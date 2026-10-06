import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleRange, shiftLabel } from '../src/staffScheduleRange.js'
import { staffScheduleDates } from '../src/staffScheduleDates.js'
test('exact application range starts Wednesday and includes end across weeks',()=>{
 const dates=scheduleRange('2026-10-07','2026-10-21','2026-10-06')
 assert.equal(dates.length,15);assert.equal(dates[0],'2026-10-07');assert.equal(dates.at(-1),'2026-10-21')
 assert.equal(staffScheduleDates('2026-10-07').length,7)
 assert.equal(staffScheduleDates('2026-10-07')[0],'2026-10-04')
})
test('same date, month and year boundaries retain inclusive dates',()=>{
 assert.deepEqual(scheduleRange('2026-10-07','2026-10-07','2026-10-06'),['2026-10-07'])
 assert.deepEqual(scheduleRange('2026-12-31','2027-01-02','2026-10-06'),['2026-12-31','2027-01-01','2027-01-02'])
})
test('invalid, reversed, past and excessive ranges cannot publish',()=>{
 for(const [from,until] of [['','2026-10-07'],['2026-02-30','2026-10-07'],['2026-10-08','2026-10-07'],['2026-10-05','2026-10-07'],['2026-10-07','2028-10-07']])assert.throws(()=>scheduleRange(from,until,'2026-10-06'))
})
test('portal distinguishes missing assignments and overnight ending',()=>{
 assert.equal(shiftLabel(null),'No schedule assigned')
 assert.equal(shiftLabel({shift_start:'15:00:00',shift_end:'00:00:00'}),'3:00 PM – 12:00 AM (next day)')
 assert.equal(shiftLabel({shift_start:'08:00:00',shift_end:'17:00:00'}),'8:00 AM – 5:00 PM')
})
