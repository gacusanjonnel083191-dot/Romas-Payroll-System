import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261024042701_secure_online_payment_ledger.sql', import.meta.url), 'utf8')
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const supervisor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('payment ledger denies anonymous access and limits staff to approved sales roles', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.admin_users (
        auth_user_id uuid primary key, role text not null,
        extra_roles text, is_active boolean not null
      );
      alter table public.admin_users enable row level security;
      create policy "admin users can read own active profile" on public.admin_users
        for select to authenticated
        using (auth.uid() = auth_user_id and is_active);
      grant select on public.admin_users to authenticated;
      create function public.business_control_has_role(allowed_roles text[])
        returns boolean language sql stable security definer set search_path to public as $$
        select exists (
          select 1 from public.admin_users au
          where au.auth_user_id = auth.uid() and au.is_active
            and (lower(au.role) = any(allowed_roles) or exists (
              select 1 from unnest(regexp_split_to_array(lower(coalesce(au.extra_roles,'')), '\\s*,\\s*')) extra_role
              where extra_role = any(allowed_roles)
            ))
        )
      $$;
      create table public.daily_sales_online_payments (
        id uuid primary key default gen_random_uuid(), amount numeric not null,
        customer_name text
      );
      alter table public.daily_sales_online_payments enable row level security;
      create policy "Allow app access to daily sales online payments"
        on public.daily_sales_online_payments for all to public
        using (true) with check (true);
      grant usage on schema public to anon, authenticated, service_role;
      grant select, insert, update, delete on public.daily_sales_online_payments to public;
      grant select, insert, update on public.daily_sales_online_payments to service_role;
    `)
    await db.query('insert into public.admin_users values ($1,$2,null,true),($3,$4,null,true)', [owner, 'owner', supervisor, 'supervisor'])
    await db.exec(migration)

    await db.exec('set role anon')
    assert.equal((await db.query("select has_table_privilege('anon','public.daily_sales_online_payments','SELECT') as allowed")).rows[0].allowed, false)
    await assert.rejects(db.query('select * from public.daily_sales_online_payments'), /permission denied/)
    await assert.rejects(db.query("insert into public.daily_sales_online_payments(amount) values(25)"), /permission denied/)

    await db.exec('set role authenticated')
    await db.exec(`select set_config('request.jwt.claim.sub','${supervisor}',false)`)
    assert.equal((await db.query('select count(*)::integer as n from public.daily_sales_online_payments')).rows[0].n, 0)
    await assert.rejects(db.query("insert into public.daily_sales_online_payments(amount) values(25)"), /row-level security policy/)

    await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`)
    await db.query("insert into public.daily_sales_online_payments(amount,customer_name) values(25,'Test customer')")
    assert.equal((await db.query('select count(*)::integer as n from public.daily_sales_online_payments')).rows[0].n, 1)
    await assert.rejects(db.query('delete from public.daily_sales_online_payments'), /permission denied/)

    await db.exec(`select set_config('request.jwt.claim.sub','${supervisor}',false)`)
    assert.equal((await db.query('select count(*)::integer as n from public.daily_sales_online_payments')).rows[0].n, 0)

    await db.exec('reset role')
    await db.query("update public.admin_users set role='manager' where auth_user_id=$1", [supervisor])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select count(*)::integer as n from public.daily_sales_online_payments')).rows[0].n, 1)
    await db.query("insert into public.daily_sales_online_payments(amount) values(30)")

    await db.exec('reset role')
    await db.query('update public.admin_users set is_active=false where auth_user_id=$1', [supervisor])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select count(*)::integer as n from public.daily_sales_online_payments')).rows[0].n, 0)
    await assert.rejects(db.query("insert into public.daily_sales_online_payments(amount) values(40)"), /row-level security policy/)

    await db.exec('set role service_role')
    assert.equal((await db.query('select count(*)::integer as n from public.daily_sales_online_payments')).rows[0].n, 2)
    await db.query("insert into public.daily_sales_online_payments(amount) values(40)")
  } finally {
    await db.close()
  }
})
