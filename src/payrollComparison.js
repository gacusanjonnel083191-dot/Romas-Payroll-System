const COMPONENTS = [
  ['basic_pay', 'Basic pay'],
  ['birthday_pay', 'Birthday pay'],
  ['overtime_pay', 'Overtime pay'],
  ['night_diff_pay', 'Night differential'],
  ['holiday_pay', 'Holiday pay'],
  ['other_earnings', 'Other earnings'],
  ['late_deduction', 'Late deduction'],
  ['undertime_deduction', 'Undertime deduction'],
  ['absence_deduction', 'Absence / special-day deduction'],
  ['other_deductions', 'Other deductions (including absence)'],
  ['cash_advance_deduction', 'Cash advance'],
  ['sss_deduction', 'SSS'],
  ['pagibig_deduction', 'Pag-IBIG'],
  ['philhealth_deduction', 'PhilHealth'],
  ['total_earnings', 'Total earnings'],
  ['total_deductions', 'Total deductions'],
  ['net_pay', 'Net pay'],
]

export function payrollCents(value) {
  const raw = String(value ?? '0').trim()
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(raw)
  if (!match) throw new Error(`Invalid payroll amount: ${raw}`)
  const cents = Number(match[2]) * 100 + Number((match[3] || '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('Payroll amount exceeds safe integer range')
  return match[1] ? -cents : cents
}

function detailItems(record) {
  const adjustments = Array.isArray(record.adjustment_breakdown) ? record.adjustment_breakdown : []
  const advances = Array.isArray(record.cash_advance_breakdown) ? record.cash_advance_breakdown : []
  return [
    ...adjustments.map(item => ({
      source: 'adjustment', id:String(item.id || ''), date:String(item.date || item.adjustment_date || ''),
      label:String(item.category || item.type || 'Adjustment'), amount:item.amount
    })),
    ...advances.map(item => ({
      source: 'cash advance', id:String(item.id || item.cash_advance_id || ''),
      date:String(item.date || item.advance_date || ''), label:'Cash advance', amount:item.amount
    }))
  ]
}

export function comparePayrollSnapshots(previousSnapshots = [], currentRecords = []) {
  const previous = previousSnapshots.map(row => row.payroll_record || row)
  const before = new Map(previous.map(row => [String(row.employee_id),row]))
  const after = new Map(currentRecords.map(row => [String(row.employee_id),row]))
  if (before.size !== previous.length || after.size !== currentRecords.length) {
    throw new Error('Duplicate employee payroll rows prevent comparison')
  }
  const ids = [...new Set([...before.keys(),...after.keys()])].sort()
  const changes = ids.flatMap(id => {
    const oldRow = before.get(id)
    const newRow = after.get(id)
    const fields = COMPONENTS.flatMap(([key,label]) => {
      const oldCents = oldRow ? payrollCents(oldRow[key]) : 0
      const newCents = newRow ? payrollCents(newRow[key]) : 0
      return oldCents === newCents ? [] : [{ field:key, label, before:oldCents/100, after:newCents/100, difference:(newCents-oldCents)/100 }]
    })
    const previousSources = oldRow ? detailItems(oldRow) : []
    const currentSources = newRow ? detailItems(newRow) : []
    const sourceOrder = (a,b) => `${a.source}|${a.id}|${a.date}|${a.amount}`.localeCompare(`${b.source}|${b.id}|${b.date}|${b.amount}`)
    const sourcesChanged = JSON.stringify([...previousSources].sort(sourceOrder)) !== JSON.stringify([...currentSources].sort(sourceOrder))
    if (!fields.length && oldRow && newRow && !sourcesChanged) return []
    return [{ employeeId:id, employeeCode:newRow?.employee_code || oldRow?.employee_code || '',
      employeeName:newRow?.employee_name || oldRow?.employee_name || '',
      status:oldRow && newRow ? 'changed' : oldRow ? 'removed' : 'added',
      fields, sourcesChanged, previousSources, currentSources }]
  })
  const previousCents = previous.reduce((sum,row) => sum + payrollCents(row.net_pay),0)
  const currentCents = currentRecords.reduce((sum,row) => sum + payrollCents(row.net_pay),0)
  return { previousTotal:previousCents/100, currentTotal:currentCents/100,
    difference:(currentCents-previousCents)/100, changes }
}
