import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const handler = app.slice(app.indexOf(' async function processFinalPay()'), app.indexOf(' async function loadPayrollHistory()'))

async function run({ row = { sil_balance:5, daily_rate:505, is_active:true }, error = null, confirm = true } = {}) {
  const calls = { tables:[], messages:[], commands:[], confirmations:[], cleared:false }
  const context = {
    finalPayResult: { employeeName:'Test employee', unusedSIL:5, dailyRate:505, totalCA:0, lastSalary:0, proRated13th:3450.83, silPay:2525, separationPay:0 },
    finalPayEmployeeId:'test-employee', finalPayReason:'resigned', finalPayLastDate:'2026-10-22',
    finalPaySettleCashAdvance:false, finalPaySettlementAuthorization:'', finalPayReceivableNote:'',
    supabase: { from(table) {
      calls.tables.push(table)
      // Reproduce production permissions: protected columns cannot be read directly.
      return { select(fields) {
        assert.equal(fields, 'sil_balance,daily_rate,is_active')
        return { eq(field, id) {
          assert.equal(field, 'id'); assert.equal(id, 'test-employee')
          return { maybeSingle: async () => table === 'employee_access'
            ? { data:row, error } : { data:null, error:{ message:'permission denied' } } }
        } }
      } }
    } },
    safeNum:(v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback,
    moneyRound:v => Math.round(v * 100) / 100,
    php:v => String(v),
    showToast:message => calls.messages.push(message),
    setFinalPayResult:value => { if (value === null) calls.cleared = true },
    getFinalPaySettlementPreview:() => ({ grossFinalPay:5975.83, cashAdvanceDeduction:0, remainingCashAdvance:0, totalFinalPay:5975.83 }),
    window: { confirm:message => { calls.confirmations.push(message); return confirm } },
    runEmployeeSeparationCommand:async (_, payload) => { calls.commands.push(payload); return { ok:true, cash_advance_deduction:0, former_employee_receivable:0 } },
    setFinalPayProcessing:() => {}, setFinalPayEmployeeId:() => {}, setFinalPaySettleCashAdvance:() => {},
    setFinalPaySettlementAuthorization:() => {}, setFinalPayReceivableNote:() => {},
    loadEmployees:() => {}, loadDeactivatedEmployees:() => {}
  }
  await vm.runInNewContext(`${handler}\nprocessFinalPay()`, context)
  return calls
}

test('authorized verification uses employee_access and passes unchanged totals to atomic settlement', async () => {
  const calls = await run()
  assert.deepEqual(calls.tables, ['employee_access'])
  assert.equal(calls.commands.length, 1)
  assert.equal(calls.commands[0].p_employee_id, 'test-employee')
  assert.equal(calls.commands[0].p_sil_pay, 2525)
  assert.equal(calls.commands[0].p_pro_rated_13th, 3450.83)
  assert.match(calls.confirmations[0], /5975.83/)
})

for (const [label, options] of [
  ['database error', { error:{ message:'unavailable' } }],
  ['missing employee', { row:null }],
  ['inactive employee', { row:{ sil_balance:5, daily_rate:505, is_active:false } }],
  ['masked SIL', { row:{ sil_balance:null, daily_rate:505, is_active:true } }],
  ['masked rate', { row:{ sil_balance:5, daily_rate:null, is_active:true } }],
  ['changed SIL', { row:{ sil_balance:0, daily_rate:505, is_active:true } }],
  ['changed rate', { row:{ sil_balance:5, daily_rate:600, is_active:true } }]
]) {
  test(`${label} blocks confirmation and settlement`, async () => {
    const calls = await run(options)
    assert.equal(calls.commands.length, 0)
    assert.equal(calls.confirmations.length, 0)
    assert.equal(calls.messages.length, 1)
    if (label.startsWith('changed')) assert.equal(calls.cleared, true)
  })
}

test('cancelling confirmation never processes or deactivates the employee', async () => {
  const calls = await run({ confirm:false })
  assert.equal(calls.confirmations.length, 1)
  assert.equal(calls.commands.length, 0)
})
