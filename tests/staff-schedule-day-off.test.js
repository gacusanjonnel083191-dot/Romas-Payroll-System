import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleRange, scheduleRecords, scheduleRecordMatches, shiftLabel, isScheduleDayOff } from '../src/staffScheduleRange.js'
const make = (options={}) => scheduleRecords({employeeId:'test-employee',dates:scheduleRange('2026-10-13','2026-11-02','2026-10-13'),start:'11:00',end:'20:00',mode:'fixed',dayOff:'6',...options})
test('Saturday repeats across partial weeks and a month boundary, with no assigned work hours',()=>{
 const rows=make(), off=rows.filter(isScheduleDayOff)
 assert.deepEqual(off.map(r=>r.schedule_date),['2026-10-17','2026-10-24','2026-10-31'])
 assert.equal(rows.length,21)
 for(const row of rows){
  assert.equal(shiftLabel(row),isScheduleDayOff(row)?'Day off':'11:00 AM – 8:00 PM')
  if(isScheduleDayOff(row)){assert.equal(row.shift_start,null);assert.equal(row.shift_end,null)}
 }
})
test('all seven weekdays and no recurring day off are supported',()=>{
 for(let weekday=0;weekday<7;weekday++)assert.equal(make({dayOff:String(weekday)}).filter(isScheduleDayOff).length,3)
 assert.equal(make({dayOff:''}).filter(isScheduleDayOff).length,0)
 assert.throws(()=>make({dayOff:'7'}))
})
test('single off day requires no hours and can be changed back to an overnight work shift',()=>{
 const off=make({dates:['2026-10-17'],mode:'off',start:'',end:'',dayOff:''})
 assert.equal(shiftLabel(off[0]),'Day off')
 const work=make({dates:['2026-10-17'],start:'21:00',end:'06:00',dayOff:'',previous:off})
 assert.equal(shiftLabel(work[0]),'9:00 PM – 6:00 AM (next day)')
 assert.equal(isScheduleDayOff(work[0]),false)
 assert.throws(()=>make({start:'',end:''}))
})
test('notes survive changing an existing assignment, and readback verifies null hours and day-off marker',()=>{
 const off=make({dates:['2026-10-17'],previous:[{schedule_date:'2026-10-17',notes:'Approved exception [schedule:fixed]'}]})[0]
 assert.equal(off.notes,'Approved exception [schedule:day-off]')
 assert(scheduleRecordMatches(off,{...off}))
 assert(!scheduleRecordMatches(off,{...off,notes:'Approved exception'}))
 assert(!scheduleRecordMatches(off,{...off,shift_start:'11:00:00'}))
 const work=make({dates:['2026-10-18']})[0]
 assert(scheduleRecordMatches(work,{...work,shift_start:'11:00:00',shift_end:'20:00:00'}))
})
