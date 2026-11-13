import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration = fs.readFileSync(new URL('../supabase/migrations/20261113021925_payroll_draft_undo_snapshots.sql',import.meta.url),'utf8')
const owner='00000000-0000-0000-0000-000000000001'
const employee='00000000-0000-0000-0000-000000000002'
const record='00000000-0000-0000-0000-000000000003'

test('audited undo snapshots rows atomically, blocks direct deletes, and preserves approved payroll',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function public.business_control_has_role(text[]) returns boolean language sql stable as $$select true$$;
      create table public.payroll_records (
        id uuid primary key, employee_id uuid not null, employee_code text,
        payroll_start date, payroll_end date, payroll_status text,
        payroll_approved boolean default false, payroll_locked boolean default false,
        payroll_released boolean default false, approved_at timestamptz, approved_by text,
        total_earnings numeric, total_deductions numeric, net_pay numeric
      );
      create table public.payroll_periods (payroll_start text,payroll_end text,payroll_status text);
      create table public.payslip_disputes (payroll_start text,payroll_end text,status text,admin_reason text);
      grant usage on schema public,auth to authenticated;
      grant all on public.payroll_records,public.payroll_periods,public.payslip_disputes to authenticated;
      grant execute on function auth.uid(),public.business_control_has_role(text[]) to authenticated;
    `)
    await db.exec(migration)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
    await db.query(`insert into public.payroll_records(id,employee_id,employee_code,payroll_start,payroll_end,payroll_status,total_earnings,total_deductions,net_pay)
      values($1,$2,'EMP-001','2026-10-26','2026-11-10','draft',1000,200,800)`,[record,employee])
    await db.exec("insert into public.payroll_periods values('2026-10-26','2026-11-10','draft')")
    await db.exec('set role authenticated')
    await assert.rejects(db.exec("delete from public.payroll_records where payroll_start='2026-10-26'"),/audited undo_payroll_draft/)
    await assert.rejects(db.query("select public.undo_payroll_draft('2026-10-26','2026-11-10',2)"),/row count changed/)
    const result=await db.query("select public.undo_payroll_draft('2026-10-26','2026-11-10',1) as batch_id")
    assert.ok(result.rows[0].batch_id)
    assert.equal((await db.query('select count(*)::int as n from public.payroll_records')).rows[0].n,0)
    const snapshot=(await db.query('select batch_id,payroll_record,payroll_period from public.payroll_draft_undo_snapshots')).rows[0]
    assert.equal(snapshot.batch_id,result.rows[0].batch_id)
    assert.equal(snapshot.payroll_record.net_pay,800)
    assert.equal(snapshot.payroll_period.payroll_status,'draft')
    await db.exec('reset role')
    await db.query(`insert into public.payroll_records(id,employee_id,employee_code,payroll_start,payroll_end,payroll_status,total_earnings,total_deductions,net_pay)
      values($1,$2,'EMP-001','2026-10-26','2026-11-10','draft',1000,200,800)`,[record,employee])
    const sameInputs=(await db.query("select to_jsonb(payroll_records) as row from public.payroll_records where employee_code='EMP-001'")).rows[0].row
    assert.deepEqual(sameInputs,snapshot.payroll_record)
    await db.exec('set role authenticated')
    const secondUndo=await db.query("select public.undo_payroll_draft('2026-10-26','2026-11-10',1) as batch_id")
    assert.notEqual(secondUndo.rows[0].batch_id,result.rows[0].batch_id)
    assert.equal((await db.query('select count(*)::int as n from public.payroll_draft_undo_snapshots')).rows[0].n,2)
    await db.exec('reset role')
    await db.query(`insert into public.payroll_records(id,employee_id,employee_code,payroll_start,payroll_end,payroll_status,total_earnings,total_deductions,net_pay)
      values($1,$2,'EMP-001','2026-10-26','2026-11-10','draft',1000,100,900)`,[record,employee])
    await db.exec('set role authenticated')
    const statusBefore=(await db.query("select public.payroll_comparison_status('2026-10-26','2026-11-10') as status")).rows[0].status
    assert.equal(statusBefore.has_snapshot,true)
    assert.equal(statusBefore.reviewed,false)
    await assert.rejects(db.exec("update public.payroll_records set payroll_approved=true where employee_code='EMP-001'"),/requires owner comparison acknowledgement/)
    await db.query("select public.acknowledge_payroll_comparison('2026-10-26','2026-11-10',$1)",[secondUndo.rows[0].batch_id])
    const statusAfter=(await db.query("select public.payroll_comparison_status('2026-10-26','2026-11-10') as status")).rows[0].status
    assert.equal(statusAfter.reviewed,true)
    await db.exec("update public.payroll_records set net_pay=901 where employee_code='EMP-001'")
    const statusChanged=(await db.query("select public.payroll_comparison_status('2026-10-26','2026-11-10') as status")).rows[0].status
    assert.equal(statusChanged.reviewed,false)
    await assert.rejects(db.exec("update public.payroll_records set payroll_approved=true where employee_code='EMP-001'"),/requires owner comparison acknowledgement/)
    await db.query("select public.acknowledge_payroll_comparison('2026-10-26','2026-11-10',$1)",[secondUndo.rows[0].batch_id])
    await db.query(`insert into public.payroll_records(id,employee_id,employee_code,payroll_start,payroll_end,payroll_status,total_earnings,total_deductions,net_pay)
      values($1,$2,'EMP-002','2026-10-26','2026-11-10','draft',1200,200,1000)`,['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'])
    await assert.rejects(db.exec("update public.payroll_records set payroll_approved=true,approved_by='Owner' where payroll_start='2026-10-26'"),/requires owner comparison acknowledgement/)
    await db.query("select public.acknowledge_payroll_comparison('2026-10-26','2026-11-10',$1)",[secondUndo.rows[0].batch_id])
    await db.exec('reset role')
    await db.exec('set role authenticated')
    await db.exec("update public.payroll_records set payroll_status='approved',payroll_approved=true,approved_by='Owner' where payroll_start='2026-10-26'")
    await assert.rejects(db.query("select public.undo_payroll_draft('2026-10-26','2026-11-10',2)"),/Approved or released payroll/)
    assert.equal((await db.query('select count(*)::int as n from public.payroll_records')).rows[0].n,2)
  } finally { await db.close() }
})
