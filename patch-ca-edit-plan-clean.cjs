const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-ca-edit-plan-clean-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

function findMatchingBrace(text, openIndex) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = null
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      const nextLine = text.indexOf('\n', i + 2)
      if (nextLine < 0) return -1
      i = nextLine
      continue
    }

    if (ch === '/' && text[i + 1] === '*') {
      const endComment = text.indexOf('*/', i + 2)
      if (endComment < 0) return -1
      i = endComment + 1
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function insertAfterAsyncFunction(functionName, insertText) {
  const needle = `async function ${functionName}`
  const start = src.indexOf(needle)
  if (start < 0) throw new Error(`${functionName} not found`)

  const openBrace = src.indexOf('{', start)
  if (openBrace < 0) throw new Error(`${functionName} opening brace not found`)

  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error(`${functionName} closing brace not found`)

  src = src.slice(0, closeBrace + 1) + '\n\n' + insertText.trim() + '\n' + src.slice(closeBrace + 1)
}

if (!src.includes('async function editCashAdvanceDeductionPlan')) {
  insertAfterAsyncFunction('reopenCashAdvanceForPayrollDeduction', `
 async function editCashAdvanceDeductionPlan(ca, req = null) {
  if (!ca?.id) {
   showToast('Cash advance ledger not found. Refresh cash advance requests first.', 'red')
   return
  }

  if (adminRole !== 'owner') {
   showToast('Owner access is required to edit an approved cash advance deduction plan.', 'red')
   return
  }

  const amount = Math.max(0, safeNum(ca.amount, 0))
  const amountPaid = Math.max(0, safeNum(ca.amount_paid, 0))
  const currentTotal = Math.max(1, safeNum(ca.installments_total, ca.installments_remaining || req?.request_installments_total || 1))
  const currentRemaining = Math.max(0, safeNum(ca.installments_remaining, currentTotal))
  const completed = Math.max(0, currentTotal - currentRemaining)

  if (!amount) {
   showToast('Invalid cash advance amount.', 'red')
   return
  }

  if (amountPaid > 0 || completed > 0) {
   showToast('This cash advance already has deduction history. Use correction/reversal instead of editing the plan directly.', 'red')
   return
  }

  const answer = window.prompt(
   'Enter new number of payroll deductions/installments:\\n\\n' +
   'Employee: ' + (ca.employee_name || req?.employee_name || 'Employee') + '\\n' +
   'CA Amount: ' + php(amount) + '\\n' +
   'Current Plan: ' + currentTotal + ' payroll(s) at ' + php(ca.per_payroll_deduction || 0) + ' per payroll',
   String(currentTotal)
  )

  if (answer === null) return

  const newInstallments = Math.max(1, Math.round(safeNum(answer, 0)))

  if (!Number.isFinite(newInstallments) || newInstallments < 1) {
   showToast('Invalid number of payroll deductions.', 'red')
   return
  }

  const newPerPayroll = moneyRound(amount / newInstallments)

  if (!window.confirm(
   'Update deduction plan?\\n\\n' +
   'Amount: ' + php(amount) + '\\n' +
   'New payroll count: ' + newInstallments + '\\n' +
   'New deduction per payroll: ' + php(newPerPayroll) + '\\n\\n' +
   'This is allowed because no payroll deduction has been applied yet.'
  )) return

  const existingNotes = String(ca.notes || '').trim()
  const newNotes = existingNotes +
   (existingNotes ? ' | ' : '') +
   'DEDUCTION PLAN EDITED BY OWNER ' + new Date().toISOString().slice(0,10) +
   ': ' + currentTotal + ' payroll(s) to ' + newInstallments + ' payroll(s)'

  try {
   const { error } = await supabase.from('cash_advances').update({
    amount_paid:0,
    balance:amount,
    per_payroll_deduction:newPerPayroll,
    installments_total:newInstallments,
    installments_remaining:newInstallments,
    status:'Unpaid',
    notes:newNotes
   }).eq('id', ca.id)

   if (error) throw error

   if (req?.id) {
    const { error:reqError } = await supabase.from('cash_advance_requests').update({
     request_installments_total:newInstallments,
     request_per_payroll_deduction:newPerPayroll
    }).eq('id', req.id)

    if (reqError && !isMissingCashAdvanceDetailColumnError(reqError)) {
     console.warn('Cash advance request plan sync skipped:', reqError)
    }
   }

   await logAudit(
    'CA DEDUCTION PLAN EDITED',
    currentAdminLabel || adminRole,
    ca.employee_name || req?.employee_name || 'Employee',
    php(amount) + ' changed from ' + currentTotal + ' payroll(s) to ' + newInstallments + ' payroll(s). New deduction: ' + php(newPerPayroll) + '. CA ID: ' + ca.id
   )

   await loadCashAdvanceRequests()
   await loadResolvedCARequests()

   showToast('Cash advance deduction plan updated: ' + php(newPerPayroll) + ' for ' + newInstallments + ' payroll(s).', 'green')
  } catch (err) {
   console.warn('editCashAdvanceDeductionPlan:', err)
   showToast('Failed to update deduction plan: ' + (err?.message || err), 'red')
  }
 }
  `)

  console.log('ADDED: editCashAdvanceDeductionPlan')
} else {
  console.log('SKIPPED: editCashAdvanceDeductionPlan already exists')
}

const heading = `<p style={{ margin:'0 0 8px', color:'#2d8a4e', fontWeight:'bold', fontSize:'13px' }}>Cash Advance Ledger / Payroll Deduction Plan</p>`

const buttonBlock = `${heading}
 {ledger && safeNum(ledger.amount_paid, 0) <= 0 && safeNum(ledger.installments_total, ledger.installments_remaining || 1) === safeNum(ledger.installments_remaining, ledger.installments_total || 1) && (
  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', margin:'0 0 10px' }}>
   <button style={{...btnBlack, background:'#4a90d9', width:'auto', padding:'7px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>editCashAdvanceDeductionPlan(ledger, req)}>EDIT DEDUCTION PLAN</button>
  </div>
 )}`

if (!src.includes('EDIT DEDUCTION PLAN')) {
  if (!src.includes(heading)) {
    throw new Error('Cash Advance Ledger heading not found')
  }

  src = src.replace(heading, buttonBlock)
  console.log('ADDED: EDIT DEDUCTION PLAN button')
} else {
  console.log('SKIPPED: EDIT DEDUCTION PLAN button already exists')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
