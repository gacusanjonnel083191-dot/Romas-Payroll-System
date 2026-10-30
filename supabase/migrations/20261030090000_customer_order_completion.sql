-- Complete pickup and delivery orders through the audited staff workflow.
-- Payment may be confirmed before or after fulfillment. Recording payment
-- atomically adds the linked Website Order entry to Daily Sales.
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
  if p_new_status not in ('accepted','preparing','ready','out_for_delivery','completed','declined','cancelled') then
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
      or (status = 'ready' and fulfillment_type = 'pickup' and p_new_status = 'completed')
      or (status = 'out_for_delivery' and fulfillment_type = 'delivery' and p_new_status = 'completed')
    )
  returning p_expected_status into v_old;
  if v_old is null then return false; end if;
  insert into public.customer_order_events
    (order_id, actor, actor_admin_user_id, old_status, new_status, note)
  values (p_order_id, 'staff', p_actor_admin_user_id, p_expected_status, p_new_status, p_note);
  return true;
end;
$$;

revoke all on function public.customer_set_order_status(uuid,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.customer_set_order_status(uuid,text,text,uuid,text)
  to service_role;

create or replace function public.customer_record_paid_sale(
  p_order_id uuid,
  p_method text,
  p_reference text,
  p_actor_admin_user_id uuid
) returns table (sale_id uuid, reused boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.customer_orders%rowtype;
  v_sale_id uuid;
  v_sale_method text;
  v_sale_reference text;
  v_sale_status text;
  v_reference text := nullif(btrim(p_reference), '');
begin
  if p_method not in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'QR PH') then
    raise exception 'Unsupported payment method';
  end if;
  if p_method <> 'Cash' and (v_reference is null or length(v_reference) > 120) then
    raise exception 'A digital payment reference is required';
  end if;
  if p_method = 'Cash' and v_reference is not null then
    raise exception 'Cash payments must not have a digital reference';
  end if;
  if not exists (
    select 1 from public.admin_users a where a.id = p_actor_admin_user_id
      and a.is_active = true and lower(a.role) in ('owner','supervisor','asst_supervisor')
  ) then
    raise exception 'Authorized ordering staff only';
  end if;

  select * into v_order from public.customer_orders
    where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  select p.id, p.payment_method, p.reference_number, p.status
    into v_sale_id, v_sale_method, v_sale_reference, v_sale_status
    from public.daily_sales_online_payments p
    where p.customer_order_id = p_order_id;
  if v_order.payment_status = 'paid' then
    if v_sale_id is null or v_sale_status <> 'active' then
      raise exception 'Paid order has no active linked sale';
    end if;
    if v_sale_method <> p_method or v_sale_reference is distinct from v_reference then
      raise exception 'Order is already paid with different payment details';
    end if;
    return query select v_sale_id, true;
    return;
  end if;
  if v_sale_id is not null then raise exception 'Order has a sale but is unpaid'; end if;
  if v_order.status not in ('accepted','preparing','ready','out_for_delivery','completed') then
    raise exception 'Order must be accepted before payment is recorded';
  end if;
  if v_order.total <= 0 then raise exception 'Order total must be positive'; end if;

  insert into public.daily_sales_online_payments (
    payment_date, sales_channel, payment_method, reference_number,
    customer_name, amount, notes, recorded_by, status,
    count_as_revenue, receipt_already_counted, customer_order_id
  ) values (
    (now() at time zone 'Asia/Manila')::date, 'Website Order', p_method,
    v_reference, v_order.customer_name, v_order.total,
    'Customer order ' || v_order.order_code, p_actor_admin_user_id::text,
    'active', true, false, p_order_id
  ) returning id into v_sale_id;

  update public.customer_orders set payment_status = 'paid', paid_at = now(),
    updated_at = now() where id = p_order_id;
  insert into public.customer_order_events (
    order_id, actor, actor_admin_user_id, old_status, new_status, note
  ) values (
    p_order_id, 'staff', p_actor_admin_user_id, v_order.status, v_order.status,
    'Payment confirmed; online sale ' || v_sale_id::text || ' (' || p_method || ')'
  );
  return query select v_sale_id, false;
end;
$$;

revoke all on function public.customer_record_paid_sale(uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.customer_record_paid_sale(uuid,text,text,uuid)
  to service_role;
