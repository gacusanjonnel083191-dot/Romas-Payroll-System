'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { applyEgressOptimization } = require('../scripts/supabase-egress-optimizer.cjs')

function fixture() {
  return `
const supabase = createClient(supabaseUrl, supabaseKey)
const [timeAdjView, setTimeAdjView] = useState('active')
const [foundationAutoRefresh, setFoundationAutoRefresh] = useState(true)
const [foundationLastUpdated, setFoundationLastUpdated] = useState(null)
 const FOUNDATION_REFRESH_SECONDS = 60
const canViewFoundation = (activeTab === 'foundation' && (adminRole === 'owner' || adminRole === 'manager')) || (activeTab === 'dashboard' && adminRole === 'owner') // OWNER_DASHBOARD_AUTO_REFRESH_V2
function refreshFoundationAfterDataChange(reason = '') {
 const canRefresh = foundationData || activeTab === 'foundation'
 if (!canRefresh) return
 loadFoundationData(foundationMonth, { silent:true, showLoading:false, reason })
}
async function loadFoundationData(monthValue = foundationMonth, options = {}) {
 const showLoading = options.showLoading === true || (options.showLoading!== false && options.silent!== true)
 try {
  work()
 } catch(e) {
 console.error('Foundation data failed:', e)
 if (!options.silent) showToast('Foundation dashboard failed to load: ' + e.message, 'red')
 } finally {
 if (showLoading) setFoundationLoading(false)
 }
 }
loadHolidays(); loadTimeAdjRequests(); loadAnnouncements(); loadDashboard()
loadDepartmentLocations(); loadDashboardCharts(); loadNotifications(); loadPendingResellerOrders(); loadBankDeposits(); loadSuspiciousAlerts(); autoAcknowledgeExpired().catch(()=>{}); if (safeRole==='owner' || safeRole==='manager') loadFoundationData().catch(()=>{})
const adjustmentRows = rows.filter(req => ['overtime','meal_break'].includes(String(req?.request_type || '').toLowerCase()))
const label = foundationAutoRefresh? \` AUTO \${FOUNDATION_REFRESH_SECONDS}s\`: ' AUTO OFF'
const note = foundationAutoRefresh? \`Auto-refresh is ON. Dashboard reloads every \${FOUNDATION_REFRESH_SECONDS} seconds while this module is open.\`: ' AUTO OFF'
`
}

test('converts expensive automatic reads into on-demand guarded reads', () => {
  const out = applyEgressOptimization(fixture())
  assert.match(out, /useState\('pending'\)/)
  assert.doesNotMatch(out, /loadHolidays\(\); loadTimeAdjRequests\(\);/)
  assert.match(out, /status \|\| ''\)\.toLowerCase\(\) === 'pending'/)
  assert.match(out, /foundationAutoRefresh, setFoundationAutoRefresh\] = useState\(false\)/)
  assert.match(out, /FOUNDATION_REFRESH_SECONDS = 15 \* 60/)
  assert.match(out, /foundationLoadInFlightRef = useRef\(false\)/)
  assert.match(out, /activeTab === 'foundation'/)
  assert.doesNotMatch(out, /safeRole==='owner' \|\| safeRole==='manager'\) loadFoundationData/)
  assert.match(out, /AUTO \$\{Math\.round\(FOUNDATION_REFRESH_SECONDS \/ 60\)\}m/)
})

test('is idempotent', () => {
  const once = applyEgressOptimization(fixture())
  const twice = applyEgressOptimization(once)
  assert.equal(twice, once)
})

test('fails closed if the target application no longer has the expected Supabase anchor', () => {
  assert.throws(() => applyEgressOptimization('const x = 1'), /Supabase client anchor was not found/)
})
