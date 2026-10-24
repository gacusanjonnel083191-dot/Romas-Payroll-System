import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261024002147_customer_order_paid_sales.sql', import.meta.url), 'utf8')
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const order = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

async function database() {
  const db = new PGlite()
  await db.exec(`
    create role service_role;
    create role authenticated;
    create role anon;
    create table public.admin_users (id uuid primary key, role text not null, is_active boolean not null);
    create table public.customer_orders (
      id uuid primary key, order_code text not null, customer_name text not null,
      total numeric(12,2) not null, status text not null,
      payment_status text not null default 'unpaid', paid_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create table public.daily_sales_online_payments (
      id uuid primary key default gen_random_uuid(), payment_date date not null,
      sales_channel text not null, payment_method text not null,
      reference_number text, customer_name text, amount numeric(12,2) not null,
      notes text, recorded_by text, status text not null,
      count_as_revenue boolean, receipt_already_counted boolean
    );
    create table public.customer_order_events (
      id bigint generated always as identity primary key, order_id uuid,
      actor text, actor_admin_user_id uuid, old_status text,
      new_status text, note text
    );
    grant usage on schema public to service_role, authenticated;
    grant select on public.admin_users to service_role;
    grant select, update on public.customer_orders to service_role;
    grant select, insert on public.daily_sales_online_payments to service_role;
    grant insert on public.customer_order_events to service_role;
    grant usage on sequence public.customer_order_events_id_seq to service_role;
  `)
  await db.exec(migration)
  await db.query('insert into public.admin_users values ($1,$2,true)', [actor, 'owner'])
  await db.query('insert into public.customer_orders (id,order_code,customer_name,total,status) values ($1,$2,$3,$4,$5)', [order, 'RD-2026-TEST00000001', 'Test customer', '156.00', 'ready'])
  return db
}

test('a confirmed cash order posts one paid online sale and retries reuse it', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    const first = await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'Cash',null,actor])
    const retry = await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'Cash',null,actor])
    assert.equal(first.rows[0].reused, false)
    assert.equal(retry.rows[0].reused, true)
    assert.equal(retry.rows[0].sale_id, first.rows[0].sale_id)
    const ledger = await db.query('select amount,payment_method,customer_order_id,count_as_revenue from public.daily_sales_online_payments')
    assert.deepEqual(ledger.rows.map(row=>[row.amount,row.payment_method,row.customer_order_id,row.count_as_revenue]), [['156.00','Cash',order,true]])
    const saved = await db.query('select payment_status,paid_at from public.customer_orders where id=$1', [order])
    assert.equal(saved.rows[0].payment_status, 'paid')
    assert.ok(saved.rows[0].paid_at)
    await assert.rejects(db.query("update public.customer_orders set status='cancelled' where id=$1", [order]), /refund workflow/)
    await assert.rejects(db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'GCash','ref',actor]), /different payment details/)
  } finally { await db.close() }
})

test('invalid or unaccepted payment cannot post revenue', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    await assert.rejects(db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'GCash',null,actor]), /reference is required/)
    await db.exec('reset role')
    await db.query("update public.customer_orders set status='pending_confirmation' where id=$1", [order])
    await db.exec('set role service_role')
    await assert.rejects(db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'Cash',null,actor]), /accepted before payment/)
    const rows = await db.query('select count(*)::integer as count from public.daily_sales_online_payments')
    assert.equal(rows.rows[0].count, 0)
  } finally { await db.close() }
})

test('digital reference cannot be reused and linked sales resist direct edits', async () => {
  const db = await database()
  const secondOrder = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  try {
    await db.query('insert into public.customer_orders (id,order_code,customer_name,total,status) values ($1,$2,$3,$4,$5)', [secondOrder, 'RD-2026-TEST00000002', 'Second customer', '25.00', 'ready'])
    await db.exec('set role service_role')
    await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'GCash','GCASH-123',actor])
    await assert.rejects(db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [secondOrder,'GCash','GCASH-123',actor]), /unique constraint/)
    const second = await db.query('select payment_status from public.customer_orders where id=$1', [secondOrder])
    assert.equal(second.rows[0].payment_status, 'unpaid')
    await db.exec('reset role')
    await db.exec('grant select, update, delete on public.daily_sales_online_payments to authenticated')
    await db.exec('set role authenticated')
    await assert.rejects(db.query("update public.daily_sales_online_payments set status='void' where customer_order_id=$1", [order]), /ordering service/)
    await assert.rejects(db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [secondOrder,'Cash',null,actor]), /permission denied/)
  } finally { await db.close() }
})
