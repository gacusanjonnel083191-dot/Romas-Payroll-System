import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

const migration = readFileSync(new URL('../supabase/migrations/20261029090000_customer_ordering_control.sql', import.meta.url), 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const viewer = '22222222-2222-4222-8222-222222222222'

test('only full-access staff can open or close ordering; each change is audited', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.admin_users(id uuid primary key, auth_user_id uuid, full_name text, is_active boolean);
      create table public.customer_order_staff_permissions(admin_user_id uuid primary key, access_level text);
      create table public.customer_orders(id uuid primary key);`)
    await db.exec(migration)
    const state = async () => (await db.query('select enabled,version from public.customer_ordering_control')).rows[0]
    const setState = (actor, version, enabled) => db.query(
      'select public.customer_set_ordering_enabled($1::uuid,$2::bigint,$3::boolean) as changed',
      [actor,version,enabled],
    )
    assert.deepEqual(await state(), {enabled:false,version:0})
    await assert.rejects(db.query('insert into public.customer_orders(id) values ($1::uuid)', [owner]), /ordering is closed/i)
    await db.query('insert into public.admin_users values ($1::uuid,$2::uuid,$3,true),($4::uuid,$5::uuid,$6,true)',
      [owner,owner,'Jonnel Gacusan',viewer,viewer,'Francis Galleto'])
    await db.query("insert into public.customer_order_staff_permissions values ($1::uuid,'full'),($2::uuid,'view')",[owner,viewer])

    await db.exec('set role service_role')
    assert.equal((await setState(viewer,0,true)).rows[0].changed,false)
    assert.equal((await setState(owner,0,true)).rows[0].changed,true)
    assert.equal((await setState(owner,0,true)).rows[0].changed,false)
    await db.exec('reset role')
    assert.deepEqual(await state(), {enabled:true,version:1})
    await db.query('insert into public.customer_orders(id) values ($1::uuid)',[owner])

    await db.exec('set role service_role')
    assert.equal((await setState(owner,1,false)).rows[0].changed,true)
    await db.exec('reset role')
    await assert.rejects(db.query('insert into public.customer_orders(id) values ($1::uuid)', [viewer]), /ordering is closed/i)
    assert.deepEqual(await state(), {enabled:false,version:2})
    const {rows:events} = await db.query('select actor_name,old_enabled,new_enabled from public.customer_ordering_control_events order by id')
    assert.deepEqual(events,[
      {actor_name:'Jonnel Gacusan',old_enabled:false,new_enabled:true},
      {actor_name:'Jonnel Gacusan',old_enabled:true,new_enabled:false},
    ])
    await db.exec('set role anon')
    try {
      await assert.rejects(setState(owner,2,true), /permission denied/i)
      await assert.rejects(db.query('select * from public.customer_ordering_control'), /permission denied/i)
    } finally {await db.exec('reset role')}
  } finally {await db.close()}
})
