-- Cart installment accounts are independent from cash advances and donut invoices.
create table if not exists public.rolling_cart_loans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete restrict,
  reseller_id uuid references public.resellers(id) on delete restrict,
  borrower_type text not null check (borrower_type in ('employee','reseller')),
  cart_identifier text not null,
  agreement_id uuid references public.company_document_records(id) on delete set null,
  start_date date not null,
  cart_price numeric(12,2) not null check (cart_price > 0),
  balance numeric(12,2) not null check (balance >= 0),
  installment_amount numeric(12,2) check (installment_amount > 0),
  frequency text not null default 'Flexible' check (frequency in ('Flexible','Weekly','Semi-monthly','Monthly')),
  first_due_date date,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check ((borrower_type='employee' and employee_id is not null) or (borrower_type='reseller' and reseller_id is not null)),
  check (balance <= cart_price)
);
create index if not exists rolling_cart_loans_employee_idx on public.rolling_cart_loans(employee_id);
create index if not exists rolling_cart_loans_reseller_idx on public.rolling_cart_loans(reseller_id);
create table if not exists public.rolling_cart_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.rolling_cart_loans(id) on delete restrict,
  event_type text not null check (event_type in ('payment','reversal')),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null,
  method text not null check (method in ('Cash','GCash','Bank Transfer','Other')),
  reference_number text,
  notes text,
  reverses_payment_id uuid unique references public.rolling_cart_payments(id) on delete restrict,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  check ((event_type='payment' and reverses_payment_id is null) or (event_type='reversal' and reverses_payment_id is not null))
);
create index if not exists rolling_cart_payments_loan_idx on public.rolling_cart_payments(loan_id,created_at);
alter table public.rolling_cart_loans enable row level security;
alter table public.rolling_cart_payments enable row level security;
revoke all on public.rolling_cart_loans, public.rolling_cart_payments from public,anon,authenticated;
grant select on public.rolling_cart_loans, public.rolling_cart_payments to authenticated;
create policy rolling_cart_loans_owner_read on public.rolling_cart_loans for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner']));
create policy rolling_cart_payments_owner_read on public.rolling_cart_payments for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner']));

-- All money changes go through these owner-checked, atomic functions.
create or replace function public.create_rolling_cart_loan(
  p_borrower_type text,p_employee_id uuid,p_reseller_id uuid,p_cart_identifier text,
  p_agreement_id uuid,p_start_date date,p_cart_price numeric,p_down_payment numeric,
  p_installment_amount numeric,p_frequency text,p_first_due_date date,p_notes text,
  p_down_method text,p_down_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then raise exception 'Owner access required'; end if;
  if p_borrower_type not in ('employee','reseller') or
    (p_borrower_type='employee' and p_employee_id is null) or
    (p_borrower_type='reseller' and p_reseller_id is null) then raise exception 'Select the responsible borrower'; end if;
  if nullif(trim(p_cart_identifier),'') is null or p_start_date is null or p_cart_price is null or p_cart_price<=0 or p_cart_price<>round(p_cart_price,2)
    or p_down_payment is null or p_down_payment<0 or p_down_payment>p_cart_price or p_down_payment<>round(p_down_payment,2) then raise exception 'Enter valid cart price and down payment'; end if;
  if p_down_payment>0 and p_down_method not in ('Cash','GCash','Bank Transfer','Other') then raise exception 'Select down payment method'; end if;
  if p_agreement_id is not null and not exists(select 1 from public.company_document_records where id=p_agreement_id and form_key='RES-CART' and (p_reseller_id is null or reseller_id=p_reseller_id)) then raise exception 'Select a matching rolling cart agreement'; end if;
  insert into public.rolling_cart_loans(employee_id,reseller_id,borrower_type,cart_identifier,agreement_id,start_date,cart_price,balance,installment_amount,frequency,first_due_date,notes,created_by)
  values(p_employee_id,p_reseller_id,p_borrower_type,trim(p_cart_identifier),p_agreement_id,p_start_date,p_cart_price,p_cart_price-p_down_payment,p_installment_amount,coalesce(p_frequency,'Flexible'),p_first_due_date,nullif(trim(p_notes),''),auth.uid()) returning id into v_id;
  if p_down_payment>0 then
    insert into public.rolling_cart_payments(loan_id,event_type,amount,payment_date,method,reference_number,notes,recorded_by)
    values(v_id,'payment',p_down_payment,p_start_date,p_down_method,nullif(trim(p_down_reference),''),'Down payment',auth.uid());
  end if;
  return v_id;
end; $$;

create or replace function public.record_rolling_cart_payment(
  p_loan_id uuid,p_amount numeric,p_payment_date date,p_method text,p_reference text,p_notes text,p_request_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_loan public.rolling_cart_loans%rowtype;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then raise exception 'Owner access required'; end if;
  if p_request_id is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_payment_date is null
    or p_method not in ('Cash','GCash','Bank Transfer','Other') then raise exception 'Enter a valid payment'; end if;
  select * into v_loan from public.rolling_cart_loans where id=p_loan_id for update;
  if not found then raise exception 'Cart loan not found'; end if;
  if exists(select 1 from public.rolling_cart_payments where id=p_request_id and loan_id=p_loan_id and event_type='payment'
    and amount=p_amount and payment_date=p_payment_date and method=p_method) then return p_request_id; end if;
  if exists(select 1 from public.rolling_cart_payments where id=p_request_id) then raise exception 'Payment request already used'; end if;
  if p_amount>v_loan.balance then raise exception 'Payment exceeds outstanding balance'; end if;
  insert into public.rolling_cart_payments(id,loan_id,event_type,amount,payment_date,method,reference_number,notes,recorded_by)
  values(p_request_id,p_loan_id,'payment',p_amount,p_payment_date,p_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),auth.uid());
  update public.rolling_cart_loans set balance=balance-p_amount where id=p_loan_id;
  return p_request_id;
end; $$;

create or replace function public.reverse_rolling_cart_payment(p_payment_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_payment public.rolling_cart_payments%rowtype; v_id uuid;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then raise exception 'Owner access required'; end if;
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Enter a correction reason (at least 10 characters)'; end if;
  select * into v_payment from public.rolling_cart_payments where id=p_payment_id and event_type='payment';
  if not found then raise exception 'Payment not found'; end if;
  perform 1 from public.rolling_cart_loans where id=v_payment.loan_id for update;
  if exists(select 1 from public.rolling_cart_payments where reverses_payment_id=p_payment_id) then raise exception 'Payment already reversed'; end if;
  insert into public.rolling_cart_payments(loan_id,event_type,amount,payment_date,method,reference_number,notes,reverses_payment_id,recorded_by)
  values(v_payment.loan_id,'reversal',v_payment.amount,(now() at time zone 'Asia/Manila')::date,v_payment.method,v_payment.reference_number,trim(p_reason),p_payment_id,auth.uid()) returning id into v_id;
  update public.rolling_cart_loans set balance=balance+v_payment.amount where id=v_payment.loan_id;
  return v_id;
end; $$;
revoke all on function public.create_rolling_cart_loan(text,uuid,uuid,text,uuid,date,numeric,numeric,numeric,text,date,text,text,text) from public,anon;
revoke all on function public.record_rolling_cart_payment(uuid,numeric,date,text,text,text,uuid) from public,anon;
revoke all on function public.reverse_rolling_cart_payment(uuid,text) from public,anon;
grant execute on function public.create_rolling_cart_loan(text,uuid,uuid,text,uuid,date,numeric,numeric,numeric,text,date,text,text,text) to authenticated;
grant execute on function public.record_rolling_cart_payment(uuid,numeric,date,text,text,text,uuid) to authenticated;
grant execute on function public.reverse_rolling_cart_payment(uuid,text) to authenticated;
notify pgrst, 'reload schema';
