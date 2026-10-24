-- Link paid customer orders to the existing online-sales ledger. The link is
-- unique so retries cannot add the same order's revenue twice.
alter table public.daily_sales_online_payments
  add column customer_order_id uuid references public.customer_orders(id) on delete restrict;

create unique index daily_sales_online_payments_customer_order_id_key
  on public.daily_sales_online_payments (customer_order_id)
  where customer_order_id is not null;

create unique index daily_sales_online_payments_order_transfer_ref_key
  on public.daily_sales_online_payments (payment_method, reference_number)
  where customer_order_id is not null and reference_number is not null;

-- The legacy payment ledger is directly writable by the app. Linked customer
-- order sales may only be inserted or changed by the server-side service role.
create function public.customer_order_sale_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then
    if tg_op = 'INSERT' and new.customer_order_id is not null then
      raise exception 'Customer order sales require the ordering service';
    elsif tg_op = 'UPDATE' and (old.customer_order_id is not null or new.customer_order_id is not null) then
      raise exception 'Customer order sales require the ordering service';
    elsif tg_op = 'DELETE' and old.customer_order_id is not null then
      raise exception 'Customer order sales require the ordering service';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger customer_order_sale_guard_trigger
  before insert or update or delete on public.daily_sales_online_payments
  for each row execute function public.customer_order_sale_guard();
revoke all on function public.customer_order_sale_guard() from public, anon, authenticated;

-- A paid order cannot enter the ordinary cancellation path. Refunds need a
-- separate, audited reversal workflow before cancellation can be allowed.
create function public.customer_order_paid_status_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.payment_status = 'paid' and new.status in ('cancelled', 'declined')
     and new.status is distinct from old.status then
    raise exception 'A paid order requires a refund workflow before cancellation';
  end if;
  return new;
end;
$$;

create trigger customer_order_paid_status_guard_trigger
  before update of status on public.customer_orders
  for each row execute function public.customer_order_paid_status_guard();
revoke all on function public.customer_order_paid_status_guard() from public, anon, authenticated;

-- One database transaction records both payment and revenue. The Edge
-- Function authenticates the actor before calling this service-role-only RPC.
create function public.customer_record_paid_sale(
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
  if v_order.status not in ('accepted','preparing','ready','completed') then
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
