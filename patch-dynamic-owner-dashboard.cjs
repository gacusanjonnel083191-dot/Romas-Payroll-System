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

// 2) Upgrade a previously build-patched V1 source safely before applying V2.
//    V2 is owner-only, keeps the original operational dashboard available through
//    an explicit view switch, and does not rename the dashboard for other roles.
const hadLegacyOwnerDashboard = src.includes('DYNAMIC_OWNER_COMMAND_CENTER_V1')
if (hadLegacyOwnerDashboard) {
  const legacyStart = src.indexOf('{/* DYNAMIC_OWNER_COMMAND_CENTER_V1 */}')
  const timedInModalIndex = src.indexOf('{/* TIMED IN MODAL */}', legacyStart)
  if (legacyStart < 0 || timedInModalIndex < 0 || timedInModalIndex - legacyStart > 22000) {
    throw new Error('Could not remove the V1 owner dashboard safely.')
  }
  src = src.slice(0, legacyStart) + src.slice(timedInModalIndex)
}

const legacyRefresh = "onClick={async()=>{ await loadDashboard(); await loadDashboardCharts(); await loadDeliveryInvoices(); if (isOwnerRole || normalizedAdminRole==='manager') await loadFoundationData({ silent:true }); /* DYNAMIC_DASHBOARD_REFRESH_V1 */ showToast(' Dashboard refreshed!') }}"
const standardRefresh = "onClick={async()=>{ await loadDashboard(); await loadDashboardCharts(); await loadDeliveryInvoices(); showToast(' Dashboard refreshed!') }}"
if (src.includes(legacyRefresh)) src = src.replace(legacyRefresh, standardRefresh)

if (hadLegacyOwnerDashboard) {
  src = src
    .replace('<p className="romas-dashboard-eyebrow">Dynamic management dashboard</p>', '<p className="romas-dashboard-eyebrow">Integrated business workflow</p>')
    .replace('<h2 className="romas-dashboard-title">OWNER COMMAND CENTER</h2>', '<h2 className="romas-dashboard-title">BUSINESS DASHBOARD</h2>')
    .replace('<p className="romas-dashboard-subtitle">Live decisions, controls, and operational signals</p>', '<p className="romas-dashboard-subtitle">Roma\'s Donuts operational overview</p>')
}

// 3) Add the owner dashboard mode once. The default is the Command Center; the
//    original HR/attendance/site-controls dashboard remains available on demand.
if (!src.includes('OWNER_DASHBOARD_MODE_V2')) {
  const foundationLoadingState = "const [foundationLoading, setFoundationLoading] = useState(false)"
  const foundationLoadingIndex = src.indexOf(foundationLoadingState)
  if (foundationLoadingIndex < 0) throw new Error('Foundation dashboard state was not found.')
  const modeState = `${foundationLoadingState}\n const [ownerDashboardMode, setOwnerDashboardMode] = useState('command') // OWNER_DASHBOARD_MODE_V2`
  src = replaceAt(src, foundationLoadingIndex, foundationLoadingState, modeState, 'owner dashboard mode state')
}

// 4) Keep the command center live while the owner is viewing the Dashboard.
if (!src.includes('OWNER_DASHBOARD_AUTO_REFRESH_V2')) {
  const oldFoundationGate = "const canViewFoundation = activeTab === 'foundation' && (adminRole === 'owner' || adminRole === 'manager')"
  const newFoundationGate = "const canViewFoundation = (activeTab === 'foundation' && (adminRole === 'owner' || adminRole === 'manager')) || (activeTab === 'dashboard' && adminRole === 'owner') // OWNER_DASHBOARD_AUTO_REFRESH_V2"
  const gateIndex = src.indexOf(oldFoundationGate)
  if (gateIndex < 0) throw new Error('Foundation auto-refresh gate was not found.')
  src = replaceAt(src, gateIndex, oldFoundationGate, newFoundationGate, 'owner dashboard auto-refresh gate')
}

// 5) Reset the owner to the command view on login and whenever Dashboard is opened.
if (!src.includes('OWNER_DASHBOARD_LOGIN_RESET_V2')) {
  const adminModeLine = "setAdminMode(true); setAdminRole(safeRole); setEmployeeSearch(''); setSidebarOpen(false)"
  const adminModeIndex = src.indexOf(adminModeLine)
  if (adminModeIndex < 0) throw new Error('Admin open flow was not found.')
  const resetLine = `${adminModeLine}\n if (safeRole === 'owner') setOwnerDashboardMode('command') // OWNER_DASHBOARD_LOGIN_RESET_V2`
  src = replaceAt(src, adminModeIndex, adminModeLine, resetLine, 'owner dashboard login reset')
}

if (!src.includes('OWNER_DASHBOARD_NAV_RESET_V2')) {
  const dashboardLoadCandidates = [
    "if(key==='dashboard') { loadDashboard(); loadDashboardCharts(); if (normalizeAdminRole(adminRole)==='owner') loadOwnerActionCenter() }",
    "if(key==='dashboard') { loadDashboard(); loadDashboardCharts() }",
  ]
  const oldDashboardLoad = dashboardLoadCandidates.find(candidate => src.includes(candidate))
  if (!oldDashboardLoad) throw new Error('Dashboard navigation loader was not found.')
  const ownerQueueRefresh = oldDashboardLoad.includes('loadOwnerActionCenter')
    ? " if (normalizeAdminRole(adminRole)==='owner') loadOwnerActionCenter();"
    : ''
  const newDashboardLoad = `if(key==='dashboard') { if (isOwnerRole) setOwnerDashboardMode('command'); /* OWNER_DASHBOARD_NAV_RESET_V2 */ loadDashboard(); loadDashboardCharts();${ownerQueueRefresh} }`
  const dashboardLoadIndex = src.indexOf(oldDashboardLoad)
  src = replaceAt(src, dashboardLoadIndex, oldDashboardLoad, newDashboardLoad, 'owner dashboard navigation reset')
}

// 6) Render the new owner-only command center as the default Dashboard. The
//    established operational dashboard is untouched for non-owners and can be
//    opened by the owner through ownerDashboardMode='operations'.
if (!src.includes('DYNAMIC_OWNER_COMMAND_CENTER_V2')) {
  const originalDashboardCondition = "{activeTab==='dashboard' && ("
  const guardedDashboardCondition = "{activeTab==='dashboard' && (!isOwnerRole || ownerDashboardMode==='operations') && ("
  let dashboardRenderIndex = src.indexOf(originalDashboardCondition)
  if (dashboardRenderIndex >= 0) {
    src = replaceAt(src, dashboardRenderIndex, originalDashboardCondition, guardedDashboardCondition, 'operational dashboard role guard')
  } else {
    dashboardRenderIndex = src.indexOf(guardedDashboardCondition)
    if (dashboardRenderIndex < 0) throw new Error('Dashboard render block was not found.')
  }
  src = src.slice(0, dashboardRenderIndex) + commandCenterSnippet + '\n\n ' + src.slice(dashboardRenderIndex)
}

// 7) Give the owner a clear way back from HR/site controls to the command view.
if (!src.includes('OWNER_DASHBOARD_RETURN_V2')) {
  const dashboardActions = '<div className="romas-dashboard-actions">'
  const operationalDashboardIndex = src.indexOf("{activeTab==='dashboard' && (!isOwnerRole || ownerDashboardMode==='operations') && (")
  if (operationalDashboardIndex < 0) throw new Error('Operational dashboard block was not found for return control.')
  const dashboardActionsIndex = src.indexOf(dashboardActions, operationalDashboardIndex)
  if (dashboardActionsIndex < 0 || dashboardActionsIndex - operationalDashboardIndex > 4000) throw new Error('Operational dashboard actions were not found safely.')
  const returnControl = `${dashboardActions}\n {isOwnerRole && <button type="button" style={{...btnYellow, width:'auto', padding:'8px 13px', marginTop:0, fontSize:'11px' }} onClick={()=>setOwnerDashboardMode('command')}>OWNER COMMAND CENTER</button>} {/* OWNER_DASHBOARD_RETURN_V2 */}`
  src = replaceAt(src, dashboardActionsIndex, dashboardActions, returnControl, 'owner command center return control')
}

// 8) Future-dated invoices are scheduled business, not earned/current revenue.
//    Keep them in the system but exclude them from Analytics until their delivery date arrives.
if (!src.includes('ANALYTICS_EXCLUDE_FUTURE_INVOICES_V1')) {
  const analyticsSource = 'const allInvoices = deliveryInvoices'
  const analyticsIndex = src.indexOf(analyticsSource)
  if (analyticsIndex < 0) throw new Error('Analytics invoice source was not found.')
  const filteredSource = "const allInvoices = deliveryInvoices.filter(inv=>!inv?.delivery_date || String(inv.delivery_date).slice(0,10) <= today) /* ANALYTICS_EXCLUDE_FUTURE_INVOICES_V1 */"
  src = replaceAt(src, analyticsIndex, analyticsSource, filteredSource, 'future invoice Analytics filter')
}

fs.writeFileSync(path, src, 'utf8')
console.log('Owner Command Center V2 applied: owner-only executive view, verified Foundation KPIs, targets, trends, drill-downs, and preserved HR/site controls.')
