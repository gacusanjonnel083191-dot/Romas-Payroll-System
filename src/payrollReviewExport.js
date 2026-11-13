import { payrollCents } from './payrollComparison.js'

// Internal report only, never an RCBC bank upload or payment instruction.
export const REVIEW_FIELDS = [
  ['basic_pay','Basic pay'],['birthday_pay','Birthday pay'],
  ['overtime_pay','Overtime pay'],['night_diff_pay','Night differential'],
  ['holiday_pay','Holiday pay'],['other_earnings','Other earnings'],
  ['total_earnings','Total earnings'],['late_deduction','Late deduction'],
  ['undertime_deduction','Undertime deduction'],['cash_advance_deduction','Cash advance'],
  ['sss_deduction','SSS'],['pagibig_deduction','Pag-IBIG'],
  ['philhealth_deduction','PhilHealth'],['other_deductions','Other deductions (includes absence)'],
  ['total_deductions','Total deductions'],['net_pay','Net pay']
]

export function payrollReviewRows(displayed=[], saved=[], start='', end='') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start>end) throw Error('Invalid payroll cutoff')
  if (!saved.length || saved.length!==displayed.length) throw Error('Saved payroll does not match displayed employee count; reload saved payroll')
  const displayedById=new Map()
  for(const r of displayed){
    const id=String(r.employeeId||r.employee_id||'')
    if(!id||displayedById.has(id)) throw Error('Duplicate or missing displayed payroll employee')
    displayedById.set(id,r)
  }
  const seen=new Set(), totals=REVIEW_FIELDS.map(()=>0)
  const detail=saved.map(r=>{
    const id=String(r.employee_id||'')
    if(!id||seen.has(id)||!displayedById.has(id))throw Error('Duplicate or unmatched saved payroll employee')
    seen.add(id)
    const d=displayedById.get(id)
    for(const [dbKey,screenKey] of [['total_earnings','totalEarnings'],['total_deductions','totalDeductions'],['net_pay','netPay']]){
      if(payrollCents(r[dbKey])!==payrollCents(d[screenKey]??d[dbKey]))throw Error('On-screen payroll differs from saved payroll for '+(r.employee_code||id))
    }
    if(payrollCents(r.total_earnings)-payrollCents(r.total_deductions)!==payrollCents(r.net_pay))throw Error('Saved payroll does not reconcile for '+(r.employee_code||id))
    const amounts=REVIEW_FIELDS.map(([k],i)=>{const cents=payrollCents(r[k]);totals[i]+=cents;return cents/100})
    return [String(r.employee_code||''),String(r.employee_name||''),String(r.payroll_status||'draft').toUpperCase(),...amounts]
  })
  const statuses=[...new Set(saved.map(r=>String(r.payroll_status||'draft').toUpperCase()))]
  const headerRowIndex=7
  const rows=[
    ["ROMA'S DONUTS - INTERNAL PAYROLL REVIEW"],
    ['NOT FOR BANK UPLOAD - NOT A PAYMENT INSTRUCTION'],
    ['Cutoff',start+' to '+end],
    ['Saved payroll status',statuses.join(', ')],
    ['Employee count',saved.length],
    ['Source','Saved payroll, verified against on-screen totals'],
    ['Note','Other deductions may include absence; do not total all detail columns again.'],
    ['Employee code','Employee name','Status',...REVIEW_FIELDS.map(([,label])=>label)],
    ...detail,
    ['TOTAL','','',...totals.map(n=>n/100)],
    ['INTERNAL REVIEW ONLY - RCBC PAYMENT EXCEL REQUIRES FINAL RELEASE']
  ]
  return {rows,headerRowIndex,firstRow:headerRowIndex+1,lastRow:headerRowIndex+saved.length+1,count:saved.length,totalNetPay:totals.at(-1)/100}
}
