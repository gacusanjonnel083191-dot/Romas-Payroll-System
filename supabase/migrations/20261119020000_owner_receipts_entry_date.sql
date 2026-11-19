-- Entry-date reporting only. No business records or saved handover snapshots are modified.
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
    'receipt_basis', 'entry_date_v1',
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
          gcash_sales, online_sales, actual_cash, opening_cash, shift_id, closed_by, verified_by
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

create or replace function private.cash_handover_expected(p_day date, p_raw jsonb, p_expenses jsonb)
returns numeric language plpgsql set search_path='' as $$
declare r jsonb; marker text[]; total numeric := 0; method text;
begin
  for r in select value from jsonb_array_elements(p_raw->'daily_sales') loop
    if ((r->>'created_at')::timestamptz at time zone 'Asia/Manila')::date is distinct from p_day or coalesce((r->>'total_walkin')::numeric,0)+coalesce((r->>'total_messenger')::numeric,0)<=0 then continue; end if;
    marker := regexp_match(coalesce(r->>'notes',''), 'SAGS-POS-SHIFT-CLOSING\|([^|\s;]+)\|(\d{4}-\d{2}-\d{2})');
    if marker is not null and exists(select 1 from jsonb_array_elements(p_raw->'pos_closings') c
      where c->>'outlet_id'=marker[1] and c->>'business_date'=marker[2] and nullif(c->>'shift_id','') is null and ((c->>'created_at')::timestamptz at time zone 'Asia/Manila')::date=p_day) then continue; end if;
    if r->>'cash_received' is null or r->>'gcash_received' is null or r->>'other_online_received' is null or r->>'unpaid_amount' is null then
      raise exception 'Review Daily Sales payment splits before handover'; end if;
    total := total + greatest(0,round((r->>'cash_received')::numeric,2));
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'pos_closings') loop
    if nullif(r->>'shift_id','') is null and ((r->>'created_at')::timestamptz at time zone 'Asia/Manila')::date=p_day then total:=total+greatest(0,round(coalesce((r->>'cash_sales')::numeric,0),2)); end if;
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'daily_online') loop
    if ((r->>'created_at')::timestamptz at time zone 'Asia/Manila')::date is distinct from p_day or lower(coalesce(r->>'status','active'))='void' or coalesce((r->>'amount')::numeric,0)<=0 then continue; end if;
    if r->>'count_as_revenue'='false' then
      if r->>'receipt_already_counted'='true' then continue; end if;
      if r->>'receipt_already_counted' is null then raise exception 'Review ambiguous online receipts before handover'; end if;
    end if;
    method:=lower(trim(coalesce(r->>'payment_method','')));
    if method='cash' then total:=total+round((r->>'amount')::numeric,2);
    elsif method !~ '(gcash|maya|bank|online|card|qr|check)' then raise exception 'Review unknown payment method before handover'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'reseller_payments') loop
    if ((r->>'created_at')::timestamptz at time zone 'Asia/Manila')::date is distinct from p_day or coalesce((r->>'amount')::numeric,0)<=0 then continue; end if;
    method:=lower(trim(coalesce(r->>'payment_method','')));
    if method='cash' then total:=total+round((r->>'amount')::numeric,2);
    elsif method !~ '(gcash|maya|bank|online|card|qr|check)' then raise exception 'Review unknown payment method before handover'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'outlet_remittances') loop
    if lower(coalesce(r->>'status',''))<>'approved' or ((r->>'created_at')::timestamptz at time zone 'Asia/Manila')::date<>p_day or coalesce((r->>'actual_remitted_amount')::numeric,0)<=0 then continue; end if;
    method:=lower(trim(coalesce(r->>'payment_method','')));
    if method='cash' then total:=total+round((r->>'actual_remitted_amount')::numeric,2);
    elsif method !~ '(gcash|maya|bank|online|card|qr|check)' then raise exception 'Review unknown payment method before handover'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_expenses) loop
    if r->>'status'='approved' and r->>'expense_date'=p_day::text and nullif(r->>'payment_method','') is null then raise exception 'Review expense payment methods before handover'; end if;
    if r->>'payment_method'='cash' and r->>'paid_date'=p_day::text then total:=total-round(coalesce((r->>'classified_amount')::numeric,0),2); end if;
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'bank_deposits') loop
    if r->>'deposit_date'=p_day::text and lower(coalesce(r->>'status',''))='deposited' then total:=total-round(coalesce((r->>'amount')::numeric,0),2); end if;
  end loop;
  return total;
end;
$$;
revoke all on function private.cash_handover_expected(date,jsonb,jsonb) from public,anon,authenticated;
