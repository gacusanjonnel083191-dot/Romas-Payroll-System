// Compact the admin Cash Advance Requests view without touching payroll/CA business logic.
// The main admin screen is implemented in a large legacy component, so this helper
// applies narrowly-scoped classes after React renders the matching section.

const CASH_ADVANCE_HEADING = 'Cash Advance Requests'
const PENDING_BADGE_TEXT = 'PENDING REVIEW'
const DEDUCTION_LABEL_TEXT = 'NUMBER OF PAYROLL DEDUCTIONS'

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase()
}

function isPendingCashAdvanceCard(element) {
  const text = normalizeText(element?.textContent)
  return text.includes(PENDING_BADGE_TEXT) && text.includes(DEDUCTION_LABEL_TEXT)
}

function tagMetricsGrid(card) {
  const metricLabels = [
    'REQUESTED AMOUNT',
    'PAYROLL DEDUCTIONS',
    'DEDUCTION / CUTOFF',
    'BALANCE AFTER APPROVAL',
  ]

  const candidates = card.querySelectorAll('div')
  for (const candidate of candidates) {
    const text = normalizeText(candidate.textContent)
    const hasAllLabels = metricLabels.every((label) => text.includes(label))
    if (candidate.children.length === 4 && hasAllLabels) {
      candidate.classList.add('ca-pending-request-metrics')
      return
    }
  }
}

function applyCashAdvanceCompactLayout() {
  document.querySelectorAll('h2').forEach((heading) => {
    if (String(heading.textContent || '').trim() !== CASH_ADVANCE_HEADING) return

    const section = heading.parentElement
    if (!section) return

    section.classList.add('ca-requests-compact-grid')

    Array.from(section.children).forEach((child) => {
      if (!isPendingCashAdvanceCard(child)) return
      child.classList.add('ca-pending-request-card')
      tagMetricsGrid(child)
    })
  })
}

let layoutQueued = false
function queueLayoutPass() {
  if (layoutQueued) return
  layoutQueued = true
  requestAnimationFrame(() => {
    layoutQueued = false
    applyCashAdvanceCompactLayout()
  })
}

export function installCashAdvanceCompactLayout() {
  queueLayoutPass()

  const root = document.getElementById('root') || document.body
  const observer = new MutationObserver(queueLayoutPass)
  observer.observe(root, { childList: true, subtree: true, characterData: true })

  return () => observer.disconnect()
}
