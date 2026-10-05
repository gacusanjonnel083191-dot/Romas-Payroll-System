-- Owner-only daily receipts report. New split fields are null for historical and automatic rows.
alter table public.daily_sales_online_payments
  add column if not exists receipt_already_counted boolean;

alter table public.daily_sales
  add column if not exists cash_received numeric(12,2),
  add column if not exists gcash_received numeric(12,2),
  add column if not exists other_online_received numeric(12,2),
  add column if not exists unpaid_amount numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'daily_sales_receipt_split_valid') then
    alter table public.daily_sales add constraint daily_sales_receipt_split_valid check (
      (cash_received is null and gcash_received is null and other_online_received is null and unpaid_amount is null)
      or
      (cash_received is not null and gcash_received is not null and other_online_received is not null and unpaid_amount is not null
       and cash_received >= 0 and gcash_received >= 0 and other_online_received >= 0 and unpaid_amount >= 0
       and round(cash_received + gcash_received + other_online_received + unpaid_amount, 2)
         = round(coalesce(total_walkin,0) + coalesce(total_messenger,0), 2))
    );
  end if;
end;
$$;

create or replace function public.owner_daily_receipts(p_day date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then
    raise exception 'Owner access required';
  end if;
  if p_day is null then raise exception 'A report date is required'; end if;
  v_start := p_day::timestamp at time zone 'Asia/Manila';
  v_end := (p_day + 1)::timestamp at time zone 'Asia/Manila';

  return jsonb_build_object(
    'date', p_day,
    'daily_sales', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at, s.id), '[]'::jsonb)
      from (
        select id, sale_date, created_at, encoded_by, total_walkin, total_messenger,
          total_reseller, total_revenue, cash_received, gcash_received,
          other_online_received, unpaid_amount, notes
        from public.daily_sales
        where sale_date = p_day or (created_at >= v_start and created_at < v_end)
      ) s
    ),
    'daily_online', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at, p.id), '[]'::jsonb)
      from (
        select id, payment_date, created_at, sales_channel, payment_method,
          amount, count_as_revenue, receipt_already_counted, status, customer_name, reference_number
        from public.daily_sales_online_payments
        where payment_date = p_day or (created_at >= v_start and created_at < v_end)
      ) p
    ),
    'reseller_payments', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at, p.id), '[]'::jsonb)
      from (
        select p.id, p.payment_date, p.created_at, p.reseller_name, p.invoice_id,
          i.invoice_number, p.amount, p.payment_method, p.recorded_by
        from public.reseller_payments p
        left join public.delivery_invoices i on i.id = p.invoice_id
        where p.payment_date = p_day or (p.created_at >= v_start and p.created_at < v_end)
      ) p
    ),
    'pos_closings', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb)
      from (
        select id, business_date, created_at, outlet_id, total_sales, cash_sales,
          gcash_sales, online_sales, actual_cash, opening_cash, shift_id
        from public.pos_shift_closings
        where business_date = p_day or (created_at >= v_start and created_at < v_end)
      ) c
    ),
    'outlet_remittances', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at, r.id), '[]'::jsonb)
      from (
        select id, week_end, created_at, reseller_name, total_sales_amount,
          actual_remitted_amount, payment_method, status
        from public.outlet_weekly_remittance_reports
        where created_at >= v_start and created_at < v_end
      ) r
    ),
    'invoices', (
      select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at, i.id), '[]'::jsonb)
      from (
        select id, invoice_number, created_at, delivery_date, reseller_name,
          total_amount, paid_amount, status, delivered_at
        from public.delivery_invoices
        where delivery_date = p_day or (created_at >= v_start and created_at < v_end)
      ) i
    ),
    'cash_counts', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb)
      from (
        select id, reconciliation_date, created_at, actual_cash, submitted_by
        from public.cash_reconciliations
        where reconciliation_date = p_day
      ) c
    ),
    'bank_deposits', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at, b.id), '[]'::jsonb)
      from (
        select id, deposit_date, created_at, amount, bank_name, status
        from public.bank_deposits
        where deposit_date = p_day
      ) b
    ),
    'expenses', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at, e.id), '[]'::jsonb)
      from (
        select id, expense_date, created_at, amount, category, status
        from public.daily_expenses
        where expense_date = p_day
      ) e
    )
  );
end;
$$;

revoke all on function public.owner_daily_receipts(date) from public, anon;
grant execute on function public.owner_daily_receipts(date) to authenticated;
