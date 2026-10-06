import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {scheduleSunday,staffScheduleDates} from '../src/staffScheduleDates.js'
test('schedule starts Sunday for every selected day',()=>{
 for(let day=4;day<=10;day++) assert.equal(scheduleSunday(`2026-10-${String(day).padStart(2,'0')}`),'2026-10-04')
})
test('weekly duration choices produce inclusive dated periods',()=>{
 for(const [choice,count,last] of [['1week',7,'2026-10-10'],['2weeks',14,'2026-10-17'],['3weeks',21,'2026-10-24'],['1month',31,'2026-11-03']]){
  const dates=staffScheduleDates('2026-10-06',choice)
  assert.equal(dates.length,count);assert.equal(dates[0],'2026-10-04');assert.equal(dates.at(-1),last)
  assert.equal(new Set(dates).size,count)
 }
})
test('calendar month handles February, leap years, and year boundaries',()=>{
 assert.equal(staffScheduleDates('2026-02-01','1month').length,28)
 assert.equal(staffScheduleDates('2032-02-01','1month').length,29)
 assert.equal(staffScheduleDates('2026-12-27','1month').at(-1),'2027-01-26')
})
test('time in reads assigned employee/date schedule before computing and saving late',()=>{
 const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
 const start=app.indexOf(' async function confirmTimeIn('),end=app.indexOf(' async function confirmTimeOut(',start)
 const source=app.slice(start,end)
 assert(source.includes("eq('employee_id',employee.id).eq('schedule_date',today).maybeSingle()"))
 assert(source.indexOf('error:assignedScheduleError')<source.indexOf('let lateMinutes'))
 assert(source.includes('shiftS = minutesFromTime(assignedSchedule.shift_start)'))
 assert(source.includes("shift_start:assignedSchedule?.shift_start||null"))
 assert(source.includes('time_in:timeInValue, late_minutes:lateMinutes'))
 assert(!source.includes('todaySchedule?.shift_start'))
})
