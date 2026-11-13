import { payrollCents } from './payrollComparison.js'

export function reconcilePayrollExport(displayedRows = [], savedRows = [], includedRows = []) {
  const id = row => String(row.employee_id || row.employeeId || '')
  const amount = row => payrollCents(row.net_pay ?? row.netPay)
  const saved = new Map(savedRows.map(row => [id(row),row]))
  const displayed = new Map(displayedRows.map(row => [id(row),row]))
  const included = new Map(includedRows.map(row => [id(row),row]))
  if (saved.size !== savedRows.length || displayed.size !== displayedRows.length || included.size !== includedRows.length) {
    throw new Error('Duplicate employee row in payroll or export')
  }
  if (saved.size !== displayed.size) throw new Error('Displayed payroll row count differs from saved payroll')
  for (const [employeeId,row] of saved) {
    if (!employeeId || !displayed.has(employeeId)) throw new Error(`Missing displayed payroll row for ${row.employee_code || employeeId}`)
    if (amount(row) !== amount(displayed.get(employeeId))) throw new Error(`Displayed net pay differs from saved net pay for ${row.employee_code || employeeId}`)
    if (payrollCents(row.total_earnings)-payrollCents(row.total_deductions)!==amount(row)) {
      throw new Error(`Saved payroll does not reconcile for ${row.employee_code || employeeId}`)
    }
  }
  let savedCents=0, includedCents=0
  for (const row of savedRows) savedCents+=amount(row)
  for (const [employeeId,row] of included) {
    if (!saved.has(employeeId)) throw new Error(`Export contains an unsaved employee ${employeeId}`)
    if (amount(row)!==amount(saved.get(employeeId))) throw new Error(`Export amount differs from saved net pay for ${employeeId}`)
    if (amount(row)<=0) throw new Error(`Export amount must be positive for ${employeeId}`)
    includedCents+=amount(row)
  }
  return { savedTotal:savedCents/100, includedTotal:includedCents/100,
    excludedTotal:(savedCents-includedCents)/100,
    includedCount:included.size, excludedCount:saved.size-included.size }
}
