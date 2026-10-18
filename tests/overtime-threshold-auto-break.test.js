import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { PGlite } from '@electric-sql/pglite'
import { usesMinuteAttendancePolicy, usesOvertimeThresholdPolicy, usesEarlyArrivalStartPolicy, usesShortShiftMealPolicy, SHORT_SHIFT_MAX_MINUTES, creditedAttendanceStartMinute, policyBreakMinutes, policyOvertimeBasis, payableOvertimeMinutes } from '../src/attendancePolicy20261006.js'
import { getAppliedPaidWorkGraceMinutes, getChargeableEarlyOutMinutes } from '../src/attendancePolicy.js'
import { enforceNoScheduleGraceBehavior } from '../vite.no-schedule-grace-invariant.js'
const source=enforceNoScheduleGraceBehavior(fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8').replace(/\r\n/g,'\n'),'/repo/src/App.jsx')
function extract(name) {
 const start=source.indexOf(`function ${name}(`)
 assert.ok(start>=0,name)
 const end=source.indexOf('\nfunction ',start+1)
 return source.slice(start,end)
}
function appContext() {
 const ctx={usesMinuteAttendancePolicy,usesOvertimeThresholdPolicy,usesEarlyArrivalStartPolicy,usesShortShiftMealPolicy,SHORT_SHIFT_MAX_MINUTES,creditedAttendanceStartMinute,policyBreakMinutes,policyOvertimeBasis,payableOvertimeMinutes,getAppliedPaidWorkGraceMinutes,getChargeableEarlyOutMinutes,
  ALLOWED_BREAK_MINUTES:60,REQUIRED_PAID_WORK_MINUTES:480,DEFAULT_LATE_GRACE_MINUTES:10,UNDERTIME_BLOCK_MINUTES:30,
  getAttendanceDayIntegrity:logs=>({isValidCompleted:logs.every(l=>l.time_in&&l.time_out),completedLogs:logs})}
 vm.createContext(ctx)
 for(const name of ['safeNum','minutesFromTime','normalizeTimeInputValue','clockMinuteToTimeValue','getClockMinuteNearestTimeline','diffMinutesAcrossMidnight','getApprovedMealBreakOverrideMinutes','getRecordedBreakMinutes','getCombinedAttendanceSpanMinutes','roundPenaltyMinutes','roundChargeableUndertimeMinutes','getScheduleAnchoredAttendanceMetrics','getAttendanceDayWorkMetrics','getPayrollAttendanceDeductionSplit','roundPayableOvertimeMinutes','getAttendanceDayActualOvertimeMinutes','getAttendanceDayActualOvertimeWindow','getAttendanceOvertimeDisplayStatus']) vm.runInContext(extract(name),ctx)
 return ctx
}
function log(time_in,time_out,br=60,shift_start=null,shift_end=null,date='2026-10-11') {
 return {id:'a',attendance_date:date,time_in,time_out,total_break_minutes:br,shift_start,shift_end,status:'Overtime - Pending Filing',late_minutes:0}
}
test('strict threshold counts the full eligible duration from 30, preserves earlier dates',()=>{
 for(const n of [0,1,29,30,30.9,31,45,59,60,61,127,Infinity,NaN,-5]) {
  const whole=Number.isFinite(n)?Math.max(0,Math.floor(n)):0
  assert.equal(payableOvertimeMinutes(n,'2026-10-11'),whole>=30?whole:0)
 }
 assert.equal(payableOvertimeMinutes(17,'2026-10-10'),17)
 assert.equal(payableOvertimeMinutes(59,'2026-10-05'),30)
})
test('five-hour boundary applies recorded breaks; longer shifts await review or retain punches',()=>{
 for(const span of [60,240,300]) assert.equal(policyBreakMinutes({date:'2026-10-11',spanMinutes:span,recordedMinutes:0}),0)
 for(const span of [301,536,539,540,571]) assert.equal(policyBreakMinutes({date:'2026-10-11',spanMinutes:span,recordedMinutes:0}),0)
 assert.equal(policyBreakMinutes({date:'2026-10-11',spanMinutes:301,recordedMinutes:15}),60)
 assert.equal(policyBreakMinutes({date:'2026-10-11',spanMinutes:600,recordedMinutes:0,legacyOverride:0}),0)
 assert.equal(policyBreakMinutes({date:'2026-10-11',spanMinutes:600,recordedMinutes:75}),75)
 assert.equal(policyBreakMinutes({date:'2026-10-11',spanMinutes:5,recordedMinutes:0}),0)
 assert.equal(policyBreakMinutes({date:'2026-10-10',spanMinutes:536,recordedMinutes:48}),48)
})
test('Sheryl four-hour shifts have no meal deduction while scheduled undertime remains',()=>{
 const ctx=appContext()
 for(const [date,timeIn,timeOut] of [
  ['2026-10-16','07:56','12:01'],
  ['2026-10-18','08:01','12:03']
 ]) {
  const metrics=ctx.getAttendanceDayWorkMetrics([log(timeIn,timeOut,0,'08:00','17:00',date)])
  assert.equal(metrics.deductedBreakMinutes,0)
  assert.ok(metrics.paidWorkedMinutes>=240)
  assert.equal(metrics.undertimeMinutes,240)
 }
 const sixHours=ctx.getAttendanceDayWorkMetrics([log('08:00','14:00',0,'08:00','17:00')])
 assert.equal(sixHours.deductedBreakMinutes,0)
 assert.equal(sixHours.undertimeMinutes,120)
})
test('Myra October 16 short shift credits the full continuous duty and keeps separate undertime',()=>{
 const ctx=appContext()
 const metrics=ctx.getAttendanceDayWorkMetrics([{...log('08:09:48','12:01:36',0,'08:00','17:00','2026-10-16'),grace_period_minutes:10}])
 assert.equal(metrics.deductedBreakMinutes,0)
 assert.equal(metrics.undertimeMinutes,270)
})
test('actual app calculation clears all four screenshot flags and uses 60 minutes',()=>{
 const ctx=appContext()
 for(const row of [log('11:57:51','21:03:40',58),log('08:56:11','18:00:52',56),log('08:07:20','17:03:14',48),log('08:01:20','17:03:23',39,'08:00','17:00')]) {
  const metrics=ctx.getAttendanceDayWorkMetrics([row])
  assert.equal(metrics.deductedBreakMinutes,60)
  assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([row]),0)
  assert.equal(ctx.getAttendanceOvertimeDisplayStatus(row),'Completed')
 }
})
test('actual filing window and badge respect 29/30/31 on day and overnight shifts',()=>{
 const ctx=appContext()
 for(const [start,end,shiftEnd] of [['08:00','17:29','17:00'],['08:00','17:30','17:00'],['08:00','17:31','17:00'],['15:00','00:29','00:00'],['15:00','00:30','00:00'],['15:00','00:31','00:00']]) {
  const row=log(start,end,39,start,shiftEnd)
  const extra=Number(end.slice(-2)); const expected=extra>=30?extra:0
  assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([row]),expected)
  const window=ctx.getAttendanceDayActualOvertimeWindow([row])
  assert.equal(window.payableMinutes,expected)
  assert.equal(window.valid,expected>0)
  assert.equal(ctx.getAttendanceOvertimeDisplayStatus(row),expected?'Overtime - Pending Filing':'Completed')
 }
 const early=log('07:00','17:20',60,'08:00','17:00')
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([early]),0)
 const noSchedule=log('08:00','17:31',0)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([noSchedule]),91)
 const incomplete=log('08:00',null)
 incomplete.status='No Assigned Shift'
 assert.equal(ctx.getAttendanceOvertimeDisplayStatus(incomplete),'No Assigned Shift')
})
test('multiple logs merge without double break deduction and preserve short-break evidence',()=>{
 const ctx=appContext(), a=log('08:00','17:31',48), b={...a,id:'b'}
 const m=ctx.getAttendanceDayWorkMetrics([a,b])
 assert.equal(m.deductedBreakMinutes,60)
 assert.equal(m.recordedBreakMinutes,48)
 assert.equal(m.paidWorkedMinutes,511)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([a,b]),31)
})

test('early punches use the scheduled start or the next whole hour',()=>{
 const ctx=appContext()
 const francis=log('13:28','00:53',60,'14:00','23:00')
 const louigi=log('13:56','00:57',60)
 const scheduled=ctx.getAttendanceDayWorkMetrics([francis])
 assert.equal(scheduled.rawSpanMinutes,685)
 assert.equal(scheduled.creditedTimeIn,'14:00')
 assert.equal(scheduled.excludedEarlyMinutes,32)
 assert.equal(scheduled.paidWorkedMinutes,593)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([francis]),113)
 assert.equal(ctx.getAttendanceDayActualOvertimeWindow([francis]).verifiedFrom,'23:00')
 const noSchedule=ctx.getAttendanceDayWorkMetrics([louigi])
 assert.equal(noSchedule.creditedTimeIn,'14:00')
 assert.equal(noSchedule.excludedEarlyMinutes,4)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([louigi]),117)
 assert.equal(ctx.getAttendanceDayActualOvertimeWindow([louigi]).verifiedFrom,'23:00')
 assert.equal(ctx.getAttendanceDayWorkMetrics([log('11:45','21:00',60)]).creditedTimeIn,'12:00')
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([log('11:45','21:00',60)]),0)
 assert.equal(ctx.getAttendanceDayWorkMetrics([log('09:54','19:30',60)]).creditedTimeIn,'10:00')
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([log('09:54','19:30',60)]),30)
 assert.equal(ctx.getAttendanceDayWorkMetrics([log('10:00','19:30',60)]).excludedEarlyMinutes,0)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([log('10:00','19:30',60)]),30)
 assert.equal(ctx.getAttendanceDayWorkMetrics([log('14:05','00:53',60,'14:00','23:00')]).creditedTimeIn,'14:05')
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([log('14:05','00:53',60,'14:00','23:00')]),108)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([log('13:28','00:53',60,null,null,'2026-10-10')]),145)
})

test('unassigned shifts use actual punches for UT while preserving credited-start OT limits',()=>{
 const ctx=appContext()
 for(const [start,end,recordedBreak,excluded] of [
  ['13:02:16','22:02:46',57,58],
  ['13:01:38','22:01:01',60,59]
 ]) {
  const row=log(start,end,recordedBreak,null,null,'2026-10-12')
  const metrics=ctx.getAttendanceDayWorkMetrics([row])
  assert.equal(metrics.rawSpanMinutes,540)
  assert.equal(metrics.creditedTimeIn,'14:00')
  assert.equal(metrics.excludedEarlyMinutes,excluded)
  assert.equal(metrics.deductedBreakMinutes,60)
  assert.equal(metrics.undertimeDeductedBreakMinutes,60)
  assert.equal(metrics.undertimePaidWorkedMinutes,480)
  assert.equal(metrics.undertimeMinutes,0)
  assert.equal(ctx.getPayrollAttendanceDeductionSplit(metrics).undertimeMinutes,0)
  assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([row]),0)
 }
})

test('unassigned shifts honor the universal 10-minute UT grace boundary',()=>{
 const ctx=appContext()
 const within=ctx.getAttendanceDayWorkMetrics([log('13:10','22:00',60,null,null,'2026-10-12')])
 const beyond=ctx.getAttendanceDayWorkMetrics([log('13:11','22:00',60,null,null,'2026-10-12')])
 assert.equal(within.rawPaidWorkShortageMinutes,10)
 assert.equal(within.graceAppliedMinutes,10)
 assert.equal(within.undertimeMinutes,0)
 assert.equal(ctx.getPayrollAttendanceDeductionSplit(within).undertimeMinutes,0)
 assert.equal(beyond.rawPaidWorkShortageMinutes,11)
 assert.equal(beyond.graceAppliedMinutes,0)
 assert.equal(beyond.undertimeMinutes,30)
 assert.equal(ctx.getPayrollAttendanceDeductionSplit(beyond).undertimeMinutes,30)
})

test('early start cutoff handles overnight shifts and separate attendance intervals',()=>{
 const ctx=appContext()
 const overnight=log('23:45','09:30',60)
 assert.equal(ctx.getAttendanceDayWorkMetrics([overnight]).creditedTimeIn,'00:00')
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes([overnight]),30)
 const split=[log('13:40','13:50',0),{...log('14:00','23:30',60),id:'b'}]
 const metrics=ctx.getAttendanceDayWorkMetrics(split)
 assert.equal(metrics.rawSpanMinutes,580)
 assert.equal(metrics.excludedEarlyMinutes,10)
 assert.equal(metrics.paidWorkedMinutes,510)
 assert.equal(ctx.getAttendanceDayActualOvertimeMinutes(split),30)
 const first={...log('23:45','00:15',0),id:'first',created_at:'2026-10-11T15:45:00Z'}
 const second={...log('00:30','09:30',60),id:'second',created_at:'2026-10-11T16:30:00Z'}
 const reversed=ctx.getAttendanceDayWorkMetrics([second,first])
 assert.equal(reversed.rawSpanMinutes,570)
 assert.equal(reversed.excludedEarlyMinutes,15)
 assert.equal(reversed.creditedTimeIn,'00:00')
 assert.equal(reversed.paidWorkedMinutes,495)
})
test('SQL filing and normalization agree with app boundaries; migration and rollback are reversible',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
   create table public.attendance_logs(id uuid,employee_id uuid,attendance_date date,time_in time,time_out time,status text,created_at timestamptz,total_break_minutes int,shift_start time,shift_end time,overtime_minutes int,undertime_minutes int,meal_break_exception_approved boolean,approved_unpaid_break_minutes int);
   create table public.time_adjustment_requests(id bigint,employee_id uuid,attendance_date text,request_type text,status text,minutes int);
   create table public.payroll_records(id uuid);
   create table public.break_logs(attendance_log_id text,break_minutes int,break_out time,break_in time);
   create table public.daily_schedules(employee_id uuid,schedule_date date,shift_start time,shift_end time,notes text);`)
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261006064018_attendance_minute_policy.sql',import.meta.url),'utf8'))
  const folder=new URL('../supabase/migrations/',import.meta.url)
  const name=fs.readdirSync(folder).find(n=>n.endsWith('_overtime_threshold_auto_break.sql'))
  const migration=fs.readFileSync(new URL(name,folder),'utf8')
  await db.exec(migration);await db.exec(migration)
  await db.exec(`create trigger normalize_att before insert or update on attendance_logs for each row execute function normalize_attendance_ot_ut_policy_minutes();
   create trigger normalize_req before insert or update on time_adjustment_requests for each row execute function normalize_time_adjustment_policy_minutes();`)
  const emp='00000000-0000-0000-0000-000000000002',id='00000000-0000-0000-0000-000000000001'
  await db.exec(`insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,shift_start,shift_end,total_break_minutes,overtime_minutes,undertime_minutes)
   values('${id}','${emp}','2026-10-11','08:00','17:29','Completed','08:00','17:00',39,29,0);`)
  for(const n of [1,29]) {
   await db.exec(`update attendance_logs set time_out='17:${String(n).padStart(2,'0')}',overtime_minutes=${n}`)
   assert.equal((await db.query('select overtime_minutes from attendance_logs')).rows[0].overtime_minutes,0)
   await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',${n})`),/THRESHOLD/)
  }
  for(const n of [30,31]) {
   await db.exec(`update attendance_logs set time_out='17:${n}',overtime_minutes=${n}`)
   assert.equal((await db.query('select overtime_minutes from attendance_logs')).rows[0].overtime_minutes,n)
   await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',${n})`)
  }
  assert.deepEqual((await db.query('select minutes from time_adjustment_requests order by minutes')).rows.map(r=>r.minutes),[30,31])
  await db.exec(`update attendance_logs set time_in='08:07',time_out='17:03',total_break_minutes=48,shift_start=null,shift_end=null`)
  await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',8)`),/THRESHOLD/)
  await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',31)`),/THRESHOLD/)
  await db.exec(`update attendance_logs set attendance_date='2026-10-10',overtime_minutes=17`)
  assert.equal((await db.query('select overtime_minutes from attendance_logs')).rows[0].overtime_minutes,17)
  await db.exec(fs.readFileSync(new URL('../supabase/rollback_overtime_threshold_auto_break.sql',import.meta.url),'utf8'))
  await db.exec(`update attendance_logs set attendance_date='2026-10-11',overtime_minutes=17`)
  assert.equal((await db.query('select overtime_minutes from attendance_logs')).rows[0].overtime_minutes,17)
 } finally {await db.close()}
})

test('database filing guard rejects early-arrival minutes and accepts the corrected requests',async()=>{
 const db=new PGlite()
 const emp='00000000-0000-0000-0000-000000000002',id='00000000-0000-0000-0000-000000000001'
 try {
  await db.exec(`create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
   create table public.attendance_logs(id uuid,employee_id uuid,attendance_date date,time_in time,time_out time,status text,created_at timestamptz,total_break_minutes int,shift_start time,shift_end time,overtime_minutes int,undertime_minutes int,meal_break_exception_approved boolean,approved_unpaid_break_minutes int);
   create table public.time_adjustment_requests(id bigint,employee_id uuid,attendance_date text,request_type text,status text,minutes int);
   create table public.payroll_records(id uuid);
   create table public.break_logs(attendance_log_id text,break_minutes int,break_out time,break_in time);
   create table public.daily_schedules(employee_id uuid,schedule_date date,shift_start time,shift_end time,notes text);
   create table public.employee_access(id uuid,shift_start time,shift_end time);`)
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261006064018_attendance_minute_policy.sql',import.meta.url),'utf8'))
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261011155858_overtime_threshold_auto_break.sql',import.meta.url),'utf8'))
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261012042034_early_arrival_credited_start.sql',import.meta.url),'utf8'))
  await db.exec(`create trigger normalize_req before insert or update on time_adjustment_requests for each row execute function normalize_time_adjustment_policy_minutes();
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,total_break_minutes)
   values('${id}','${emp}','2026-10-11','13:56','00:57','Completed',60);`)
  await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',121)`),/117 payable OT/)
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',117)`)
  await db.exec(`update attendance_logs set time_in='13:28',time_out='00:53',shift_start='14:00',shift_end='23:00'`)
  await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',145)`),/113 payable OT/)
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',113)`)
  await db.exec(`delete from attendance_logs;delete from time_adjustment_requests;delete from employee_access;
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,total_break_minutes)
   values('${id}','${emp}','2026-10-11','09:54','19:30','Completed',60);`)
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',30)`)
  await db.exec(`delete from attendance_logs;delete from time_adjustment_requests;
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,total_break_minutes)
   values('${id}','${emp}','2026-10-11','11:45','21:00','Completed',60);`)
  await assert.rejects(db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',30)`),/THRESHOLD/)
  await db.exec(`delete from attendance_logs;
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,total_break_minutes)
   values('${id}','${emp}','2026-10-11','23:45','09:30','Completed',60);`)
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',30)`)
  await db.exec(`delete from attendance_logs;delete from time_adjustment_requests;
   insert into daily_schedules values('${emp}','2026-10-11','14:00','23:00',null);
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,total_break_minutes)
   values('${id}','${emp}','2026-10-11','13:28','00:53','Completed',60);`)
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',113)`)
  await db.exec(`delete from attendance_logs;delete from time_adjustment_requests;delete from daily_schedules;
   insert into employee_access values('${emp}','14:00','23:00');
   insert into attendance_logs(id,employee_id,attendance_date,time_in,time_out,status,total_break_minutes)
   values('${id}','${emp}','2026-10-11','13:28','00:53','Completed',60);`)
  await db.exec(`insert into time_adjustment_requests(employee_id,attendance_date,request_type,status,minutes) values('${emp}','2026-10-11','overtime','pending',113)`)
 } finally {await db.close()}
})
