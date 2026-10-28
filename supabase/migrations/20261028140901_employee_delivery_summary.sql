-- Read-only names-only delivery access for the two verified employee accounts.
-- Uses existing opaque employee sessions, including expiry and active-employee checks.
create or replace function public.employee_delivery_summary(
  p_session_token uuid, p_delivery_date date
) returns table(outlet_name text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_employee_id uuid;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  if v_employee_id not in (
    '8dad9f5c-3228-416f-8d1c-ddc8c8abfd61'::uuid,
    '8587695c-fcc0-4875-b52a-95625985d477'::uuid
  ) then
    raise exception 'Delivery summary access is not enabled for this employee.' using errcode = '42501';
  end if;
  if p_delivery_date is null then
    raise exception 'Choose a delivery date.' using errcode = '22004';
  end if;
  return query
  select distinct names.name
  from (
    select coalesce(nullif(btrim(r.name), ''), nullif(btrim(i.reseller_name), '')) as name
    from public.delivery_invoices i
    left join public.resellers r on r.id = i.reseller_id
    where i.delivery_date = p_delivery_date
      and (i.reseller_id is not null or lower(coalesce(i.customer_type, 'reseller')) = 'reseller')
      and lower(coalesce(i.status, '')) not in ('cancelled','canceled','void','voided','deleted','rejected')
      and lower(coalesce(i.delivery_status, '')) not in ('cancelled','canceled','void','voided','deleted','rejected')
      and i.voided_at is null
    union all
    select coalesce(nullif(btrim(r.name), ''), nullif(btrim(o.reseller_name), ''))
    from public.reseller_orders o
    left join public.resellers r on r.id = o.reseller_id
    where o.delivery_date = p_delivery_date
      and lower(o.status) in ('pending','approved')
      -- Linked orders are represented by their invoice, so voiding or moving
      -- that invoice cannot leave an obsolete delivery in this list.
      and o.invoice_id is null
  ) names
  where names.name is not null
  order by names.name;
end;
$$;
revoke all on function public.employee_delivery_summary(uuid,date) from public;
grant execute on function public.employee_delivery_summary(uuid,date) to anon, authenticated;
notify pgrst, 'reload schema';
