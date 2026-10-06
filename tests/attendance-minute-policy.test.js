import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {policyBreakMinutes, payableOvertimeMinutes, policyOvertimeBasis} from '../src/attendancePolicy20261006.js'
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
function extract(name) {
 const start=app.indexOf(`function ${name}(`)
 const end=app.indexOf('\nfunction ',start+1)
 return app.slice(start,end)
}
test('OT effective date keeps old blocks and pays each new whole minute',()=>{
 for(const n of [1,17,29,30,31,59,61,127]) {
  assert.equal(payableOvertimeMinutes(n,'2026-10-05'),Math.floor(n/30)*30)
  assert.equal(payableOvertimeMinutes(n,'2026-10-06'),n)
 }
 assert.equal(payableOvertimeMinutes(Infinity,'2026-10-06'),0)
})
test('full shift automatic meal, short shift actual breaks, no second deduction',()=>{
 assert.equal(policyBreakMinutes({date:'2026-10-06',spanMinutes:540,recordedMinutes:0}),60)
 assert.equal(policyBreakMinutes({date:'2026-10-06',spanMinutes:540,recordedMinutes:60}),60)
 assert.equal(policyBreakMinutes({date:'2026-10-06',spanMinutes:600,recordedMinutes:75}),75)
 assert.equal(policyBreakMinutes({date:'2026-10-06',spanMinutes:240,recordedMinutes:0}),0)
 assert.equal(policyBreakMinutes({date:'2026-10-06',spanMinutes:240,recordedMinutes:15}),15)
 assert.equal(policyBreakMinutes({date:'2026-10-06',spanMinutes:540,legacyOverride:0}),60)
 assert.equal(policyBreakMinutes({date:'2026-10-05',spanMinutes:540,legacyOverride:0}),0)
})
test('OT excludes early arrival and cannot replace missing paid work',()=>{
 assert.equal(policyOvertimeBasis({paidWorkedMinutes:540,hasSchedule:true,postShiftMinutes:17},'2026-10-06'),17)
 assert.equal(policyOvertimeBasis({paidWorkedMinutes:470,hasSchedule:true,postShiftMinutes:17},'2026-10-06'),0)
 assert.equal(policyOvertimeBasis({paidWorkedMinutes:510,hasSchedule:false},'2026-10-06'),30)
})
test('actual App OT window uses dated schedule cap and preserves overnight range',()=>{
 const context={policyOvertimeBasis,payableOvertimeMinutes,
  getAttendanceDayIntegrity:logs=>({isValidCompleted:true,completedLogs:logs}),
  getAttendanceDayWorkMetrics:()=>({paidWorkedMinutes:497,hasSchedule:true,postShiftMinutes:17,rawSpanMinutes:557,deductedBreakMinutes:60}),
  roundPayableOvertimeMinutes:payableOvertimeMinutes,
  minutesFromTime:t=>Number(t.slice(0,2))*60+Number(t.slice(3,5)),
  normalizeTimeInputValue:t=>t.slice(0,5),
  clockMinuteToTimeValue:n=>`${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
 vm.createContext(context)
 vm.runInContext(extract('getAttendanceDayActualOvertimeWindow'),context)
 const result=context.getAttendanceDayActualOvertimeWindow([{attendance_date:'2026-10-06',time_in:'15:00',time_out:'00:17',shift_start:'15:00',shift_end:'00:00'}])
 assert.equal(result.payableMinutes,17);assert.equal(result.verifiedFrom,'00:00');assert.equal(result.verifiedTo,'00:17');assert.equal(result.crossesMidnight,true)
})
