import test from 'node:test'
import assert from 'node:assert/strict'
import { getChargeableEarlyOutMinutes } from '../src/attendancePolicy.js'

test('approved no-meal-break removes the unused meal hour from early-out shortage', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:300,
  deductedBreakMinutes:0,
  breakOverrideApplied:true
 }), {
  mealBreakScheduleCreditMinutes:60,
  chargeableEarlyOutMinutes:240
 })
})

test('normal unpaid meal break keeps the complete early-out shortage', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:300,
  deductedBreakMinutes:60,
  breakOverrideApplied:false
 }), {
  mealBreakScheduleCreditMinutes:0,
  chargeableEarlyOutMinutes:300
 })
})

test('approved partial unpaid break credits only the waived portion', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:180,
  deductedBreakMinutes:30,
  breakOverrideApplied:true
 }), {
  mealBreakScheduleCreditMinutes:30,
  chargeableEarlyOutMinutes:150
 })
})

test('approved no-meal-break never creates negative early-out minutes', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:30,
  deductedBreakMinutes:0,
  breakOverrideApplied:true
 }), {
  mealBreakScheduleCreditMinutes:60,
  chargeableEarlyOutMinutes:0
 })
})

test('reconciled Sheryl and Myra short shifts produce the expected 30-minute UT blocks', () => {
 const cases = [
  { employee:'Myra', date:'2026-08-24', earlyOutMinutes:298, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-19', earlyOutMinutes:290, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-20', earlyOutMinutes:297, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-24', earlyOutMinutes:297, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-25', earlyOutMinutes:299, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-28', earlyOutMinutes:293, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-09-01', earlyOutMinutes:415, expectedUndertime:360 },
  { employee:'Sheryl', date:'2026-09-03', earlyOutMinutes:353, expectedUndertime:300 },
  { employee:'Sheryl', date:'2026-09-07', earlyOutMinutes:174, expectedUndertime:120 }
 ]

 cases.forEach(({ employee, date, earlyOutMinutes, expectedUndertime }) => {
  const { chargeableEarlyOutMinutes } = getChargeableEarlyOutMinutes({
   earlyOutMinutes,
   deductedBreakMinutes:0,
   breakOverrideApplied:true
  })
  const roundedUndertime = Math.ceil(chargeableEarlyOutMinutes / 30) * 30
  assert.equal(roundedUndertime, expectedUndertime, `${employee} ${date}`)
 })
})
