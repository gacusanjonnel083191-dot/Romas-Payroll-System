const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/

const AUTO_ORDER_UI_REPLACEMENTS = [
  [
    "if (getOrderCutoffStatus().locked && activeSchedules.some(entry=>entry.weekday===tomorrowWeekday)) {",
    "if (getPHDateTimeParts().totalMinutes >= minutesFromTime('10:00') && activeSchedules.some(entry=>entry.weekday===tomorrowWeekday)) {",
    'recurring skip client-side cutoff guard',
  ],
  [
    'after the 1:00 PM cutoff.',
    'after the 10:00 AM automatic-order cutoff.',
    'recurring skip cutoff warning',
  ],
  [
    'Daily cutoff: <strong>1:00 PM Philippine time</strong> · Staff approval required',
    'Automatic submission: <strong>10:00 AM Philippine time</strong> · Manual order deadline: <strong>1:00 PM</strong> · Staff approval required',
    'reseller dashboard cutoff summary',
  ],
  [
    'Orders are generated at the fixed 1:00 PM Philippine-time cutoff for the next delivery day, then wait for staff approval.',
    'Automatic orders are submitted at the fixed 10:00 AM Philippine-time cutoff for the next delivery day, then wait for staff approval. Manual orders remain open until 1:00 PM.',
    'automatic ordering page description',
  ],
  [
    'Active day templates will submit automatically at 1:00 PM.',
    'Active day templates will submit automatically at 10:00 AM.',
    'automatic ordering enabled status',
  ],
  [
    'One template per weekday. Template changes for tomorrow lock at 1:00 PM.',
    'One template per weekday. Template changes for tomorrow lock at 10:00 AM.',
    'automatic template lock notice',
  ],
  [
    'Choose a one-time future date or a delivery day to skip every week. Tomorrow can only be changed before 1:00 PM.',
    'Choose a one-time future date or a delivery day to skip every week. Tomorrow can only be changed before 10:00 AM.',
    'automatic skip lock notice',
  ],
  [
    'value="1:00 PM every day (fixed)"',
    'value="10:00 AM every day (fixed)"',
    'automatic template cutoff field',
  ],
]

function replaceExactlyOnce(source, from, to, label) {
  const firstIndex = source.indexOf(from)
  if (firstIndex < 0) {
    throw new Error(`Reseller auto-order 10 AM invariant failed: ${label} was not found.`)
  }
  const secondIndex = source.indexOf(from, firstIndex + from.length)
  if (secondIndex >= 0) {
    throw new Error(`Reseller auto-order 10 AM invariant failed: ${label} matched more than once.`)
  }
  return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

export function enforceResellerAutoOrder10am(source, id = '') {
  if (!APP_MODULE_RE.test(id)) return source

  let transformed = source
  for (const [from, to, label] of AUTO_ORDER_UI_REPLACEMENTS) {
    transformed = replaceExactlyOnce(transformed, from, to, label)
  }

  // The manual-order workflow must remain at 1:00 PM.
  if (!transformed.includes("const ORDER_CUTOFF_TIME = '13:00'")) {
    throw new Error('Reseller auto-order 10 AM invariant failed: manual ORDER_CUTOFF_TIME must remain 13:00.')
  }
  if (!transformed.includes("const ORDER_CUTOFF_LABEL = '1:00 PM'")) {
    throw new Error('Reseller auto-order 10 AM invariant failed: manual ORDER_CUTOFF_LABEL must remain 1:00 PM.')
  }

  return transformed
}

export function resellerAutoOrder10amInvariant() {
  return {
    name: 'romas-reseller-auto-order-10am-invariant',
    enforce: 'pre',
    transform(code, id) {
      if (!APP_MODULE_RE.test(id)) return null
      return {
        code: enforceResellerAutoOrder10am(code, id),
        map: null,
      }
    },
  }
}
