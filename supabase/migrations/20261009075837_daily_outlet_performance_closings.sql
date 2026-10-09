-- Daily outlet sell-through is a separate, informational record. It never posts
-- to daily_sales, invoices, payments, inventory, or weekly remittances.
create table public.outlet_daily_closings (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete restrict,
  business_date date not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  delivered_qty integer not null check (delivered_qty >= 0),
  sold_qty integer not null check (sold_qty >= 0),
  wastage_qty integer not null check (wastage_qty >= 0),
  sales_amount numeric(14,2) not null check (sales_amount >= 0),
  notes text,
  recorded_by text not null,
  recorded_by_uid uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint outlet_daily_closings_one_per_outlet_day unique (reseller_id, business_date)
);

create index outlet_daily_closings_date_idx on public.outlet_daily_closings (business_date desc);
alter table public.outlet_daily_closings enable row level security;
revoke all on public.outlet_daily_closings from public, anon, authenticated;
grant select, insert on public.outlet_daily_closings to authenticated;

create policy outlet_daily_closings_admin_read on public.outlet_daily_closings
  for select to authenticated
  using ((select private.cash_advance_admin_has_role(array['owner','manager']::text[])));

create policy outlet_daily_closings_admin_insert on public.outlet_daily_closings
  for insert to authenticated
  with check (
    recorded_by_uid = (select auth.uid())
    and (select private.cash_advance_admin_has_role(array['owner','manager']::text[]))
  );

comment on table public.outlet_daily_closings is
  'Immutable daily physical-count snapshots for outlet performance graphs; no financial posting.';
