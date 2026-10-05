-- Owner-confirmed expense payment classifications. Events are append-only so corrections remain auditable.
create table public.owner_expense_payment_events (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.daily_expenses(id),
  expense_amount numeric(12,2) not null check (expense_amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'gcash', 'other_online', 'unpaid')),
  paid_date date,
  note text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  constraint owner_expense_payment_date_valid check (
    (payment_method = 'unpaid' and paid_date is null)
    or (payment_method <> 'unpaid' and paid_date is not null)
  )
);

create index owner_expense_payment_events_latest_idx
  on public.owner_expense_payment_events (expense_id, created_at desc, id desc);

alter table public.owner_expense_payment_events enable row level security;
revoke all on public.owner_expense_payment_events from public, anon, authenticated;
grant select on public.owner_expense_payment_events to authenticated;
create policy owner_expense_payment_events_owner_read
  on public.owner_expense_payment_events for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner']));

create function public.owner_record_expense_payment(
  p_expense_id uuid,
  p_payment_method text,
  p_paid_date date,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_expense public.daily_expenses%rowtype;
  v_method text := lower(trim(coalesce(p_payment_method, '')));
  v_previous public.owner_expense_payment_events%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then
    raise exception 'Owner access required';
  end if;
  select * into v_expense from public.daily_expenses where id = p_expense_id for update;
  if not found or lower(coalesce(v_expense.status, '')) <> 'approved' then
    raise exception 'An approved expense is required';
  end if;
  if v_expense.amount is null or v_expense.amount <= 0 then
    raise exception 'The approved expense must have a positive amount';
  end if;
  if v_method not in ('cash', 'gcash', 'other_online', 'unpaid') then
    raise exception 'Choose a valid expense payment method';
  end if;
  if (v_method = 'unpaid' and p_paid_date is not null)
      or (v_method <> 'unpaid' and (p_paid_date is null or p_paid_date > (now() at time zone 'Asia/Manila')::date)) then
    raise exception 'Choose a valid paid date, or leave it blank for unpaid';
  end if;
  select * into v_previous from public.owner_expense_payment_events
    where expense_id = p_expense_id order by created_at desc, id desc limit 1;
  if found and v_previous.payment_method = v_method
      and v_previous.paid_date is not distinct from p_paid_date
      and v_previous.expense_amount = round(v_expense.amount::numeric, 2) then
    raise exception 'This payment classification is already recorded';
  end if;
  if found and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'A correction note is required';
  end if;
  insert into public.owner_expense_payment_events
    (expense_id, expense_amount, payment_method, paid_date, note, recorded_by)
  values
    (p_expense_id, round(v_expense.amount::numeric, 2), v_method, p_paid_date,
      nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.owner_record_expense_payment(uuid, text, date, text) from public, anon;
grant execute on function public.owner_record_expense_payment(uuid, text, date, text) to authenticated;

create function public.owner_cash_expenses_for_day(p_day date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then
    raise exception 'Owner access required';
  end if;
  if p_day is null then raise exception 'A report date is required'; end if;
  with latest as (
    select distinct on (expense_id) expense_id, expense_amount, payment_method,
      paid_date, note, created_at as classified_at
    from public.owner_expense_payment_events
    order by expense_id, created_at desc, id desc
  ), relevant as (
    select e.id, e.expense_date, e.category, e.description, e.amount, e.status,
      e.created_at, l.expense_amount as classified_amount, l.payment_method,
      l.paid_date, l.note as payment_note, l.classified_at
    from public.daily_expenses e
    left join latest l on l.expense_id = e.id
    where e.expense_date = p_day or l.paid_date = p_day
  )
  select coalesce(jsonb_agg(to_jsonb(relevant) order by relevant.created_at, relevant.id), '[]'::jsonb)
    into v_result from relevant;
  return v_result;
end;
$$;

revoke all on function public.owner_cash_expenses_for_day(date) from public, anon;
grant execute on function public.owner_cash_expenses_for_day(date) to authenticated;
