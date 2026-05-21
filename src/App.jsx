import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hebbunlnzklavkkugtzs.supabase.co'
const supabaseKey = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYmJ1bmxuemtsYXZra3VndHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTU5MDgsImV4cCI6MjA5NDU5MTkwOH0.mdgYJBoRvHQcf-Tn-1AbTN-rnB5pPxOCSTxGlUrgJpg`
const supabase = createClient(supabaseUrl, supabaseKey)

const STORE_LAT = 15.4755
const STORE_LNG = 120.5963
const STORE_RADIUS_METERS = 200
const ALLOWED_BREAK_MINUTES = 60

function getTodayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour12: false }) }
function minutesFromTime(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function roundPenaltyMinutes(min) { if (!min || min <= 10) return 0; return Math.ceil(min / 30) * 30 }
function php(a) { return `PHP ${Number(a || 0).toFixed(2)}` }
function genSerial(start, idx) { return `PS-${start.slice(0,7).replace('-','')}-${String(idx+1).padStart(3,'0')}` }
function getDistanceMeters(la1,lo1,la2,lo2) {
  const R=6371000,dL=(la2-la1)*Math.PI/180,dO=(lo2-lo1)*Math.PI/180
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

function Badge({ label, color }) {
  const colors = { green:'#2d8a4e', orange:'#f5a623', red:'#ca1b1b', blue:'#4a90d9', gray:'#777', yellow:'#f5c518' }
  return <span style={{ background: colors[color]||colors.gray, color: color==='yellow'?'#333':'white', padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold' }}>{label}</span>
}

function EmployeeSelect({ value, onChange, employees }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">Select employee</option>
      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.employee_code}</option>)}
    </select>
  )
}

function PayslipPrint({ pay, payrollStart, payrollEnd, idx }) {
  return (
    <div className="payslip-page" style={{ background:'white', width:'145mm', minHeight:'210mm', padding:'8mm', boxSizing:'border-box', fontFamily:'Arial,sans-serif', fontSize:'11px', color:'#000', pageBreakAfter:'always', pageBreakInside:'avoid' }}>
      <div style={{ textAlign:'center', marginBottom:'10px', borderBottom:'2px solid #ca1b1b', paddingBottom:'10px' }}>
        <img src="/logo.png" alt="Logo" style={{ width:'60px', height:'60px', objectFit:'contain' }} />
        <h2 style={{ margin:'4px 0', color:'#ca1b1b', fontSize:'18px' }}>Roma's Donuts</h2>
        <p style={{ margin:'2px 0', fontSize:'11px', color:'#666' }}>Payroll & Attendance System</p>
        <strong style={{ fontSize:'14px' }}>EMPLOYEE PAYSLIP</strong>
        <p style={{ margin:'4px 0', fontSize:'11px' }}>Serial No: {genSerial(payrollStart, idx)}</p>
        <p style={{ margin:'2px 0', fontSize:'11px', color:'#666' }}>Period: {payrollStart} to {payrollEnd}</p>
      </div>
      <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'8px', padding:'10px', marginBottom:'12px' }}>
        <p style={{ margin:'2px 0', fontSize:'16px', fontWeight:'bold', color:'#ca1b1b' }}>{pay.employeeName}</p>
        <p style={{ margin:'2px 0', fontSize:'13px', fontWeight:'bold', color:'#555' }}>{pay.position || ''}</p>
        <p style={{ margin:'2px 0', fontSize:'11px' }}>Code: {pay.employeeCode}</p>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'10px' }}>
        <thead><tr style={{ background:'#ca1b1b', color:'white' }}>
          <th style={{ padding:'6px 8px', textAlign:'left', fontSize:'11px' }}>Description</th>
          <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'11px' }}>Amount</th>
        </tr></thead>
        <tbody>
          <tr style={{ background:'#f0fff0' }}><td colSpan={2} style={{ padding:'5px 8px', fontWeight:'bold', color:'#2d8a4e', fontSize:'11px' }}>EARNINGS</td></tr>
          {[
            ['Basic Pay', pay.basicPay],
            ['Overtime Pay', pay.overtimePay],
            ['Night Differential', pay.nightDiffPay],
            ['Holiday Pay', pay.holidayPay],
            ['Bonus / Other Earnings', pay.adjustmentEarnings],
          ].map(([l,v]) => v > 0 && <tr key={l} style={{ borderBottom:'1px solid #eee' }}><td style={{ padding:'4px 8px', fontSize:'11px' }}>{l}</td><td style={{ padding:'4px 8px', textAlign:'right', fontSize:'11px' }}>{php(v)}</td></tr>)}
          <tr style={{ background:'#e8f5e9', fontWeight:'bold' }}><td style={{ padding:'5px 8px', fontSize:'11px' }}>Total Earnings</td><td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px' }}>{php(pay.totalEarnings)}</td></tr>
          <tr style={{ background:'#fff0f0' }}><td colSpan={2} style={{ padding:'5px 8px', fontWeight:'bold', color:'#ca1b1b', fontSize:'11px' }}>DEDUCTIONS</td></tr>
          {[
            [`Late (${pay.lateMinutes} min)`, pay.lateDeduction],
            [`Undertime (${pay.undertimeMinutes} min)`, pay.undertimeDeduction],
            [`Excess Break`, pay.excessBreakDeduction||0],
            ['Cash Advance', pay.cashAdvanceDeduction],
            ['SSS', pay.sssDeduction],
            ['Pag-IBIG', pay.pagibigDeduction],
            ['PhilHealth', pay.philhealthDeduction],
            ['Other Deductions', pay.adjustmentDeductions],
          ].map(([l,v]) => v > 0 && <tr key={l} style={{ borderBottom:'1px solid #eee' }}><td style={{ padding:'4px 8px', fontSize:'11px' }}>{l}</td><td style={{ padding:'4px 8px', textAlign:'right', fontSize:'11px' }}>{php(v)}</td></tr>)}
          <tr style={{ background:'#ffe8e8', fontWeight:'bold' }}><td style={{ padding:'5px 8px', fontSize:'11px' }}>Total Deductions</td><td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px' }}>{php(pay.totalDeductions)}</td></tr>
        </tbody>
      </table>
      <div style={{ background:'#ca1b1b', color:'white', padding:'10px 12px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:'bold', fontSize:'14px' }}>NET PAY</span>
        <span style={{ fontWeight:'bold', fontSize:'18px' }}>{php(pay.netPay)}</span>
      </div>
      <div style={{ marginTop:'30px', display:'flex', justifyContent:'space-between' }}>
        <div style={{ textAlign:'center' }}><div style={{ borderTop:'1px solid #000', width:'150px', paddingTop:'4px', fontSize:'10px' }}>Employee Signature</div></div>
        <div style={{ textAlign:'center' }}><div style={{ borderTop:'1px solid #000', width:'150px', paddingTop:'4px', fontSize:'10px' }}>Authorized Signature</div></div>
      </div>
      <p style={{ textAlign:'center', fontSize:'9px', color:'#999', marginTop:'15px' }}>This is a system-generated payslip. {genSerial(payrollStart, idx)}</p>
    </div>
  )
}

export default function App() {
  const today = getTodayDate()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Auth
  const [employeeCode, setEmployeeCode] = useState('')
  const [pin, setPin] = useState('')
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(false)

  // Camera
  const [cameraMode, setCameraMode] = useState(null)
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [geoStatus, setGeoStatus] = useState('')

  // Announcements
  const [pendingAnnouncement, setPendingAnnouncement] = useState(null)
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false)

  // Employee portal
  const [todayLog, setTodayLog] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState(null)
  const [todayBreaks, setTodayBreaks] = useState([])
  const [myPayslips, setMyPayslips] = useState([])
  const [myAttendance, setMyAttendance] = useState([])
  const [myCashAdvances, setMyCashAdvances] = useState([])
  const [myLeaveBalance, setMyLeaveBalance] = useState({ sick: 5, vacation: 5 })
  const [showLeaveRequest, setShowLeaveRequest] = useState(false)
  const [showPayslips, setShowPayslips] = useState(false)
  const [showCashAdvances, setShowCashAdvances] = useState(false)
  const [showCashAdvanceRequest, setShowCashAdvanceRequest] = useState(false)
  const [showMyAttendance, setShowMyAttendance] = useState(false)
  const [requestCashAmount, setRequestCashAmount] = useState('')
  const [requestCashReason, setRequestCashReason] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')
  const [leaveType, setLeaveType] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [disputeReasons, setDisputeReasons] = useState({})
  const [showDisputeBox, setShowDisputeBox] = useState({})
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // OT/UT filing
  const [showOTRequest, setShowOTRequest] = useState(false)
  const [otRequestType, setOtRequestType] = useState('overtime')
  const [otRequestReason, setOtRequestReason] = useState('')
  const [otRequestMinutes, setOtRequestMinutes] = useState('')

  // Admin
  const [adminMode, setAdminMode] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [employees, setEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [payrollSearch, setPayrollSearch] = useState('')
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [editFields, setEditFields] = useState({})
  const [newEmpFields, setNewEmpFields] = useState({ code:'', name:'', position:'', pin:'', rate:'', hire_date: today, sick:5, vacation:5, sil:5, hasSss:false, hasPagibig:false, hasPhilhealth:false, payType:'daily', hourlyRate:0, gracePeriod:10, dob:'', gender:'', civil_status:'', address:'', contact:'', emergency_name:'', emergency_contact:'', employment_type:'regular', department:'' })

  // Final pay
  const [finalPayEmployeeId, setFinalPayEmployeeId] = useState('')
  const [finalPayReason, setFinalPayReason] = useState('resigned')
  const [finalPayLastDate, setFinalPayLastDate] = useState(today)
  const [finalPayResult, setFinalPayResult] = useState(null)

  // Attendance admin
  const [adminLogs, setAdminLogs] = useState([])
  const [adminDate, setAdminDate] = useState(today)
  const [absentEmployeeId, setAbsentEmployeeId] = useState('')
  const [absentDate, setAbsentDate] = useState(today)

  // Schedule
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [scheduleDate, setScheduleDate] = useState(today)
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')

  // Leave
  const [leaveRequests, setLeaveRequests] = useState([])
  const [showResolvedLeaves, setShowResolvedLeaves] = useState(false)
  const [resolvedLeaves, setResolvedLeaves] = useState([])
  const [leaveDisapproveReason, setLeaveDisapproveReason] = useState({})
  const [showLeaveDisapproveBox, setShowLeaveDisapproveBox] = useState({})

  // Holidays
  const [holidays, setHolidays] = useState([])
  const [newHolidayDate, setNewHolidayDate] = useState(today)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayType, setNewHolidayType] = useState('regular')

  // OT/UT admin
  const [timeAdjRequests, setTimeAdjRequests] = useState([])
  const [adjAdminReason, setAdjAdminReason] = useState({})
  const [showAdjReasonBox, setShowAdjReasonBox] = useState({})

  // Cash advance
  const [cashAdvanceRequests, setCashAdvanceRequests] = useState([])
  const [installmentCounts, setInstallmentCounts] = useState({})
  const [showResolvedCA, setShowResolvedCA] = useState(false)
  const [resolvedCARequests, setResolvedCARequests] = useState([])
  const [caDisapproveReason, setCaDisapproveReason] = useState({})
  const [showCADisapproveBox, setShowCADisapproveBox] = useState({})

  // Disputes
  const [payslipDisputes, setPayslipDisputes] = useState([])
  const [showResolvedDisputes, setShowResolvedDisputes] = useState(false)
  const [resolvedDisputes, setResolvedDisputes] = useState([])
  const [disputeAdminReason, setDisputeAdminReason] = useState({})
  const [showDisputeAdminBox, setShowDisputeAdminBox] = useState({})

  // Adjustments
  const [adjustmentEmployeeId, setAdjustmentEmployeeId] = useState('')
  const [adjustmentDate, setAdjustmentDate] = useState(today)
  const [adjustmentType, setAdjustmentType] = useState('deduction')
  const [adjustmentCategory, setAdjustmentCategory] = useState('')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentNotes, setAdjustmentNotes] = useState('')

  // Payroll
  const [payrollStart, setPayrollStart] = useState(today)
  const [payrollEnd, setPayrollEnd] = useState(today)
  const [payrollMonth, setPayrollMonth] = useState(today.slice(0, 7))
  const [payrollCutoff, setPayrollCutoff] = useState('11-25')
  const [payrollResults, setPayrollResults] = useState([])
  const [payrollSummary, setPayrollSummary] = useState(null)
  const [payrollComputing, setPayrollComputing] = useState(false)

  // Announcements admin
  const [announcements, setAnnouncements] = useState([])
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('')
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('')
  const [announcementViews, setAnnouncementViews] = useState([])

  // Dashboard
  const [dashboardData, setDashboardData] = useState(null)

  // Payroll reminder
  const currentDay = new Date().getDate()
  const showPayrollReminder = currentDay === 11 || currentDay === 26

  useEffect(() => {
    if (employee) {
      loadTodayLog(employee); loadTodaySchedule(employee)
      loadMyPayslips(employee); loadMyCashAdvances(employee)
      loadMyAttendanceHistory(employee); loadMyLeaveBalance(employee)
      checkAnnouncements(employee)
    }
  }, [employee])

  useEffect(() => {
    if (cameraMode && videoRef.current) startCamera()
    return () => { stopCamera() }
  }, [cameraMode])

  // ── Camera ─────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      setCameraStream(stream)
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch { alert('Camera access denied. Please allow camera to time in/out.'); setCameraMode(null) }
  }
  function stopCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null) }
  }
  function capturePhoto() {
    const cv = canvasRef.current, vd = videoRef.current
    if (!cv || !vd) return
    cv.width = vd.videoWidth; cv.height = vd.videoHeight
    cv.getContext('2d').drawImage(vd, 0, 0)
    setCapturedPhoto(cv.toDataURL('image/jpeg', 0.7)); stopCamera()
  }
  function retakePhoto() { setCapturedPhoto(null); startCamera() }
  async function uploadSelfie(dataUrl, fileName) {
    const b64 = dataUrl.split(',')[1], bs = atob(b64), ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab)
    for (let i = 0; i < bs.length; i++) ia[i] = bs.charCodeAt(i)
    const blob = new Blob([ab], { type: 'image/jpeg' })
    await supabase.storage.from('selfies').upload(fileName, blob, { upsert: true })
    const { data } = supabase.storage.from('selfies').getPublicUrl(fileName)
    return data.publicUrl
  }
  async function uploadProfilePhoto(file, empId) {
    const { error } = await supabase.storage.from('profile-photos').upload(`${empId}.jpg`, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('profile-photos').getPublicUrl(`${empId}.jpg`)
    return data.publicUrl
  }

  // ── Geofencing ──────────────────────────────────────────────────────────
  async function checkLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve({ ok: true }); return }
      setGeoStatus('Checking your location...')
      navigator.geolocation.getCurrentPosition(
        pos => {
          const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, STORE_LAT, STORE_LNG)
          setGeoStatus('')
          resolve(dist <= STORE_RADIUS_METERS ? { ok: true } : { ok: false, message: `You are ${Math.round(dist)}m away. Must be within ${STORE_RADIUS_METERS}m of the store.` })
        },
        () => { setGeoStatus(''); resolve({ ok: true }) },
        { timeout: 8000, enableHighAccuracy: true }
      )
    })
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  async function login() {
    setLoading(true)
    const { data, error } = await supabase.from('employees').select('*').eq('employee_code', employeeCode.trim()).eq('pin', pin.trim()).eq('is_active', true).single()
    setLoading(false)
    if (error || !data) { alert('Invalid Employee ID or PIN'); return }
    setEmployee(data)
    if (data.profile_photo_url) setProfilePhotoUrl(data.profile_photo_url)
  }
  function logout() {
    setEmployee(null); setEmployeeCode(''); setPin(''); setTodayLog(null)
    setTodaySchedule(null); setMyPayslips([]); setCameraMode(null)
    setCapturedPhoto(null); stopCamera(); setPendingAnnouncement(null); setShowAnnouncementPopup(false)
  }
  function closeAllPanels() {
    setShowLeaveRequest(false); setShowPayslips(false)
    setShowCashAdvances(false); setShowCashAdvanceRequest(false); setShowMyAttendance(false); setShowOTRequest(false)
  }

  // ── Announcements ───────────────────────────────────────────────────────
  async function checkAnnouncements(emp) {
    const { data: active } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1)
    if (!active || active.length === 0) return
    const ann = active[0]
    const { data: viewed } = await supabase.from('announcement_views').select('id').eq('announcement_id', ann.id).eq('employee_id', emp.id).maybeSingle()
    if (!viewed) { setPendingAnnouncement(ann); setShowAnnouncementPopup(true) }
  }
  async function markAnnouncementViewed(ann) {
    await supabase.from('announcement_views').insert({ announcement_id: ann.id, employee_id: employee.id, employee_name: employee.full_name })
    setShowAnnouncementPopup(false); setPendingAnnouncement(null)
  }
  async function loadAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }
  async function addAnnouncement() {
    if (!newAnnouncementTitle || !newAnnouncementContent) { alert('Please enter title and content.'); return }
    await supabase.from('announcements').insert({ title: newAnnouncementTitle, content: newAnnouncementContent, is_active: true })
    alert('Announcement posted!')
    setNewAnnouncementTitle(''); setNewAnnouncementContent(''); loadAnnouncements()
  }
  async function toggleAnnouncement(id, current) {
    await supabase.from('announcements').update({ is_active: !current }).eq('id', id)
    loadAnnouncements()
  }
  async function deleteAnnouncement(id) {
    if (!window.confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    loadAnnouncements()
  }
  async function loadAnnouncementViews(annId) {
    const { data: all } = await supabase.from('employees').select('id,full_name,employee_code').eq('is_active', true)
    const { data: views } = await supabase.from('announcement_views').select('employee_id').eq('announcement_id', annId)
    const viewedIds = new Set(views?.map(v => v.employee_id) || [])
    setAnnouncementViews((all || []).map(e => ({ ...e, viewed: viewedIds.has(e.id) })))
  }

  // ── Employee Portal ─────────────────────────────────────────────────────
  async function loadTodayLog(emp) {
    const { data } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).eq('attendance_date', today).maybeSingle()
    setTodayLog(data)
    if (data) loadTodayBreaks(data.id)
  }
  async function loadTodaySchedule(emp) {
    const { data } = await supabase.from('daily_schedules').select('*').eq('employee_id', emp.id).eq('schedule_date', today).maybeSingle()
    setTodaySchedule(data)
  }
  async function loadTodayBreaks(logId) {
    const { data } = await supabase.from('break_logs').select('*').eq('attendance_log_id', logId).order('created_at')
    setTodayBreaks(data || [])
  }
  async function loadMyPayslips(emp) {
    const { data } = await supabase.from('payroll_records').select('*').eq('employee_id', emp.id).order('payroll_start', { ascending: false })
    setMyPayslips(data || [])
  }
  async function loadMyCashAdvances(emp) {
    const { data } = await supabase.from('cash_advance_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false })
    setMyCashAdvances(data || [])
  }
  async function loadMyAttendanceHistory(emp) {
    const { data } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('attendance_date', { ascending: false }).limit(30)
    setMyAttendance(data || [])
  }
  async function loadMyLeaveBalance(emp) {
    const yearStart = `${today.slice(0,4)}-01-01`
    const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').gte('leave_start', yearStart)
    const usedS = data?.filter(l => l.leave_type === 'Sick Leave').reduce((s,l) => s+Number(l.duration_days||1), 0)||0
    const usedV = data?.filter(l => l.leave_type === 'Vacation Leave').reduce((s,l) => s+Number(l.duration_days||1), 0)||0
    setMyLeaveBalance({ sick: Math.max(0,(emp.sick_leave_balance??5)-usedS), vacation: Math.max(0,(emp.vacation_leave_balance??5)-usedV) })
  }

  async function handleProfilePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const url = await uploadProfilePhoto(file, employee.id)
      await supabase.from('employees').update({ profile_photo_url: url }).eq('id', employee.id)
      setProfilePhotoUrl(url)
      alert('Profile photo updated!')
    } catch(err) { alert('Failed to upload photo: ' + err.message) }
    setUploadingPhoto(false)
  }

  async function initiateTimeIn() {
    const geo = await checkLocation()
    if (!geo.ok) { alert(geo.message); return }
    setCapturedPhoto(null); setCameraMode('timein')
  }
  async function initiateTimeOut() {
    if (!todayLog) { alert('You need to Time In first.'); return }
    if (todayLog.time_out) { alert('You already timed out today.'); return }
    const openBreak = todayBreaks.find(b => !b.break_in)
    if (openBreak) { alert('Please Break In first before timing out.'); return }
    const geo = await checkLocation()
    if (!geo.ok) { alert(geo.message); return }
    setCapturedPhoto(null); setCameraMode('timeout')
  }
  async function initiateBreakOut() {
    if (!todayLog || todayLog.time_out) { alert('You must be timed in to take a break.'); return }
    const openBreak = todayBreaks.find(b => !b.break_in)
    if (openBreak) { alert('You are already on a break. Please Break In first.'); return }
    const { error } = await supabase.from('break_logs').insert({
      attendance_log_id: todayLog.id, employee_id: employee.id, employee_name: employee.full_name,
      attendance_date: today, break_out: nowTime()
    })
    if (error) { alert('Failed: ' + error.message); return }
    loadTodayBreaks(todayLog.id); alert('Break started!')
  }
  async function initiateBreakIn() {
    const openBreak = todayBreaks.find(b => !b.break_in)
    if (!openBreak) { alert('You are not currently on a break.'); return }
    const breakOutMins = minutesFromTime(openBreak.break_out)
    const breakInMins = minutesFromTime(nowTime())
    const breakDuration = breakInMins - breakOutMins
    const { error } = await supabase.from('break_logs').update({ break_in: nowTime(), break_minutes: Math.max(0, breakDuration) }).eq('id', openBreak.id)
    if (error) { alert('Failed: ' + error.message); return }
    loadTodayBreaks(todayLog.id); alert('Break ended!')
  }

  async function confirmTimeIn() {
    if (!capturedPhoto) { alert('Please take a selfie first.'); return }
    setLoading(true)
    const { data: existing } = await supabase.from('attendance_logs').select('*').eq('employee_id', employee.id).eq('attendance_date', today).maybeSingle()
    if (existing) { setLoading(false); setTodayLog(existing); alert('Already timed in today.'); setCameraMode(null); return }
    let selfieUrl = null
    try { selfieUrl = await uploadSelfie(capturedPhoto, `timein_${employee.id}_${today}.jpg`) } catch(e){}
    const gracePeriod = employee.grace_period_minutes ?? 10
    let lateMinutes = 0, status = 'No Assigned Shift'
    if (todaySchedule?.shift_start) {
      const cur = minutesFromTime(nowTime()), shiftS = minutesFromTime(todaySchedule.shift_start)
      const raw = Math.max(0, cur - shiftS)
      lateMinutes = raw > gracePeriod ? raw : 0
      status = lateMinutes > 0 ? 'Late' : 'On Time'
    }
    const { data, error } = await supabase.from('attendance_logs').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      attendance_date: today, shift_start: todaySchedule?.shift_start||null, shift_end: todaySchedule?.shift_end||null,
      time_in: nowTime(), late_minutes: lateMinutes, status, selfie_in_url: selfieUrl
    }).select().single()
    setLoading(false)
    if (error) { alert('Time In failed'); return }
    setTodayLog(data); setCameraMode(null); setCapturedPhoto(null)
    await logAudit('TIME IN', employee.full_name, employee.full_name, `Timed in at ${data.time_in}`)
    alert('Time In saved successfully!')
  }

  async function confirmTimeOut() {
    if (!capturedPhoto) { alert('Please take a selfie first.'); return }
    setLoading(true)
    let undertimeMinutes = 0, overtimeMinutes = 0, status = todayLog.late_minutes > 0 ? 'Late' : 'Completed'
    const totalBreakMins = todayBreaks.reduce((s,b) => s + Number(b.break_minutes||0), 0)
    const excessBreakMins = Math.max(0, totalBreakMins - ALLOWED_BREAK_MINUTES)
    if (todaySchedule?.shift_end) {
      const cur = minutesFromTime(nowTime()), shiftE = minutesFromTime(todaySchedule.shift_end)
      const diff = cur - shiftE
      undertimeMinutes = diff < 0 ? Math.abs(diff) : 0
      overtimeMinutes = diff > 0 ? diff : 0
      if (undertimeMinutes > 0) status = 'Undertime - Pending Filing'
      if (overtimeMinutes > 0) status = 'Overtime - Pending Filing'
    }
    let selfieUrl = null
    try { selfieUrl = await uploadSelfie(capturedPhoto, `timeout_${employee.id}_${today}.jpg`) } catch(e){}
    const { data, error } = await supabase.from('attendance_logs').update({
      time_out: nowTime(), undertime_minutes: undertimeMinutes, overtime_minutes: overtimeMinutes,
      status, selfie_out_url: selfieUrl, total_break_minutes: totalBreakMins,
      excess_break_minutes: excessBreakMins, overtime_approved: null
    }).eq('id', todayLog.id).select().single()
    setLoading(false)
    if (error) { alert('Time Out failed'); return }
    setTodayLog(data); setCameraMode(null); setCapturedPhoto(null)
    await logAudit('TIME OUT', employee.full_name, employee.full_name, `Timed out at ${data.time_out}`)
    let msg = 'Time Out saved successfully!'
    if (overtimeMinutes > 0) msg += `\n\nYou have ${overtimeMinutes} min overtime. Please file an overtime request with your reason.`
    if (undertimeMinutes > 0) msg += `\n\nYou have ${undertimeMinutes} min undertime. Please file an undertime request with your reason.`
    if (excessBreakMins > 0) msg += `\n\nNote: ${excessBreakMins} min excess break will be deducted from your pay.`
    alert(msg)
  }

  async function submitTimeAdjRequest() {
    if (!otRequestReason || !otRequestMinutes) { alert('Please enter minutes and reason.'); return }
    const { error } = await supabase.from('time_adjustment_requests').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      attendance_date: today, request_type: otRequestType,
      minutes: Number(otRequestMinutes), employee_reason: otRequestReason, status: 'pending'
    })
    if (error) { alert('Failed: ' + error.message); return }
    alert(`${otRequestType === 'overtime' ? 'Overtime' : 'Undertime'} request filed! Waiting for admin approval.`)
    setOtRequestReason(''); setOtRequestMinutes(''); setShowOTRequest(false)
  }

  async function submitLeaveRequest() {
    if (!leaveStartDate || !leaveEndDate || !leaveType || !leaveReason) { alert('Please complete all fields'); return }
    const todayMid = new Date(); todayMid.setHours(0,0,0,0)
    const startD = new Date(leaveStartDate); startD.setHours(0,0,0,0)
    if ((startD - todayMid)/(1000*60*60*24) < 2) { alert('Must be filed at least 3 days in advance.'); return }
    const dur = Math.ceil((new Date(leaveEndDate)-new Date(leaveStartDate))/(1000*60*60*24))+1
    if (leaveType === 'Sick Leave' && dur > myLeaveBalance.sick) { alert(`Only ${myLeaveBalance.sick} Sick Leave days remaining.`); return }
    if (leaveType === 'Vacation Leave' && dur > myLeaveBalance.vacation) { alert(`Only ${myLeaveBalance.vacation} Vacation Leave days remaining.`); return }
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      leave_start: leaveStartDate, leave_end: leaveEndDate, duration_days: dur,
      leave_type: leaveType, reason: leaveReason, status: 'pending'
    })
    if (error) { alert(error.message); return }
    alert('Leave request submitted!'); setLeaveStartDate(''); setLeaveEndDate(''); setLeaveType(''); setLeaveReason(''); setShowLeaveRequest(false); loadMyLeaveBalance(employee)
  }

  async function submitCashAdvanceRequest() {
    if (!requestCashAmount || !requestCashReason) { alert('Please enter amount and reason.'); return }
    const amount = Number(requestCashAmount)
    if (amount <= 0) { alert('Amount must be greater than 0.'); return }
    const { error } = await supabase.from('cash_advance_requests').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      amount, reason: requestCashReason, status: 'pending'
    })
    if (error) { alert('Failed: ' + error.message); return }
    alert('Request submitted! Waiting for admin approval.')
    setRequestCashAmount(''); setRequestCashReason(''); setShowCashAdvanceRequest(false); loadMyCashAdvances(employee)
  }

  async function agreePayslip(payId) {
    await supabase.from('payroll_records').update({ employee_acknowledgement: 'agreed' }).eq('id', payId)
    alert('Payslip acknowledged!'); loadMyPayslips(employee)
  }
  async function submitPayslipDispute(pay) {
    const reason = disputeReasons[pay.id]
    if (!reason?.trim()) { alert('Please enter your reason.'); return }
    await supabase.from('payslip_disputes').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      payroll_record_id: String(pay.id), payroll_start: pay.payroll_start, payroll_end: pay.payroll_end,
      reason, status: 'pending'
    })
    await supabase.from('payroll_records').update({ employee_acknowledgement: 'disputed' }).eq('id', pay.id)
    alert('Dispute submitted.'); setShowDisputeBox(p => ({ ...p, [pay.id]: false })); setDisputeReasons(p => ({ ...p, [pay.id]: '' })); loadMyPayslips(employee)
  }

  // ── Admin Functions ────────────────────────────────────────────────────
  async function logAudit(action, by, target, details) {
    await supabase.from('audit_logs').insert({ action, performed_by: by, target_employee: target, details }).catch(() => {})
  }

  function openAdmin() {
    setAdminMode(true); setEmployeeSearch(''); setSidebarOpen(false); setActiveTab('dashboard')
    loadEmployees(); loadAdminLogs(); loadLeaveRequests(); loadCashAdvanceRequests()
    loadHolidays(); loadTimeAdjRequests(); loadAnnouncements(); loadDashboard()
  }

  async function loadDashboard() {
    const { data: emps } = await supabase.from('employees').select('id').eq('is_active', true)
    const { data: todayLogs } = await supabase.from('attendance_logs').select('*').eq('attendance_date', today)
    const { data: pendingLeave } = await supabase.from('leave_requests').select('id').eq('status', 'pending')
    const { data: pendingCA } = await supabase.from('cash_advance_requests').select('id').eq('status', 'pending')
    const { data: pendingOT } = await supabase.from('time_adjustment_requests').select('id').eq('status', 'pending')
    const { data: pendingDisp } = await supabase.from('payslip_disputes').select('id').eq('status', 'pending')
    setDashboardData({
      totalEmployees: emps?.length || 0,
      timedIn: todayLogs?.filter(l => l.time_in && !l.time_out).length || 0,
      timedOut: todayLogs?.filter(l => l.time_out).length || 0,
      absent: todayLogs?.filter(l => l.status === 'Absent').length || 0,
      pendingLeave: pendingLeave?.length || 0,
      pendingCA: pendingCA?.length || 0,
      pendingOT: pendingOT?.length || 0,
      pendingDisputes: pendingDisp?.length || 0,
    })
  }

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('*').eq('is_active', true).order('full_name')
    setEmployees(data || [])
  }
  async function loadAdminLogs() {
    const { data } = await supabase.from('attendance_logs').select('*').eq('attendance_date', adminDate).order('employee_name')
    setAdminLogs(data || [])
  }
  async function markAbsent() {
    if (!absentEmployeeId || !absentDate) { alert('Please select employee and date.'); return }
    const emp = employees.find(e => e.id === absentEmployeeId)
    const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', absentEmployeeId).eq('attendance_date', absentDate).maybeSingle()
    if (existing) { alert('This employee already has an attendance record for this date.'); return }
    await supabase.from('attendance_logs').insert({ employee_id: absentEmployeeId, employee_code: emp?.employee_code||'', employee_name: emp?.full_name||'', attendance_date: absentDate, status: 'Absent' })
    await logAudit('MARK ABSENT', 'Admin', emp?.full_name||'', `Marked absent on ${absentDate}`)
    alert(`${emp?.full_name} marked Absent on ${absentDate}`); loadAdminLogs()
  }

  async function loadLeaveRequests() {
    const { data } = await supabase.from('leave_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setLeaveRequests(data || [])
  }
  async function loadResolvedLeaves() {
    const { data } = await supabase.from('leave_requests').select('*').in('status', ['approved', 'disapproved']).order('created_at', { ascending: false })
    setResolvedLeaves(data || [])
  }
  async function updateLeaveStatus(id, status, reason) {
    await supabase.from('leave_requests').update({ status, admin_reason: reason||null }).eq('id', id)
    await logAudit(`LEAVE ${status.toUpperCase()}`, 'Admin', '', `Leave ID ${id}${reason ? ' — Reason: '+reason : ''}`)
    alert(`Leave ${status}`); loadLeaveRequests()
  }

  async function loadHolidays() {
    const { data } = await supabase.from('holidays').select('*').order('holiday_date')
    setHolidays(data || [])
  }
  async function addHoliday() {
    if (!newHolidayDate || !newHolidayName) { alert('Please enter date and name.'); return }
    await supabase.from('holidays').insert({ holiday_date: newHolidayDate, holiday_name: newHolidayName, holiday_type: newHolidayType })
    alert('Holiday added!'); setNewHolidayName(''); loadHolidays()
  }
  async function deleteHoliday(id) { await supabase.from('holidays').delete().eq('id', id); loadHolidays() }

  async function loadTimeAdjRequests() {
    const { data } = await supabase.from('time_adjustment_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setTimeAdjRequests(data || [])
  }
  async function approveTimeAdj(req) {
    const updateData = { status: 'approved', reviewed_by: 'Admin', reviewed_at: new Date().toISOString(), admin_reason: adjAdminReason[req.id]||'' }
    await supabase.from('time_adjustment_requests').update(updateData).eq('id', req.id)
    // Apply to attendance log
    if (req.request_type === 'overtime') {
      await supabase.from('attendance_logs').update({ overtime_minutes: req.minutes, overtime_approved: true, status: 'Overtime' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    } else {
      await supabase.from('attendance_logs').update({ undertime_minutes: req.minutes, status: 'Undertime' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    }
    await logAudit(`${req.request_type.toUpperCase()} APPROVED`, 'Admin', req.employee_name, `${req.minutes} min on ${req.attendance_date}`)
    alert('Approved!'); loadTimeAdjRequests()
  }
  async function rejectTimeAdj(req) {
    const reason = adjAdminReason[req.id]
    if (!reason) { alert('Please enter a reason for rejection.'); return }
    await supabase.from('time_adjustment_requests').update({ status: 'rejected', reviewed_by: 'Admin', reviewed_at: new Date().toISOString(), admin_reason: reason }).eq('id', req.id)
    if (req.request_type === 'overtime') {
      await supabase.from('attendance_logs').update({ overtime_minutes: 0, overtime_approved: false, status: 'Completed' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    } else {
      await supabase.from('attendance_logs').update({ undertime_minutes: 0, status: 'Completed' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    }
    await logAudit(`${req.request_type.toUpperCase()} REJECTED`, 'Admin', req.employee_name, `Reason: ${reason}`)
    alert('Rejected.'); loadTimeAdjRequests()
  }

  async function saveEmployeeChanges() {
    const { error } = await supabase.from('employees').update({
      employee_code: editFields.code, full_name: editFields.name, position: editFields.position,
      pin: editFields.pin, daily_rate: Number(editFields.rate||0), has_sss: editFields.hasSss,
      has_pagibig: editFields.hasPagibig, has_philhealth: editFields.hasPhilhealth,
      hire_date: editFields.hireDate, sick_leave_balance: Number(editFields.sick||5),
      vacation_leave_balance: Number(editFields.vacation||5), sil_balance: Number(editFields.sil||5),
      pay_type: editFields.payType||'daily', hourly_rate: Number(editFields.hourlyRate||0),
      grace_period_minutes: Number(editFields.gracePeriod||10),
      date_of_birth: editFields.dob||null, gender: editFields.gender||'',
      civil_status: editFields.civil_status||'', home_address: editFields.address||'',
      contact_number: editFields.contact||'', emergency_contact_name: editFields.emergency_name||'',
      emergency_contact_number: editFields.emergency_contact||'',
      employment_type: editFields.employment_type||'regular', department: editFields.department||''
    }).eq('id', editingEmployeeId)
    if (error) { alert(error.message); return }
    await logAudit('EMPLOYEE UPDATED', 'Admin', editFields.name, 'Employee details updated')
    setEditingEmployeeId(''); loadEmployees(); alert('Employee updated successfully!')
  }
  async function addEmployee() {
    const f = newEmpFields
    if (!f.code || !f.name || !f.position || !f.pin) { alert('Please complete all required fields'); return }
    const { error } = await supabase.from('employees').insert({
      employee_code: f.code.toUpperCase(), full_name: f.name, position: f.position, pin: f.pin,
      daily_rate: Number(f.rate||0), is_active: true, has_sss: f.hasSss, has_pagibig: f.hasPagibig,
      has_philhealth: f.hasPhilhealth, hire_date: f.hire_date, sick_leave_balance: Number(f.sick||5),
      vacation_leave_balance: Number(f.vacation||5), sil_balance: Number(f.sil||5),
      pay_type: f.payType||'daily', hourly_rate: Number(f.hourlyRate||0),
      grace_period_minutes: Number(f.gracePeriod||10),
      date_of_birth: f.dob||null, gender: f.gender||'', civil_status: f.civil_status||'',
      home_address: f.address||'', contact_number: f.contact||'',
      emergency_contact_name: f.emergency_name||'', emergency_contact_number: f.emergency_contact||'',
      employment_type: f.employment_type||'regular', department: f.department||''
    })
    if (error) { alert('Failed: ' + error.message); return }
    await logAudit('EMPLOYEE ADDED', 'Admin', f.name, 'New employee added')
    alert('Employee added!'); setNewEmpFields({ code:'', name:'', position:'', pin:'', rate:'', hire_date:today, sick:5, vacation:5, sil:5, hasSss:false, hasPagibig:false, hasPhilhealth:false, payType:'daily', hourlyRate:0, gracePeriod:10, dob:'', gender:'', civil_status:'', address:'', contact:'', emergency_name:'', emergency_contact:'', employment_type:'regular', department:'' }); loadEmployees()
  }
  async function deactivateEmployee(empId, empName) {
    if (!window.confirm(`Deactivate ${empName}?`)) return
    await supabase.from('employees').update({ is_active: false }).eq('id', empId)
    await logAudit('EMPLOYEE DEACTIVATED', 'Admin', empName, 'Employee deactivated')
    alert(`${empName} deactivated.`); loadEmployees()
  }

  async function loadCashAdvanceRequests() {
    const { data } = await supabase.from('cash_advance_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setCashAdvanceRequests(data || [])
  }
  async function loadResolvedCARequests() {
    const { data } = await supabase.from('cash_advance_requests').select('*').in('status', ['approved', 'disapproved']).order('created_at', { ascending: false })
    setResolvedCARequests(data || [])
  }
  async function updateCashAdvanceStatus(id, newStatus) {
    const req = cashAdvanceRequests.find(r => r.id === id)
    if (!req) return
    if (newStatus === 'disapproved') {
      const reason = caDisapproveReason[id]
      if (!reason) { alert('Please enter a reason for disapproval.'); return }
      await supabase.from('cash_advance_requests').update({ status: 'disapproved', admin_reason: reason }).eq('id', id)
      await logAudit('CA DISAPPROVED', 'Admin', req.employee_name, `Reason: ${reason}`)
      alert('Disapproved.'); loadCashAdvanceRequests(); return
    }
    await supabase.from('cash_advance_requests').update({ status: 'approved' }).eq('id', id)
    const totalAmount = Number(req.amount), installments = Math.max(1, Number(installmentCounts[id]||1))
    const perPayroll = Math.ceil((totalAmount/installments)*100)/100
    await supabase.from('cash_advances').insert({
      employee_id: req.employee_id, employee_code: req.employee_code, employee_name: req.employee_name,
      advance_date: today, amount: totalAmount, amount_paid: 0, balance: totalAmount,
      per_payroll_deduction: perPayroll, installments_total: installments, installments_remaining: installments,
      notes: req.reason, status: 'Unpaid'
    })
    await logAudit('CA APPROVED', 'Admin', req.employee_name, `${php(totalAmount)} in ${installments} installments`)
    alert(`Approved! ${php(perPayroll)} × ${installments} payroll(s).`); loadCashAdvanceRequests()
  }

  async function loadPayslipDisputes() {
    const { data } = await supabase.from('payslip_disputes').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setPayslipDisputes(data || [])
  }
  async function loadResolvedDisputes() {
    const { data } = await supabase.from('payslip_disputes').select('*').eq('status', 'resolved').order('created_at', { ascending: false })
    setResolvedDisputes(data || [])
  }
  async function resolveDispute(id) {
    const reason = disputeAdminReason[id]
    if (!reason) { alert('Please enter admin response/reason before resolving.'); return }
    await supabase.from('payslip_disputes').update({ status: 'resolved', admin_reason: reason }).eq('id', id)
    await logAudit('DISPUTE RESOLVED', 'Admin', '', `Dispute ID ${id} — ${reason}`)
    alert('Dispute resolved.'); loadPayslipDisputes()
  }

  async function saveAdjustment() {
    if (!adjustmentEmployeeId || !adjustmentDate || !adjustmentCategory || !adjustmentAmount) { alert('Please complete all fields.'); return }
    const emp = employees.find(e => e.id === adjustmentEmployeeId)
    await supabase.from('payroll_adjustments').insert({
      employee_id: adjustmentEmployeeId, employee_code: emp?.employee_code||'', employee_name: emp?.full_name||'',
      adjustment_date: adjustmentDate, adjustment_type: adjustmentType, category: adjustmentCategory, amount: Number(adjustmentAmount), notes: adjustmentNotes
    })
    await logAudit('ADJUSTMENT ADDED', 'Admin', emp?.full_name||'', `${adjustmentType}: ${php(adjustmentAmount)} — ${adjustmentCategory}`)
    alert('Adjustment saved'); setAdjustmentEmployeeId(''); setAdjustmentCategory(''); setAdjustmentAmount(''); setAdjustmentNotes('')
  }
  async function saveSchedule() {
    if (!selectedEmployeeId || !scheduleDate || !shiftStart || !shiftEnd) { alert('Complete all fields.'); return }
    await supabase.from('daily_schedules').upsert({ employee_id: selectedEmployeeId, schedule_date: scheduleDate, shift_start: shiftStart, shift_end: shiftEnd }, { onConflict: 'employee_id,schedule_date' })
    alert('Schedule saved'); setSelectedEmployeeId(''); setShiftStart(''); setShiftEnd('')
  }
  function applyPayrollCutoff() {
    const [y, m] = payrollMonth.split('-').map(Number)
    if (payrollCutoff === '11-25') { setPayrollStart(`${y}-${String(m).padStart(2,'0')}-11`); setPayrollEnd(`${y}-${String(m).padStart(2,'0')}-25`) }
    else { const s=new Date(y,m-1,26),e=new Date(y,m,10); setPayrollStart(s.toISOString().slice(0,10)); setPayrollEnd(e.toISOString().slice(0,10)) }
  }

  async function computeFinalPay() {
    if (!finalPayEmployeeId || !finalPayLastDate) { alert('Please select employee and last working date.'); return }
    const emp = employees.find(e => e.id === finalPayEmployeeId)
    if (!emp) return
    const { data: allLogs } = await supabase.from('attendance_logs').select('*').eq('employee_id', finalPayEmployeeId).lte('attendance_date', finalPayLastDate).order('attendance_date', { ascending: false }).limit(60)
    const { data: lastPay } = await supabase.from('payroll_records').select('payroll_end').eq('employee_id', finalPayEmployeeId).order('payroll_end', { ascending: false }).limit(1)
    const lastPayEnd = lastPay?.[0]?.payroll_end || '2000-01-01'
    const unpaidDays = (allLogs?.filter(l => l.time_in && l.attendance_date > lastPayEnd) || []).length
    const yearStart = `${finalPayLastDate.slice(0,4)}-01-01`
    const { data: yearPays } = await supabase.from('payroll_records').select('basic_pay').eq('employee_id', finalPayEmployeeId).gte('payroll_start', yearStart).lte('payroll_end', finalPayLastDate)
    const totalBasic = yearPays?.reduce((s,p) => s+Number(p.basic_pay||0),0)||0
    const proRated13th = totalBasic/12
    const { data: leaves } = await supabase.from('leave_requests').select('*').eq('employee_id', finalPayEmployeeId).eq('status', 'approved').gte('leave_start', yearStart)
    const usedS = leaves?.filter(l=>l.leave_type==='Sick Leave').reduce((s,l)=>s+Number(l.duration_days||1),0)||0
    const usedV = leaves?.filter(l=>l.leave_type==='Vacation Leave').reduce((s,l)=>s+Number(l.duration_days||1),0)||0
    const silAlloc=(emp.sick_leave_balance||5)+(emp.vacation_leave_balance||5)
    const unusedSIL=Math.max(0,silAlloc-usedS-usedV)
    const silPay=unusedSIL*Number(emp.daily_rate||0)
    const hireDate=emp.hire_date?new Date(emp.hire_date):new Date(finalPayLastDate)
    const yearsOfService=Math.max(0,Math.floor((new Date(finalPayLastDate)-hireDate)/(1000*60*60*24*365)))
    let separationPay=0
    if (finalPayReason==='redundancy'||finalPayReason==='retrenchment') separationPay=Number(emp.daily_rate||0)*26*yearsOfService
    else if (finalPayReason==='authorized') separationPay=Number(emp.daily_rate||0)*13*yearsOfService
    else if (finalPayReason==='retirement') separationPay=Number(emp.daily_rate||0)*22.5*yearsOfService
    const { data: cas } = await supabase.from('cash_advances').select('*').eq('employee_id', finalPayEmployeeId).eq('status', 'Unpaid')
    const totalCA=cas?.reduce((s,c)=>s+Number(c.balance||0),0)||0
    const lastSalary=unpaidDays*Number(emp.daily_rate||0)
    const totalFinalPay=lastSalary+proRated13th+silPay+separationPay-totalCA
    setFinalPayResult({ employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position, hireDate:emp.hire_date||'N/A', lastDate:finalPayLastDate, yearsOfService, reason:finalPayReason, dailyRate:Number(emp.daily_rate||0), unpaidDays, lastSalary, proRated13th, unusedSIL, silPay, separationPay, totalCA, totalFinalPay })
  }
  async function processFinalPay() {
    if (!finalPayResult) return
    if (!window.confirm(`Process final pay for ${finalPayResult.employeeName} and deactivate?`)) return
    await supabase.from('employees').update({ is_active: false }).eq('id', finalPayEmployeeId)
    await supabase.from('final_pay_records').insert({ employee_id:finalPayEmployeeId, employee_name:finalPayResult.employeeName, employee_code:finalPayResult.employeeCode, separation_reason:finalPayReason, last_working_date:finalPayLastDate, last_salary:finalPayResult.lastSalary, pro_rated_13th:finalPayResult.proRated13th, sil_pay:finalPayResult.silPay, separation_pay:finalPayResult.separationPay, cash_advance_deduction:finalPayResult.totalCA, total_final_pay:finalPayResult.totalFinalPay }).catch(()=>{})
    await logAudit('FINAL PAY PROCESSED', 'Admin', finalPayResult.employeeName, `Total: ${php(finalPayResult.totalFinalPay)}`)
    alert(`Final pay processed. ${finalPayResult.employeeName} deactivated.`)
    setFinalPayResult(null); setFinalPayEmployeeId(''); loadEmployees()
  }

  async function computePayroll() {
    const { data: existing } = await supabase.from('payroll_records').select('id').eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd).limit(1)
    if (existing && existing.length > 0) {
      if (!window.confirm(`Payroll for this period already exists. Overwrite?`)) return
      await supabase.from('payroll_records').delete().eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd)
    }
    setPayrollComputing(true)
    const { data: empList } = await supabase.from('employees').select('*').eq('is_active', true)
    const { data: holidayList } = await supabase.from('holidays').select('*').gte('holiday_date', payrollStart).lte('holiday_date', payrollEnd)
    const results = []
    const startDay = Number(payrollStart.split('-')[2])
    const isFirstCutoff = startDay >= 11 && startDay <= 25

    for (const emp of empList || []) {
      const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).gte('attendance_date', payrollStart).lte('attendance_date', payrollEnd)
      const { data: leaves } = await supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').gte('leave_start', payrollStart).lte('leave_end', payrollEnd)
      const { data: cas } = await supabase.from('cash_advances').select('*').eq('employee_id', emp.id).eq('status', 'Unpaid')
      const { data: adjs } = await supabase.from('payroll_adjustments').select('*').eq('employee_id', emp.id).gte('adjustment_date', payrollStart).lte('adjustment_date', payrollEnd)

      const workedDays = logs?.filter(l=>l.time_in).length||0
      const absentDays = logs?.filter(l=>l.status==='Absent').length||0
      const paidLeaveDays = leaves?.filter(l=>l.is_paid).length||0
      const lateMinutes = roundPenaltyMinutes(logs?.reduce((s,l)=>s+Number(l.late_minutes||0),0)||0)
      const undertimeMinutes = roundPenaltyMinutes(logs?.reduce((s,l)=>s+Number(l.undertime_minutes||0),0)||0)
      const overtimeMinutes = logs?.filter(l=>l.overtime_approved===true).reduce((s,l)=>s+Number(l.overtime_minutes||0),0)||0
      const totalExcessBreak = logs?.reduce((s,l)=>s+Number(l.excess_break_minutes||0),0)||0

      const dailyRate = Number(emp.daily_rate||0)
      const isHourly = emp.pay_type === 'hourly'
      const hourlyRate = isHourly ? Number(emp.hourly_rate||0) : dailyRate/8
      const minuteRate = hourlyRate/60

      let basicPay = 0
      if (isHourly) {
        const totalMins = logs?.filter(l=>l.time_in&&l.time_out).reduce((s,l)=>{
          const inM=minutesFromTime(l.time_in), outM=minutesFromTime(l.time_out)
          return s + Math.max(0, (outM>inM?outM:outM+24*60)-inM - Number(l.total_break_minutes||0))
        },0)||0
        basicPay = (totalMins/60)*hourlyRate + paidLeaveDays*dailyRate
      } else {
        basicPay = (workedDays+paidLeaveDays)*dailyRate
      }

      const lateDeduction = lateMinutes*minuteRate
      const undertimeDeduction = undertimeMinutes*minuteRate
      const excessBreakDeduction = totalExcessBreak*minuteRate
      const overtimePay = overtimeMinutes*minuteRate*1.25

      let holidayPay=0
      for (const h of holidayList||[]) {
        const worked=logs?.find(l=>l.attendance_date===h.holiday_date&&l.time_in)
        if (h.holiday_type==='regular') holidayPay+=worked?dailyRate*2:0
        else if (h.holiday_type==='special') holidayPay+=worked?dailyRate*1.3:0
      }

      let caDeduction=0
      for (const ca of cas||[]) caDeduction+=ca.per_payroll_deduction?Number(ca.per_payroll_deduction):Number(ca.balance||0)
      let adjEarnings=0, adjDeductions=0
      for (const adj of adjs||[]) { if (adj.adjustment_type==='addition') adjEarnings+=Number(adj.amount||0); else adjDeductions+=Number(adj.amount||0) }

      let nightDiffPay=0
      for (const log of logs||[]) {
        if (log.time_in&&log.time_out) {
          const inM=minutesFromTime(log.time_in), outM=minutesFromTime(log.time_out)+(minutesFromTime(log.time_out)<minutesFromTime(log.time_in)?24*60:0)
          const ns=22*60,ne=30*60,os=Math.max(inM,ns),oe=Math.min(outM,ne)
          if (oe>os) nightDiffPay+=(oe-os)*minuteRate*0.10
        }
      }

      const sssDeduction = workedDays>0&&emp.has_sss&&isFirstCutoff?375:0
      const pagibigDeduction = workedDays>0&&emp.has_pagibig&&!isFirstCutoff?200:0
      const philhealthDeduction = workedDays>0&&emp.has_philhealth&&!isFirstCutoff?250:0
      const totalEarnings = basicPay+overtimePay+nightDiffPay+holidayPay+adjEarnings
      const totalDeductions = lateDeduction+undertimeDeduction+excessBreakDeduction+caDeduction+sssDeduction+pagibigDeduction+philhealthDeduction+adjDeductions
      const netPay = totalEarnings-totalDeductions

      results.push({ employeeId:emp.id, employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position||'',
        workedDays, absentDays, paidLeaveDays, lateMinutes, undertimeMinutes, overtimeMinutes,
        basicPay, overtimePay, nightDiffPay, holidayPay, adjEarnings, adjustmentEarnings:adjEarnings, totalEarnings,
        lateDeduction, undertimeDeduction, excessBreakDeduction, cashAdvanceDeduction:caDeduction,
        sssDeduction, pagibigDeduction, philhealthDeduction, adjustmentDeductions:adjDeductions, totalDeductions, netPay })
    }

    for (const pay of results) {
      const { data: empCAs } = await supabase.from('cash_advances').select('*').eq('employee_id', pay.employeeId).eq('status', 'Unpaid')
      for (const ca of empCAs||[]) {
        const ded=ca.per_payroll_deduction?Number(ca.per_payroll_deduction):Number(ca.balance||0)
        const newPaid=Number(ca.amount_paid||0)+ded, newBal=Math.max(0,Number(ca.balance||0)-ded)
        const newRem=Math.max(0,Number(ca.installments_remaining||1)-1)
        await supabase.from('cash_advances').update({ amount_paid:newPaid, balance:newBal, installments_remaining:newRem, status:newBal<=0||newRem<=0?'Paid':'Unpaid' }).eq('id', ca.id)
      }
      const serial = genSerial(payrollStart, results.indexOf(pay))
      await supabase.from('payroll_records').insert([{
        employee_id:pay.employeeId, employee_code:pay.employeeCode, employee_name:pay.employeeName,
        payroll_start:payrollStart, payroll_end:payrollEnd, worked_days:pay.workedDays,
        basic_pay:pay.basicPay, overtime_pay:pay.overtimePay, night_diff_pay:pay.nightDiffPay,
        holiday_pay:pay.holidayPay, other_earnings:pay.adjEarnings, total_earnings:pay.totalEarnings,
        late_deduction:pay.lateDeduction, undertime_deduction:pay.undertimeDeduction,
        cash_advance_deduction:pay.cashAdvanceDeduction, sss_deduction:pay.sssDeduction,
        pagibig_deduction:pay.pagibigDeduction, philhealth_deduction:pay.philhealthDeduction,
        other_deductions:pay.adjDeductions, total_deductions:pay.totalDeductions,
        net_pay:pay.netPay, employee_acknowledgement:'pending', payslip_serial:serial
      }])
    }

    const s = { totalEmployees:results.length, totalBasicPay:results.reduce((a,p)=>a+p.basicPay,0), totalOvertimePay:results.reduce((a,p)=>a+p.overtimePay,0), totalNightDiff:results.reduce((a,p)=>a+p.nightDiffPay,0), totalHolidayPay:results.reduce((a,p)=>a+p.holidayPay,0), totalEarnings:results.reduce((a,p)=>a+p.totalEarnings,0), totalDeductions:results.reduce((a,p)=>a+p.totalDeductions,0), totalNetPay:results.reduce((a,p)=>a+p.netPay,0), totalSSS:results.reduce((a,p)=>a+p.sssDeduction,0), totalPagibig:results.reduce((a,p)=>a+p.pagibigDeduction,0), totalPhilhealth:results.reduce((a,p)=>a+p.philhealthDeduction,0), totalCA:results.reduce((a,p)=>a+p.cashAdvanceDeduction,0) }
    setPayrollResults(results); setPayrollSummary(s); setPayrollComputing(false)
    await logAudit('PAYROLL COMPUTED', 'Admin', 'ALL', `${payrollStart} to ${payrollEnd} — ${results.length} employees`)
    alert('Payroll computed successfully!')
  }

  // ── Print All Payslips ──────────────────────────────────────────────────
  function printAllPayslips() {
    const printWindow = window.open('', '_blank')
    const payslipHTML = payrollResults.map((pay, idx) => `
      <div style="background:white;width:145mm;min-height:210mm;padding:8mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:12px;color:#000;page-break-after:always;">
        <div style="text-align:center;margin-bottom:10px;border-bottom:2px solid #ca1b1b;padding-bottom:10px;">
          <h2 style="margin:4px 0;color:#ca1b1b;font-size:18px;">Roma's Donuts</h2>
          <strong style="font-size:14px;">EMPLOYEE PAYSLIP</strong>
          <p style="margin:4px 0;font-size:11px;">Serial No: ${genSerial(payrollStart, idx)}</p>
          <p style="margin:2px 0;font-size:11px;color:#666;">Period: ${payrollStart} to ${payrollEnd}</p>
        </div>
        <div style="background:#fff8dc;border:2px solid #ca1b1b;border-radius:8px;padding:10px;margin-bottom:12px;">
          <p style="margin:2px 0;font-size:16px;font-weight:bold;color:#ca1b1b;">${pay.employeeName}</p>
          <p style="margin:2px 0;font-size:13px;font-weight:bold;color:#555;">${pay.position || ''}</p>
          <p style="margin:2px 0;font-size:11px;">Code: ${pay.employeeCode}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
          <thead><tr style="background:#ca1b1b;color:white;">
            <th style="padding:6px 8px;text-align:left;font-size:11px;">Description</th>
            <th style="padding:6px 8px;text-align:right;font-size:11px;">Amount</th>
          </tr></thead>
          <tbody>
            <tr style="background:#f0fff0"><td colspan="2" style="padding:5px 8px;font-weight:bold;color:#2d8a4e;font-size:11px;">EARNINGS</td></tr>
            <tr><td style="padding:4px 8px;font-size:11px;">Basic Pay</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.basicPay)}</td></tr>
            ${pay.overtimePay > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Overtime Pay</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.overtimePay)}</td></tr>` : ''}
            ${pay.nightDiffPay > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Night Differential</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.nightDiffPay)}</td></tr>` : ''}
            ${pay.holidayPay > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Holiday Pay</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.holidayPay)}</td></tr>` : ''}
            ${pay.adjustmentEarnings > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Bonus / Other Earnings</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.adjustmentEarnings)}</td></tr>` : ''}
            <tr style="background:#e8f5e9;font-weight:bold;"><td style="padding:5px 8px;font-size:11px;">Total Earnings</td><td style="padding:5px 8px;text-align:right;font-size:11px;">${php(pay.totalEarnings)}</td></tr>
            <tr style="background:#fff0f0"><td colspan="2" style="padding:5px 8px;font-weight:bold;color:#ca1b1b;font-size:11px;">DEDUCTIONS</td></tr>
            ${pay.lateDeduction > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Late (${pay.lateMinutes} min)</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.lateDeduction)}</td></tr>` : ''}
            ${pay.undertimeDeduction > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Undertime (${pay.undertimeMinutes} min)</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.undertimeDeduction)}</td></tr>` : ''}
            ${(pay.excessBreakDeduction||0) > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Excess Break</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.excessBreakDeduction)}</td></tr>` : ''}
            ${pay.cashAdvanceDeduction > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Cash Advance</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.cashAdvanceDeduction)}</td></tr>` : ''}
            ${pay.sssDeduction > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">SSS</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.sssDeduction)}</td></tr>` : ''}
            ${pay.pagibigDeduction > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Pag-IBIG</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.pagibigDeduction)}</td></tr>` : ''}
            ${pay.philhealthDeduction > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">PhilHealth</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.philhealthDeduction)}</td></tr>` : ''}
            ${pay.adjustmentDeductions > 0 ? `<tr><td style="padding:4px 8px;font-size:11px;">Other Deductions</td><td style="padding:4px 8px;text-align:right;font-size:11px;">${php(pay.adjustmentDeductions)}</td></tr>` : ''}
            <tr style="background:#ffe8e8;font-weight:bold;"><td style="padding:5px 8px;font-size:11px;">Total Deductions</td><td style="padding:5px 8px;text-align:right;font-size:11px;">${php(pay.totalDeductions)}</td></tr>
          </tbody>
        </table>
        <div style="background:#ca1b1b;color:white;padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;">
          <span style="font-weight:bold;font-size:14px;">NET PAY</span>
          <span style="font-weight:bold;font-size:18px;">${php(pay.netPay)}</span>
        </div>
        <div style="margin-top:30px;display:flex;justify-content:space-between;">
          <div style="text-align:center;"><div style="border-top:1px solid #000;width:150px;padding-top:4px;font-size:10px;">Employee Signature</div></div>
          <div style="text-align:center;"><div style="border-top:1px solid #000;width:150px;padding-top:4px;font-size:10px;">Authorized Signature</div></div>
        </div>
        <p style="text-align:center;font-size:9px;color:#999;margin-top:15px;">System-generated payslip. ${genSerial(payrollStart, idx)}</p>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>Payslips ${payrollStart} to ${payrollEnd}</title>
      <style>
        body { margin: 0; padding: 0; }
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; }
          div[style*="page-break-after"] { page-break-after: always !important; }
        }
      </style>
      </head><body>${payslipHTML}</body></html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.focus(); printWindow.print() }, 500)
  }

  // ── Camera Screen ───────────────────────────────────────────────────────
  if (cameraMode) {
    return (
      <div style={{ minHeight:'100vh', background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <h2 style={{ color:'white', marginBottom:'8px' }}>{cameraMode==='timein'?'📸 Selfie for Time In':'📸 Selfie for Time Out'}</h2>
        <p style={{ color:'#aaa', marginBottom:'16px', fontSize:'13px' }}>Take a clear selfie to confirm your attendance</p>
        {!capturedPhoto ? (
          <>
            <video ref={videoRef} autoPlay playsInline style={{ width:'100%', maxWidth:'380px', borderRadius:'14px', border:'3px solid #ca1b1b' }} />
            <canvas ref={canvasRef} style={{ display:'none' }} />
            <button style={{ ...btnRed, maxWidth:'380px', marginTop:'16px' }} onClick={capturePhoto}>📸 TAKE SELFIE</button>
          </>
        ) : (
          <>
            <img src={capturedPhoto} alt="Selfie" style={{ width:'100%', maxWidth:'380px', borderRadius:'14px', border:'3px solid #2d8a4e' }} />
            <div style={{ display:'flex', gap:'10px', marginTop:'16px', width:'100%', maxWidth:'380px' }}>
              <button style={{ ...btnGray, flex:1, marginTop:0 }} onClick={retakePhoto}>🔄 RETAKE</button>
              <button style={{ ...btnGreen, flex:1, marginTop:0 }} onClick={cameraMode==='timein'?confirmTimeIn:confirmTimeOut} disabled={loading}>{loading?'⏳ SAVING...':'✅ CONFIRM'}</button>
            </div>
          </>
        )}
        <button style={{ ...btnGray, maxWidth:'380px', marginTop:'12px' }} onClick={() => { setCameraMode(null); setCapturedPhoto(null); stopCamera() }}>CANCEL</button>
      </div>
    )
  }

  // ── Admin Render ────────────────────────────────────────────────────────
  if (adminMode) {
    const tabs = [
      ['dashboard','🏠 Dashboard'],['attendance','📋 Attendance'],['employees','👥 Employees'],
      ['schedule','📅 Schedule'],['holidays','🗓️ Holidays'],['overtime','⏰ OT / UT Requests'],
      ['adjustment','⚙️ Adjustment'],['payroll','💰 Payroll'],['thirteenth','🎁 13th Month'],
      ['finalpay','📄 Final Pay'],['announcements','📢 Announcements'],
      ['leaveRequests','🏖️ Leave Requests 🔔'],['cashRequests','💵 CA Requests 🔔'],['disputes','⚠️ Disputes 🔔'],
    ]
    const filteredResults = payrollResults.filter(p => p.employeeName.toLowerCase().includes(payrollSearch.toLowerCase()) || p.employeeCode.toLowerCase().includes(payrollSearch.toLowerCase()))

    return (
      <div style={{ minHeight:'100vh', width:'100vw', background:'linear-gradient(135deg,#ca1b1b,#fdd412)', padding:isMobile?'0':'20px', boxSizing:'border-box' }}>
        {showPayrollReminder && (
          <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9999, background:'#ca1b1b', color:'white', padding:'10px 20px', textAlign:'center', fontWeight:'bold', fontSize:'14px' }}>
            🔔 PAYROLL REMINDER: Salary release is on the {currentDay===11?'15th':'30th'}. Please compute and release payroll on time!
          </div>
        )}
        <div style={{ background:'white', borderRadius:isMobile?'0':'20px', width:'100%', margin:'0 auto', minHeight:'100vh', boxShadow:'0 10px 30px rgba(0,0,0,0.2)', display:'flex', flexDirection:isMobile?'column':'row', overflow:'hidden', marginTop:showPayrollReminder?'44px':'0' }}>

          {isMobile && (
            <div style={{ background:'#ca1b1b', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top: showPayrollReminder?44:0, zIndex:100 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <img src="/logo.png" alt="Logo" style={{ width:'32px', height:'32px', objectFit:'contain' }} />
                <span style={{ color:'white', fontWeight:'bold', fontSize:'15px' }}>Admin Dashboard</span>
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.5)', color:'white', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold' }}>{sidebarOpen?'✕':'☰'}</button>
            </div>
          )}

          {(!isMobile||sidebarOpen) && (
            <div style={{ width:isMobile?'100%':'220px', background:'#fff8f8', borderRight:isMobile?'none':'2px solid #eee', padding:'16px 10px', display:'flex', flexDirection:'column', gap:'4px', flexShrink:0, overflowY:'auto', maxHeight:isMobile?'none':'95vh' }}>
              {!isMobile && (<>
                <img src="/logo.png" alt="Logo" style={{ width:'70px', height:'70px', objectFit:'contain', margin:'0 auto 4px' }} />
                <h2 style={{ color:'#ca1b1b', textAlign:'center', margin:'0 0 8px', fontSize:'13px' }}>Admin Dashboard</h2>
              </>)}
              {tabs.map(([key,label]) => (
                <button key={key} onClick={() => {
                  setActiveTab(key); setSidebarOpen(false)
                  if (key==='leaveRequests') loadLeaveRequests()
                  if (key==='cashRequests') loadCashAdvanceRequests()
                  if (key==='disputes') loadPayslipDisputes()
                  if (key==='overtime') loadTimeAdjRequests()
                  if (key==='holidays') loadHolidays()
                  if (key==='announcements') loadAnnouncements()
                  if (key==='dashboard') loadDashboard()
                }} style={{ padding:'9px 10px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'12px', textAlign:'left', width:'100%', background:activeTab===key?'#ca1b1b':'#f0f0f0', color:activeTab===key?'white':'#333' }}>{label}</button>
              ))}
              <button style={{ padding:'9px 10px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'12px', textAlign:'left', width:'100%', background:'#222', color:'white', marginTop:'8px' }} onClick={() => setAdminMode(false)}>← Back to Login</button>
            </div>
          )}

          <div style={{ flex:1, padding:isMobile?'14px':'24px', overflowY:'auto', maxHeight:isMobile?'none':'95vh' }}>

            {activeTab==='dashboard' && dashboardData && (
              <div>
                <h2 style={h2s}>🏠 Dashboard — {today}</h2>
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
                  {[
                    ['👥 Total Employees', dashboardData.totalEmployees, 'blue'],
                    ['🟢 Timed In', dashboardData.timedIn, 'green'],
                    ['✅ Timed Out', dashboardData.timedOut, 'gray'],
                    ['🔴 Absent', dashboardData.absent, 'red'],
                    ['🏖️ Pending Leave', dashboardData.pendingLeave, dashboardData.pendingLeave>0?'orange':'gray'],
                    ['💵 Pending CA', dashboardData.pendingCA, dashboardData.pendingCA>0?'orange':'gray'],
                    ['⏰ Pending OT/UT', dashboardData.pendingOT, dashboardData.pendingOT>0?'orange':'gray'],
                    ['⚠️ Disputes', dashboardData.pendingDisputes, dashboardData.pendingDisputes>0?'red':'gray'],
                  ].map(([label,value,color])=>(
                    <div key={label} style={{ background:'white', border:`2px solid ${color==='red'?'#ca1b1b':color==='green'?'#2d8a4e':color==='orange'?'#f5a623':color==='blue'?'#4a90d9':'#ddd'}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
                      <p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px' }}>{label}</p>
                      <p style={{ fontWeight:'bold', fontSize:'22px', margin:0, color:color==='red'?'#ca1b1b':color==='green'?'#2d8a4e':color==='orange'?'#f5a623':color==='blue'?'#4a90d9':'#555' }}>{value}</p>
                    </div>
                  ))}
                </div>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 20px' }} onClick={loadDashboard}>🔄 REFRESH</button>
              </div>
            )}

            {activeTab==='attendance' && (
              <div>
                <h2 style={h2s}>Attendance Records</h2>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px' }}>
                  <input type="date" value={adminDate} onChange={e=>setAdminDate(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                  <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={loadAdminLogs}>LOAD</button>
                  <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={() => window.print()}>PRINT</button>
                </div>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'18px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 10px', fontSize:'13px' }}>Mark Employee as Absent</h3>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <EmployeeSelect value={absentEmployeeId} onChange={setAbsentEmployeeId} employees={employees} />
                    <input type="date" value={absentDate} onChange={e=>setAbsentDate(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                    <button style={{ ...btnRed, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={markAbsent}>MARK ABSENT</button>
                  </div>
                </div>
                {adminLogs.length===0 && <p style={{ color:'#888' }}>No records for this date.</p>}
                {adminLogs.map(log => (
                  <div key={log.id} style={cardS}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{log.employee_name}</strong>
                      <Badge label={log.status||'—'} color={log.status==='Absent'?'red':log.status==='Late'?'orange':log.status?.includes('Overtime')?'green':log.status==='On Time'?'blue':'gray'} />
                    </div>
                    <p style={cps}>Schedule: {log.shift_start||'None'} – {log.shift_end||'None'}</p>
                    <p style={cps}>Time In: <strong>{log.time_in||'—'}</strong> | Time Out: <strong>{log.time_out||'—'}</strong></p>
                    <p style={cps}>Late: {log.late_minutes||0}m | Undertime: {log.undertime_minutes||0}m | OT: {log.overtime_minutes||0}m | Break: {log.total_break_minutes||0}m</p>
                    <div style={{ display:'flex', gap:'8px', marginTop:'8px', flexWrap:'wrap' }}>
                      {log.selfie_in_url && <div><p style={{ ...cps, marginBottom:'3px' }}>Time In:</p><img src={log.selfie_in_url} alt="IN" style={{ width:'70px', height:'70px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2d8a4e', cursor:'pointer' }} onClick={()=>window.open(log.selfie_in_url,'_blank')} /></div>}
                      {log.selfie_out_url && <div><p style={{ ...cps, marginBottom:'3px' }}>Time Out:</p><img src={log.selfie_out_url} alt="OUT" style={{ width:'70px', height:'70px', objectFit:'cover', borderRadius:'8px', border:'2px solid #ca1b1b', cursor:'pointer' }} onClick={()=>window.open(log.selfie_out_url,'_blank')} /></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='employees' && (
              <div>
                <h2 style={h2s}>Employees</h2>
                <input placeholder="Search name, code, or position..." value={employeeSearch} onChange={e=>setEmployeeSearch(e.target.value)} style={inputStyle} />
                {employeeSearch.trim() && employees.filter(emp=>`${emp.full_name} ${emp.employee_code} ${emp.position}`.toLowerCase().includes(employeeSearch.toLowerCase())).map(emp=>(
                  <div key={emp.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                      {emp.profile_photo_url && <img src={emp.profile_photo_url} alt="" style={{ width:'50px', height:'50px', borderRadius:'50%', objectFit:'cover', border:'2px solid #ca1b1b' }} />}
                      <div>
                        <strong style={{ color:'#ca1b1b' }}>{emp.full_name}</strong>
                        <p style={cps}>{emp.employee_code} | {emp.position} | {emp.department||'—'} | <Badge label={emp.employment_type||'regular'} color="blue" /></p>
                        <p style={cps}>{php(emp.daily_rate)}/day | {emp.gender||'—'} | {emp.civil_status||'—'} | DOB: {emp.date_of_birth||'—'}</p>
                        <p style={cps}>📞 {emp.contact_number||'—'} | 🏠 {emp.home_address||'—'}</p>
                        <p style={cps}>🚨 {emp.emergency_contact_name||'—'} — {emp.emergency_contact_number||'—'}</p>
                        <p style={cps}>SL: {emp.sick_leave_balance||5}d | VL: {emp.vacation_leave_balance||5}d | SIL: {emp.sil_balance||5}d</p>
                        <p style={cps}>{emp.has_sss?'✅':'❌'} SSS &nbsp;{emp.has_pagibig?'✅':'❌'} Pag-IBIG &nbsp;{emp.has_philhealth?'✅':'❌'} PhilHealth</p>
                      </div>
                    </div>
                  </div>
                ))}

                <h3 style={{ color:'#ca1b1b', marginTop:'16px', marginBottom:'10px' }}>Add New Employee</h3>
                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>📋 Basic Information</p>
                <input placeholder="Employee Code *" value={newEmpFields.code||''} onChange={e=>setNewEmpFields(p=>({...p,code:e.target.value}))} style={inputStyle} />
                <input placeholder="Full Name *" value={newEmpFields.name||''} onChange={e=>setNewEmpFields(p=>({...p,name:e.target.value}))} style={inputStyle} />
                <input placeholder="Position / Job Title *" value={newEmpFields.position||''} onChange={e=>setNewEmpFields(p=>({...p,position:e.target.value}))} style={inputStyle} />
                <input placeholder="PIN *" value={newEmpFields.pin||''} onChange={e=>setNewEmpFields(p=>({...p,pin:e.target.value}))} style={inputStyle} />
                <input placeholder="Department (e.g. Kitchen, Cashier)" value={newEmpFields.department||''} onChange={e=>setNewEmpFields(p=>({...p,department:e.target.value}))} style={inputStyle} />
                <label style={lblS}>Employment Type:</label>
                <select value={newEmpFields.employment_type||'regular'} onChange={e=>setNewEmpFields(p=>({...p,employment_type:e.target.value}))} style={inputStyle}>
                  <option value="regular">Regular</option>
                  <option value="probationary">Probationary</option>
                  <option value="part-time">Part-Time</option>
                  <option value="contractual">Contractual</option>
                </select>

                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>👤 Personal Information</p>
                <label style={lblS}>Date of Birth:</label>
                <input type="date" value={newEmpFields.dob||''} onChange={e=>setNewEmpFields(p=>({...p,dob:e.target.value}))} style={inputStyle} />
                <label style={lblS}>Gender:</label>
                <select value={newEmpFields.gender||''} onChange={e=>setNewEmpFields(p=>({...p,gender:e.target.value}))} style={inputStyle}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <label style={lblS}>Civil Status:</label>
                <select value={newEmpFields.civil_status||''} onChange={e=>setNewEmpFields(p=>({...p,civil_status:e.target.value}))} style={inputStyle}>
                  <option value="">Select Civil Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </select>
                <input placeholder="Home Address" value={newEmpFields.address||''} onChange={e=>setNewEmpFields(p=>({...p,address:e.target.value}))} style={inputStyle} />
                <input placeholder="Contact Number" value={newEmpFields.contact||''} onChange={e=>setNewEmpFields(p=>({...p,contact:e.target.value}))} style={inputStyle} />

                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>🚨 Emergency Contact</p>
                <input placeholder="Emergency Contact Name" value={newEmpFields.emergency_name||''} onChange={e=>setNewEmpFields(p=>({...p,emergency_name:e.target.value}))} style={inputStyle} />
                <input placeholder="Emergency Contact Number" value={newEmpFields.emergency_contact||''} onChange={e=>setNewEmpFields(p=>({...p,emergency_contact:e.target.value}))} style={inputStyle} />

                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>💰 Compensation</p>
                <input placeholder="Daily Rate (PHP)" type="number" value={newEmpFields.rate||''} onChange={e=>setNewEmpFields(p=>({...p,rate:e.target.value}))} style={inputStyle} />
                <input placeholder="Hourly Rate (PHP, if applicable)" type="number" value={newEmpFields.hourlyRate||''} onChange={e=>setNewEmpFields(p=>({...p,hourlyRate:e.target.value}))} style={inputStyle} />
                <label style={lblS}>Pay Type:</label>
                <select value={newEmpFields.payType||'daily'} onChange={e=>setNewEmpFields(p=>({...p,payType:e.target.value}))} style={inputStyle}>
                  <option value="daily">Daily Rate</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
                <label style={lblS}>Hire Date:</label>
                <input type="date" value={newEmpFields.hire_date||''} onChange={e=>setNewEmpFields(p=>({...p,hire_date:e.target.value}))} style={inputStyle} />
                <label style={lblS}>Late Grace Period (minutes):</label>
                <input type="number" value={newEmpFields.gracePeriod||10} onChange={e=>setNewEmpFields(p=>({...p,gracePeriod:e.target.value}))} style={inputStyle} />

                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>📅 Leave & Benefits</p>
                <div style={{ display:'flex', gap:'10px' }}>
                  <div style={{ flex:1 }}><label style={lblS}>Sick Leave (days/year):</label><input type="number" value={newEmpFields.sick||5} onChange={e=>setNewEmpFields(p=>({...p,sick:e.target.value}))} style={inputStyle} /></div>
                  <div style={{ flex:1 }}><label style={lblS}>Vacation Leave (days/year):</label><input type="number" value={newEmpFields.vacation||5} onChange={e=>setNewEmpFields(p=>({...p,vacation:e.target.value}))} style={inputStyle} /></div>
                </div>
                <label style={lblS}>Service Incentive Leave (days/year):</label>
                <input type="number" value={newEmpFields.sil||5} onChange={e=>setNewEmpFields(p=>({...p,sil:e.target.value}))} style={inputStyle} />
                <div style={{ background:'#f9f9f9', borderRadius:'10px', padding:'12px', marginBottom:'12px' }}>
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:'0 0 8px' }}>Government Contributions:</p>
                  <label style={lblS}><input type="checkbox" checked={newEmpFields.hasSss} onChange={e=>setNewEmpFields(p=>({...p,hasSss:e.target.checked}))} style={{ marginRight:'8px' }} />SSS — PHP 375 (11–25 cutoff)</label>
                  <label style={lblS}><input type="checkbox" checked={newEmpFields.hasPagibig} onChange={e=>setNewEmpFields(p=>({...p,hasPagibig:e.target.checked}))} style={{ marginRight:'8px' }} />Pag-IBIG — PHP 200 (26–10 cutoff)</label>
                  <label style={lblS}><input type="checkbox" checked={newEmpFields.hasPhilhealth} onChange={e=>setNewEmpFields(p=>({...p,hasPhilhealth:e.target.checked}))} style={{ marginRight:'8px' }} />PhilHealth — PHP 250 (26–10 cutoff)</label>
                </div>
                <button style={btnGreen} onClick={addEmployee}>ADD EMPLOYEE</button>

                <h3 style={{ color:'#ca1b1b', marginTop:'22px', marginBottom:'10px' }}>Employee List</h3>
                <div style={{ maxHeight:'500px', overflowY:'auto', border:'2px solid #ca1b1b', borderRadius:'10px', padding:'10px', background:'#fff8dc' }}>
                  {employees.map(emp=>(
                    <div key={emp.id} style={{ borderBottom:'1px solid #ddd', padding:'12px 0' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                          {emp.profile_photo_url ? <img src={emp.profile_photo_url} alt="" style={{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover' }} /> : <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#ddd', display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontSize:'16px' }}>👤</div>}
                          <div>
                            <strong style={{ color:'#ca1b1b', fontSize:'14px' }}>{emp.full_name}</strong>
                            <p style={cps}>{emp.employee_code} | {emp.position} | {emp.department||'—'} | <Badge label={emp.employment_type||'regular'} color="blue" /></p>
                            <p style={cps}>{php(emp.daily_rate)}/day | Grace: {emp.grace_period_minutes||10}min | Hired: {emp.hire_date||'N/A'}</p>
                            <p style={cps}>👤 {emp.gender||'—'} | {emp.civil_status||'—'} | DOB: {emp.date_of_birth||'—'}</p>
                            <p style={cps}>📞 {emp.contact_number||'—'} | 🏠 {emp.home_address||'—'}</p>
                            <p style={cps}>🚨 Emergency: {emp.emergency_contact_name||'—'} — {emp.emergency_contact_number||'—'}</p>
                            <p style={cps}>SL: {emp.sick_leave_balance||5}d | VL: {emp.vacation_leave_balance||5}d | SIL: {emp.sil_balance||5}d</p>
                            <p style={cps}>{emp.has_sss?'✅':'❌'} SSS &nbsp;{emp.has_pagibig?'✅':'❌'} Pag-IBIG &nbsp;{emp.has_philhealth?'✅':'❌'} PhilHealth</p>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                          <button style={btnYellow} onClick={()=>{ setEditingEmployeeId(emp.id); setEditFields({ code:emp.employee_code||'', name:emp.full_name||'', position:emp.position||'', pin:emp.pin||'', rate:emp.daily_rate||'', hasSss:emp.has_sss||false, hasPagibig:emp.has_pagibig||false, hasPhilhealth:emp.has_philhealth||false, hireDate:emp.hire_date||today, sick:emp.sick_leave_balance||5, vacation:emp.vacation_leave_balance||5, sil:emp.sil_balance||5, payType:emp.pay_type||'daily', hourlyRate:emp.hourly_rate||0, gracePeriod:emp.grace_period_minutes||10, dob:emp.date_of_birth||'', gender:emp.gender||'', civil_status:emp.civil_status||'', address:emp.home_address||'', contact:emp.contact_number||'', emergency_name:emp.emergency_contact_name||'', emergency_contact:emp.emergency_contact_number||'', employment_type:emp.employment_type||'regular', department:emp.department||'' }) }}>✏ EDIT</button>
                          <button style={{ ...btnRed, width:'auto', padding:'6px 10px', marginTop:0, fontSize:'12px' }} onClick={()=>deactivateEmployee(emp.id, emp.full_name)}>🚫</button>
                        </div>
                      </div>
                      {editingEmployeeId===emp.id && (
                        <div style={{ marginTop:'12px', background:'white', padding:'14px', borderRadius:'10px', border:'1px solid #ddd' }}>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>📋 Basic Information</p>
                          <input placeholder="Employee Code" value={editFields.code||''} onChange={e=>setEditFields(p=>({...p,code:e.target.value}))} style={inputStyle} />
                          <input placeholder="Full Name" value={editFields.name||''} onChange={e=>setEditFields(p=>({...p,name:e.target.value}))} style={inputStyle} />
                          <input placeholder="Position" value={editFields.position||''} onChange={e=>setEditFields(p=>({...p,position:e.target.value}))} style={inputStyle} />
                          <input placeholder="PIN" value={editFields.pin||''} onChange={e=>setEditFields(p=>({...p,pin:e.target.value}))} style={inputStyle} />
                          <input placeholder="Department" value={editFields.department||''} onChange={e=>setEditFields(p=>({...p,department:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Employment Type:</label>
                          <select value={editFields.employment_type||'regular'} onChange={e=>setEditFields(p=>({...p,employment_type:e.target.value}))} style={inputStyle}>
                            <option value="regular">Regular</option>
                            <option value="probationary">Probationary</option>
                            <option value="part-time">Part-Time</option>
                            <option value="contractual">Contractual</option>
                          </select>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>👤 Personal Information</p>
                          <label style={lblS}>Date of Birth:</label>
                          <input type="date" value={editFields.dob||''} onChange={e=>setEditFields(p=>({...p,dob:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Gender:</label>
                          <select value={editFields.gender||''} onChange={e=>setEditFields(p=>({...p,gender:e.target.value}))} style={inputStyle}>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                          <label style={lblS}>Civil Status:</label>
                          <select value={editFields.civil_status||''} onChange={e=>setEditFields(p=>({...p,civil_status:e.target.value}))} style={inputStyle}>
                            <option value="">Select Civil Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                          </select>
                          <input placeholder="Home Address" value={editFields.address||''} onChange={e=>setEditFields(p=>({...p,address:e.target.value}))} style={inputStyle} />
                          <input placeholder="Contact Number" value={editFields.contact||''} onChange={e=>setEditFields(p=>({...p,contact:e.target.value}))} style={inputStyle} />
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>🚨 Emergency Contact</p>
                          <input placeholder="Emergency Contact Name" value={editFields.emergency_name||''} onChange={e=>setEditFields(p=>({...p,emergency_name:e.target.value}))} style={inputStyle} />
                          <input placeholder="Emergency Contact Number" value={editFields.emergency_contact||''} onChange={e=>setEditFields(p=>({...p,emergency_contact:e.target.value}))} style={inputStyle} />
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>💰 Compensation</p>
                          <input placeholder="Daily Rate (PHP)" type="number" value={editFields.rate||''} onChange={e=>setEditFields(p=>({...p,rate:e.target.value}))} style={inputStyle} />
                          <input placeholder="Hourly Rate (PHP)" type="number" value={editFields.hourlyRate||''} onChange={e=>setEditFields(p=>({...p,hourlyRate:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Pay Type:</label>
                          <select value={editFields.payType||'daily'} onChange={e=>setEditFields(p=>({...p,payType:e.target.value}))} style={inputStyle}>
                            <option value="daily">Daily Rate</option>
                            <option value="hourly">Hourly Rate</option>
                          </select>
                          <label style={lblS}>Hire Date:</label>
                          <input type="date" value={editFields.hireDate||''} onChange={e=>setEditFields(p=>({...p,hireDate:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Grace Period (minutes):</label>
                          <input type="number" value={editFields.gracePeriod||10} onChange={e=>setEditFields(p=>({...p,gracePeriod:e.target.value}))} style={inputStyle} />
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginTop:'8px' }}>📅 Leave & Benefits</p>
                          <div style={{ display:'flex', gap:'10px' }}>
                            <div style={{ flex:1 }}><label style={lblS}>Sick Leave (days/year):</label><input type="number" value={editFields.sick||5} onChange={e=>setEditFields(p=>({...p,sick:e.target.value}))} style={inputStyle} /></div>
                            <div style={{ flex:1 }}><label style={lblS}>Vacation Leave (days/year):</label><input type="number" value={editFields.vacation||5} onChange={e=>setEditFields(p=>({...p,vacation:e.target.value}))} style={inputStyle} /></div>
                          </div>
                          <label style={lblS}>Service Incentive Leave (days/year):</label>
                          <input type="number" value={editFields.sil||5} onChange={e=>setEditFields(p=>({...p,sil:e.target.value}))} style={inputStyle} />
                          <div style={{ background:'#f9f9f9', borderRadius:'10px', padding:'12px', marginBottom:'12px' }}>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:'0 0 8px' }}>Government Contributions:</p>
                            <label style={lblS}><input type="checkbox" checked={editFields.hasSss||false} onChange={e=>setEditFields(p=>({...p,hasSss:e.target.checked}))} style={{ marginRight:'8px' }} />SSS</label>
                            <label style={lblS}><input type="checkbox" checked={editFields.hasPagibig||false} onChange={e=>setEditFields(p=>({...p,hasPagibig:e.target.checked}))} style={{ marginRight:'8px' }} />Pag-IBIG</label>
                            <label style={lblS}><input type="checkbox" checked={editFields.hasPhilhealth||false} onChange={e=>setEditFields(p=>({...p,hasPhilhealth:e.target.checked}))} style={{ marginRight:'8px' }} />PhilHealth</label>
                          </div>
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={saveEmployeeChanges} style={{ ...btnRed, width:'auto', padding:'10px 18px', marginTop:0 }}>SAVE</button>
                            <button onClick={()=>setEditingEmployeeId('')} style={{ ...btnGray, width:'auto', padding:'10px 18px', marginTop:0 }}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab==='schedule' && (
              <div>
                <h2 style={h2s}>Assign Daily Schedule</h2>
                <EmployeeSelect value={selectedEmployeeId} onChange={setSelectedEmployeeId} employees={employees} />
                <input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={inputStyle} />
                <label style={lblS}>Shift Start:</label>
                <input type="time" value={shiftStart} onChange={e=>setShiftStart(e.target.value)} style={inputStyle} />
                <label style={lblS}>Shift End:</label>
                <input type="time" value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)} style={inputStyle} />
                <button style={btnGreen} onClick={saveSchedule}>SAVE SCHEDULE</button>
              </div>
            )}

            {activeTab==='holidays' && (
              <div>
                <h2 style={h2s}>Holiday Calendar</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'15px' }}>Regular Holidays = 200% pay if worked. Special Non-Working = 130%.</p>
                <div style={{ background:'#f9f9f9', borderRadius:'10px', padding:'14px', marginBottom:'18px' }}>
                  <label style={lblS}>Date:</label>
                  <input type="date" value={newHolidayDate} onChange={e=>setNewHolidayDate(e.target.value)} style={inputStyle} />
                  <label style={lblS}>Holiday Name:</label>
                  <input placeholder="e.g. Christmas Day" value={newHolidayName} onChange={e=>setNewHolidayName(e.target.value)} style={inputStyle} />
                  <label style={lblS}>Type:</label>
                  <select value={newHolidayType} onChange={e=>setNewHolidayType(e.target.value)} style={inputStyle}>
                    <option value="regular">Regular Holiday (200%)</option>
                    <option value="special">Special Non-Working (130%)</option>
                  </select>
                  <button style={btnGreen} onClick={addHoliday}>ADD HOLIDAY</button>
                </div>
                {holidays.length===0 && <p style={{ color:'#888' }}>No holidays added yet.</p>}
                {holidays.map(h=>(
                  <div key={h.id} style={{ ...cardS, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div><strong style={{ color:'#ca1b1b' }}>{h.holiday_name}</strong><p style={cps}>{h.holiday_date} — {h.holiday_type==='regular'?'Regular (200%)':'Special (130%)'}</p></div>
                    <button style={{ ...btnRed, width:'auto', padding:'6px 12px', marginTop:0 }} onClick={()=>deleteHoliday(h.id)}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='overtime' && (
              <div>
                <h2 style={h2s}>Overtime / Undertime Requests</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={loadTimeAdjRequests}>REFRESH</button>
                {timeAdjRequests.length===0 && <p style={{ color:'#888' }}>No pending requests.</p>}
                {timeAdjRequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:`2px solid ${req.request_type==='overtime'?'#2d8a4e':'#f5a623'}`, background:req.request_type==='overtime'?'#f0fff0':'#fffbf0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{req.employee_name}</strong>
                      <Badge label={req.request_type==='overtime'?'OVERTIME':'UNDERTIME'} color={req.request_type==='overtime'?'green':'orange'} />
                    </div>
                    <p style={cps}>Date: {req.attendance_date} | Minutes: <strong>{req.minutes}</strong></p>
                    <p style={cps}>Employee Reason: <em>"{req.employee_reason}"</em></p>
                    <label style={lblS}>Admin Response / Reason:</label>
                    <textarea placeholder="Enter your reason (required for rejection)..." value={adjAdminReason[req.id]||''} onChange={e=>setAdjAdminReason(p=>({...p,[req.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                    <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>approveTimeAdj(req)}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>rejectTimeAdj(req)}>❌ REJECT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='adjustment' && (
              <div>
                <h2 style={h2s}>Payroll Adjustment</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'15px' }}>Add bonuses or deductions. Applied automatically during payroll computation.</p>
                <EmployeeSelect value={adjustmentEmployeeId} onChange={setAdjustmentEmployeeId} employees={employees} />
                <input type="date" value={adjustmentDate} onChange={e=>setAdjustmentDate(e.target.value)} style={inputStyle} />
                <select value={adjustmentType} onChange={e=>setAdjustmentType(e.target.value)} style={inputStyle}>
                  <option value="deduction">Deduction</option>
                  <option value="addition">Addition / Bonus</option>
                </select>
                <input placeholder="Category (e.g. Bonus, Penalty)" value={adjustmentCategory} onChange={e=>setAdjustmentCategory(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Amount (PHP)" value={adjustmentAmount} onChange={e=>setAdjustmentAmount(e.target.value)} style={inputStyle} />
                <input placeholder="Notes (optional)" value={adjustmentNotes} onChange={e=>setAdjustmentNotes(e.target.value)} style={inputStyle} />
                <button style={btnGreen} onClick={saveAdjustment}>SAVE ADJUSTMENT</button>
              </div>
            )}

            {activeTab==='payroll' && (
              <div>
                <h2 style={h2s}>Payroll Computation</h2>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'15px', fontSize:'13px', color:'#666' }}>
                  <strong style={{ color:'#ca1b1b' }}>Cutoff Rules:</strong> 11–25 → SSS (PHP 375) | 26–10 → Pag-IBIG (PHP 200) + PhilHealth (PHP 250) | Only approved OT/UT is computed
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
                  <input type="month" value={payrollMonth} onChange={e=>setPayrollMonth(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                  <select value={payrollCutoff} onChange={e=>setPayrollCutoff(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }}>
                    <option value="11-25">11th – 25th (SSS Cutoff)</option>
                    <option value="26-10">26th – 10th (Pag-IBIG + PhilHealth)</option>
                  </select>
                  <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={applyPayrollCutoff}>APPLY</button>
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px' }}>
                  <div><label style={lblS}>From:</label><input type="date" value={payrollStart} onChange={e=>setPayrollStart(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                  <div><label style={lblS}>To:</label><input type="date" value={payrollEnd} onChange={e=>setPayrollEnd(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px' }}>
                  <button style={{ ...btnBlack, width:'auto', padding:'12px 22px', marginTop:0 }} onClick={computePayroll} disabled={payrollComputing}>{payrollComputing?'⏳ COMPUTING...':'🧮 COMPUTE PAYROLL'}</button>
                  <button style={{ ...btnGreen, width:'auto', padding:'12px 22px', marginTop:0 }} onClick={printAllPayslips} disabled={payrollResults.length===0}>🖨 PRINT ALL PAYSLIPS</button>
                </div>

                {payrollSummary && (
                  <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'18px', marginBottom:'22px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 12px' }}>📊 Payroll Summary — {payrollStart} to {payrollEnd}</h3>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:'8px' }}>
                      {[['Employees',payrollSummary.totalEmployees],['Basic Pay',php(payrollSummary.totalBasicPay)],['Overtime',php(payrollSummary.totalOvertimePay)],['Night Diff',php(payrollSummary.totalNightDiff)],['Holiday Pay',php(payrollSummary.totalHolidayPay)],['Total Earnings',php(payrollSummary.totalEarnings)],['SSS',php(payrollSummary.totalSSS)],['Pag-IBIG',php(payrollSummary.totalPagibig)],['PhilHealth',php(payrollSummary.totalPhilhealth)],['Cash Advance',php(payrollSummary.totalCA)],['Total Deductions',php(payrollSummary.totalDeductions)],['TOTAL NET PAY',php(payrollSummary.totalNetPay)]].map(([label,value])=>(
                        <div key={label} style={{ background:'white', borderRadius:'8px', padding:'10px', border:'1px solid #eee' }}>
                          <p style={{ color:'#888', fontSize:'11px', margin:'0 0 3px' }}>{label}</p>
                          <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'13px', margin:0 }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {payrollResults.length > 0 && (
                  <input placeholder="🔍 Search employee in results..." value={payrollSearch} onChange={e=>setPayrollSearch(e.target.value)} style={{ ...inputStyle, marginBottom:'16px' }} />
                )}

                {filteredResults.map((pay,idx)=>(
                  <div key={pay.employeeCode} style={{ ...cardS, marginBottom:'20px' }}>
                    <div style={{ background:'white', padding:'18px', borderRadius:'10px', border:'1px solid #ddd', fontSize:'13px' }}>
                      <div style={{ textAlign:'center', marginBottom:'12px', borderBottom:'2px solid #ca1b1b', paddingBottom:'10px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width:'48px', height:'48px', objectFit:'contain' }} />
                        <h2 style={{ margin:'4px 0', color:'#ca1b1b', fontSize:'15px' }}>Roma's Donuts</h2>
                        <strong>EMPLOYEE PAYSLIP</strong>
                        <p style={{ margin:'3px 0', color:'#666', fontSize:'11px' }}>Serial: {genSerial(payrollStart,payrollResults.indexOf(pay))} | Period: {payrollStart} to {payrollEnd}</p>
                      </div>
                      <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'8px', padding:'10px', marginBottom:'12px' }}>
                        <p style={{ margin:'2px 0', fontSize:'16px', fontWeight:'bold', color:'#ca1b1b' }}>{pay.employeeName}</p>
                        <p style={{ margin:'2px 0', fontSize:'13px', fontWeight:'bold', color:'#555' }}>{pay.position}</p>
                        <p style={{ margin:'2px 0', fontSize:'11px', color:'#888' }}>Code: {pay.employeeCode} | Worked: {pay.workedDays}d | Absent: {pay.absentDays}d</p>
                      </div>
                      <p style={{ color:'green', fontWeight:'bold' }}>EARNINGS</p>
                      <p>Basic Pay: {php(pay.basicPay)}</p>
                      {pay.overtimePay>0&&<p>Overtime Pay: {php(pay.overtimePay)}</p>}
                      {pay.nightDiffPay>0&&<p>Night Differential: {php(pay.nightDiffPay)}</p>}
                      {pay.holidayPay>0&&<p>Holiday Pay: {php(pay.holidayPay)}</p>}
                      {pay.adjustmentEarnings>0&&<p>Bonus / Other: {php(pay.adjustmentEarnings)}</p>}
                      <p><strong>Total Earnings: {php(pay.totalEarnings)}</strong></p>
                      <hr />
                      <p style={{ color:'#ca1b1b', fontWeight:'bold' }}>DEDUCTIONS</p>
                      {pay.lateDeduction>0&&<p>Late ({pay.lateMinutes} min): {php(pay.lateDeduction)}</p>}
                      {pay.undertimeDeduction>0&&<p>Undertime ({pay.undertimeMinutes} min): {php(pay.undertimeDeduction)}</p>}
                      {(pay.excessBreakDeduction||0)>0&&<p>Excess Break: {php(pay.excessBreakDeduction)}</p>}
                      {pay.cashAdvanceDeduction>0&&<p>Cash Advance: {php(pay.cashAdvanceDeduction)}</p>}
                      {pay.sssDeduction>0&&<p>SSS: {php(pay.sssDeduction)}</p>}
                      {pay.pagibigDeduction>0&&<p>Pag-IBIG: {php(pay.pagibigDeduction)}</p>}
                      {pay.philhealthDeduction>0&&<p>PhilHealth: {php(pay.philhealthDeduction)}</p>}
                      {pay.adjustmentDeductions>0&&<p>Other Deductions: {php(pay.adjustmentDeductions)}</p>}
                      <p><strong>Total Deductions: {php(pay.totalDeductions)}</strong></p>
                      <hr />
                      <h3 style={{ color:'#ca1b1b' }}>NET PAY: {php(pay.netPay)}</h3>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='thirteenth' && (
              <div>
                <h2 style={h2s}>13th Month Pay</h2>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px' }}>
                  <div><label style={lblS}>From:</label><input type="date" value={payrollStart} onChange={e=>setPayrollStart(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                  <div><label style={lblS}>To:</label><input type="date" value={payrollEnd} onChange={e=>setPayrollEnd(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                </div>
                <button style={btnGreen} onClick={async()=>{
                  const { data: empList } = await supabase.from('employees').select('*').eq('is_active', true)
                  const r = []
                  for (const emp of empList||[]) {
                    const { data: records } = await supabase.from('payroll_records').select('basic_pay').eq('employee_id', emp.id).gte('payroll_start', payrollStart).lte('payroll_end', payrollEnd)
                    const totalBasic = records?.reduce((s,rec)=>s+Number(rec.basic_pay||0),0)||0
                    r.push({ employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position||'', totalBasic, thirteenthMonth:totalBasic/12 })
                  }
                  setPayrollResults(r)
                }}>COMPUTE 13TH MONTH</button>
                {payrollResults.map(pay=>(
                  <div key={pay.employeeCode} style={cardS}>
                    <strong style={{ color:'#ca1b1b' }}>{pay.employeeName}</strong>
                    <p style={cps}>{pay.employeeCode} | {pay.position}</p>
                    <p style={cps}>Total Basic Pay (Year): {php(pay.totalBasic)}</p>
                    <h3 style={{ color:'#ca1b1b', margin:'6px 0 0' }}>13th Month Pay: {php(pay.thirteenthMonth)}</h3>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='finalpay' && (
              <div>
                <h2 style={h2s}>Final Pay Computation</h2>
                <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
                  <EmployeeSelect value={finalPayEmployeeId} onChange={setFinalPayEmployeeId} employees={employees} />
                  <label style={lblS}>Separation Reason:</label>
                  <select value={finalPayReason} onChange={e=>setFinalPayReason(e.target.value)} style={inputStyle}>
                    <option value="resigned">Resigned (no separation pay)</option>
                    <option value="authorized">Authorized Cause — ½ month/year</option>
                    <option value="redundancy">Redundancy / Retrenchment — 1 month/year</option>
                    <option value="retirement">Retirement</option>
                    <option value="dismissed">Dismissed for Cause (no separation pay)</option>
                  </select>
                  <label style={lblS}>Last Working Date:</label>
                  <input type="date" value={finalPayLastDate} onChange={e=>setFinalPayLastDate(e.target.value)} style={inputStyle} />
                  <button style={btnGreen} onClick={computeFinalPay}>COMPUTE FINAL PAY</button>
                </div>
                {finalPayResult && (
                  <div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'20px' }}>
                    <div style={{ textAlign:'center', marginBottom:'14px' }}>
                      <h2 style={{ color:'#ca1b1b', margin:'4px 0' }}>Roma's Donuts — FINAL PAY SLIP</h2>
                    </div>
                    <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'8px', padding:'10px', marginBottom:'12px' }}>
                      <p style={{ margin:'2px 0', fontSize:'16px', fontWeight:'bold', color:'#ca1b1b' }}>{finalPayResult.employeeName}</p>
                      <p style={{ margin:'2px 0', fontSize:'13px', fontWeight:'bold', color:'#555' }}>{finalPayResult.position}</p>
                    </div>
                    <p><strong>Code:</strong> {finalPayResult.employeeCode} | <strong>Hire Date:</strong> {finalPayResult.hireDate}</p>
                    <p><strong>Last Working Date:</strong> {finalPayResult.lastDate} | <strong>Years of Service:</strong> {finalPayResult.yearsOfService}</p>
                    <p><strong>Reason:</strong> {finalPayResult.reason} | <strong>Daily Rate:</strong> {php(finalPayResult.dailyRate)}</p>
                    <hr />
                    <p style={{ color:'green', fontWeight:'bold' }}>FINAL PAY COMPONENTS</p>
                    <p>Last Salary ({finalPayResult.unpaidDays} days): {php(finalPayResult.lastSalary)}</p>
                    <p>Pro-rated 13th Month: {php(finalPayResult.proRated13th)}</p>
                    <p>Unused SIL ({finalPayResult.unusedSIL} days): {php(finalPayResult.silPay)}</p>
                    <p>Separation Pay: {php(finalPayResult.separationPay)}</p>
                    <hr />
                    <p style={{ color:'#ca1b1b', fontWeight:'bold' }}>DEDUCTIONS</p>
                    <p>Outstanding Cash Advance: {php(finalPayResult.totalCA)}</p>
                    <hr />
                    <h2 style={{ color:'#ca1b1b' }}>TOTAL FINAL PAY: {php(finalPayResult.totalFinalPay)}</h2>
                    <div style={{ display:'flex', gap:'10px', marginTop:'15px', flexWrap:'wrap' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={processFinalPay}>✅ PROCESS & DEACTIVATE</button>
                      <button style={{ ...btnBlack, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={()=>window.print()}>🖨 PRINT</button>
                      <button style={{ ...btnGray, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={()=>setFinalPayResult(null)}>CANCEL</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab==='announcements' && (
              <div>
                <h2 style={h2s}>📢 Announcements</h2>
                <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 10px' }}>Post New Announcement</h3>
                  <input placeholder="Title" value={newAnnouncementTitle} onChange={e=>setNewAnnouncementTitle(e.target.value)} style={inputStyle} />
                  <textarea placeholder="Announcement content..." value={newAnnouncementContent} onChange={e=>setNewAnnouncementContent(e.target.value)} style={{ ...inputStyle, minHeight:'80px', resize:'none' }} />
                  <button style={btnGreen} onClick={addAnnouncement}>📢 POST ANNOUNCEMENT</button>
                </div>
                {announcements.length===0 && <p style={{ color:'#888' }}>No announcements yet.</p>}
                {announcements.map(ann=>(
                  <div key={ann.id} style={{ ...cardS, border:`2px solid ${ann.is_active?'#ca1b1b':'#ccc'}`, background:ann.is_active?'#fff8dc':'#f9f9f9' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <div>
                        <strong style={{ color:ann.is_active?'#ca1b1b':'#888', fontSize:'15px' }}>{ann.title}</strong>
                        <Badge label={ann.is_active?'ACTIVE':'INACTIVE'} color={ann.is_active?'green':'gray'} />
                      </div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button style={{ ...btnYellow, marginTop:0 }} onClick={()=>toggleAnnouncement(ann.id, ann.is_active)}>{ann.is_active?'DEACTIVATE':'ACTIVATE'}</button>
                        <button style={{ ...btnRed, width:'auto', padding:'6px 10px', marginTop:0 }} onClick={()=>deleteAnnouncement(ann.id)}>🗑</button>
                      </div>
                    </div>
                    <p style={cps}>{ann.content}</p>
                    <p style={{ ...cps, color:'#aaa' }}>Posted: {new Date(ann.created_at).toLocaleDateString()}</p>
                    <button style={{ ...btnBlack, width:'auto', padding:'6px 12px', marginTop:'8px', fontSize:'12px' }} onClick={()=>loadAnnouncementViews(ann.id)}>👁 VIEW WHO HASN'T SEEN THIS</button>
                    {announcementViews.length>0 && (
                      <div style={{ marginTop:'10px', background:'white', borderRadius:'8px', padding:'10px', border:'1px solid #ddd' }}>
                        <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 8px' }}>Announcement View Status:</p>
                        {announcementViews.map(v=>(
                          <div key={v.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f0f0f0' }}>
                            <span style={{ fontSize:'13px' }}>{v.full_name} ({v.employee_code})</span>
                            <Badge label={v.viewed?'✅ Viewed':'🔔 Not Viewed'} color={v.viewed?'green':'red'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab==='leaveRequests' && (
              <div>
                <h2 style={h2s}>Leave Requests</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={loadLeaveRequests}>REFRESH</button>
                {leaveRequests.length===0 && <p style={{ color:'#888' }}>No pending leave requests.</p>}
                {leaveRequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{req.employee_name}</strong>
                    <p style={cps}>Code: {req.employee_code}</p>
                    <p style={cps}>Leave: {req.leave_start} to {req.leave_end} ({req.duration_days} day(s))</p>
                    <p style={cps}>Type: {req.leave_type} | Reason: <em>"{req.reason}"</em></p>
                    <p style={{ fontWeight:'bold', color:'#f5a623', margin:'4px 0' }}>Status: {req.status}</p>
                    <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>updateLeaveStatus(req.id,'approved','')}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>setShowLeaveDisapproveBox(p=>({...p,[req.id]:!p[req.id]}))}>❌ DISAPPROVE</button>
                    </div>
                    {showLeaveDisapproveBox[req.id] && (
                      <div style={{ marginTop:'10px' }}>
                        <textarea placeholder="Reason for disapproval (required)..." value={leaveDisapproveReason[req.id]||''} onChange={e=>setLeaveDisapproveReason(p=>({...p,[req.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>{ const r=leaveDisapproveReason[req.id]; if(!r){alert('Please enter a reason.');return;} updateLeaveStatus(req.id,'disapproved',r); setShowLeaveDisapproveBox(p=>({...p,[req.id]:false})) }}>CONFIRM DISAPPROVE</button>
                      </div>
                    )}
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop:'20px' }} onClick={async()=>{ await loadResolvedLeaves(); setShowResolvedLeaves(!showResolvedLeaves) }}>
                  {showResolvedLeaves?'🔼 HIDE':'🔽 VIEW'} APPROVED / REJECTED LEAVES
                </button>
                {showResolvedLeaves && resolvedLeaves.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'1px solid #ccc', marginTop:'8px' }}>
                    <strong>{req.employee_name}</strong>
                    <p style={cps}>{req.leave_start} to {req.leave_end} | {req.leave_type}</p>
                    <p style={cps}>Reason: {req.reason}</p>
                    {req.admin_reason && <p style={cps}>Admin Reason: <em>"{req.admin_reason}"</em></p>}
                    <p style={{ fontWeight:'bold', color:req.status==='approved'?'green':'red', margin:'4px 0' }}>Status: {req.status}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='cashRequests' && (
              <div>
                <h2 style={h2s}>Cash Advance Requests</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={loadCashAdvanceRequests}>REFRESH</button>
                {cashAdvanceRequests.length===0 && <p style={{ color:'#888' }}>No pending requests.</p>}
                {cashAdvanceRequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{req.employee_name}</strong>
                    <p style={cps}>Code: {req.employee_code} | Reason: <em>"{req.reason}"</em></p>
                    <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'17px', margin:'6px 0' }}>Amount: {php(req.amount)}</p>
                    <label style={lblS}>Number of Payroll Deductions:</label>
                    <input type="number" min="1" max="24" value={installmentCounts[req.id]||1}
                      onChange={e=>{ const v=parseInt(e.target.value)||1; setInstallmentCounts(p=>({...p,[req.id]:Math.max(1,v)})) }}
                      style={{ ...inputStyle, marginBottom:'4px' }} />
                    <p style={{ color:'#888', fontSize:'12px', marginBottom:'10px' }}>{php(Number(req.amount)/Math.max(1,installmentCounts[req.id]||1))} per payroll cutoff</p>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>updateCashAdvanceStatus(req.id,'approved')}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>setShowCADisapproveBox(p=>({...p,[req.id]:!p[req.id]}))}>❌ DISAPPROVE</button>
                    </div>
                    {showCADisapproveBox[req.id] && (
                      <div style={{ marginTop:'10px' }}>
                        <textarea placeholder="Reason for disapproval (required)..." value={caDisapproveReason[req.id]||''} onChange={e=>setCaDisapproveReason(p=>({...p,[req.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={()=>updateCashAdvanceStatus(req.id,'disapproved')}>CONFIRM DISAPPROVE</button>
                      </div>
                    )}
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop:'20px' }} onClick={async()=>{ await loadResolvedCARequests(); setShowResolvedCA(!showResolvedCA) }}>
                  {showResolvedCA?'🔼 HIDE':'🔽 VIEW'} RESOLVED REQUESTS
                </button>
                {showResolvedCA && resolvedCARequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'1px solid #ccc', marginTop:'8px' }}>
                    <strong>{req.employee_name}</strong>
                    <p style={cps}>Amount: {php(req.amount)} | Reason: {req.reason}</p>
                    {req.admin_reason && <p style={cps}>Admin Reason: <em>"{req.admin_reason}"</em></p>}
                    <p style={{ fontWeight:'bold', color:req.status==='approved'?'green':'red', margin:'4px 0' }}>Status: {req.status}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab==='disputes' && (
              <div>
                <h2 style={h2s}>Payslip Disputes</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={loadPayslipDisputes}>REFRESH</button>
                {payslipDisputes.length===0 && <p style={{ color:'#888' }}>No pending disputes.</p>}
                {payslipDisputes.map(d=>(
                  <div key={d.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{d.employee_name}</strong>
                    <p style={cps}>Cutoff: {d.payroll_start} to {d.payroll_end}</p>
                    <p style={cps}>Employee Reason: <em>"{d.reason}"</em></p>
                    <p style={cps}>Filed: {new Date(d.created_at).toLocaleDateString()}</p>
                    <label style={lblS}>Admin Response (required to resolve):</label>
                    <textarea placeholder="Enter your response or resolution..." value={disputeAdminReason[d.id]||''} onChange={e=>setDisputeAdminReason(p=>({...p,[d.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                    <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:'8px' }} onClick={()=>resolveDispute(d.id)}>✅ MARK AS RESOLVED</button>
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop:'20px' }} onClick={async()=>{ await loadResolvedDisputes(); setShowResolvedDisputes(!showResolvedDisputes) }}>
                  {showResolvedDisputes?'🔼 HIDE':'🔽 VIEW'} RESOLVED DISPUTES
                </button>
                {showResolvedDisputes && resolvedDisputes.map(d=>(
                  <div key={d.id} style={{ ...cardS, border:'1px solid #ccc', marginTop:'8px' }}>
                    <strong>{d.employee_name}</strong>
                    <p style={cps}>Cutoff: {d.payroll_start} to {d.payroll_end}</p>
                    <p style={cps}>Reason: {d.reason}</p>
                    {d.admin_reason && <p style={cps}>Admin Response: <em>"{d.admin_reason}"</em></p>}
                    <p style={{ fontWeight:'bold', color:'green', margin:'4px 0' }}>Status: resolved</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ── Employee Portal Render ───────────────────────────────────────────────
  if (employee) {
    const onBreak = todayBreaks.length > 0 && !todayBreaks[todayBreaks.length-1]?.break_in
    const totalBreakMins = todayBreaks.reduce((s,b)=>s+Number(b.break_minutes||0),0)

    return (
      <div style={pageStyle}>
        {showAnnouncementPopup && pendingAnnouncement && (
          <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div style={{ background:'white', borderRadius:'16px', padding:'24px', maxWidth:'400px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <span style={{ fontSize:'32px' }}>📢</span>
                <h2 style={{ color:'#ca1b1b', margin:'8px 0 4px' }}>Announcement</h2>
              </div>
              <h3 style={{ color:'#333', margin:'0 0 8px' }}>{pendingAnnouncement.title}</h3>
              <p style={{ color:'#555', fontSize:'14px', lineHeight:'1.5' }}>{pendingAnnouncement.content}</p>
              <button style={{ ...btnRed, marginTop:'16px' }} onClick={()=>markAnnouncementViewed(pendingAnnouncement)}>✅ I'VE READ THIS</button>
            </div>
          </div>
        )}

        <div style={{ ...cardStyle, width:isMobile?'100%':'420px', maxWidth:'100%', margin:isMobile?'0':'auto', borderRadius:isMobile?'0':'20px', minHeight:isMobile?'100vh':'auto', textAlign:'left' }}>
          <div style={{ textAlign:'center', marginBottom:'12px' }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              {profilePhotoUrl ?
                <img src={profilePhotoUrl} alt="Profile" style={{ width:'80px', height:'80px', borderRadius:'50%', objectFit:'cover', border:'3px solid #ca1b1b' }} /> :
                <div style={{ width:'80px', height:'80px', borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', border:'3px solid #ca1b1b', margin:'0 auto' }}>👤</div>
              }
              <label style={{ position:'absolute', bottom:0, right:0, background:'#ca1b1b', color:'white', borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'12px' }}>
                📷<input type="file" accept="image/*" onChange={handleProfilePhotoUpload} style={{ display:'none' }} />
              </label>
            </div>
            {uploadingPhoto && <p style={{ color:'#888', fontSize:'12px', margin:'4px 0' }}>Uploading...</p>}
            <h2 style={{ fontSize:isMobile?'20px':'24px', fontWeight:'bold', color:'#ca1b1b', margin:'8px 0 2px' }}>{employee.full_name}</h2>
            <p style={{ color:'#888', margin:'0 0 4px', fontSize:'13px' }}>{employee.position} — {employee.employee_code}</p>
          </div>

          {geoStatus && <p style={{ color:'#f5a623', textAlign:'center', fontWeight:'bold', fontSize:'13px', margin:'0 0 8px' }}>{geoStatus}</p>}

          <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'12px', marginBottom:'12px' }}>
            <p style={{ margin:'3px 0', fontSize:'13px' }}>📅 Shift: {todaySchedule?`${todaySchedule.shift_start} – ${todaySchedule.shift_end}`:'No Assigned Shift'}</p>
            <p style={{ margin:'3px 0', fontSize:'13px' }}>🟢 In: <strong>{todayLog?.time_in||'Not yet'}</strong> &nbsp; 🔴 Out: <strong>{todayLog?.time_out||'Not yet'}</strong></p>
            <p style={{ margin:'3px 0', fontSize:'13px' }}>
              ☕ Break: <strong>{totalBreakMins} min used</strong>
              {onBreak && <span style={{ color:'#f5a623', fontWeight:'bold', marginLeft:'6px' }}>● Currently on break</span>}
              {!onBreak && totalBreakMins > 0 && totalBreakMins <= 60 && <span style={{ color:'#2d8a4e', marginLeft:'6px' }}>✅ Within limit</span>}
              {totalBreakMins > 60 && <span style={{ color:'#ca1b1b', fontWeight:'bold', marginLeft:'6px' }}>⚠️ Exceeded 60 min limit</span>}
            </p>
            {todayBreaks.length > 0 && (
              <div style={{ marginTop:'4px' }}>
                {todayBreaks.map((b, i) => (
                  <p key={b.id} style={{ margin:'2px 0', fontSize:'12px', color:'#888' }}>
                    Break {i+1}: {b.break_out} {b.break_in ? `→ ${b.break_in} (${b.break_minutes} min)` : '→ ongoing'}
                  </p>
                ))}
              </div>
            )}
            <p style={{ margin:'3px 0', fontSize:'13px' }}>📌 Status: <strong>{todayLog?.status||'No record yet'}</strong></p>
            {(todayLog?.selfie_in_url||todayLog?.selfie_out_url) && (
              <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                {todayLog?.selfie_in_url && <img src={todayLog.selfie_in_url} alt="IN" style={{ width:'50px', height:'50px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2d8a4e' }} />}
                {todayLog?.selfie_out_url && <img src={todayLog.selfie_out_url} alt="OUT" style={{ width:'50px', height:'50px', objectFit:'cover', borderRadius:'8px', border:'2px solid #ca1b1b' }} />}
              </div>
            )}
          </div>

          <div style={{ background:'#e8f5e9', borderRadius:'10px', padding:'8px 14px', marginBottom:'12px', display:'flex', gap:'20px', justifyContent:'center' }}>
            <div style={{ textAlign:'center' }}><p style={{ fontSize:'11px', color:'#888', margin:'0 0 2px' }}>Sick Leave</p><p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'16px', margin:0 }}>{myLeaveBalance.sick} days</p></div>
            <div style={{ textAlign:'center' }}><p style={{ fontSize:'11px', color:'#888', margin:'0 0 2px' }}>Vacation Leave</p><p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'16px', margin:0 }}>{myLeaveBalance.vacation} days</p></div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'4px' }}>
            <button style={{ ...btnGreen, margin:0, opacity:todayLog?0.5:1, fontSize:'13px', textAlign:'center' }} onClick={initiateTimeIn} disabled={loading||!!todayLog}>⏰ TIME IN</button>
            <button style={{ ...btnBlack, margin:0, opacity:(!todayLog||todayLog?.time_out)?0.5:1, fontSize:'13px', textAlign:'center' }} onClick={initiateTimeOut} disabled={loading||!todayLog||!!todayLog?.time_out}>⏰ TIME OUT</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'4px' }}>
            <button style={{ background:onBreak?'#f5a623':'#4a90d9', color:'white', padding:'11px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', opacity:(!todayLog||todayLog?.time_out)?0.5:1 }} onClick={onBreak?initiateBreakIn:initiateBreakOut} disabled={!todayLog||!!todayLog?.time_out}>
              {onBreak?'☕ BREAK IN — End Break':'☕ BREAK OUT — Start Break'}
            </button>
            <button style={{ background:'#8b5cf6', color:'white', padding:'11px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', opacity:(!todayLog||!todayLog?.time_out)?0.5:1 }} onClick={()=>{ closeAllPanels(); setShowOTRequest(!showOTRequest) }} disabled={!todayLog||!todayLog?.time_out}>
              📝 FILE OT/UT
            </button>
          </div>
          <p style={{ color:'#888', fontSize:'11px', textAlign:'center', margin:'4px 0 8px' }}>📸 Selfie required for Time In/Out | 📍 Must be at store location</p>

          {showOTRequest && (
            <div style={{ marginTop:'10px', background:'#f9f9f9', padding:'14px', borderRadius:'12px', border:'1px solid #ddd', marginBottom:'8px' }}>
              <h3 style={{ color:'#8b5cf6', margin:'0 0 10px', fontSize:'14px' }}>📝 File Overtime / Undertime Request</h3>
              <label style={lblS}>Request Type:</label>
              <select value={otRequestType} onChange={e=>setOtRequestType(e.target.value)} style={inputStyle}>
                <option value="overtime">Overtime</option>
                <option value="undertime">Undertime</option>
              </select>
              <label style={lblS}>Minutes:</label>
              <input type="number" placeholder="Number of minutes" value={otRequestMinutes} onChange={e=>setOtRequestMinutes(e.target.value)} style={inputStyle} />
              <label style={lblS}>Reason:</label>
              <textarea placeholder="Explain why you had overtime/undertime..." value={otRequestReason} onChange={e=>setOtRequestReason(e.target.value)} style={{ ...inputStyle, minHeight:'70px', resize:'none' }} />
              <button style={{ background:'#8b5cf6', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }} onClick={submitTimeAdjRequest}>SUBMIT REQUEST</button>
            </div>
          )}

          <button style={{ ...btnRed, background:'#ca1b1b', textAlign:'center' }} onClick={()=>{ closeAllPanels(); setShowLeaveRequest(!showLeaveRequest) }}>🏖️ FILE LEAVE REQUEST</button>
          {showLeaveRequest && (
            <div style={{ marginTop:'10px', background:'#f9f9f9', padding:'14px', borderRadius:'12px', border:'1px solid #ddd' }}>
              <input type="date" value={leaveStartDate} min={new Date(Date.now()+3*24*60*60*1000).toISOString().split('T')[0]} onChange={e=>setLeaveStartDate(e.target.value)} style={inputStyle} />
              <input type="date" value={leaveEndDate} onChange={e=>setLeaveEndDate(e.target.value)} style={inputStyle} />
              {leaveStartDate&&leaveEndDate&&<p style={{ color:'#ca1b1b', fontWeight:'bold', marginBottom:'8px', fontSize:'13px' }}>Duration: {Math.ceil((new Date(leaveEndDate)-new Date(leaveStartDate))/(1000*60*60*24))+1} day(s)</p>}
              <select value={leaveType} onChange={e=>setLeaveType(e.target.value)} style={inputStyle}>
                <option value="">Select Leave Type</option>
                <option value="Sick Leave">Sick Leave ({myLeaveBalance.sick} days left)</option>
                <option value="Vacation Leave">Vacation Leave ({myLeaveBalance.vacation} days left)</option>
                <option value="Emergency Leave">Emergency Leave</option>
              </select>
              <textarea placeholder="Reason for leave..." value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} style={{ ...inputStyle, minHeight:'70px', resize:'none' }} />
              <button style={btnGreen} onClick={submitLeaveRequest}>SUBMIT LEAVE REQUEST</button>
            </div>
          )}

          <button style={{ background:'#f5a623', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', textAlign:'center' }} onClick={()=>{ closeAllPanels(); setShowCashAdvanceRequest(!showCashAdvanceRequest) }}>💵 REQUEST CASH ADVANCE</button>
          {showCashAdvanceRequest && (
            <div style={{ marginTop:'10px', background:'#f9f9f9', padding:'14px', borderRadius:'12px', border:'1px solid #ddd' }}>
              <p style={{ color:'#888', fontSize:'13px', margin:'0 0 10px' }}>Once approved, deducted from next payroll cutoff.</p>
              <input type="number" placeholder="Amount (PHP)" value={requestCashAmount} onChange={e=>setRequestCashAmount(e.target.value)} style={inputStyle} />
              <textarea placeholder="Reason..." value={requestCashReason} onChange={e=>setRequestCashReason(e.target.value)} style={{ ...inputStyle, minHeight:'70px', resize:'none' }} />
              <button style={btnGreen} onClick={submitCashAdvanceRequest}>SUBMIT REQUEST</button>
            </div>
          )}

          <button style={{ background:'#f5a623', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', textAlign:'center' }} onClick={()=>{ closeAllPanels(); setShowCashAdvances(!showCashAdvances) }}>
            {showCashAdvances?'🔼 HIDE MY CASH ADVANCES':'🔽 VIEW MY CASH ADVANCES'}
          </button>
          {showCashAdvances && (
            <div style={{ marginTop:'10px' }}>
              {myCashAdvances.length===0&&<p style={{ color:'#888', fontSize:'13px' }}>No cash advance requests found.</p>}
              {myCashAdvances.map(ca=>(
                <div key={ca.id} style={cardS}>
                  <p style={cps}><strong>Amount:</strong> {php(ca.amount)}</p>
                  <p style={cps}><strong>Reason:</strong> {ca.reason}</p>
                  {ca.admin_reason && <p style={{ ...cps, color:'#ca1b1b' }}><strong>Admin Reason:</strong> {ca.admin_reason}</p>}
                  <Badge label={ca.status} color={ca.status==='approved'?'green':ca.status==='pending'?'orange':'red'} />
                </div>
              ))}
            </div>
          )}

          <button style={{ background:'#4a90d9', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', textAlign:'center' }} onClick={()=>{ closeAllPanels(); setShowMyAttendance(!showMyAttendance) }}>
            {showMyAttendance?'🔼 HIDE ATTENDANCE HISTORY':'🔽 VIEW MY ATTENDANCE HISTORY'}
          </button>
          {showMyAttendance && (
            <div style={{ marginTop:'10px' }}>
              {myAttendance.length===0&&<p style={{ color:'#888', fontSize:'13px' }}>No attendance records found.</p>}
              {myAttendance.map(log=>(
                <div key={log.id} style={{ ...cardS, borderLeft:`4px solid ${log.status==='Absent'?'#ca1b1b':log.status==='Late'?'#f5a623':'#2d8a4e'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <strong style={{ fontSize:'13px' }}>{log.attendance_date}</strong>
                    <Badge label={log.status||'—'} color={log.status==='Absent'?'red':log.status==='Late'?'orange':'green'} />
                  </div>
                  {log.time_in&&<p style={cps}>In: {log.time_in} | Out: {log.time_out||'—'} | Break: {log.total_break_minutes||0}min</p>}
                  {log.late_minutes>0&&<p style={{ ...cps, color:'#f5a623' }}>Late: {log.late_minutes} min</p>}
                  {log.overtime_minutes>0&&<p style={{ ...cps, color:'#2d8a4e' }}>OT: {log.overtime_minutes} min {log.overtime_approved?'✅ Approved':'⏳ Pending'}</p>}
                </div>
              ))}
            </div>
          )}

          {employee?.is_admin&&<button style={{ ...btnBlack, background:'#333', textAlign:'center' }} onClick={openAdmin}>🔧 ADMIN PANEL</button>}

          <button style={{ ...btnBlack, background:'#222', textAlign:'center' }} onClick={()=>{ closeAllPanels(); setShowPayslips(!showPayslips) }}>
            {showPayslips?'🔼 HIDE PAYSLIPS':'🔽 VIEW MY PAYSLIPS'}
          </button>
          {showPayslips && (
            <div style={{ marginTop:'10px' }}>
              {myPayslips.length===0&&<p style={{ color:'#888', fontSize:'13px' }}>No payslips found.</p>}
              {myPayslips.map(pay=>(
                <div key={pay.id} style={cardS}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px', marginBottom:'6px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>Payslip</h3>
                    {pay.payslip_serial&&<span style={{ fontSize:'11px', color:'#aaa', fontFamily:'monospace' }}>{pay.payslip_serial}</span>}
                    {pay.employee_acknowledgement==='agreed'&&<Badge label="✅ Agreed" color="green" />}
                    {pay.employee_acknowledgement==='disputed'&&<Badge label="⚠️ Disputed" color="red" />}
                    {(pay.employee_acknowledgement==='pending'||!pay.employee_acknowledgement)&&<Badge label="🔔 Pending Review" color="orange" />}
                  </div>
                  <p style={cps}>Period: {pay.payroll_start} to {pay.payroll_end}</p>
                  <p style={cps}>Basic Pay: {php(pay.basic_pay)} | Earnings: {php(pay.total_earnings)}</p>
                  <p style={cps}>Deductions: {php(pay.total_deductions)}</p>
                  <h3 style={{ color:'#ca1b1b', margin:'6px 0' }}>Net Pay: {php(pay.net_pay)}</h3>
                  {(pay.employee_acknowledgement==='pending'||!pay.employee_acknowledgement)&&(
                    <div style={{ marginTop:'10px' }}>
                      <p style={{ color:'#888', fontSize:'13px', margin:'0 0 8px' }}>Please review and confirm this payslip.</p>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'13px' }} onClick={()=>agreePayslip(pay.id)}>✅ AGREE</button>
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'13px' }} onClick={()=>setShowDisputeBox(p=>({...p,[pay.id]:!p[pay.id]}))}>❌ DISAGREE</button>
                      </div>
                      {showDisputeBox[pay.id]&&(
                        <div style={{ marginTop:'10px' }}>
                          <textarea placeholder="Please explain why you disagree..." value={disputeReasons[pay.id]||''} onChange={e=>setDisputeReasons(p=>({...p,[pay.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'70px', resize:'none' }} />
                          <button style={btnRed} onClick={()=>submitPayslipDispute(pay)}>SUBMIT DISPUTE</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button style={{ ...btnRed, marginTop:'20px', background:'#888', textAlign:'center' }} onClick={logout}>🚪 LOGOUT</button>
        </div>
      </div>
    )
  }

  // ── Login Screen ──────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, width:isMobile?'95%':'400px' }}>
        <img src="/logo.png" alt="Logo" style={logoStyle} />
        <h1 style={{ color:'#ca1b1b', margin:'0 0 4px', fontSize:isMobile?'22px':'26px', textAlign:'center' }}>Roma's Donuts</h1>
        <p style={{ color:'#888', margin:'0 0 20px', fontSize:'13px', textAlign:'center' }}>Payroll & Attendance System</p>
        <input placeholder="Employee ID" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)} style={inputStyle} />
        <input placeholder="PIN" type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} style={inputStyle} />
        <button style={btnRed} onClick={login} disabled={loading}>{loading?'PLEASE WAIT...':'LOGIN'}</button>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const pageStyle = { minHeight:'100vh', width:'100vw', background:'linear-gradient(135deg,#ca1b1b,#fdd412)', display:'flex', justifyContent:'center', alignItems:'flex-start', padding:'20px', boxSizing:'border-box' }
const cardStyle = { background:'white', padding:'22px', borderRadius:'20px', boxShadow:'0 10px 30px rgba(0,0,0,0.2)', width:'100%' }
const logoStyle = { width:'80px', height:'80px', objectFit:'contain', display:'block', margin:'0 auto 8px' }
const inputStyle = { width:'100%', padding:'12px', marginBottom:'12px', borderRadius:'10px', border:'1px solid #ddd', boxSizing:'border-box', fontSize:'14px' }
const cardS = { border:'1px solid #eee', padding:'12px', borderRadius:'12px', marginBottom:'10px', background:'#fafafa' }
const cps = { margin:'3px 0', color:'#555', fontSize:'13px' }
const h2s = { color:'#ca1b1b', marginTop:0, marginBottom:'15px' }
const lblS = { display:'block', marginBottom:'4px', fontWeight:'bold', color:'#555', fontSize:'13px' }
const btnRed = { width:'100%', padding:'13px', borderRadius:'10px', border:'none', background:'#ca1b1b', color:'white', fontWeight:'bold', cursor:'pointer', marginTop:'8px', fontSize:'14px' }
const btnGreen = { ...btnRed, background:'#2d8a4e' }
const btnBlack = { ...btnRed, background:'#222' }
const btnGray = { ...btnRed, background:'#777' }
const btnYellow = { ...btnRed, background:'#f5c518', color:'#222', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'13px' }
