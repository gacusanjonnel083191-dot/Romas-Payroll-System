import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const paidMigration = await readFile(new URL('../supabase/migrations/20261024002147_customer_order_paid_sales.sql', import.meta.url), 'utf8')
const refundMigration = await readFile(new URL('../supabase/migrations/20261026090000_customer_order_refunds.sql', import.meta.url), 'utf8')
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
      updated_at timestamptz not null default now(),
      constraint customer_orders_payment_status_check check (payment_status in ('unpaid','paid')),
      constraint customer_order_paid_at check ((payment_status = 'paid') = (paid_at is not null))
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
  await db.exec(paidMigration)
  await db.exec(refundMigration)
  await db.query('insert into public.admin_users values ($1,$2,true)', [actor, 'asst_supervisor'])
  await db.query('insert into public.customer_orders (id,order_code,customer_name,total,status) values ($1,$2,$3,$4,$5)', [order, 'RD-2026-REFUNDTEST', 'Test customer', '156.00', 'ready'])
  return db
}

test('full refund cancels an unfulfilled order and posts one negative sale', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    const payment = await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'GCash','PAY-123',actor])
    const refund = await db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'GCash','REF-123','Customer cancelled before pickup',actor])
    const retry = await db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'GCash','REF-123','Customer cancelled before pickup',actor])
    assert.equal(refund.rows[0].reused, false)
    assert.equal(retry.rows[0].reused, true)
    assert.equal(retry.rows[0].refund_id, refund.rows[0].refund_id)
    const rows = await db.query('select id,amount,refund_of_payment_id,sales_channel from public.daily_sales_online_payments order by amount desc')
    assert.deepEqual(rows.rows.map(row=>[row.amount,row.refund_of_payment_id,row.sales_channel]),
      [['156.00',null,'Website Order'],['-156.00',payment.rows[0].sale_id,'Website Order Refund']])
    const saved = await db.query('select status,payment_status,paid_at,refunded_at from public.customer_orders where id=$1', [order])
    assert.equal(saved.rows[0].status, 'cancelled')
    assert.equal(saved.rows[0].payment_status, 'refunded')
    assert.ok(saved.rows[0].paid_at)
    assert.ok(saved.rows[0].refunded_at)
    const net = await db.query('select sum(amount) as revenue from public.daily_sales_online_payments where status=$1 and count_as_revenue=true', ['active'])
    assert.equal(net.rows[0].revenue, '0.00')
    await assert.rejects(db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'Cash',null,'Different refund attempt',actor]), /already refunded/)
  } finally { await db.close() }
})

test('refund needs a paid order, a reason, and a digital reference', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    await assert.rejects(db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'Cash',null,'Customer cancelled',actor]), /matching active sale/)
    await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'Cash',null,actor])
    await assert.rejects(db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'GCash',null,'Customer cancelled',actor]), /reference is required/)
    await assert.rejects(db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'Cash',null,'short',actor]), /reason of 10 to 500/)
    await assert.rejects(db.query("update public.customer_orders set payment_status='refunded', refunded_at=now(), status='cancelled' where id=$1", [order]), /recorded refund/)
    const rows = await db.query('select count(*)::integer as count from public.daily_sales_online_payments')
    assert.equal(rows.rows[0].count, 1)
  } finally { await db.close() }
})

test('a refund reference cannot duplicate an original order payment', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'GCash','PAY-123',actor])
    await assert.rejects(db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'GCash','PAY-123','Customer cancelled before pickup',actor]), /unique constraint/)
    const saved = await db.query('select payment_status,status from public.customer_orders where id=$1', [order])
    assert.deepEqual(saved.rows[0], {payment_status:'paid',status:'ready'})
  } finally { await db.close() }
})

test('completed orders remain completed and refund rows resist direct edits', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [order,'Cash',null,actor])
    await db.query("update public.customer_orders set status='completed' where id=$1", [order])
    const refund = await db.query('select * from public.customer_refund_paid_sale($1,$2,$3,$4,$5)',
      [order,'Cash',null,'Quality issue after delivery',actor])
    const saved = await db.query('select status,payment_status from public.customer_orders where id=$1', [order])
    assert.deepEqual(saved.rows[0], {status:'completed',payment_status:'refunded'})
    await db.exec('reset role')
    await db.exec('grant select, update, delete on public.daily_sales_online_payments to authenticated')
    await db.exec('set role authenticated')
    await assert.rejects(db.query('delete from public.daily_sales_online_payments where id=$1', [refund.rows[0].refund_id]), /ordering service/)
    await assert.rejects(db.query("update public.daily_sales_online_payments set amount=0 where id=$1", [refund.rows[0].refund_id]), /ordering service/)
  } finally { await db.close() }
})
