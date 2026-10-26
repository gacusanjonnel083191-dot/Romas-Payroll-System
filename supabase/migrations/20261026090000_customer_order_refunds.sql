-- A full refund preserves the original paid sale and posts one dated,
-- negative revenue entry. Both rows remain visible for reconciliation.
alter table public.daily_sales_online_payments
  add column refund_of_payment_id uuid
    references public.daily_sales_online_payments(id) on delete restrict;

create unique index daily_sales_online_payments_refund_once_key
  on public.daily_sales_online_payments (refund_of_payment_id)
  where refund_of_payment_id is not null;

drop index if exists public.daily_sales_online_payments_order_transfer_ref_key;
create unique index daily_sales_online_payments_order_transfer_ref_key
  on public.daily_sales_online_payments (payment_method, reference_number)
  where (customer_order_id is not null or refund_of_payment_id is not null)
    and reference_number is not null;

alter table public.daily_sales_online_payments
  add constraint customer_order_refund_ledger_shape check (
    refund_of_payment_id is null or (
      customer_order_id is null and amount < 0
      and sales_channel = 'Website Order Refund'
      and status = 'active' and count_as_revenue = true
    )
  );

alter table public.customer_orders add column refunded_at timestamptz;
alter table public.customer_orders drop constraint customer_orders_payment_status_check;
alter table public.customer_orders add constraint customer_orders_payment_status_check
  check (payment_status in ('unpaid','paid','refunded'));
alter table public.customer_orders drop constraint customer_order_paid_at;
alter table public.customer_orders add constraint customer_order_payment_timestamps check (
  (payment_status = 'unpaid' and paid_at is null and refunded_at is null)
  or (payment_status = 'paid' and paid_at is not null and refunded_at is null)
  or (payment_status = 'refunded' and paid_at is not null and refunded_at is not null)
);

create or replace function public.customer_order_sale_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then
    if tg_op = 'INSERT' and (
      new.customer_order_id is not null or new.refund_of_payment_id is not null
      or new.sales_channel = 'Website Order Refund'
    ) then
      raise exception 'Customer order sales require the ordering service';
    elsif tg_op = 'UPDATE' and (
      old.customer_order_id is not null or new.customer_order_id is not null
      or old.refund_of_payment_id is not null or new.refund_of_payment_id is not null
      or old.sales_channel = 'Website Order Refund'
      or new.sales_channel = 'Website Order Refund'
    ) then
      raise exception 'Customer order sales require the ordering service';
    elsif tg_op = 'DELETE' and (
      old.customer_order_id is not null or old.refund_of_payment_id is not null
      or old.sales_channel = 'Website Order Refund'
    ) then
      raise exception 'Customer order sales require the ordering service';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.customer_order_paid_status_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.payment_status = 'refunded' and new.payment_status <> 'refunded' then
    raise exception 'A refunded order cannot become payable again';
  end if;
  if old.payment_status = 'paid' and new.payment_status = 'refunded' then
    if current_user <> 'service_role' or new.refunded_at is null or not exists (
      select 1 from public.daily_sales_online_payments original
      join public.daily_sales_online_payments refund
        on refund.refund_of_payment_id = original.id
      where original.customer_order_id = old.id and refund.status = 'active'
        and refund.amount = -old.total
    ) then
      raise exception 'A paid order requires a recorded refund before cancellation';
    end if;
  elsif old.payment_status = 'paid' and new.payment_status <> 'paid' then
    raise exception 'A paid order requires a recorded refund';
  end if;
  if old.payment_status = 'paid' and new.status in ('cancelled','declined')
    and new.status is distinct from old.status
    and new.payment_status <> 'refunded' then
    raise exception 'A paid order requires a refund workflow before cancellation';
  end if;
  return new;
end;
$$;
drop trigger customer_order_paid_status_guard_trigger on public.customer_orders;
create trigger customer_order_paid_status_guard_trigger
  before update of status, payment_status, refunded_at on public.customer_orders
  for each row execute function public.customer_order_paid_status_guard();

create function public.customer_refund_paid_sale(
  p_order_id uuid,
  p_method text,
  p_reference text,
  p_reason text,
  p_actor_admin_user_id uuid
) returns table (refund_id uuid, reused boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.customer_orders%rowtype;
  v_sale public.daily_sales_online_payments%rowtype;
  v_refund public.daily_sales_online_payments%rowtype;
  v_reference text := nullif(btrim(p_reference), '');
  v_reason text := btrim(coalesce(p_reason, ''));
  v_next_status text;
begin
  if p_method not in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'QR PH') then
    raise exception 'Unsupported refund method';
  end if;
  if p_method <> 'Cash' and (v_reference is null or length(v_reference) > 120) then
    raise exception 'A digital refund reference is required';
  end if;
  if p_method = 'Cash' and v_reference is not null then
    raise exception 'Cash refunds must not have a digital reference';
  end if;
  if length(v_reason) < 10 or length(v_reason) > 500 then
    raise exception 'Give a refund reason of 10 to 500 characters';
  end if;
  if not exists (
    select 1 from public.admin_users a where a.id = p_actor_admin_user_id
      and a.is_active = true
      and lower(a.role) in ('owner','supervisor','asst_supervisor')
  ) then
    raise exception 'Authorized ordering staff only';
  end if;

  select * into v_order from public.customer_orders
    where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into v_sale from public.daily_sales_online_payments
    where customer_order_id = p_order_id;
  if not found or v_sale.status <> 'active' or v_sale.amount <> v_order.total then
    raise exception 'Paid order has no matching active sale';
  end if;
  select * into v_refund from public.daily_sales_online_payments
    where refund_of_payment_id = v_sale.id;
  if v_order.payment_status = 'refunded' then
    if not found or v_refund.status <> 'active'
      or v_refund.amount <> -v_order.total
      or v_refund.payment_method <> p_method
      or v_refund.reference_number is distinct from v_reference then
      raise exception 'Order was already refunded with different details';
    end if;
    return query select v_refund.id, true;
    return;
  end if;
  if v_order.payment_status <> 'paid' or v_order.paid_at is null then
    raise exception 'Only a paid order can be refunded';
  end if;
  if v_refund.id is not null then
    raise exception 'Order has a refund but is still marked paid';
  end if;
  if v_order.status not in ('accepted','preparing','ready','out_for_delivery','completed') then
    raise exception 'This order cannot be refunded through the staff queue';
  end if;
  if v_order.total <= 0 then raise exception 'Order total must be positive'; end if;

  insert into public.daily_sales_online_payments (
    payment_date, sales_channel, payment_method, reference_number,
    customer_name, amount, notes, recorded_by, status,
    count_as_revenue, receipt_already_counted, refund_of_payment_id
  ) values (
    (now() at time zone 'Asia/Manila')::date, 'Website Order Refund',
    p_method, v_reference, v_order.customer_name, -v_order.total,
    'Full refund for order ' || v_order.order_code || '; original sale '
      || v_sale.id::text || '; reason: ' || v_reason,
    p_actor_admin_user_id::text, 'active', true, false, v_sale.id
  ) returning * into v_refund;

  v_next_status := case when v_order.status = 'completed'
    then 'completed' else 'cancelled' end;
  update public.customer_orders set payment_status = 'refunded',
    refunded_at = now(), status = v_next_status, updated_at = now()
    where id = p_order_id;
  insert into public.customer_order_events (
    order_id, actor, actor_admin_user_id, old_status, new_status, note
  ) values (
    p_order_id, 'staff', p_actor_admin_user_id, v_order.status, v_next_status,
    'Full refund ' || v_refund.id::text || ' (' || p_method || '): ' || v_reason
  );
  return query select v_refund.id, false;
end;
$$;

revoke all on function public.customer_refund_paid_sale(uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.customer_refund_paid_sale(uuid,text,text,text,uuid)
  to service_role;
