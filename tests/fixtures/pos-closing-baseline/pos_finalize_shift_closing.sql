CREATE OR REPLACE FUNCTION public.pos_finalize_shift_closing(p_outlet_id text, p_business_date date, p_opening_cash numeric, p_actual_cash numeric, p_closed_by text, p_verified_by text DEFAULT NULL::text, p_verified_by_role text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_admin_full_name text;
  v_admin_email text;
  v_admin_primary_role text;
  v_admin_extra_roles text;
  v_admin_roles text[];
  v_verified_by text;
  v_verified_role text;
  v_marker text;
  v_transaction_count integer := 0;
  v_cash_sales numeric := 0;
  v_gcash_sales numeric := 0;
  v_online_sales numeric := 0;
  v_total_sales numeric := 0;
  v_expected_cash numeric := 0;
  v_variance numeric := 0;
  v_closing public.pos_shift_closings%rowtype;
  v_daily public.daily_sales%rowtype;
  v_linked_daily_count integer := 0;
  v_linked_daily_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'AUTHORIZED_ADMIN_LOGIN_REQUIRED: Please sign in again using Owner/Admin Login.';
  end if;

  select au.full_name, au.email, lower(trim(coalesce(au.role, ''))), coalesce(au.extra_roles, '')
    into v_admin_full_name, v_admin_email, v_admin_primary_role, v_admin_extra_roles
  from public.admin_users au
  where au.auth_user_id = v_auth_user_id
    and au.is_active = true
  limit 1;

  if not found then
    raise exception 'ACTIVE_ADMIN_PROFILE_REQUIRED: This authenticated user is not registered as an active admin.';
  end if;

  v_admin_roles := array_remove(
    array_cat(
      array[v_admin_primary_role],
      regexp_split_to_array(lower(trim(v_admin_extra_roles)), '\s*,\s*')
    ),
    ''
  );

  if not (v_admin_roles && array['owner','manager','admin','pos_admin','hr']::text[]) then
    raise exception 'SHIFT_CLOSING_ROLE_BLOCKED: Only Owner, Manager, Admin, SAGS POS Admin, or HR Admin can finalize a POS shift.';
  end if;

  if nullif(trim(coalesce(p_outlet_id, '')), '') is null then
    raise exception 'OUTLET_REQUIRED: POS outlet is missing.';
  end if;
  if p_business_date is null then
    raise exception 'BUSINESS_DATE_REQUIRED: POS business date is missing.';
  end if;
  if p_business_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'FUTURE_SHIFT_BLOCKED: A future POS business date cannot be closed.';
  end if;
  if coalesce(p_opening_cash, 0) < 0 or coalesce(p_actual_cash, 0) < 0 then
    raise exception 'INVALID_CASH_AMOUNT: Opening and actual cash cannot be negative.';
  end if;
  if nullif(trim(coalesce(p_closed_by, '')), '') is null then
    raise exception 'CLOSED_BY_REQUIRED: Enter who physically closed or verified the shift.';
  end if;

  perform pg_advisory_xact_lock(hashtext(trim(p_outlet_id) || '|' || p_business_date::text));

  with active_sales as (
    select s.*
    from public.pos_sales s
    where s.outlet_id = trim(p_outlet_id)
      and s.business_date = p_business_date
      and lower(trim(coalesce(s.status, 'completed'))) not in
        ('void','voided','cancelled','canceled','refunded','deleted')
  ),
  payment_summary as (
    select
      p.sale_id,
      count(*) as payment_rows,
      coalesce(sum(case when lower(trim(p.method)) = 'cash' then p.amount else 0 end), 0) as cash_amount,
      coalesce(sum(case when lower(trim(p.method)) like '%gcash%' then p.amount else 0 end), 0) as gcash_amount,
      coalesce(sum(case when lower(trim(p.method)) like '%online%' then p.amount else 0 end), 0) as online_amount
    from public.pos_sale_payments p
    join active_sales s on s.id = p.sale_id
    group by p.sale_id
  )
  select
    count(*)::integer,
    round(coalesce(sum(
      case when coalesce(ps.payment_rows, 0) > 0
        then ps.cash_amount
        when lower(trim(coalesce(s.payment_method, ''))) = 'cash'
        then coalesce(s.net_total, 0)
        else 0 end
    ), 0), 2),
    round(coalesce(sum(
      case when coalesce(ps.payment_rows, 0) > 0
        then ps.gcash_amount
        when lower(trim(coalesce(s.payment_method, ''))) like '%gcash%'
        then coalesce(s.net_total, 0)
        else 0 end
    ), 0), 2),
    round(coalesce(sum(
      case when coalesce(ps.payment_rows, 0) > 0
        then ps.online_amount
        when lower(trim(coalesce(s.payment_method, ''))) like '%online%'
        then coalesce(s.net_total, 0)
        else 0 end
    ), 0), 2),
    round(coalesce(sum(coalesce(s.net_total, 0)), 0), 2)
  into
    v_transaction_count,
    v_cash_sales,
    v_gcash_sales,
    v_online_sales,
    v_total_sales
  from active_sales s
  left join payment_summary ps on ps.sale_id = s.id;

  v_expected_cash := round(coalesce(p_opening_cash, 0) + v_cash_sales, 2);
  v_variance := round(coalesce(p_actual_cash, 0) - v_expected_cash, 2);

  v_verified_by := coalesce(nullif(trim(v_admin_full_name), ''), nullif(trim(v_admin_email), ''), nullif(trim(p_verified_by), ''), 'Authenticated Admin');
  v_verified_role := case
    when lower(trim(coalesce(p_verified_by_role, ''))) = any(v_admin_roles)
      then lower(trim(p_verified_by_role))
    else v_admin_primary_role
  end;

  insert into public.pos_shift_closings (
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
    verified_by,
    verified_by_role,
    remarks,
    updated_at
  ) values (
    trim(p_outlet_id),
    p_business_date,
    round(coalesce(p_opening_cash, 0), 2),
    v_cash_sales,
    v_gcash_sales,
    v_online_sales,
    v_total_sales,
    v_expected_cash,
    round(coalesce(p_actual_cash, 0), 2),
    v_variance,
    v_transaction_count,
    trim(p_closed_by),
    v_verified_by,
    v_verified_role,
    nullif(trim(coalesce(p_remarks, '')), ''),
    now()
  )
  on conflict (outlet_id, business_date)
  do update set
    opening_cash = excluded.opening_cash,
    cash_sales = excluded.cash_sales,
    gcash_sales = excluded.gcash_sales,
    online_sales = excluded.online_sales,
    total_sales = excluded.total_sales,
    expected_cash = excluded.expected_cash,
    actual_cash = excluded.actual_cash,
    cash_variance = excluded.cash_variance,
    transaction_count = excluded.transaction_count,
    closed_by = excluded.closed_by,
    verified_by = excluded.verified_by,
    verified_by_role = excluded.verified_by_role,
    remarks = excluded.remarks,
    updated_at = now()
  returning * into v_closing;

  v_marker := 'SAGS-POS-SHIFT-CLOSING|' || trim(p_outlet_id) || '|' || p_business_date::text;

  select count(*), (array_agg(ds.id order by ds.created_at desc))[1]
    into v_linked_daily_count, v_linked_daily_id
  from public.daily_sales ds
  where ds.sale_date = p_business_date
    and position(v_marker in coalesce(ds.notes, '')) > 0;

  if v_linked_daily_count > 1 then
    raise exception 'DUPLICATE_LINKED_DAILY_SALES: Multiple linked SAGS POS Daily Sales rows exist for %. Review duplicates before closing.', p_business_date;
  end if;

  if v_linked_daily_id is not null then
    update public.daily_sales
    set
      total_walkin = v_total_sales,
      total_messenger = 0,
      total_reseller = 0,
      total_revenue = v_total_sales,
      notes = concat_ws(' | ',
        v_marker,
        'Source: SAGS POS – ' || trim(p_outlet_id),
        'Status: Shift Closed',
        'Cash ₱' || to_char(v_cash_sales, 'FM9999999990.00'),
        'GCash ₱' || to_char(v_gcash_sales, 'FM9999999990.00'),
        'Online ₱' || to_char(v_online_sales, 'FM9999999990.00'),
        'Transactions ' || v_transaction_count,
        'Closed by ' || trim(p_closed_by),
        'Verified by ' || v_verified_by || ' (' || v_verified_role || ')',
        case when nullif(trim(coalesce(p_remarks, '')), '') is not null then 'Closing remarks: ' || trim(p_remarks) end
      ),
      encoded_by = v_verified_by
    where id = v_linked_daily_id
    returning * into v_daily;
  else
    insert into public.daily_sales (
      sale_date,
      total_walkin,
      total_messenger,
      total_reseller,
      total_revenue,
      notes,
      encoded_by
    ) values (
      p_business_date,
      v_total_sales,
      0,
      0,
      v_total_sales,
      concat_ws(' | ',
        v_marker,
        'Source: SAGS POS – ' || trim(p_outlet_id),
        'Status: Shift Closed',
        'Cash ₱' || to_char(v_cash_sales, 'FM9999999990.00'),
        'GCash ₱' || to_char(v_gcash_sales, 'FM9999999990.00'),
        'Online ₱' || to_char(v_online_sales, 'FM9999999990.00'),
        'Transactions ' || v_transaction_count,
        'Closed by ' || trim(p_closed_by),
        'Verified by ' || v_verified_by || ' (' || v_verified_role || ')',
        case when nullif(trim(coalesce(p_remarks, '')), '') is not null then 'Closing remarks: ' || trim(p_remarks) end
      ),
      v_verified_by
    )
    returning * into v_daily;
  end if;

  insert into public.audit_logs (action, performed_by, target_employee, details)
  values (
    'POS SHIFT CLOSED ATOMICALLY',
    v_verified_by,
    trim(p_outlet_id) || ' ' || p_business_date::text,
    '₱' || to_char(v_total_sales, 'FM9999999990.00') ||
    ' | ' || v_transaction_count || ' transaction(s)' ||
    ' | Cash variance ₱' || to_char(v_variance, 'FM9999999990.00') ||
    ' | Shift Closing and Daily Sales committed together' ||
    ' | Role: ' || v_verified_role
  );

  return jsonb_build_object(
    'ok', true,
    'closing', to_jsonb(v_closing),
    'daily_sales', to_jsonb(v_daily),
    'verified_by', v_verified_by,
    'verified_by_role', v_verified_role
  );
end;
$function$;
