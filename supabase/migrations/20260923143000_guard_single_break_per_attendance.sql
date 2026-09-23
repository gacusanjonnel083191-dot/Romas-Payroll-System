-- Prevent duplicate break rows from being created for the same attendance shift.
-- Historical duplicate rows are intentionally left untouched; this migration only
-- protects new inserts. The advisory transaction lock closes concurrent insert races.

create or replace function public.guard_single_break_per_attendance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_attendance_log_id text;
begin
  v_attendance_log_id := nullif(trim(coalesce(new.attendance_log_id, '')), '');

  if v_attendance_log_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_attendance_log_id, 0));

  if exists (
    select 1
    from public.break_logs bl
    where bl.attendance_log_id = v_attendance_log_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'BREAK_ALREADY_RECORDED: Only one break is allowed per attendance shift.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_single_break_per_attendance on public.break_logs;
create trigger trg_guard_single_break_per_attendance
before insert on public.break_logs
for each row
execute function public.guard_single_break_per_attendance();
