CREATE OR REPLACE FUNCTION private.cash_handover_expected(p_day date, p_raw jsonb, p_expenses jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r jsonb; marker text[]; total numeric := 0; method text;
begin
  for r in select value from jsonb_array_elements(p_raw->'daily_sales') loop
    if ((r->>'created_at')::timestamptz at time zone 'Asia/Manila')::date is distinct from p_day or coalesce((r->>'total_walkin')::numeric,0)+coalesce((r->>'total_messenger')::numeric,0)<=0 then continue; end if;
    marker := regexp_match(coalesce(r->>'notes',''), 'SAGS-POS-SHIFT-CLOSING\|([^|\s;]+)\|(\d{4}-\d{2}-\d{2})');
    if marker is not null then continue; end if;
    if r->>'cash_received' is null or r->>'gcash_received' is null or r->>'other_online_received' is null or r->>'unpaid_amount' is null then
      raise exception 'Review Daily Sales payment splits before handover'; end if;
    total := total + greatest(0,round((r->>'cash_received')::numeric,2));
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p_raw->'pos_cash_receipts','[]')) loop
    if ((r->>'received_at')::timestamptz at time zone 'Asia/Manila')::date=p_day then total:=total+greatest(0,round(coalesce((r->>'actual_received')::numeric,0),2)); end if;
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
$function$
