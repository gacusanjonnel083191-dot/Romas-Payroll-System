import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

test('database migration preserves exact OT, blocks retired filings, and protects started schedules',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
   create table public.attendance_logs(id uuid,employee_id uuid,attendance_date date,time_in time,time_out time,status text,created_at timestamptz,total_break_minutes int,shift_start time,shift_end time,overtime_minutes int,undertime_minutes int,meal_break_exception_approved boolean,approved_unpaid_break_minutes int);
   create table public.time_adjustment_requests(id bigint,employee_id uuid,attendance_date text,request_type text,status text,minutes int);
   create table public.payroll_records(id uuid);
   create table public.break_logs(attendance_log_id text,break_minutes int,break_out time,break_in time);
   create table public.daily_schedules(employee_id uuid,schedule_date date,shift_start time,shift_end time,notes text);
   create trigger normalize_att before insert or update on attendance_logs for each row execute function pg_catalog.suppress_redundant_updates_trigger();`)
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261006064018_attendance_minute_policy.sql',import.meta.url),'utf8'))
  await db.exec(`drop trigger normalize_att on attendance_logs;
   create trigger normalize_att before insert or update on attendance_logs for each row execute function normalize_attendance_ot_ut_policy_minutes();
   create trigger normalize_req before insert or update on time_adjustment_requests for each row execute function normalize_time_adjustment_policy_minutes();
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,shift_start,shift_end,overtime_minutes,undertime_minutes)
   values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','2026-10-06','15:00','00:17','Completed','15:00','00:00',17,11);`)
  const result=await db.query('select overtime_minutes,undertime_minutes from attendance_logs')
  assert.deepEqual(result.rows,[{overtime_minutes:17,undertime_minutes:30}])
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('00000000-0000-0000-0000-000000000002','2026-10-06','overtime','pending',17)`)
  assert.equal((await db.query('select minutes from time_adjustment_requests')).rows[0].minutes,17)
  await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('00000000-0000-0000-0000-000000000002','2026-10-06','meal_break','pending',0)`),/No Meal Break/)
  await assert.rejects(db.exec(`update attendance_logs set meal_break_exception_approved=true,approved_unpaid_break_minutes=0`),/overrides are disabled/)
  await assert.rejects(db.exec(`insert into daily_schedules values('00000000-0000-0000-0000-000000000002','2026-10-06','16:00','01:00',null)`),/after Time In/)
  await db.exec(`insert into attendance_logs(attendance_date,overtime_minutes,undertime_minutes) values('2026-10-05',17,11)`)
  assert.equal((await db.query("select overtime_minutes from attendance_logs where attendance_date='2026-10-05'")).rows[0].overtime_minutes,0)
 } finally {await db.close()}
})
