'use strict'

function replaceRequired(src, before, after, label) {
  if (src.includes(before)) return src.replace(before, after)
  if (src.includes(after)) return src
  throw new Error(`Supabase egress optimization aborted: ${label} anchor was not found.`)
}

function replaceAllRequired(src, before, after, label, expectedMin = 1) {
  if (!src.includes(before)) {
    if (src.includes(after)) return src
    throw new Error(`Supabase egress optimization aborted: ${label} anchor was not found.`)
  }
  const count = src.split(before).length - 1
  if (count < expectedMin) {
    throw new Error(`Supabase egress optimization aborted: ${label} expected at least ${expectedMin} match(es), found ${count}.`)
  }
  return src.split(before).join(after)
}

function assertContains(src, needle, label) {
  if (!src.includes(needle)) {
    throw new Error(`Supabase egress optimization verification failed: ${label}.`)
  }
}

function assertNotContains(src, needle, label) {
  if (src.includes(needle)) {
    throw new Error(`Supabase egress optimization verification failed: ${label}.`)
  }
}

function applyEgressOptimization(source) {
  let src = String(source || '')
  if (!src.includes("const supabase = createClient(supabaseUrl, supabaseKey)")) {
    throw new Error("Supabase egress optimization aborted: Roma's Supabase client anchor was not found.")
  }

  // Attendance adjustments: do not load/revalidate hundreds of approved historical
  // requests during a normal owner/admin login. Pending becomes the operational default.
  src = replaceRequired(
    src,
    "const [timeAdjView, setTimeAdjView] = useState('active')",
    "const [timeAdjView, setTimeAdjView] = useState('pending')",
    'attendance-adjustment default view'
  )

  src = replaceRequired(
    src,
    'loadHolidays(); loadTimeAdjRequests(); loadAnnouncements(); loadDashboard()',
    'loadHolidays(); loadAnnouncements(); loadDashboard()',
    'eager attendance-adjustment login load'
  )

  src = replaceRequired(
    src,
    "const adjustmentRows = rows.filter(req => ['overtime','meal_break'].includes(String(req?.request_type || '').toLowerCase()))",
    "const adjustmentRows = rows.filter(req => String(req?.status || '').toLowerCase() === 'pending' && ['overtime','meal_break'].includes(String(req?.request_type || '').toLowerCase()))",
    'attendance-adjustment bulk validation scope'
  )

  // Foundation / Owner Command Center: preserve every existing calculation, but stop
  // downloading the full current-month + six-month historical dataset automatically.
  // The existing Owner Command Center already has LOAD/REFRESH controls, so data becomes
  // explicitly on-demand. Auto-refresh is opt-in and only runs while Foundation is open.
  src = replaceRequired(
    src,
    'const [foundationAutoRefresh, setFoundationAutoRefresh] = useState(true)',
    'const [foundationAutoRefresh, setFoundationAutoRefresh] = useState(false)',
    'Foundation auto-refresh default'
  )

  src = replaceRequired(
    src,
    'const FOUNDATION_REFRESH_SECONDS = 60',
    'const FOUNDATION_REFRESH_SECONDS = 15 * 60',
    'Foundation refresh cadence'
  )

  src = replaceRequired(
    src,
    'const [foundationLastUpdated, setFoundationLastUpdated] = useState(null)\n const FOUNDATION_REFRESH_SECONDS = 15 * 60',
    'const [foundationLastUpdated, setFoundationLastUpdated] = useState(null)\n const foundationLoadInFlightRef = useRef(false)\n const FOUNDATION_REFRESH_SECONDS = 15 * 60',
    'Foundation in-flight request guard state'
  )

  src = replaceRequired(
    src,
    "const canViewFoundation = (activeTab === 'foundation' && (adminRole === 'owner' || adminRole === 'manager')) || (activeTab === 'dashboard' && adminRole === 'owner') // OWNER_DASHBOARD_AUTO_REFRESH_V2",
    "const canViewFoundation = activeTab === 'foundation' && (adminRole === 'owner' || adminRole === 'manager') // EGRESS_SAFE_FOUNDATION_REFRESH_V1",
    'Foundation background-refresh scope'
  )

  src = replaceRequired(
    src,
    "const canRefresh = foundationData || activeTab === 'foundation'\n if (!canRefresh) return\n loadFoundationData(foundationMonth, { silent:true, showLoading:false, reason })",
    "const canRefresh = activeTab === 'foundation' && !!foundationData\n if (!canRefresh) return\n loadFoundationData(foundationMonth, { silent:true, showLoading:false, reason, force:true })",
    'Foundation post-mutation refresh scope'
  )

  src = replaceRequired(
    src,
    "async function loadFoundationData(monthValue = foundationMonth, options = {}) {\n const showLoading = options.showLoading === true || (options.showLoading!== false && options.silent!== true)",
    "async function loadFoundationData(monthValue = foundationMonth, options = {}) {\n if (foundationLoadInFlightRef.current) return\n foundationLoadInFlightRef.current = true\n const showLoading = options.showLoading === true || (options.showLoading!== false && options.silent!== true)",
    'Foundation loader in-flight guard'
  )

  src = replaceRequired(
    src,
    "console.error('Foundation data failed:', e)\n if (!options.silent) showToast('Foundation dashboard failed to load: ' + e.message, 'red')\n } finally {\n if (showLoading) setFoundationLoading(false)\n }\n }",
    "console.error('Foundation data failed:', e)\n if (!options.silent) showToast('Foundation dashboard failed to load: ' + e.message, 'red')\n } finally {\n if (showLoading) setFoundationLoading(false)\n foundationLoadInFlightRef.current = false\n }\n }",
    'Foundation loader in-flight release'
  )

  // Remove only the eager Foundation call at successful admin login. The command center
  // already renders an explicit LOAD COMMAND CENTER button when foundationData is null.
  src = replaceRequired(
    src,
    "; autoAcknowledgeExpired().catch(()=>{}); if (safeRole==='owner' || safeRole==='manager') loadFoundationData().catch(()=>{})",
    "; autoAcknowledgeExpired().catch(()=>{})",
    'eager Foundation login load'
  )

  // If the user deliberately enables auto-refresh, make the UI communicate minutes rather
  // than the old 60-second cadence.
  src = replaceAllRequired(
    src,
    '` AUTO ${FOUNDATION_REFRESH_SECONDS}s`',
    '` AUTO ${Math.round(FOUNDATION_REFRESH_SECONDS / 60)}m`',
    'Foundation auto-refresh button label'
  )

  src = replaceAllRequired(
    src,
    '`Auto-refresh is ON. Dashboard reloads every ${FOUNDATION_REFRESH_SECONDS} seconds while this module is open.`',
    '`Auto-refresh is ON. Foundation reloads every ${Math.round(FOUNDATION_REFRESH_SECONDS / 60)} minutes while this module is open.`',
    'Foundation auto-refresh explanatory text'
  )

  // Verification: cover only the expensive behaviors; unrelated business rules are untouched.
  assertContains(src, "const [timeAdjView, setTimeAdjView] = useState('pending')", 'Pending is the attendance-adjustment default')
  assertNotContains(src, 'loadHolidays(); loadTimeAdjRequests(); loadAnnouncements(); loadDashboard()', 'attendance adjustments are no longer eagerly loaded at login')
  assertContains(src, "String(req?.status || '').toLowerCase() === 'pending'", 'bulk attendance validation is restricted to pending requests')
  assertContains(src, 'const [foundationAutoRefresh, setFoundationAutoRefresh] = useState(false)', 'Foundation auto-refresh defaults OFF')
  assertContains(src, 'const FOUNDATION_REFRESH_SECONDS = 15 * 60', 'Foundation opt-in auto-refresh is 15 minutes')
  assertContains(src, 'const foundationLoadInFlightRef = useRef(false)', 'Foundation in-flight guard exists')
  assertContains(src, "const canViewFoundation = activeTab === 'foundation'", 'Foundation background refresh is limited to the Foundation module')
  assertNotContains(src, "if (safeRole==='owner' || safeRole==='manager') loadFoundationData().catch(()=>{})", 'Foundation no longer performs a heavy eager login load')

  return src
}

module.exports = { applyEgressOptimization }
