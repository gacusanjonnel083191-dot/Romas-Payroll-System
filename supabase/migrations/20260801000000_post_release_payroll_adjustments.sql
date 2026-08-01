-- Roma's Donuts Main App 68
-- Idempotent schema support for released-period OT/UT adjustments.
-- Run this in the Supabase SQL Editor before deploying App(68).jsx.

begin;

alter table public.payroll_adjustments
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_payroll_start date,
  add column if not exists source_payroll_end date,
  add column if not exists source_attendance_date date,
  add column if not exists source_minutes integer,
  add column if not exists source_rate numeric,
  add column if not exists source_multiplier numeric,
  add column if not exists created_by text;

create unique index if not exists ux_payroll_adjustments_source
  on public.payroll_adjustments (source_type, source_id)
  where source_type is not null and source_id is not null;

create index if not exists ix_payroll_adjustments_source_period
  on public.payroll_adjustments (employee_id, source_payroll_start, source_payroll_end);

comment on column public.payroll_adjustments.source_type is
  'Origin table/workflow for an automatically linked adjustment.';
comment on column public.payroll_adjustments.source_id is
  'Stable source record identifier. Unique with source_type to prevent duplicate posting.';
comment on column public.payroll_adjustments.source_payroll_start is
  'Start date of the released payroll that remains unchanged.';
comment on column public.payroll_adjustments.source_payroll_end is
  'End date of the released payroll that remains unchanged.';
comment on column public.payroll_adjustments.source_attendance_date is
  'Original attendance date that caused the prior-period adjustment.';
comment on column public.payroll_adjustments.source_minutes is
  'Policy-qualified OT/UT minutes approved from actual attendance.';
comment on column public.payroll_adjustments.source_rate is
  'Hourly rate snapshot used when the adjustment was calculated.';
comment on column public.payroll_adjustments.source_multiplier is
  'Premium multiplier snapshot used when the adjustment was calculated.';
comment on column public.payroll_adjustments.created_by is
  'Admin identity recorded by the application when the adjustment was created.';

commit;

notify pgrst, 'reload schema';
