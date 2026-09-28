-- Rolling physical crate counts. No historical crate movements are rewritten.
create table if not exists public.crate_physical_counts (
  id uuid primary key default gen_random_uuid(),
  location_type text not null check (location_type in ('outlet','bakery','vehicle')),
  reseller_id uuid references public.resellers(id),
  location_label text not null default '',
  count_date date not null,
  crate_qty integer not null check (crate_qty >= 0),
  cover_qty integer not null check (cover_qty >= 0),
  counted_by_name text not null,
  confirmation_reference text not null,
  notes text not null default '',
  submitted_by uuid not null default auth.uid(),
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text not null default '',
  constraint crate_count_location_check check (
    (location_type = 'outlet' and reseller_id is not null and location_label = '') or
    (location_type = 'bakery' and reseller_id is null and location_label = 'Bakery') or
    (location_type = 'vehicle' and reseller_id is null and length(btrim(location_label)) >= 2)
  ),
  constraint crate_count_day_check check (count_date <= (now() at time zone 'Asia/Manila')::date),
  constraint crate_count_reference_check check (length(btrim(counted_by_name)) >= 2 and length(btrim(confirmation_reference)) >= 3)
);

create index if not exists crate_physical_counts_location_idx
  on public.crate_physical_counts (location_type, reseller_id, count_date desc, submitted_at desc);

alter table public.crate_physical_counts enable row level security;
revoke all on public.crate_physical_counts from public, anon, authenticated;
grant select, insert on public.crate_physical_counts to authenticated;

drop policy if exists crate_counts_admin_read on public.crate_physical_counts;
create policy crate_counts_admin_read on public.crate_physical_counts
  for select to authenticated
  using (public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));

drop policy if exists crate_counts_staff_submit on public.crate_physical_counts;
create policy crate_counts_staff_submit on public.crate_physical_counts
  for insert to authenticated
  with check (
    public.business_control_has_role(array['owner','manager','supervisor','asst_supervisor'])
    and submitted_by = auth.uid() and status = 'pending'
    and reviewed_by is null and reviewed_at is null
  );

-- The reviewer cannot edit a submitted quantity. A corrected count is a new row.
create or replace function public.crate_review_physical_count(
  p_count_id uuid, p_approve boolean, p_notes text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.crate_physical_counts%rowtype;
begin
  if not public.business_control_has_role(array['owner']) then
    raise exception 'Owner approval required';
  end if;
  select * into v_row from public.crate_physical_counts where id = p_count_id for update;
  if not found or v_row.status <> 'pending' then
    raise exception 'Count is missing or has already been reviewed';
  end if;
  if not p_approve and length(btrim(coalesce(p_notes,''))) < 3 then
    raise exception 'A rejection reason is required';
  end if;
  update public.crate_physical_counts
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(), reviewed_at = now(), review_notes = coalesce(p_notes,'')
    where id = p_count_id;
end;
$$;
revoke all on function public.crate_review_physical_count(uuid, boolean, text) from public, anon;
grant execute on function public.crate_review_physical_count(uuid, boolean, text) to authenticated;

-- The existing movement ledger was exposed to the anonymous Data API. The app's
-- authenticated admin workflow is the only client path that should access it.
alter table public.crate_movements enable row level security;
revoke all on public.crate_movements from public, anon, authenticated;
grant select, insert on public.crate_movements to authenticated;
grant update (is_deleted, notes) on public.crate_movements to authenticated;

drop policy if exists crate_movements_staff_read on public.crate_movements;
create policy crate_movements_staff_read on public.crate_movements
  for select to authenticated
  using (public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));

drop policy if exists crate_movements_staff_insert on public.crate_movements;
create policy crate_movements_staff_insert on public.crate_movements
  for insert to authenticated
  with check (public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));

-- Existing one-click invoice settlement soft-replaces its own movement rows.
drop policy if exists crate_movements_settlement_replace on public.crate_movements;
create policy crate_movements_settlement_replace on public.crate_movements
  for update to authenticated
  using (public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']))
  with check (public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));
