const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/
const DEDUPE_MARKER = 'PAYROLL_PRIOR_CUTOFF_OT_DEDUP_GUARD'
const SNAPSHOT_FUNCTION_ANCHOR = 'function buildPayrollAdjustmentSnapshot(rows = []) {'
const SNAPSHOT_CALL = 'const adjustmentBreakdown = buildPayrollAdjustmentSnapshot(adjs || [])'
const DEDUPED_SNAPSHOT_CALL = 'const adjustmentBreakdown = buildPayrollAdjustmentSnapshot(filterDuplicatePriorCutoffOTAdjustments(adjs || []))'

export function getPriorCutoffOTSemanticKey(row = {}) {
  const adjustmentType = String(row?.adjustment_type || '').trim().toLowerCase()
  const category = String(row?.category || '').trim()
  const employeeId = String(row?.employee_id || '').trim()
  const attendanceDate = String(row?.source_attendance_date || '').slice(0, 10)
  const payrollStart = String(row?.source_payroll_start || '').slice(0, 10)
  const payrollEnd = String(row?.source_payroll_end || '').slice(0, 10)
  const minutes = Math.max(0, Math.round(Number(row?.source_minutes || 0)))
  const rate = Number(row?.source_rate || 0)
  const multiplier = Number(row?.source_multiplier || 0)
  const amount = Number(row?.amount || 0)

  if (
    adjustmentType !== 'addition'
    || !category.startsWith('Prior-Cutoff OT Correction')
    || !employeeId
    || !attendanceDate
    || !payrollStart
    || !payrollEnd
    || minutes <= 0
    || !Number.isFinite(rate)
    || rate <= 0
    || !Number.isFinite(multiplier)
    || multiplier <= 0
    || !Number.isFinite(amount)
    || amount <= 0
  ) return ''

  return [
    employeeId,
    attendanceDate,
    payrollStart,
    payrollEnd,
    minutes,
    rate.toFixed(6),
    multiplier.toFixed(4),
    amount.toFixed(2),
  ].join('|')
}

export function filterDuplicatePriorCutoffOTAdjustments(rows = []) {
  const list = Array.isArray(rows) ? rows : []
  const canonicalKeys = new Set(
    list
      .filter(row => String(row?.source_type || '').trim() === 'time_adjustment_carry_forward')
      .map(getPriorCutoffOTSemanticKey)
      .filter(Boolean)
  )
  if (canonicalKeys.size === 0) return list

  const retainedCanonicalKeys = new Set()
  return list.filter(row => {
    const key = getPriorCutoffOTSemanticKey(row)
    if (!key || !canonicalKeys.has(key)) return true

    const sourceType = String(row?.source_type || '').trim()
    if (sourceType === 'time_adjustment_carry_forward') {
      if (retainedCanonicalKeys.has(key)) return false
      retainedCanonicalKeys.add(key)
      return true
    }

    return false
  })
}

const HELPER_SOURCE = `// ${DEDUPE_MARKER}: source-request-linked carry-forwards are canonical.\n${getPriorCutoffOTSemanticKey.toString()}\n\n${filterDuplicatePriorCutoffOTAdjustments.toString()}\n\n`

function replaceExactlyOnce(source, from, to, label) {
  const firstIndex = source.indexOf(from)
  if (firstIndex < 0) throw new Error(`Payroll OT dedup invariant failed: ${label} was not found.`)
  const secondIndex = source.indexOf(from, firstIndex + from.length)
  if (secondIndex >= 0) throw new Error(`Payroll OT dedup invariant failed: ${label} matched more than once.`)
  return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

export function enforcePayrollAdjustmentDedup(source, id = '') {
  if (!APP_MODULE_RE.test(id)) return source
  let transformed = source
  if (!transformed.includes(DEDUPE_MARKER)) {
    transformed = replaceExactlyOnce(
      transformed,
      SNAPSHOT_FUNCTION_ANCHOR,
      `${HELPER_SOURCE}${SNAPSHOT_FUNCTION_ANCHOR}`,
      'payroll adjustment snapshot helper anchor'
    )
  }
  if (!transformed.includes(DEDUPED_SNAPSHOT_CALL)) {
    transformed = replaceExactlyOnce(
      transformed,
      SNAPSHOT_CALL,
      DEDUPED_SNAPSHOT_CALL,
      'payroll adjustment snapshot call'
    )
  }
  return transformed
}

export function payrollAdjustmentDedupInvariant() {
  return {
    name: 'romas-payroll-adjustment-dedup-invariant',
    enforce: 'pre',
    transform(code, id) {
      if (!APP_MODULE_RE.test(id)) return null
      return { code: enforcePayrollAdjustmentDedup(code, id), map: null }
    },
  }
}
