-- Prerequisites: owner_daily_receipts and owner_cash_expenses_for_day.
-- No existing reconciliation, receipt, expense or balance is rewritten.
create schema if not exists private;
create table public.cash_handover_events (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  revision integer not null,
  previous_id uuid references public.cash_handover_events(id),
  request_id uuid not null unique,
  request_payload jsonb not null,
  event_type text not null check (event_type in ('handover','count')),
  handover_at timestamptz not null,
  handed_over_by text not null,
  received_by text not null,
  recorded_by uuid not null,
  owner_count_at timestamptz,
  notes text,
  system_expected_cash numeric(12,2) not null,
  cash_handed_over numeric(12,2) not null check (cash_handed_over >= 0),
  owner_physical_count numeric(12,2) check (owner_physical_count >= 0),
  collection_variance numeric(12,2) generated always as (cash_handed_over-system_expected_cash) stored,
  counting_variance numeric(12,2) generated always as (owner_physical_count-cash_handed_over) stored,
  final_variance numeric(12,2) generated always as (owner_physical_count-system_expected_cash) stored,
  source_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(business_date,revision),
  check ((owner_physical_count is null) = (owner_count_at is null))
);
create unique index cash_handover_one_initial on public.cash_handover_events(business_date) where previous_id is null;
create unique index cash_handover_one_successor on public.cash_handover_events(previous_id) where previous_id is not null;
alter table public.cash_handover_events enable row level security;
revoke all on public.cash_handover_events from public,anon,authenticated;
grant select on public.cash_handover_events to authenticated;
create policy cash_handover_owner_read on public.cash_handover_events for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner']));

create function private.cash_handover_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Cash handover history is immutable; append a correction'; end;
$$;
create trigger cash_handover_immutable before update or delete on public.cash_handover_events
for each row execute function private.cash_handover_immutable();
revoke all on function private.cash_handover_immutable() from public,anon,authenticated;

-- Server counterpart of buildOwnerDailyReceipts: confirmed cash tenders only.
-- Returns integer-cent-rounded money, and refuses uncertain classifications.
create function private.cash_handover_expected(p_day date, p_raw jsonb, p_expenses jsonb)
returns numeric language plpgsql set search_path='' as $$
declare r jsonb; marker text[]; total numeric := 0; method text;
begin
  for r in select value from jsonb_array_elements(p_raw->'daily_sales') loop
    if r->>'sale_date' <> p_day::text or coalesce((r->>'total_walkin')::numeric,0)+coalesce((r->>'total_messenger')::numeric,0)<=0 then continue; end if;
    marker := regexp_match(coalesce(r->>'notes',''), 'SAGS-POS-SHIFT-CLOSING\|([^|\s;]+)\|(\d{4}-\d{2}-\d{2})');
    if marker is not null and exists(select 1 from jsonb_array_elements(p_raw->'pos_closings') c
      where c->>'outlet_id'=marker[1] and c->>'business_date'=marker[2] and c->>'business_date'=p_day::text) then continue; end if;
    if r->>'cash_received' is null or r->>'gcash_received' is null or r->>'other_online_received' is null or r->>'unpaid_amount' is null then
      raise exception 'Review Daily Sales payment splits before handover'; end if;
    total := total + greatest(0,round((r->>'cash_received')::numeric,2));
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'pos_closings') loop
    if r->>'business_date'=p_day::text then total:=total+greatest(0,round(coalesce((r->>'cash_sales')::numeric,0),2)); end if;
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'daily_online') loop
    if r->>'payment_date'<>p_day::text or lower(coalesce(r->>'status','active'))='void' or coalesce((r->>'amount')::numeric,0)<=0 then continue; end if;
    if r->>'count_as_revenue'='false' then
      if r->>'receipt_already_counted'='true' then continue; end if;
      if r->>'receipt_already_counted' is null then raise exception 'Review ambiguous online receipts before handover'; end if;
    end if;
    method:=lower(trim(coalesce(r->>'payment_method','')));
    if method='cash' then total:=total+round((r->>'amount')::numeric,2);
    elsif method !~ '(gcash|maya|bank|online|card|qr|check)' then raise exception 'Review unknown payment method before handover'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_raw->'reseller_payments') loop
    if r->>'payment_date'<>p_day::text or coalesce((r->>'amount')::numeric,0)<=0 then continue; end if;
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

-- Privileged writes live in the unexposed schema. The public RPC is an invoker wrapper.
create function private.save_cash_handover(
  p_day date,p_previous_id uuid,p_action text,p_expected numeric,p_handed numeric,p_count numeric,
  p_handed_by text,p_handover_at timestamptz,p_notes text,p_request_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  prev public.cash_handover_events%rowtype; retry public.cash_handover_events%rowtype;
  raw jsonb; expenses jsonb; snapshot jsonb; expected numeric; payload jsonb;
  actor_name text; result uuid; count_at timestamptz;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then raise exception 'Owner access required'; end if;
  if p_day is null or p_day>(now() at time zone 'Asia/Manila')::date or p_request_id is null then raise exception 'Valid business date and request token required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash-handover:'||p_day::text,0));
  payload:=jsonb_build_object('day',p_day,'previous',p_previous_id,'action',p_action,'expected',p_expected,'handed',p_handed,'count',p_count,'by',p_handed_by,'at',p_handover_at,'notes',p_notes);
  select * into retry from public.cash_handover_events where request_id=p_request_id;
  if found then
    if retry.recorded_by<>auth.uid() or retry.request_payload<>payload then raise exception 'Request token already used for another submission'; end if;
    return retry.id;
  end if;
  select * into prev from public.cash_handover_events where business_date=p_day order by revision desc limit 1;
  if prev.id is distinct from p_previous_id then raise exception 'History changed; refresh before submitting'; end if;
  if p_action is null or p_action not in ('handover','count') then raise exception 'Invalid action'; end if;
  if p_handed is null or p_handed::text in ('NaN','Infinity','-Infinity') or p_handed<0 or p_handed<>round(p_handed,2)
    or (p_count is not null and (p_count::text in ('NaN','Infinity','-Infinity') or p_count<0 or p_count<>round(p_count,2))) then raise exception 'Enter nonnegative amounts with at most two decimal places'; end if;
  if nullif(trim(p_handed_by),'') is null or length(p_handed_by)>120 or p_handover_at is null or p_handover_at>clock_timestamp()
    or (p_handover_at at time zone 'Asia/Manila')::date<>p_day then raise exception 'Choose a handover time on the business date and name the person handing over'; end if;
  if length(coalesce(p_notes,''))>1000 then raise exception 'Notes must be at most 1000 characters'; end if;
  if p_action='count' then
    if prev.id is null or prev.owner_physical_count is not null or p_count is null then raise exception 'A pending handover is required for owner count'; end if;
    if p_handed<>prev.cash_handed_over or p_handed_by<>prev.handed_over_by or p_handover_at<>prev.handover_at then raise exception 'Owner count cannot change the handover'; end if;
    expected:=prev.system_expected_cash; snapshot:=prev.source_snapshot;
  else
    if prev.id is not null and nullif(trim(p_notes),'') is null then raise exception 'Correction reason required'; end if;
    raw:=public.owner_daily_receipts(p_day); expenses:=public.owner_cash_expenses_for_day(p_day);
    expected:=private.cash_handover_expected(p_day,raw,expenses);
    snapshot:=jsonb_build_object('logic','owner-dashboard-v1','receipts',raw,'cash_expenses',expenses);
  end if;
  if p_expected is null or p_expected<>expected then raise exception 'Expected cash changed; refresh and review before saving'; end if;
  if p_action='handover' and prev.id is not null and expected=prev.system_expected_cash
    and p_handed=prev.cash_handed_over and p_count is not distinct from prev.owner_physical_count
    and trim(p_handed_by)=prev.handed_over_by and p_handover_at=prev.handover_at then
    raise exception 'These handover and count values are already recorded';
  end if;
  select full_name into actor_name from public.admin_users where auth_user_id=auth.uid() and is_active=true order by id limit 1;
  if nullif(trim(actor_name),'') is null then raise exception 'An active named owner account is required'; end if;
  if p_action='count' then actor_name:=prev.received_by; end if;
  count_at:=case when p_count is not null then clock_timestamp() end;
  insert into public.cash_handover_events(business_date,revision,previous_id,request_id,request_payload,event_type,handover_at,handed_over_by,received_by,recorded_by,owner_count_at,notes,system_expected_cash,cash_handed_over,owner_physical_count,source_snapshot)
  values(p_day,coalesce(prev.revision,0)+1,prev.id,p_request_id,payload,p_action,p_handover_at,trim(p_handed_by),actor_name,auth.uid(),count_at,nullif(trim(p_notes),''),expected,p_handed,p_count,snapshot) returning id into result;
  return result;
end;
$$;
revoke all on function private.save_cash_handover(date,uuid,text,numeric,numeric,numeric,text,timestamptz,text,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_cash_handover(date,uuid,text,numeric,numeric,numeric,text,timestamptz,text,uuid) to authenticated;
create function public.owner_save_cash_handover(
  p_day date,p_previous_id uuid,p_action text,p_expected numeric,p_handed numeric,p_count numeric,
  p_handed_by text,p_handover_at timestamptz,p_notes text,p_request_id uuid
) returns uuid language sql security invoker set search_path='' as $$
  select private.save_cash_handover(p_day,p_previous_id,p_action,p_expected,p_handed,p_count,p_handed_by,p_handover_at,p_notes,p_request_id);
$$;
revoke all on function public.owner_save_cash_handover(date,uuid,text,numeric,numeric,numeric,text,timestamptz,text,uuid) from public,anon;
grant execute on function public.owner_save_cash_handover(date,uuid,text,numeric,numeric,numeric,text,timestamptz,text,uuid) to authenticated;
