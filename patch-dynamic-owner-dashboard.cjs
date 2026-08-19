const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')
const commandCenterSnippet = fs.readFileSync('dynamic-owner-dashboard-snippet.txt','utf8').trim()

function replaceAt(source, start, oldText, newText, label) {
  if (start < 0 || source.slice(start, start + oldText.length) !== oldText) {
    throw new Error(`Could not replace ${label}. Dynamic dashboard patch aborted safely.`)
  }
  return source.slice(0, start) + newText + source.slice(start + oldText.length)
}

function replaceAfter(anchorIndex, oldText, newText, label, maxDistance = 20000) {
  const targetIndex = src.indexOf(oldText, anchorIndex)
  if (targetIndex < 0 || targetIndex - anchorIndex > maxDistance) {
    throw new Error(`Could not find ${label}. Dynamic dashboard patch aborted safely.`)
  }
  src = replaceAt(src, targetIndex, oldText, newText, label)
}

// 1) Upgrade the existing dashboard loader with the latest owner-control briefing.
if (!src.includes('DYNAMIC_OWNER_BRIEFING_QUERY_V1')) {
  const loadDashboardIndex = src.indexOf('async function loadDashboard()')
  if (loadDashboardIndex < 0) throw new Error('loadDashboard() was not found.')

  const pendingDisputeQuery = "const { data:pendingDisp } = await supabase.from('payslip_disputes').select('id').eq('status', 'pending')"
  const ownerBriefingQuery = `${pendingDisputeQuery}\n  // DYNAMIC_OWNER_BRIEFING_QUERY_V1\n  const { data:ownerBriefingRows } = await supabase.from('business_owner_briefings')\n   .select('briefing_date,headline,executive_summary,metrics,priorities,generated_at')\n   .order('generated_at', { ascending:false })\n   .limit(1)\n  const ownerBriefing = ownerBriefingRows?.[0] || null`
  replaceAfter(loadDashboardIndex, pendingDisputeQuery, ownerBriefingQuery, 'owner briefing query', 7000)

  const pendingDisputeField = 'pendingDisputes: pendingDisp?.length||0,'
  replaceAfter(loadDashboardIndex, pendingDisputeField, `${pendingDisputeField}\n  ownerBriefing,`, 'owner briefing dashboard field', 14000)
}

// 2) Insert the professional command center at the top of the current Dashboard tab.
if (!src.includes('DYNAMIC_OWNER_COMMAND_CENTER_V1')) {
  const dashboardRenderIndex = src.indexOf("{activeTab==='dashboard' && (")
  if (dashboardRenderIndex < 0) throw new Error('Dashboard render block was not found.')
  const timedInModalIndex = src.indexOf('{/* TIMED IN MODAL */}', dashboardRenderIndex)
  if (timedInModalIndex < 0 || timedInModalIndex - dashboardRenderIndex > 12000) {
    throw new Error('Dashboard insertion point was not found safely.')
  }
  src = src.slice(0, timedInModalIndex) + commandCenterSnippet + '\n  ' + src.slice(timedInModalIndex)
}

// 3) Refreshing the dashboard must refresh the integrated Foundation data as well.
if (!src.includes('DYNAMIC_DASHBOARD_REFRESH_V1')) {
  const dashboardRenderIndex = src.indexOf("{activeTab==='dashboard' && (")
  if (dashboardRenderIndex < 0) throw new Error('Dashboard render block was not found for refresh patch.')
  const oldRefresh = "onClick={async()=>{ await loadDashboard(); await loadDashboardCharts(); await loadDeliveryInvoices(); showToast(' Dashboard refreshed!') }}"
  const newRefresh = "onClick={async()=>{ await loadDashboard(); await loadDashboardCharts(); await loadDeliveryInvoices(); if (isOwnerRole || normalizedAdminRole==='manager') await loadFoundationData({ silent:true }); /* DYNAMIC_DASHBOARD_REFRESH_V1 */ showToast(' Dashboard refreshed!') }}"
  replaceAfter(dashboardRenderIndex, oldRefresh, newRefresh, 'dashboard integrated refresh', 7000)
}

// 4) Future-dated invoices are scheduled business, not earned/current revenue.
//    Keep them in the system but exclude them from Analytics until their delivery date arrives.
if (!src.includes('ANALYTICS_EXCLUDE_FUTURE_INVOICES_V1')) {
  const analyticsSource = 'const allInvoices = deliveryInvoices'
  const analyticsIndex = src.indexOf(analyticsSource)
  if (analyticsIndex < 0) throw new Error('Analytics invoice source was not found.')
  const filteredSource = "const allInvoices = deliveryInvoices.filter(inv=>!inv?.delivery_date || String(inv.delivery_date).slice(0,10) <= today) /* ANALYTICS_EXCLUDE_FUTURE_INVOICES_V1 */"
  src = replaceAt(src, analyticsIndex, analyticsSource, filteredSource, 'future invoice Analytics filter')
}

// 5) Clarify the dashboard purpose without removing the existing operational detail below it.
const dashboardTitle = '<h2 className="romas-dashboard-title">BUSINESS DASHBOARD</h2>'
if (src.includes(dashboardTitle)) {
  src = src.replace(dashboardTitle, '<h2 className="romas-dashboard-title">OWNER COMMAND CENTER</h2>')
}
const dashboardSubtitle = '<p className="romas-dashboard-subtitle">Roma\'s Donuts operational overview</p>'
if (src.includes(dashboardSubtitle)) {
  src = src.replace(dashboardSubtitle, '<p className="romas-dashboard-subtitle">Live decisions, controls, and operational signals</p>')
}
const dashboardEyebrow = '<p className="romas-dashboard-eyebrow">Integrated business workflow</p>'
if (src.includes(dashboardEyebrow)) {
  src = src.replace(dashboardEyebrow, '<p className="romas-dashboard-eyebrow">Dynamic management dashboard</p>')
}

fs.writeFileSync(path, src, 'utf8')
console.log('Dynamic Owner Command Center applied: live briefing priorities, integrated Foundation KPIs, decision support, operational signals, and future-invoice Analytics protection.')
