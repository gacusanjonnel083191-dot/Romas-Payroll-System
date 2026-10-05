import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { outletMovementSummary, projectedOutletBalance } from '../src/crateReconciliation.js'

const invoiceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const resellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const migration = new URL('../supabase/migrations/20261005093552_reconcile_invoice_crate_handovers.sql', import.meta.url)

async function active(db) {
 const result = await db.query(`select asset_type, movement_type, direction, quantity::integer as quantity
   from public.crate_movements where invoice_id = $1 and is_deleted = false
   order by asset_type, movement_type`, [invoiceId])
 return result.rows
}

async function reconcile(db, values = {}) {
 const args = {
  p_invoice_id:invoiceId,
  p_crates_delivered:null,
  p_crates_collected:null,
  p_covers_delivered:null,
  p_covers_collected:null,
  p_dispatcher_name:'Dispatcher',
  p_driver_name:'Driver',
  p_recorded_by:'Test staff',
  p_notes:'Physical handover',
  ...values
 }
 const result = await db.query(`select public.crate_reconcile_invoice_handovers(
  $1,$2,$3,$4,$5,$6,$7,$8,$9) as result`, Object.values(args))
 return result.rows[0].result
}

test('invoice crate reconciliation is atomic, idempotent, and handles zero corrections', async () => {
 const db = new PGlite()
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
   create function public.business_control_has_role(text[]) returns boolean language sql as $$ select true $$;
   create table public.delivery_invoices (
    id uuid primary key, reseller_id uuid, reseller_name text, invoice_number text,
    delivery_date date, status text, customer_type text, container_type text, crates_used numeric
   );
   create table public.crate_movements (
    id uuid primary key default gen_random_uuid(), movement_date date not null,
    related_delivery_date date, reseller_id uuid, reseller_name text not null default '',
    invoice_id uuid, invoice_number text not null default '', movement_type text not null,
    direction text not null, quantity numeric not null, asset_type text not null,
    dispatcher_name text not null default '', driver_name text not null default '',
    recorded_by text not null default '', notes text not null default '',
    is_deleted boolean not null default false, created_at timestamptz not null default now()
   );`)
  await db.exec(await readFile(migration, 'utf8'))
  await db.query(`insert into public.delivery_invoices values ($1,$2,'Outlet','INV-1','2026-10-05','delivered','reseller','Crates',5)`, [invoiceId,resellerId])

  assert.equal((await reconcile(db, { p_crates_delivered:5 })).changed, true)
  assert.deepEqual(await active(db), [{ asset_type:'crate', movement_type:'settlement_dispatch', direction:'out', quantity:5 }])
  assert.equal((await reconcile(db, { p_crates_delivered:5 })).changed, false)
  assert.equal((await active(db)).length, 1)

  await reconcile(db, { p_crates_delivered:3, p_crates_collected:2, p_covers_delivered:1 })
  assert.deepEqual(await active(db), [
   { asset_type:'cover', movement_type:'settlement_dispatch', direction:'out', quantity:1 },
   { asset_type:'crate', movement_type:'settlement_collection', direction:'in', quantity:2 },
   { asset_type:'crate', movement_type:'settlement_dispatch', direction:'out', quantity:3 }
  ])
  assert.equal((await db.query('select crates_used::integer as value from public.delivery_invoices where id=$1',[invoiceId])).rows[0].value,3)
  const handovers = (await db.query('select reseller_id, movement_date, movement_type, direction, quantity, asset_type, is_deleted from public.crate_movements where invoice_id=$1',[invoiceId])).rows
  const baseline = { status:'approved', reseller_id:resellerId, count_date:'2026-10-04', crate_qty:4, cover_qty:0 }
  assert.equal(projectedOutletBalance(baseline, handovers, 'crate').expected,5)
  assert.deepEqual(outletMovementSummary(resellerId, handovers, baseline).ledgerNet, { crates:1, covers:1 })

  await reconcile(db, { p_crates_delivered:0, p_crates_collected:0, p_covers_delivered:0, p_covers_collected:0 })
  assert.deepEqual(await active(db), [])
  assert.equal((await db.query('select crates_used::integer as value from public.delivery_invoices where id=$1',[invoiceId])).rows[0].value,0)
  assert.ok((await db.query('select count(*)::integer as count from public.crate_movements where invoice_id=$1 and is_deleted=true',[invoiceId])).rows[0].count >= 4)
  assert.equal((await reconcile(db, { p_crates_delivered:0, p_crates_collected:0, p_covers_delivered:0, p_covers_collected:0 })).changed,false)
  const retries = await Promise.all([reconcile(db, { p_crates_delivered:2 }), reconcile(db, { p_crates_delivered:2 })])
  assert.equal(retries.filter(row=>row.changed).length,1)
  assert.deepEqual(await active(db), [{ asset_type:'crate', movement_type:'settlement_dispatch', direction:'out', quantity:2 }])
  await assert.rejects(reconcile(db, { p_crates_delivered:-1 }), /negative/)
  await db.exec('set role anon')
  await assert.rejects(reconcile(db, { p_crates_delivered:2 }), /permission denied/)
  await db.exec('reset role')
 } finally { await db.close() }
})
