import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const sql=fs.readFileSync(new URL('../supabase/data-changes/20261026_spooky_donut_boxes.sql',import.meta.url),'utf8')
const setup=`
create table donut_variants(id uuid primary key default gen_random_uuid(),name text not null,category text,selling_price numeric,pieces_per_batch numeric,is_active boolean,normal_daily_pieces numeric,is_manufactured boolean,requires_company_delivery boolean,equivalent_unit_factor numeric,equivalent_unit_note text,cost_override_notes text);
create table pos_products(id text primary key,sku text,product_name text,category text,selling_price numeric,cost numeric,stock numeric,min_stock numeric,is_active boolean,outlet_id text,daily_tracking_mode text,standard_daily_qty numeric);
create table recipe_vault(id uuid primary key default gen_random_uuid(),recipe_code text,product_name text,product_category text,linked_variant_id uuid,batch_size_label text,batch_yield_pieces numeric,selling_price numeric,reseller_price numeric,status text,procedure text,finishing_instructions text,notes text,created_by text,updated_by text);
insert into donut_variants(name,category,selling_price,pieces_per_batch,is_active) values('Shells','Filled',26,380,true),('Rings','Regular',25,390,true);
insert into pos_products(id,product_name,category,selling_price,stock,is_active,outlet_id,daily_tracking_mode) values('P016','Rings','Donuts',25,6,true,'OUTLET-MALUED','none');`
test('catalog is idempotent, starts with zero boxes, preserves ordinary stock and leaves recipes unapproved',async()=>{
 const db=new PGlite();try{
 await db.exec(setup);await db.exec(sql);await db.exec(sql)
 const v=(await db.query("select * from donut_variants where category='Seasonal Boxes' order by selling_price")).rows
 assert.equal(v.length,2);assert.deepEqual(v.map(x=>Number(x.selling_price)),[160,315]);assert(v.every(x=>Number(x.pieces_per_batch)===1))
 const p=(await db.query("select * from pos_products where id like 'SPOOKY-%' order by selling_price")).rows
 assert.equal(p.length,2);assert(p.every(x=>Number(x.stock)===0&&x.cost===null));assert.equal(Number((await db.query("select stock from pos_products where id='P016'")).rows[0].stock),6)
 const recipes=(await db.query('select status,batch_yield_pieces,reseller_price from recipe_vault order by selling_price')).rows
 assert.deepEqual(recipes.map(x=>x.status),['test','test']);assert.deepEqual(recipes.map(x=>Number(x.reseller_price)),[128,252])
 await db.exec("update pos_products set stock=4 where selling_price=160;");await db.exec(sql)
 assert.equal(Number((await db.query("select stock from pos_products where selling_price=160")).rows[0].stock),4)
 }finally{await db.close()}
})
test('conflicting preexisting product aborts the complete catalog transaction',async()=>{
 const db=new PGlite();try{
 await db.exec(setup);await db.exec("insert into donut_variants(name,selling_price,is_active) values('Spooky Donuts - 6-piece box',1,true)")
 await assert.rejects(db.exec(sql),/differs from approved setup/);await db.exec('rollback')
 assert.equal((await db.query('select * from recipe_vault')).rows.length,0)
 assert.equal((await db.query("select * from pos_products where id like 'SPOOKY-%'")).rows.length,0)
 }finally{await db.close()}
})
