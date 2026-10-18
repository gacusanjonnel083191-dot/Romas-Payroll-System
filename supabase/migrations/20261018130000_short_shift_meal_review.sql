-- Effective with the October 11-25 cutoff. Leave October 6-10 records intact.
create or replace function public.guard_retired_no_meal_break_policy()
returns trigger language plpgsql security invoker set search_path = pg_catalog, pg_temp
as $$
declare
 v_span integer;
begin
 if lower(coalesce(new.request_type,'')) = 'meal_break' then
  if new.attendance_date::date < date '2026-10-11' then
   raise exception 'No Meal Break filing is unavailable before October 11, 2026.';
  end if;
  if tg_op = 'INSERT' or lower(coalesce(new.status,'')) in ('pending','approved') then
   select sum(
    (extract(epoch from al.time_out - al.time_in) / 60)::integer
    + case when al.time_out < al.time_in then 1440 else 0 end
   ) into v_span
   from public.attendance_logs al
   where al.employee_id = new.employee_id
     and al.attendance_date = new.attendance_date::date
     and al.time_in is not null and al.time_out is not null
     and lower(coalesce(al.status,'')) <> 'absent';
   if coalesce(v_span,0) <= 300 then
    raise exception 'No Meal Break review requires a completed shift longer than five hours.';
   end if;
  end if;
 end if;
 return new;
end;
$$;

create or replace function public.guard_retired_attendance_meal_override()
returns trigger language plpgsql security invoker set search_path = pg_catalog, pg_temp
as $$
begin
 if new.attendance_date::date >= date '2026-10-06'
    and new.attendance_date::date < date '2026-10-11'
    and (coalesce(new.meal_break_exception_approved,false) or new.approved_unpaid_break_minutes is not null) then
  raise exception 'Meal-break overrides are disabled for October 6-10, 2026.';
 end if;
 if new.attendance_date::date >= date '2026-10-11'
    and coalesce(new.meal_break_exception_approved,false)
    and (new.time_in is null or new.time_out is null
      or (extract(epoch from new.time_out - new.time_in) / 60)::integer
         + case when new.time_out < new.time_in then 1440 else 0 end <= 300) then
  raise exception 'No Meal Break approval requires a completed shift longer than five hours.';
 end if;
 return new;
end;
$$;

notify pgrst, 'reload schema';
