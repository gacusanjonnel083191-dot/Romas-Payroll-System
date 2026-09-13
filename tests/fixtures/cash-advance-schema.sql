create schema private; create schema auth;
create role anon; create role authenticated;
grant usage on schema public,private,auth to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.cash_advances (advance_date date,amount numeric,amount_paid numeric,approved_at timestamp with time zone,approved_by text,balance numeric,created_at timestamp with time zone,employee_code text,employee_id uuid,employee_name text,id uuid primary key,installments_remaining integer,installments_total integer,notes text,per_payroll_deduction numeric,source_request_id text,status text);
create table public.payroll_periods (acknowledge_deadline text,computed_at timestamp with time zone,id integer primary key,payroll_end text,payroll_start text,payroll_status text,review_sent_at timestamp with time zone,review_sent_by text);
create table public.payroll_records (absence_deduction numeric,absent_days numeric,adjustment_breakdown jsonb,approved_at timestamp with time zone,approved_by text,bank_account text,bank_account_name text,bank_account_number text,bank_name text,basic_pay numeric,birthday_pay numeric,cash_advance_breakdown jsonb,cash_advance_deduction numeric,created_at timestamp with time zone,deferred_cash_advance_deduction numeric,employee_acknowledgement text,employee_code text,employee_id uuid,employee_name text,excess_break_deduction numeric,gross_pay numeric,holiday_pay numeric,holiday_pay_exempted numeric,holiday_pay_exemption_note text,id uuid primary key,late_deduction numeric,late_minutes integer,net_pay numeric,night_diff_minutes numeric,night_diff_pay numeric,non_ca_deduction_overflow numeric,other_deductions numeric,other_earnings numeric,overtime_minutes integer,overtime_pay numeric,pagibig_deduction numeric,paid_leave_days numeric,paid_leave_pay numeric,payroll_approved boolean,payroll_cost_label text,payroll_cost_type text,payroll_end date,payroll_locked boolean,payroll_released boolean,payroll_start date,payroll_status text,payslip_serial text,philhealth_deduction numeric,regular_paid_minutes numeric,released_at timestamp with time zone,released_by text,requested_cash_advance_deduction numeric,review_sent_at timestamp with time zone,review_sent_by text,sss_deduction numeric,thirteenth_month_basis numeric,total_deductions numeric,total_earnings numeric,total_worked_minutes numeric,undertime_deduction numeric,undertime_minutes integer,unpaid_leave_days numeric,worked_basic_pay numeric,worked_days numeric);
create table public.admin_users (auth_user_id uuid,created_at timestamp with time zone,email text,employee_id text,extra_roles text,full_name text,id uuid primary key,is_active boolean,notes text,role text,updated_at timestamp with time zone);
create table public.daily_expenses (amount numeric,approved_at timestamp with time zone,approved_by text,category text,created_at timestamp with time zone,description text,encoded_by text,expense_date date,id uuid primary key,rejection_reason text,status text);
create table public.time_adjustment_requests (admin_reason text,attendance_date text,created_at timestamp with time zone,employee_code text,employee_id uuid,employee_name text,employee_reason text,id integer primary key,minutes integer,request_type text,reviewed_at timestamp with time zone,reviewed_by text,status text);
create table public.audit_logs(id integer generated always as identity primary key,action text,performed_by text,target_employee text,details text,created_at timestamptz default now());
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
CREATE OR REPLACE FUNCTION private.cash_advance_admin_has_role(p_allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.admin_users au
      where au.auth_user_id = (select auth.uid())
        and au.is_active = true
        and (
          lower(btrim(au.role)) = any (p_allowed_roles)
          or exists (
            select 1
            from unnest(string_to_array(lower(coalesce(au.extra_roles, '')), ',')) as extra(role_name)
            where btrim(extra.role_name) = any (p_allowed_roles)
          )
        )
    );
$function$
;
alter table public.cash_advances enable row level security;
create policy ca_admin_select on public.cash_advances for select to authenticated using(private.cash_advance_admin_has_role(array['owner','payroll']));
create policy ca_owner_insert on public.cash_advances for insert to authenticated with check(private.cash_advance_admin_has_role(array['owner']));
create policy ca_admin_update on public.cash_advances for update to authenticated using(private.cash_advance_admin_has_role(array['owner','payroll'])) with check(private.cash_advance_admin_has_role(array['owner','payroll']));
create policy ca_owner_delete on public.cash_advances for delete to authenticated using(private.cash_advance_admin_has_role(array['owner']));
CREATE OR REPLACE FUNCTION public.enforce_payroll_release_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if lower(trim(coalesce(new.payroll_status, ''))) = 'released'
     or coalesce(new.payroll_released, false) = true then
    new.payroll_status := 'released';
    new.payroll_approved := true;
    new.payroll_released := true;
    new.payroll_locked := true;
    new.approved_at := coalesce(new.approved_at, new.released_at, new.created_at, now());
    new.released_at := coalesce(new.released_at, new.approved_at, new.created_at, now());
    new.released_by := coalesce(new.released_by, new.approved_by);
  end if;
  return new;
end;
$function$
;
create trigger trg_enforce_payroll_release_state before insert or update of payroll_status,payroll_approved,payroll_released,payroll_locked,approved_at,released_at on public.payroll_records for each row execute function public.enforce_payroll_release_state();

