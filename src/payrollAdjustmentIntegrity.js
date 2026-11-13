function cents(value, id) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) {
    throw new Error(`Payroll adjustment ${id}: amount must be a nonnegative cent value`)
  }
  return Math.round(number * 100)
}

export function buildDeterministicAdjustmentSnapshot(rows = []) {
  const seen = new Set()
  return rows.map(row => {
    const id = String(row?.id || '').trim()
    const type = String(row?.adjustment_type || '').trim().toLowerCase()
    const date = String(row?.adjustment_date || '').slice(0, 10)
    if (!id || seen.has(id)) throw new Error(`Duplicate or unidentified payroll adjustment ${id || '(missing ID)'}`)
    seen.add(id)
    if (type !== 'addition' && type !== 'deduction') throw new Error(`Payroll adjustment ${id}: invalid type`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Payroll adjustment ${id}: invalid source date`)
    const amountCents = cents(row.amount,id)
    return {
      id, type, category:String(row?.category || '').trim() || (type === 'addition' ? 'Payroll Addition' : 'Payroll Deduction'),
      amount:amountCents / 100, date, notes:String(row?.notes || '').trim(), source:'payroll_adjustments'
    }
  }).filter(item => item.amount > 0).sort((a,b) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export function sumAdjustmentCents(items = [], type) {
  return items.filter(item => item.type === type).reduce((sum,item) => sum + cents(item.amount,item.id),0)
}
