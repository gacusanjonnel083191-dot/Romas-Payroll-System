const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/

const ATTENDANCE_HISTORY_LOADER = `async function loadMyAttendanceHistory(emp) {
 const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('attendance_date', { ascending:false }).limit(30)
 if (error) {
  console.error('Attendance history load failed:', error)
  setMyAttendance([])
  return
 }
 const scheduleAwareLogs = await hydrateAttendanceLogsWithScheduleFallback(data || [], emp)
 const enrichedLogs = await enrichAttendanceLogsWithBreakRows(scheduleAwareLogs)
 setMyAttendance(attachAttendanceEmployeePolicy(enrichedLogs, emp))
 }`

const ATTENDANCE_HISTORY_LOADER_WITH_FILING_STATUS = `async function loadMyAttendanceHistory(emp) {
 const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('attendance_date', { ascending:false }).limit(30)
 if (error) {
  console.error('Attendance history load failed:', error)
  setMyAttendance([])
  return
 }
 const scheduleAwareLogs = await hydrateAttendanceLogsWithScheduleFallback(data || [], emp)
 const enrichedLogs = await enrichAttendanceLogsWithBreakRows(scheduleAwareLogs)
 const attendanceDates = Array.from(new Set(enrichedLogs.map(row => String(row?.attendance_date || '').slice(0,10)).filter(Boolean)))
 let activeTimeAdjustmentRows = []
 if (attendanceDates.length > 0) {
  const { data:timeAdjustmentRows, error:timeAdjustmentError } = await supabase
   .from('time_adjustment_requests')
   .select('id,attendance_date,request_type,status,created_at')
   .eq('employee_id', emp.id)
   .in('attendance_date', attendanceDates)
   .in('request_type', ['overtime','meal_break'])
   .in('status', ['pending','approved'])
   .order('created_at', { ascending:false })
   .limit(100)
  if (timeAdjustmentError) console.warn('Attendance filing-status load failed:', timeAdjustmentError)
  else activeTimeAdjustmentRows = timeAdjustmentRows || []
 }
 const filingStatusByDate = activeTimeAdjustmentRows.reduce((map, row) => {
  const dateKey = String(row?.attendance_date || '').slice(0,10)
  const requestType = String(row?.request_type || '').toLowerCase()
  const status = String(row?.status || '').toLowerCase()
  if (!dateKey || !['overtime','meal_break'].includes(requestType) || !['pending','approved'].includes(status)) return map
  const key = requestType === 'overtime' ? 'ot' : 'mealBreak'
  const current = map[dateKey]?.[key] || ''
  if (!map[dateKey]) map[dateKey] = {}
  if (status === 'approved' || current !== 'approved') map[dateKey][key] = status
  return map
 }, {})
 const logsWithFilingStatus = enrichedLogs.map(row => {
  const dateKey = String(row?.attendance_date || '').slice(0,10)
  const filingStatus = filingStatusByDate[dateKey] || {}
  return {
   ...row,
   __ot_request_status:filingStatus.ot || '',
   __meal_break_request_status:filingStatus.mealBreak || ''
  }
 })
 setMyAttendance(attachAttendanceEmployeePolicy(logsWithFilingStatus, emp))
 }`

const TOGGLE_FUNCTION_ANCHOR = `async function toggleTimeAdjustmentFilingPanel() {`
const EXACT_DATE_OT_OPENER = `async function openOTRequestForAttendanceDate(attendanceDate) {
 const targetDate = String(attendanceDate || '').slice(0,10)
 if (!targetDate) {
  alert('Unable to open OT filing because the attendance date is missing.')
  return
 }
 closeAllPanels()
 setShowOTRequest(true)
 setOtRequestType('overtime')
 setOtRequestReason('')
 setOtRequestReasonPreset('')
 setOtRequestMinutes('')
 setOtRequestDate(targetDate)
 setOtRequestFrom('')
 setOtRequestTo('')
 setMealBreakAttestation(false)
 setTimeAdjPreview({ loading:true, canSubmit:false, minutes:0, message:'Validating this exact attendance date...', code:'loading' })
 await refreshTimeAdjustmentPreview(targetDate, 'overtime', '', '')
 }

 async function toggleTimeAdjustmentFilingPanel() {`

const DTR_OT_LINE = `{getDTRActualOvertimeMinutes(log)>0&&<p style={{...cps, color:'#2d8a4e' }}>Actual OT: {getDTRActualOvertimeMinutes(log)} min {getDTRApprovedOvertimeMinutes(log)>0?' Approved':' Pending filing/approval'}</p>}`
const DTR_OT_FILING_UI = `{getDTRActualOvertimeMinutes(log)>0&&(
  <div style={{...cps, color:'#2d8a4e', display:'flex', alignItems:'center', flexWrap:'wrap', gap:'6px' }}>
   <span>Actual OT: {getDTRActualOvertimeMinutes(log)} min</span>
   {(getDTRApprovedOvertimeMinutes(log)>0 || log.__ot_request_status==='approved') ? (
    <strong>OT APPROVED</strong>
   ) : log.__ot_request_status==='pending' ? (
    <strong style={{ color:'#b36b00' }}>OT FILED — Pending approval</strong>
   ) : log.__meal_break_request_status==='pending' ? (
    <strong style={{ color:'#b36b00' }}>OT NOT YET APPROVED — No Meal Break review pending</strong>
   ) : (
    <>
     <strong style={{ color:'#b36b00' }}>NOT YET APPROVED</strong>
     <button
      type="button"
      onClick={()=>openOTRequestForAttendanceDate(log.attendance_date)}
      style={{ background:'#1a1a2e', color:'#fff', border:'none', borderRadius:'7px', padding:'5px 8px', fontSize:'10px', fontWeight:'900', cursor:'pointer' }}
     >FILE / CHECK OT</button>
    </>
   )}
  </div>
 )}`

function replaceExactlyOnce(source, from, to, label) {
 const firstIndex = source.indexOf(from)
 if (firstIndex < 0) throw new Error(`Employee OT filing invariant failed: ${label} was not found.`)
 const secondIndex = source.indexOf(from, firstIndex + from.length)
 if (secondIndex >= 0) throw new Error(`Employee OT filing invariant failed: ${label} matched more than once.`)
 return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

export function enforceEmployeeOTFilingBehavior(source, id = '') {
 if (!APP_MODULE_RE.test(id)) return source
 let transformed = source
 if (!transformed.includes('__ot_request_status:filingStatus.ot')) {
  transformed = replaceExactlyOnce(transformed, ATTENDANCE_HISTORY_LOADER, ATTENDANCE_HISTORY_LOADER_WITH_FILING_STATUS, 'employee attendance-history loader')
 }
 if (!transformed.includes('async function openOTRequestForAttendanceDate(attendanceDate)')) {
  transformed = replaceExactlyOnce(transformed, TOGGLE_FUNCTION_ANCHOR, EXACT_DATE_OT_OPENER, 'time-adjustment filing panel opener')
 }
 if (!transformed.includes('>FILE / CHECK OT</button>')) {
  transformed = replaceExactlyOnce(transformed, DTR_OT_LINE, DTR_OT_FILING_UI, 'employee DTR overtime status row')
 }
 return transformed
}

export function employeeOTFilingInvariant() {
 return {
  name:'romas-employee-ot-filing-invariant',
  enforce:'pre',
  transform(code, id) {
   if (!APP_MODULE_RE.test(id)) return null
   return { code:enforceEmployeeOTFilingBehavior(code, id), map:null }
  }
 }
}
