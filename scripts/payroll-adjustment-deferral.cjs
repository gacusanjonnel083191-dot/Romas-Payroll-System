'use strict'

function replaceRequired(src, before, after, label) {
  if (src.includes(before)) return src.replace(before, after)
  if (src.includes(after)) return src
  throw new Error(`Payroll adjustment deferral patch aborted: ${label} anchor was not found.`)
}

function assertContains(src, needle, label) {
  if (!src.includes(needle)) throw new Error(`Payroll adjustment deferral verification failed: ${label}.`)
}

function applyPayrollAdjustmentDeferral(source) {
  let src = String(source || '')
  if (!src.includes("const supabase = createClient(supabaseUrl, supabaseKey)")) {
    throw new Error("Payroll adjustment deferral patch aborted: Roma's Supabase client anchor was not found.")
  }

  const before = `  const adjDeductionsRounded=moneyRound(adjDeductions+absenceDeductionRounded)\n  const nonCADeductions=moneyRound(lateDeductionRounded+undertimeDeductionRounded+sssDeductionRounded+pagibigDeductionRounded+philhealthDeductionRounded+adjDeductionsRounded)\n\n  // Payroll safety rule: deductions must never create negative net pay.\n  // Cash advance is flexible and is always applied last. Any unpaid CA stays in the CA balance.\n  // If non-CA deductions alone exceed earnings, release is blocked until admin reviews/corrects it.\n  const nonCADeductionOverflow=moneyRound(Math.max(0, nonCADeductions-totalEarnings))\n  const availableForCA=moneyRound(Math.max(0, totalEarnings-nonCADeductions))\n  const rawCADeduction=moneyRound((cas||[]).filter(isOutstandingCashAdvance).reduce((s,ca)=>s+getCashAdvancePayrollDeduction(ca),0))\n  const caDeduction=moneyRound(Math.min(rawCADeduction, availableForCA))\n  const deferredCADeduction=moneyRound(Math.max(0, rawCADeduction-caDeduction))\n  const cashAdvanceBreakdown=buildCashAdvanceDeductionSnapshot(cas || [], caDeduction)\n  const totalDeductions=moneyRound(nonCADeductionOverflow>0?nonCADeductions:nonCADeductions+caDeduction)\n  const netPay=moneyRound(Math.max(0,totalEarnings-totalDeductions))`

  const after = `  // Mandatory deductions remain in the current cutoff. Payroll-adjustment deductions\n  // (charges/other deductions) are deferrable: if the employee has insufficient earnings,\n  // move the whole unpaid adjustment to the next cutoff instead of creating a release blocker.\n  const mandatoryNonCADeductions=moneyRound(lateDeductionRounded+undertimeDeductionRounded+sssDeductionRounded+pagibigDeductionRounded+philhealthDeductionRounded+absenceDeductionRounded)\n  const nextPayrollStart=addDaysToDateString(payrollEnd,1)\n  let adjustmentCapacity=moneyRound(Math.max(0,totalEarnings-mandatoryNonCADeductions))\n  let deferRemainingAdjustments=false\n  const deferredAdjustmentIds=new Set()\n  let deferredAdjustmentTotal=0\n  const orderedDeductionAdjustments=[...adjustmentBreakdown]\n   .filter(item=>item.type!=='addition')\n   .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')) || String(a.id||'').localeCompare(String(b.id||'')))\n\n  for (const item of orderedDeductionAdjustments) {\n   const amount=moneyRound(Number(item.amount||0))\n   if (amount<=0) continue\n   const sourceRow=(adjs||[]).find(row=>String(row?.id||'')===String(item?.id||''))\n   const fitsCurrentCutoff=!deferRemainingAdjustments && amount<=adjustmentCapacity+0.009\n   if (fitsCurrentCutoff || !sourceRow?.id || !nextPayrollStart) {\n    if (fitsCurrentCutoff) adjustmentCapacity=moneyRound(Math.max(0,adjustmentCapacity-amount))\n    else if (!fitsCurrentCutoff) deferRemainingAdjustments=true\n    continue\n   }\n\n   deferRemainingAdjustments=true\n   const originalDate=String(sourceRow.adjustment_date||item.date||'').slice(0,10)\n   const marker=\`AUTO-DEFERRED FROM PAYROLL \${payrollStart} to \${payrollEnd} due insufficient earnings; original adjustment date \${originalDate}.\`\n   const currentNotes=String(sourceRow.notes||'').trim()\n   const nextNotes=currentNotes.includes(marker)?currentNotes:[currentNotes,marker].filter(Boolean).join(' | ')\n   const { error:deferError }=await supabase.from('payroll_adjustments').update({ adjustment_date:nextPayrollStart, notes:nextNotes }).eq('id',sourceRow.id).eq('employee_id',emp.id).eq('adjustment_date',originalDate)\n   if (deferError) throw deferError\n   deferredAdjustmentIds.add(String(sourceRow.id))\n   deferredAdjustmentTotal=moneyRound(deferredAdjustmentTotal+amount)\n  }\n\n  const payableAdjustmentBreakdown=adjustmentBreakdown.filter(item=>item.type==='addition' || !deferredAdjustmentIds.has(String(item?.id||'')))\n  const appliedAdjustmentDeductions=moneyRound(payableAdjustmentBreakdown.filter(item=>item.type!=='addition').reduce((sum,item)=>sum+Number(item.amount||0),0))\n  const adjDeductionsRounded=moneyRound(appliedAdjustmentDeductions+absenceDeductionRounded)\n  const nonCADeductions=moneyRound(mandatoryNonCADeductions+appliedAdjustmentDeductions)\n\n  if (deferredAdjustmentIds.size>0) {\n   const { error:deferAuditError }=await supabase.from('audit_logs').insert([{\n    action:'PAYROLL ADJUSTMENT AUTO-DEFERRED',\n    performed_by:'Payroll System',\n    target_employee:emp.full_name||emp.employee_code||emp.id,\n    details:\`\${deferredAdjustmentIds.size} adjustment(s) totaling \${php(deferredAdjustmentTotal)} moved from payroll \${payrollStart} to \${payrollEnd} into next cutoff starting \${nextPayrollStart} because current earnings were insufficient.\`\n   }])\n   if (deferAuditError) console.warn('Payroll adjustment deferral audit failed:',deferAuditError)\n  }\n\n  // Payroll safety rule: deductions must never create negative net pay.\n  // Cash advance is flexible and is always applied last. Any unpaid CA stays in the CA balance.\n  // Only mandatory non-CA deductions can now create a release blocker; deferrable payroll\n  // adjustments are automatically carried to the next cutoff as whole items.\n  const nonCADeductionOverflow=moneyRound(Math.max(0, nonCADeductions-totalEarnings))\n  const availableForCA=moneyRound(Math.max(0, totalEarnings-nonCADeductions))\n  const rawCADeduction=moneyRound((cas||[]).filter(isOutstandingCashAdvance).reduce((s,ca)=>s+getCashAdvancePayrollDeduction(ca),0))\n  const caDeduction=moneyRound(Math.min(rawCADeduction, availableForCA))\n  const deferredCADeduction=moneyRound(Math.max(0, rawCADeduction-caDeduction))\n  const cashAdvanceBreakdown=buildCashAdvanceDeductionSnapshot(cas || [], caDeduction)\n  const totalDeductions=moneyRound(nonCADeductionOverflow>0?nonCADeductions:nonCADeductions+caDeduction)\n  const netPay=moneyRound(Math.max(0,totalEarnings-totalDeductions))`

  src = replaceRequired(src, before, after, 'payroll deduction capacity and deferral logic')
  src = replaceRequired(
    src,
    'adjustmentEarnings:adjEarnings, adjustmentItems:adjustmentBreakdown, totalEarnings',
    'adjustmentEarnings:adjEarnings, adjustmentItems:payableAdjustmentBreakdown, totalEarnings',
    'payslip adjustment snapshot after deferral'
  )

  assertContains(src, 'const mandatoryNonCADeductions=', 'mandatory deductions are separated from deferrable adjustments')
  assertContains(src, "action:'PAYROLL ADJUSTMENT AUTO-DEFERRED'", 'automatic deferrals are audited')
  assertContains(src, 'adjustmentItems:payableAdjustmentBreakdown', 'deferred adjustments are removed from current payslip')
  assertContains(src, "update({ adjustment_date:nextPayrollStart, notes:nextNotes })", 'deferred adjustment moves to next cutoff')

  return src
}

module.exports = { applyPayrollAdjustmentDeferral }
