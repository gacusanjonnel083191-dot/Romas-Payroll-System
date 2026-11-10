// Keep overtime narratives specific and auditable without changing the existing payroll rules.
const GENERIC_OVERTIME_REASONS = new Set([
  'operational requirements volume of work',
  'rush order client deadline',
  'staff shortage manpower gap',
  'management request',
  'inventory or restocking task',
  'others',
  'overtime',
  'extra work',
  'additional work',
  'needed overtime',
  'because of work',
  'due to work',
  'due to workload',
  'busy day',
  'as instructed',
  'same as above',
  'same work as above',
  'helped at work'
])

const normalized = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const wordCount = value => String(value || '').trim().split(/\s+/).filter(Boolean).length

export function validateOvertimeReasonFields(tasks, necessity) {
  const work = String(tasks || '').trim()
  const why = String(necessity || '').trim()
  if (work.length < 15 || wordCount(work) < 3) {
    return { valid:false, message:'Describe the specific overtime work performed (at least 15 characters and 3 words).' }
  }
  if (why.length < 15 || wordCount(why) < 3) {
    return { valid:false, message:'Explain why that work could not wait for the regular shift (at least 15 characters and 3 words).' }
  }
  if (GENERIC_OVERTIME_REASONS.has(normalized(work)) || GENERIC_OVERTIME_REASONS.has(normalized(why))) {
    return { valid:false, message:'Generic overtime reasons are not accepted. Describe the actual tasks and the specific operational need.' }
  }
  if (normalized(work) === normalized(why)) {
    return { valid:false, message:'The work performed and the reason overtime was necessary must be different explanations.' }
  }
  return { valid:true, message:'' }
}

export function formatOvertimeReasonForStorage(tasks, necessity) {
  return `Work performed: ${String(tasks || '').trim()}\nWhy overtime was necessary: ${String(necessity || '').trim()}`
}
