CREATE OR REPLACE FUNCTION public.pos_close_shift_atomic(p_outlet_id text, p_shift_id text, p_counted_cash numeric, p_notes text DEFAULT NULL::text, p_closed_by text DEFAULT NULL::text)
 RETURNS TABLE(shift_id text, business_date date, opening_cash numeric, cash_sales numeric, total_sales numeric, expected_cash numeric, counted_cash numeric, variance numeric, transaction_count integer, closed_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_shift public.pos_shifts%rowtype;
  v_date date;
  v_date_count integer;
  v_cash numeric := 0;
  v_total numeric := 0;
  v_expected numeric := 0;
  v_variance numeric := 0;
  v_count integer := 0;
  v_closed timestamptz := clock_timestamp();
begin
  select sh.*
  into v_shift
  from public.pos_shifts as sh
  where sh.id = trim(p_shift_id)
    and sh.outlet_id = trim(p_outlet_id)
  for update;

  if not found then
    raise exception 'Shift not found.';
  end if;
  if lower(trim(coalesce(v_shift.status, ''))) <> 'open' then
    raise exception 'Shift is not open.';
  end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Counted cash must be zero or more.';
  end if;

  select
    count(distinct s.business_date),
    max(s.business_date)
  into v_date_count, v_date
  from public.pos_sales as s
  where s.shift_id = v_shift.id
    and s.outlet_id = v_shift.outlet_id
    and lower(trim(coalesce(s.status, 'completed'))) <> 'voided';

  if v_date_count > 1 then
    raise exception 'Shift spans multiple business dates.';
  end if;
  if v_date is null then
    v_date := (clock_timestamp() at time zone 'Asia/Manila')::date;
  end if;

  -- A partially uploaded receipt (sale header without valid items) must never
  -- be counted as safely synchronized inventory.
  if exists (
    select 1
    from public.pos_sales as s
    where s.shift_id = v_shift.id
      and s.outlet_id = v_shift.outlet_id
      and lower(trim(coalesce(s.status, 'completed'))) <> 'voided'
      and not exists (
        select 1
        from public.pos_sale_items as i
        where i.sale_id = s.id
          and nullif(trim(i.product_id), '') is not null
          and coalesce(i.qty, 0) > 0
      )
  ) then
    raise exception 'SHIFT_INVENTORY_SYNC_INCOMPLETE: a receipt is missing its item rows.';
  end if;

  -- Every active receipt/product quantity must have one matching negative sale
  -- movement. This catches failures between saving the receipt and deducting
  -- stock, while accepting safe idempotent retries.
  if exists (
    with expected as (
      select
        s.receipt_no,
        i.product_id,
        sum(coalesce(i.qty, 0))::numeric as expected_qty
      from public.pos_sales as s
      join public.pos_sale_items as i on i.sale_id = s.id
      where s.shift_id = v_shift.id
        and s.outlet_id = v_shift.outlet_id
        and lower(trim(coalesce(s.status, 'completed'))) <> 'voided'
        and nullif(trim(i.product_id), '') is not null
        and coalesce(i.qty, 0) > 0
      group by s.receipt_no, i.product_id
    ),
    actual as (
      select
        m.reference_no,
        m.product_id,
        sum(coalesce(m.qty, 0))::numeric as actual_qty
      from public.pos_inventory_movements as m
      where m.outlet_id = v_shift.outlet_id
        and lower(trim(coalesce(m.movement_type, ''))) = 'sale'
      group by m.reference_no, m.product_id
    )
    select 1
    from expected as e
    left join actual as a
      on a.reference_no = e.receipt_no
     and a.product_id = e.product_id
    where abs(coalesce(a.actual_qty, 0) + e.expected_qty) > 0.0001
  ) then
    raise exception 'SHIFT_INVENTORY_SYNC_INCOMPLETE: receipt stock deductions are missing or mismatched.';
  end if;

  -- Positive donut balances require a physical close-out. A completed log must
  -- also agree with the final product stock (zero for Same-Day, counted stock
  -- for Carries Over) before the shift can close.
  if exists (
    select 1
    from public.pos_products as p
    left join public.pos_daily_donut_log as d
      on d.outlet_id = v_shift.outlet_id
     and d.product_id = p.id
     and d.business_date = v_date
    where (p.outlet_id = v_shift.outlet_id or p.outlet_id is null)
      and coalesce(p.is_active, true)
      and lower(trim(coalesce(p.category, ''))) = 'donuts'
      and (
        (greatest(coalesce(p.stock, 0), 0) > 0 and d.closed_at is null)
        or (
          d.closed_at is not null
          and lower(trim(coalesce(d.tracking_mode, p.daily_tracking_mode, 'same_day_pull'))) <> 'carries_over'
          and abs(coalesce(p.stock, 0)) > 0.0001
        )
        or (
          d.closed_at is not null
          and lower(trim(coalesce(d.tracking_mode, p.daily_tracking_mode, 'same_day_pull'))) = 'carries_over'
          and abs(coalesce(p.stock, 0) - greatest(coalesce(d.actual_counted, 0), 0)) > 0.0001
        )
      )
  ) then
    raise exception 'DONUT_CLOSEOUT_REQUIRED: finish Daily Donuts physical counts before closing the shift.';
  end if;

  with active_sales as (
    select s.id, s.net_total, s.payment_method
    from public.pos_sales as s
    where s.shift_id = v_shift.id
      and s.outlet_id = v_shift.outlet_id
      and lower(trim(coalesce(s.status, 'completed'))) <> 'voided'
  ),
  per_sale as (
    select
      s.id,
      greatest(coalesce(s.net_total, 0), 0)::numeric as net_total,
      case
        when count(p.id) > 0 then
          coalesce(
            sum(p.amount) filter (
              where lower(trim(coalesce(p.method, ''))) = 'cash'
            ),
            0
          )::numeric
        when lower(trim(coalesce(s.payment_method, ''))) = 'cash' then
          greatest(coalesce(s.net_total, 0), 0)::numeric
        else 0::numeric
      end as cash_amount
    from active_sales as s
    left join public.pos_sale_payments as p on p.sale_id = s.id
    group by s.id, s.net_total, s.payment_method
  )
  select
    coalesce(sum(ps.cash_amount), 0),
    coalesce(sum(ps.net_total), 0),
    count(*)::integer
  into v_cash, v_total, v_count
  from per_sale as ps;

  v_expected := greatest(coalesce(v_shift.starting_cash, 0), 0) + v_cash;
  v_variance := p_counted_cash - v_expected;

  update public.pos_shifts as sh
  set
    closed_at = v_closed,
    expected_cash = v_expected,
    counted_cash = p_counted_cash,
    variance = v_variance,
    status = 'closed',
    notes = nullif(trim(p_notes), '')
  where sh.id = v_shift.id
    and sh.outlet_id = v_shift.outlet_id;

  update public.pos_shift_closings as c
  set
    business_date = v_date,
    opening_cash = greatest(coalesce(v_shift.starting_cash, 0), 0),
    cash_sales = v_cash,
    gcash_sales = 0,
    online_sales = 0,
    total_sales = v_total,
    expected_cash = v_expected,
    actual_cash = p_counted_cash,
    cash_variance = v_variance,
    transaction_count = v_count,
    closed_by = coalesce(nullif(trim(p_closed_by), ''), v_shift.cashier_name),
    remarks = nullif(trim(p_notes), ''),
    created_at = v_closed
  where c.shift_id = v_shift.id;

  if not found then
    insert into public.pos_shift_closings (
      shift_id,
      outlet_id,
      business_date,
      opening_cash,
      cash_sales,
      gcash_sales,
      online_sales,
      total_sales,
      expected_cash,
      actual_cash,
      cash_variance,
      transaction_count,
      closed_by,
      remarks,
      created_at
    ) values (
      v_shift.id,
      v_shift.outlet_id,
      v_date,
      greatest(coalesce(v_shift.starting_cash, 0), 0),
      v_cash,
      0,
      0,
      v_total,
      v_expected,
      p_counted_cash,
      v_variance,
      v_count,
      coalesce(nullif(trim(p_closed_by), ''), v_shift.cashier_name),
      nullif(trim(p_notes), ''),
      v_closed
    );
  end if;

  return query
  select
    v_shift.id,
    v_date,
    greatest(coalesce(v_shift.starting_cash, 0), 0)::numeric,
    v_cash,
    v_total,
    v_expected,
    p_counted_cash,
    v_variance,
    v_count,
    v_closed;
end;
$function$;
