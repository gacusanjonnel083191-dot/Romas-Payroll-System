-- Roma's Donuts: targeted indexes for the hot read paths identified during the
-- 2026-09-15 Supabase egress/performance audit.
-- Prepared only; do not apply to production without an approved migration window.

create index if not exists idx_break_logs_attendance_log_created
  on public.break_logs (attendance_log_id, created_at);

create index if not exists idx_time_adjustment_status_created
  on public.time_adjustment_requests (status, created_at desc);

create index if not exists idx_audit_logs_created_at_desc
  on public.audit_logs (created_at desc);

-- Existing indexes already cover these hot paths and are intentionally not duplicated:
-- attendance_logs(employee_id, attendance_date, updated_at desc)
-- daily_schedules(employee_id, schedule_date)
-- time_adjustment_requests(employee_id, attendance_date, request_type, status)
-- payroll_records(employee_id, payroll_start, payroll_end)
-- delivery_invoices delivery_date/reseller date paths
-- delivery_invoice_items(invoice_id)
-- reseller_return_items(return_id)
