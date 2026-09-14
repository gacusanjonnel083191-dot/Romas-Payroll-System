const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

// Keep the visible admin/owner UI synchronized with the real Supabase Auth session.
// Secure Payroll tables intentionally reject anonymous access, so stale owner UI state
// must never survive after the authenticated session has ended.
const authListenerOld = `if (!session?.user) {
setAdminAuthUser(null)
setAdminAuthProfile(null)
setInvoiceDeletionAccess({ can_request:false, can_review:false, admin_user_id:null, admin_name:'' })
setInvoiceDeletionRequests([])
setRequestingInvoiceDeletion(null)
}`

const authListenerNew = `if (!session?.user) {
// ADMIN_SESSION_INTEGRITY_V1: never leave an Owner/Admin screen active after Supabase Auth is gone.
setAdminAuthUser(null)
setAdminAuthProfile(null)
setAdminMode(false)
setAdminRole(null)
setAdminEmployee(null)
setAvailableRoles([])
setCameFromAdmin(false)
setInvoiceDeletionAccess({ can_request:false, can_review:false, admin_user_id:null, admin_name:'' })
setInvoiceDeletionRequests([])
setRequestingInvoiceDeletion(null)
}`

if (!src.includes('ADMIN_SESSION_INTEGRITY_V1')) {
  const matches = src.split(authListenerOld).length - 1
  if (matches !== 1) {
    throw new Error(`Admin session integrity patch aborted: expected exactly 1 auth-listener target, found ${matches}.`)
  }
  src = src.replace(authListenerOld, authListenerNew)
}

// The company-device authorization flow performs a fresh owner password check. If an
// owner session was already active, do not sign that owner out after the check; doing so
// would turn subsequent protected Payroll requests into anonymous requests while the UI
// could still appear to be in Owner mode.
const companyAuthStartOld = `  setCompanyDeviceAuthLoading(true)
  let temporaryAuthStarted = false
  try {
   const { data:authData, error:authError } = await supabase.auth.signInWithPassword({ email, password:companyDeviceAuthPassword })`

const companyAuthStartNew = `  setCompanyDeviceAuthLoading(true)
  let temporaryAuthStarted = false
  let hadExistingAdminSession = false
  try {
   const { data:existingAuthData } = await supabase.auth.getSession()
   hadExistingAdminSession = !!existingAuthData?.session?.user
   // COMPANY_DEVICE_SESSION_PRESERVE_V1: a fresh password check must not destroy an already-active admin session.
   const { data:authData, error:authError } = await supabase.auth.signInWithPassword({ email, password:companyDeviceAuthPassword })`

if (!src.includes('COMPANY_DEVICE_SESSION_PRESERVE_V1')) {
  const matches = src.split(companyAuthStartOld).length - 1
  if (matches !== 1) {
    throw new Error(`Admin session integrity patch aborted: expected exactly 1 company-device auth target, found ${matches}.`)
  }
  src = src.replace(companyAuthStartOld, companyAuthStartNew)
}

const companyAuthFinallyOld = `  } finally {
   if (temporaryAuthStarted) await supabase.auth.signOut().catch(()=>{})
   setCompanyDeviceAuthLoading(false)
  }`

const companyAuthFinallyNew = `  } finally {
   if (temporaryAuthStarted && !hadExistingAdminSession) await supabase.auth.signOut().catch(()=>{})
   setCompanyDeviceAuthLoading(false)
  }`

if (!src.includes('temporaryAuthStarted && !hadExistingAdminSession')) {
  const matches = src.split(companyAuthFinallyOld).length - 1
  if (matches !== 1) {
    throw new Error(`Admin session integrity patch aborted: expected exactly 1 company-device sign-out target, found ${matches}.`)
  }
  src = src.replace(companyAuthFinallyOld, companyAuthFinallyNew)
}

const requiredMarkers = [
  'ADMIN_SESSION_INTEGRITY_V1',
  'COMPANY_DEVICE_SESSION_PRESERVE_V1',
  'temporaryAuthStarted && !hadExistingAdminSession'
]
for (const marker of requiredMarkers) {
  if (!src.includes(marker)) throw new Error(`Admin session integrity verification failed: missing ${marker}.`)
}

fs.writeFileSync(path, src, 'utf8')
console.log('Admin session integrity patch applied: protected Owner/Admin UI now follows Supabase Auth state, and company-device verification preserves an existing admin session.')
