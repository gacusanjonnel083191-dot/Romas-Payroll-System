// Inspect an entire saved cutoff before any payroll release side effects.
// A completed cutoff is idempotent; a partially released one must be audited.
export function getPayrollReleaseState(rows = [], isReleasedRecord = () => false) {
  const total = rows.length
  const released = rows.filter(isReleasedRecord).length
  return {
    total,
    released,
    allReleased: total > 0 && released === total,
    partiallyReleased: released > 0 && released < total
  }
}
