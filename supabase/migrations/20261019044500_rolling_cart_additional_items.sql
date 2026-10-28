-- Dated equipment issued on credit increases the cart loan balance.
alter table public.rolling_cart_loans drop constraint if exists rolling_cart_loans_check1;

create table public.rolling_cart_charges (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.rolling_cart_loans(id) on delete restrict,
  event_type text not null check (event_type in ('charge','reversal')),
  category text not null check (category in ('Uniform','Additional Tray','Solar Light','Others')),
  description text,
  charge_date date not null,
  quantity integer not null check (quantity > 0),
  unit_amount numeric(12,2) not null check (unit_amount > 0),
  total_amount numeric(12,2) generated always as (quantity * unit_amount) stored,
  reverses_charge_id uuid unique references public.rolling_cart_charges(id) on delete restrict,
  notes text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  check (category <> 'Others' or nullif(trim(description),'') is not null),
  check ((event_type='charge' and reverses_charge_id is null) or (event_type='reversal' and reverses_charge_id is not null))
);
create index rolling_cart_charges_loan_idx on public.rolling_cart_charges(loan_id,created_at);
alter table public.rolling_cart_charges enable row level security;
revoke all on public.rolling_cart_charges from public,anon,authenticated;
grant select on public.rolling_cart_charges to authenticated;
create policy rolling_cart_charges_owner_read on public.rolling_cart_charges for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner']));

create function public.add_rolling_cart_charge(
  p_loan_id uuid,p_category text,p_description text,p_charge_date date,
  p_quantity integer,p_unit_amount numeric,p_notes text,p_request_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_total numeric(12,2);
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then raise exception 'Owner access required'; end if;
  if p_request_id is null or p_category not in ('Uniform','Additional Tray','Solar Light','Others') or p_charge_date is null
     or p_quantity is null or p_quantity<=0 or p_unit_amount is null or p_unit_amount<=0 or p_unit_amount<>round(p_unit_amount,2)
     or (p_category='Others' and nullif(trim(p_description),'') is null) then raise exception 'Enter valid item, date, quantity and unit amount'; end if;
  v_total := p_quantity * p_unit_amount;
  perform 1 from public.rolling_cart_loans where id=p_loan_id for update;
  if not found then raise exception 'Cart loan not found'; end if;
  if exists(select 1 from public.rolling_cart_charges where id=p_request_id and loan_id=p_loan_id and event_type='charge'
    and category=p_category and description is not distinct from nullif(trim(p_description),'')
    and charge_date=p_charge_date and quantity=p_quantity and unit_amount=p_unit_amount) then return p_request_id; end if;
  if exists(select 1 from public.rolling_cart_charges where id=p_request_id) then raise exception 'Charge request already used'; end if;
  insert into public.rolling_cart_charges(id,loan_id,event_type,category,description,charge_date,quantity,unit_amount,notes,recorded_by)
  values(p_request_id,p_loan_id,'charge',p_category,nullif(trim(p_description),''),p_charge_date,p_quantity,p_unit_amount,nullif(trim(p_notes),''),auth.uid());
  update public.rolling_cart_loans set balance=balance+v_total where id=p_loan_id;
  return p_request_id;
end; $$;

create function public.reverse_rolling_cart_charge(p_charge_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_charge public.rolling_cart_charges%rowtype; v_balance numeric; v_id uuid;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner']) then raise exception 'Owner access required'; end if;
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Enter a correction reason (at least 10 characters)'; end if;
  select * into v_charge from public.rolling_cart_charges where id=p_charge_id and event_type='charge';
  if not found then raise exception 'Charge not found'; end if;
  select balance into v_balance from public.rolling_cart_loans where id=v_charge.loan_id for update;
  if exists(select 1 from public.rolling_cart_charges where reverses_charge_id=p_charge_id) then raise exception 'Charge already reversed'; end if;
  if v_balance < v_charge.total_amount then raise exception 'Cannot reverse: payments have already covered this charge; reconcile payments first'; end if;
  insert into public.rolling_cart_charges(loan_id,event_type,category,description,charge_date,quantity,unit_amount,reverses_charge_id,notes,recorded_by)
  values(v_charge.loan_id,'reversal',v_charge.category,v_charge.description,(now() at time zone 'Asia/Manila')::date,v_charge.quantity,v_charge.unit_amount,p_charge_id,trim(p_reason),auth.uid()) returning id into v_id;
  update public.rolling_cart_loans set balance=balance-v_charge.total_amount where id=v_charge.loan_id;
  return v_id;
end; $$;
revoke all on function public.add_rolling_cart_charge(uuid,text,text,date,integer,numeric,text,uuid) from public,anon;
revoke all on function public.reverse_rolling_cart_charge(uuid,text) from public,anon;
grant execute on function public.add_rolling_cart_charge(uuid,text,text,date,integer,numeric,text,uuid) to authenticated;
grant execute on function public.reverse_rolling_cart_charge(uuid,text) to authenticated;
notify pgrst, 'reload schema';
