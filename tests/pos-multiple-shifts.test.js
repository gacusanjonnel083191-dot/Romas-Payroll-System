import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { dailyPosClosing, posClosingReceipts } from '../src/posClosingSummary.js'
import { buildOwnerDailyReceipts } from '../src/ownerDailyReceipts.js'

const fixture = name => readFile(new URL(`./fixtures/pos-closing-baseline/${name}.sql`, import.meta.url), 'utf8')
test('two shifts close on the same day without replacing the earlier closing; daily summary remains unique', async () => {
  const db = new PGlite()
  try {
    await db.exec(await fixture('schema'))
    await db.exec(`create schema auth;
      create function auth.uid() returns uuid language sql as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
      create unique index pos_shift_closings_shift_id_uidx on pos_shift_closings(shift_id) where shift_id is not null;
      create unique index pos_shift_closings_outlet_business_date_uidx on pos_shift_closings(outlet_id,business_date);
      insert into admin_users(auth_user_id,full_name,email,role,extra_roles,is_active)
        values ('11111111-1111-4111-8111-111111111111','Test Owner','test@example.invalid','owner','',true);
      insert into pos_shifts(id,outlet_id,status,starting_cash,cashier_name) values ('empty','TEST','open',0,'Test'),('active','TEST','open',2000,'Test');`)
    await db.exec(await fixture('pos_close_shift_atomic'))
    await db.exec(await fixture('pos_finalize_shift_closing'))
    await db.exec(`create function run_business_integrity_audit(p_from date,p_to date) returns jsonb language plpgsql as $$
declare v_from date:=p_from; v_to date:=p_to; v_yesterday date:=p_from; n int;
begin
  select count(*) into n
  from public.pos_shift_closings c
  where c.business_date between v_from and v_to;
  return jsonb_build_object('n',n,'pos_cash_variance',(select coalesce(sum(abs(cash_variance)),0) from public.pos_shift_closings where business_date=v_yesterday));
end; $$;`)
    await db.query(`select * from pos_close_shift_atomic('TEST','empty',0,'Empty shift','Test')`)
    const before = (await db.query(`select * from pos_shift_closings where shift_id='empty'`)).rows[0]
    await db.exec(`insert into pos_sales(id,shift_id,outlet_id,business_date,net_total,payment_method,status,receipt_no)
      values ('sale','active','TEST',current_date,1774.70,'Cash','completed','TEST-1');
      insert into pos_sale_items(sale_id,product_id,qty) values ('sale','product',1);
      insert into pos_inventory_movements(outlet_id,reference_no,product_id,qty,movement_type) values ('TEST','TEST-1','product',-1,'sale');`)
    await assert.rejects(db.query(`select * from pos_close_shift_atomic('TEST','active',2157,'Counted','Test')`), /unique constraint/)
    assert.equal((await db.query(`select status from pos_shifts where id='active'`)).rows[0].status,'open')
    await db.exec(await readFile(new URL('../supabase/migrations/20261015133003_allow_multiple_pos_shifts_per_day.sql',import.meta.url),'utf8'))
    const result = (await db.query(`select * from pos_close_shift_atomic('TEST','active',2157,'Counted','Test')`)).rows[0]
    assert.equal(Number(result.expected_cash),3774.7)
    assert.equal(Number(result.variance),-1617.7)
    assert.equal((await db.query(`select status from pos_shifts where id='active'`)).rows[0].status,'closed')
    assert.deepEqual((await db.query(`select * from pos_shift_closings where shift_id='empty'`)).rows[0],before)
    await assert.rejects(db.exec(`insert into pos_shift_closings(shift_id,outlet_id,business_date) values ('active','TEST',current_date)`),/unique constraint/)
    await db.query(`select pos_finalize_shift_closing('TEST',current_date,2000,2157,'Test Owner')`)
    await db.query(`select pos_finalize_shift_closing('TEST',current_date,2000,2157,'Test Owner')`)
    assert.equal((await db.query(`select count(*)::int n from pos_shift_closings where shift_id is null`)).rows[0].n,1)
    assert.equal((await db.query(`select count(*)::int n from daily_sales`)).rows[0].n,1)
    assert.deepEqual((await db.query(`select * from pos_shift_closings where shift_id='empty'`)).rows[0],before)
    const audit = (await db.query(`select run_business_integrity_audit(current_date,current_date) result`)).rows[0].result
    assert.equal(audit.n,2)
    assert.equal(audit.pos_cash_variance,1617.7)
    await db.exec(`update admin_users set role='employee'`)
    await assert.rejects(db.query(`select pos_finalize_shift_closing('TEST',current_date,2000,2157,'Test Owner')`),/SHIFT_CLOSING_ROLE_BLOCKED/)
  } finally { await db.close() }
})

test('daily monitor aggregates shifts and owner receipts exclude a duplicate daily summary', () => {
  const base = { outlet_id:'TEST',business_date:'2026-10-15',created_at:'2026-10-15T09:00:00Z',gcash_sales:0,online_sales:0 }
  const rows = [
    {...base,id:'first',shift_id:'first',cash_sales:0,total_sales:0,opening_cash:0,actual_cash:0,transaction_count:0},
    {...base,id:'second',shift_id:'second',cash_sales:1774.7,total_sales:1774.7,opening_cash:2000,actual_cash:2157,expected_cash:3774.7,cash_variance:-1617.7,transaction_count:1}
  ]
  assert.equal(dailyPosClosing(rows).total_sales,1774.7)
  assert.equal(dailyPosClosing(rows).cash_variance,-1617.7)
  const summary = {...base,id:'daily',total_sales:1774.7,cash_sales:1774.7}
  assert.equal(dailyPosClosing([summary,...rows]).id,'daily')
  assert.equal(posClosingReceipts([summary,...rows]).length,2)
  const report = buildOwnerDailyReceipts({pos_closings:[summary,...rows]},'2026-10-15')
  const once = buildOwnerDailyReceipts({pos_closings:rows},'2026-10-15')
  assert.deepEqual(report,once)
})
