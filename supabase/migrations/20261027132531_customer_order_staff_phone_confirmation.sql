-- Orders stay pending until an authorized staff member calls the customer.
alter table public.customer_orders
  add column phone_verified_at timestamptz,
  add column phone_verified_by uuid references public.admin_users(id) on delete restrict,
  add column phone_verification_method text,
  add constraint customer_order_phone_verification_complete check (
    (phone_verified_at is null and phone_verified_by is null and phone_verification_method is null)
    or (phone_verified_at is not null and phone_verified_by is not null
      and phone_verification_method = 'staff_call')
  );

create function public.customer_confirm_order_phone(
  p_order_id uuid,
  p_actor_admin_user_id uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_order_id uuid;
begin
  update public.customer_orders
  set phone_verified_at = now(), phone_verified_by = p_actor_admin_user_id,
    phone_verification_method = 'staff_call', updated_at = now()
  where id = p_order_id and status = 'pending_confirmation'
    and phone_verified_at is null
  returning id into v_order_id;
  if v_order_id is null then return false; end if;
  insert into public.customer_order_events
    (order_id, actor, actor_admin_user_id, old_status, new_status, note)
  values (v_order_id, 'staff', p_actor_admin_user_id,
    'pending_confirmation', 'pending_confirmation', 'Customer phone confirmed by staff call');
  return true;
end;
$$;

revoke all on function public.customer_confirm_order_phone(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.customer_confirm_order_phone(uuid, uuid)
  to service_role;

-- This condition is enforced in the database, not only by the staff page.
create or replace function public.customer_set_order_status(
  p_order_id uuid,
  p_expected_status text,
  p_new_status text,
  p_actor_admin_user_id uuid,
  p_note text default null
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_old text;
begin
  if p_new_status not in ('accepted','preparing','ready','out_for_delivery','declined','cancelled') then
    raise exception 'Status requires another workflow';
  end if;
  update public.customer_orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id and status = p_expected_status
    and (p_new_status <> 'accepted' or phone_verified_at is not null)
    and (
      (status = 'pending_confirmation' and p_new_status in ('accepted','declined','cancelled'))
      or (status = 'accepted' and p_new_status in ('preparing','cancelled'))
      or (status = 'preparing' and p_new_status in ('ready','cancelled'))
      or (status = 'ready' and p_new_status = 'cancelled')
      or (status = 'ready' and fulfillment_type = 'delivery' and p_new_status = 'out_for_delivery')
    )
  returning p_expected_status into v_old;
  if v_old is null then return false; end if;
  insert into public.customer_order_events
    (order_id, actor, actor_admin_user_id, old_status, new_status, note)
  values (p_order_id, 'staff', p_actor_admin_user_id, p_expected_status, p_new_status, p_note);
  return true;
end;
$$;
