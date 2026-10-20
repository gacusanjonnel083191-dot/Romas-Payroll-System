import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { isSagsTransferSchemaMissing, sagsTransfersAsForecastDeliveries } from '../src/sagsTransferForecast.js'
import { filterProductionForecastInvoices } from '../src/productionForecastPolicy.js'

test('an unapplied transfer migration keeps the existing invoice forecast available', () => {
  assert.equal(isSagsTransferSchemaMissing({ code:'PGRST205', message:"Could not find the table 'public.sags_internal_transfers' in the schema cache" }), true)
  assert.equal(isSagsTransferSchemaMissing({ code:'42P01', message:'relation "sags_internal_transfers" does not exist' }), true)
  assert.equal(isSagsTransferSchemaMissing({ code:'42501', message:'permission denied for sags_internal_transfers' }), false)
  assert.equal(isSagsTransferSchemaMissing({ code:'PGRST205', message:'Could not find another table' }), false)
})

test('SAGS transfer quantities contribute to production planning without a financial amount', () => {
  const rows = sagsTransfersAsForecastDeliveries([{ id:'t1',transfer_number:'SAGS-TR-1',delivery_date:'2026-10-21',
    sags_internal_transfer_items:[{ variant_id:'v1',variant_name:'Rings',quantity:40 }] }], 'sags-outlet')
  assert.equal(rows[0].total_amount, 0)
  assert.equal(rows[0].delivery_invoice_items[0].quantity, 40)
  assert.equal(filterProductionForecastInvoices(rows,'2026-10-21').length, 1)
  assert.equal(filterProductionForecastInvoices(rows,'2026-10-22').length, 0)
})

test('SAGS delivery is a stock transfer, with actual receipt posted once and no sales or receivable', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $$;
      create function public.business_control_has_role(allowed_roles text[]) returns boolean language sql stable
        as $$ select current_setting('app.test_role', true) = any(allowed_roles) $$;
      create table public.donut_variants(id uuid primary key, name text not null);
      create table public.pos_products(id text primary key, product_name text not null, outlet_id text, category text,
        stock numeric default 0, sku text, barcode text);
      create table public.pos_inventory_movements(id bigserial primary key, outlet_id text, product_id text, sku text,
        barcode text, product_name text, movement_type text, qty numeric, reference_no text, remarks text, created_by text);
      create table public.resellers(id uuid primary key, name text not null);
      create table public.delivery_invoices(id uuid primary key default gen_random_uuid(), reseller_id uuid, total_amount numeric, delivery_date date, status text);
      create table public.daily_sales(id uuid primary key default gen_random_uuid(), total_revenue numeric);
    `)
    const migration = await readFile(new URL('../supabase/migrations/20261020113000_sags_internal_transfers.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(`
      select set_config('app.test_role','owner',false);
      insert into public.donut_variants values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Rings'),('cccccccc-cccc-cccc-cccc-cccccccccccc','Shells');
      insert into public.pos_products(id,product_name,outlet_id,category,stock) values
        ('P016','Rings','OUTLET-MALUED','Donuts',5),('P017','Shells','OUTLET-MALUED','Donuts',3);
      insert into public.resellers values('dddddddd-dddd-dddd-dddd-dddddddddddd','SAGS');
    `)
    const transferId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    const items = JSON.stringify([
      { variant_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', pos_product_id:'P016', quantity:10 },
      { variant_id:'cccccccc-cccc-cccc-cccc-cccccccccccc', pos_product_id:'P017', quantity:4 }
    ])
    const call = `select public.create_sags_internal_transfer('${transferId}',(now() at time zone 'Asia/Manila')::date,'Dispatcher','', '${items}'::jsonb)`
    await db.query(call)
    await db.query(call)
    const before = await db.query('select id,quantity from public.sags_internal_transfer_items order by quantity desc')
    assert.deepEqual(before.rows.map(row => row.quantity), [10, 4])
    const dateCheck = await db.query('select count(*)::int as total from public.sags_internal_transfers')
    assert.equal(dateCheck.rows[0].total, 1)
    const actual = JSON.stringify(before.rows.map(row => ({ id:row.id, quantity:row.quantity === 10 ? 8 : 4 })))
    await assert.rejects(db.query(`select public.receive_sags_internal_transfer('${transferId}','Receiver','${actual}'::jsonb,'')`), /Explain the delivery quantity difference/)
    const receive = `select public.receive_sags_internal_transfer('${transferId}','Receiver','${actual}'::jsonb,'Two pieces missing')`
    await db.query(receive)
    await db.query(receive)
    const stocks = await db.query('select stock from public.pos_products order by id')
    assert.deepEqual(stocks.rows.map(row => Number(row.stock)), [13, 7])
    const movements = await db.query('select qty from public.pos_inventory_movements order by product_id')
    assert.deepEqual(movements.rows.map(row => Number(row.qty)), [8, 4])
    const values = await db.query('select status,receipt_notes from public.sags_internal_transfers')
    assert.equal(values.rows[0].status, 'received')
    assert.equal(values.rows[0].receipt_notes, 'Two pieces missing')
    const financial = await db.query('select (select count(*) from public.delivery_invoices)::int as invoices,(select count(*) from public.daily_sales)::int as sales')
    assert.deepEqual(financial.rows[0], { invoices:0, sales:0 })
    await assert.rejects(db.query("insert into public.delivery_invoices(reseller_id,total_amount) values('dddddddd-dddd-dddd-dddd-dddddddddddd',100)"), /Internal Transfers/)
    await db.exec('drop trigger guard_new_sags_reseller_invoice on public.delivery_invoices')
    await db.query("insert into public.delivery_invoices(reseller_id,total_amount,delivery_date,status) values('dddddddd-dddd-dddd-dddd-dddddddddddd',100,current_date+1,'delivered')")
    await assert.rejects(db.query(`select public.create_sags_internal_transfer('ffffffff-ffff-ffff-ffff-ffffffffffff',current_date+1,'','', '${items}'::jsonb)`), /invoice already exists/)
    await db.exec("select set_config('app.test_role','pos_admin',false)")
    await assert.rejects(db.query(`select public.create_sags_internal_transfer('ffffffff-ffff-ffff-ffff-ffffffffffff',(now() at time zone 'Asia/Manila')::date,'','', '${items}'::jsonb)`), /requires Owner/)
    await db.exec('grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; set role authenticated')
    const visible = await db.query('select count(*)::int as total from public.sags_internal_transfers')
    assert.equal(visible.rows[0].total, 1)
    await assert.rejects(db.query("insert into public.sags_internal_transfers(transfer_number,delivery_date,created_by) values('FAKE',current_date,auth.uid())"), /permission denied/)
    await db.exec("select set_config('app.test_role','payroll',false)")
    const hidden = await db.query('select count(*)::int as total from public.sags_internal_transfers')
    assert.equal(hidden.rows[0].total, 0)
  } finally { await db.close() }
})
