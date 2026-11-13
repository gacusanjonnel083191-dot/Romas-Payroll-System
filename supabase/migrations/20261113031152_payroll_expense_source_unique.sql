-- Local proposal only. Existing tagged historical expense rows are preserved.
-- New payroll postings identify their source period for database-level idempotence.
alter table public.daily_expenses
  add column if not exists payroll_start date,
  add column if not exists payroll_end date;

alter table public.daily_expenses
  add constraint daily_expenses_payroll_period_pair
  check ((payroll_start is null and payroll_end is null)
      or (payroll_start is not null and payroll_end is not null and payroll_end >= payroll_start));

create unique index if not exists daily_expenses_one_payroll_post_per_period
  on public.daily_expenses (payroll_start,payroll_end)
  where category = 'Payroll Expense' and payroll_start is not null;
