import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateSpecialHolidayPay, isSpecialHolidayRestDay } from '../src/specialHolidayPayrollPolicy.js'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const T = (options) => calculateSpecialHolidayPay({ dailyRate: 700, ...options })

test('daily paid special holiday: no work no pay, worked 130%', () => {
  assert.deepEqual(T({ payrollBasis:'daily', hasWorked:false }), {holidayPremium:0,unworkedFixedDayDeduction:0})
  assert.deepEqual(T({ payrollBasis:'daily', hasWorked:true }), {holidayPremium:210,unworkedFixedDayDeduction:0})
})

test('worked special holiday on rest day pays statutory 150%', () => {
  assert.equal(T({payrollBasis:'daily',hasWorked:true,restDay:true}).holidayPremium,350)
  assert.equal(T({payrollBasis:'monthly',hasWorked:true,restDay:true}).holidayPremium,1050)
  assert.equal(T({payrollBasis:'monthly',hasWorked:true}).holidayPremium,210)
})

test('monthly and semi-monthly: no work on included salaried date removes one daily equivalent', () => {
  for (const payrollBasis of ['monthly','semi_monthly']) {
    assert.equal(T({payrollBasis,hasWorked:false}).unworkedFixedDayDeduction,700)
    assert.equal(T({payrollBasis,hasWorked:true}).unworkedFixedDayDeduction,0)
  }
})

test('avoid double deduction for unpaid leave or recorded absence, and preserve paid leave/rest day', () => {
  assert.equal(T({payrollBasis:'monthly',alreadyDeductedForAbsence:true}).unworkedFixedDayDeduction,0)
  assert.equal(T({payrollBasis:'monthly',paidLeaveCovered:true}).unworkedFixedDayDeduction,0)
  assert.equal(T({payrollBasis:'monthly',restDay:true}).unworkedFixedDayDeduction,0)
})

test('scheduling overrides default rest-day assumption', () => {
  assert.equal(isSpecialHolidayRestDay('2026-11-01',null,313),true)
  assert.equal(isSpecialHolidayRestDay('2026-11-02',null,313),false)
  assert.equal(isSpecialHolidayRestDay('2026-11-01',{shift_start:'09:00',shift_end:'18:00'},313),false)
  assert.equal(isSpecialHolidayRestDay('2026-11-02',{shift_start:null,shift_end:null},313),true)
})

test('production computation keeps regular holiday absence guard separate from statutory special pay', () => {
  assert.match(app, /calculateSpecialHolidayPay\(\{/)
  assert.match(app, /if \(holidayType === 'special'\)/)
  assert.match(app, /absenceDeduction \+= treatment\.unworkedFixedDayDeduction/)
  assert.match(app, /holidayPay \+= treatment\.holidayPremium/)
  const from = app.indexOf('if (holidayType === \'special\')')
  const to = app.indexOf('const absenceGuard = getHolidayAbsenceGuardFailure',from)
  assert.ok(from > 0 && to > from)
  assert.doesNotMatch(app.slice(from,to), /getHolidayAbsenceGuardFailure/)
  assert.match(app.slice(to,to + 900), /holidayType === 'regular'/)
  assert.match(app, /specialHolidaySchedulesByKey/)
})

test('historical payroll remains untouched; only future payroll computations use the policy', () => {
  assert.match(app, /\.from\('payroll_records'\)\.insert\(rows\)/)
  assert.doesNotMatch(app, /\.from\('payroll_records'\)\.update\(\{holiday_pay:/)
})
