import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hebbunlnzklavkkugtzs.supabase.co'
const supabaseKey = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYmJ1bmxuemtsYXZra3VndHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTU5MDgsImV4cCI6MjA5NDU5MTkwOH0.mdgYJBoRvHQcf-Tn-1AbTN-rnB5pPxOCSTxGlUrgJpg`
const supabase = createClient(supabaseUrl, supabaseKey)

const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
const STORE_LAT = 15.4755
const STORE_LNG = 120.5963
const STORE_RADIUS_METERS = 200
const ALLOWED_BREAK_MINUTES = 60

// ── Styles (must be at top level, NOT inside function) ────────────────────────
const pageStyle = { position:'fixed', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg,#ca1b1b,#fdd412)', display:'flex', justifyContent:'center', alignItems:'center', padding:'20px', boxSizing:'border-box', overflowY:'auto' }
const cardStyle = { background:'white', padding:'24px', borderRadius:'20px', boxShadow:'0 10px 30px rgba(0,0,0,0.2)', width:'100%', boxSizing:'border-box' }
const logoStyle = { width:'80px', height:'80px', objectFit:'contain', display:'block', margin:'0 auto 8px' }
const inputStyle = { width:'100%', padding:'12px', marginBottom:'12px', borderRadius:'10px', border:'1px solid #ddd', boxSizing:'border-box', fontSize:'14px', background:'white', color:'#333' }
const cardS = { border:'1px solid #eee', padding:'12px', borderRadius:'12px', marginBottom:'10px', background:'#fafafa' }
const cps = { margin:'3px 0', color:'#555', fontSize:'13px' }
const h2s = { color:'#ca1b1b', marginTop:0, marginBottom:'15px' }
const lblS = { display:'block', marginBottom:'4px', fontWeight:'bold', color:'#555', fontSize:'13px' }
const btnRed = { width:'100%', padding:'13px', borderRadius:'10px', border:'none', background:'#ca1b1b', color:'white', fontWeight:'bold', cursor:'pointer', marginTop:'8px', fontSize:'14px' }
const btnGreen = { ...btnRed, background:'#2d8a4e' }
const btnBlack = { ...btnRed, background:'#222' }
const btnGray = { ...btnRed, background:'#777' }
const btnYellow = { ...btnRed, background:'#f5c518', color:'#222', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'13px' }

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return <span style={{ background:colors[color]||colors.gray, color:color==='yellow'?'#333':'white', padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold' }}>{label}</span>
}

function EmployeeSelect({ value, onChange, employees }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">Select employee</option>
      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.employee_code}</option>)}
    </select>
  )
}

// ── Print helpers (outside App so they have no stale closure issues) ──────────
function buildPayslipHTML(pay, payrollStart, payrollEnd, idx) {
  return `
    <div class="payslip-wrap">
      <div style="width:145mm;min-height:210mm;padding:8mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000;background:white;">
        <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #ca1b1b;padding-bottom:8px;">
          <div style="font-size:20px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
          <div style="font-size:10px;color:#666;">Payroll &amp; Attendance System</div>
          <div style="font-size:13px;font-weight:bold;margin-top:4px;">EMPLOYEE PAYSLIP</div>
          <div style="font-size:10px;margin-top:2px;">Serial No: ${genSerial(payrollStart, idx)}</div>
          <div style="font-size:10px;color:#666;">Period: ${payrollStart} to ${payrollEnd}</div>
        </div>
        <div style="background:#fff8dc;border:2px solid #ca1b1b;border-radius:6px;padding:8px;margin-bottom:10px;">
          <div style="font-size:15px;font-weight:bold;color:#ca1b1b;">${pay.employeeName}</div>
          <div style="font-size:12px;font-weight:bold;color:#555;">${pay.position||''}</div>
          <div style="font-size:10px;color:#888;">Code: ${pay.employeeCode} | Worked: ${pay.workedDays} day(s) | Absent: ${pay.absentDays} day(s)</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
          <tr style="background:#ca1b1b;color:white;">
            <th style="padding:5px 8px;text-align:left;font-size:10px;">Description</th>
            <th style="padding:5px 8px;text-align:right;font-size:10px;">Amount</th>
          </tr>
          <tr style="background:#f0fff0;"><td colspan="2" style="padding:4px 8px;font-weight:bold;color:#2d8a4e;font-size:10px;">EARNINGS</td></tr>
          <tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Basic Pay</td><td style="padding:3px 8px;text-align:right;font-size:10px;">${php(pay.basicPay)}</td></tr>
          ${pay.overtimePay>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Overtime Pay</td><td style="padding:3px 8px;text-align:right;">${php(pay.overtimePay)}</td></tr>`:''}
          ${pay.nightDiffPay>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Night Differential</td><td style="padding:3px 8px;text-align:right;">${php(pay.nightDiffPay)}</td></tr>`:''}
          ${pay.holidayPay>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Holiday Pay</td><td style="padding:3px 8px;text-align:right;">${php(pay.holidayPay)}</td></tr>`:''}
          ${pay.adjustmentEarnings>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Bonus / Other</td><td style="padding:3px 8px;text-align:right;">${php(pay.adjustmentEarnings)}</td></tr>`:''}
          <tr style="background:#e8f5e9;font-weight:bold;"><td style="padding:4px 8px;font-size:10px;">Total Earnings</td><td style="padding:4px 8px;text-align:right;">${php(pay.totalEarnings)}</td></tr>
          <tr style="background:#fff0f0;"><td colspan="2" style="padding:4px 8px;font-weight:bold;color:#ca1b1b;font-size:10px;">DEDUCTIONS</td></tr>
          ${pay.lateDeduction>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Late (${pay.lateMinutes} min)</td><td style="padding:3px 8px;text-align:right;">${php(pay.lateDeduction)}</td></tr>`:''}
          ${pay.undertimeDeduction>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Undertime (${pay.undertimeMinutes} min)</td><td style="padding:3px 8px;text-align:right;">${php(pay.undertimeDeduction)}</td></tr>`:''}
          ${(pay.excessBreakDeduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Excess Break</td><td style="padding:3px 8px;text-align:right;">${php(pay.excessBreakDeduction)}</td></tr>`:''}
          ${pay.cashAdvanceDeduction>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Cash Advance</td><td style="padding:3px 8px;text-align:right;">${php(pay.cashAdvanceDeduction)}</td></tr>`:''}
          ${pay.sssDeduction>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">SSS</td><td style="padding:3px 8px;text-align:right;">${php(pay.sssDeduction)}</td></tr>`:''}
          ${pay.pagibigDeduction>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Pag-IBIG</td><td style="padding:3px 8px;text-align:right;">${php(pay.pagibigDeduction)}</td></tr>`:''}
          ${pay.philhealthDeduction>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">PhilHealth</td><td style="padding:3px 8px;text-align:right;">${php(pay.philhealthDeduction)}</td></tr>`:''}
          ${pay.adjustmentDeductions>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Other Deductions</td><td style="padding:3px 8px;text-align:right;">${php(pay.adjustmentDeductions)}</td></tr>`:''}
          <tr style="background:#ffe8e8;font-weight:bold;"><td style="padding:4px 8px;font-size:10px;">Total Deductions</td><td style="padding:4px 8px;text-align:right;">${php(pay.totalDeductions)}</td></tr>
        </table>
        <div style="background:#ca1b1b;color:white;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:bold;font-size:13px;">NET PAY</span>
          <span style="font-weight:bold;font-size:17px;">${php(pay.netPay)}</span>
        </div>
        <div style="margin-top:25px;display:flex;justify-content:space-between;">
          <div style="text-align:center;"><div style="border-top:1px solid #000;width:110px;padding-top:4px;font-size:9px;">Employee Signature</div></div>
          <div style="text-align:center;"><div style="border-top:1px solid #000;width:110px;padding-top:4px;font-size:9px;">Authorized Signature</div></div>
        </div>
        <div style="text-align:center;font-size:9px;color:#999;margin-top:8px;">${genSerial(payrollStart,idx)}</div>
      </div>
    </div>`
}

const printCSS = `
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#e0e0e0;display:flex;flex-direction:column;align-items:center;padding:16px 0;}
    .payslip-wrap{background:white;width:145mm;margin:10px auto;box-shadow:0 2px 8px rgba(0,0,0,0.2);}
    @media print{
      @page{size:145mm 210mm;margin:0;}
      body{background:white;display:block;padding:0;}
      .payslip-wrap{box-shadow:none;margin:0;page-break-after:always;}
    }
  </style>`

export default function App() {
  const today = getTodayDate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [employeeCode, setEmployeeCode] = useState('')
  const [pin, setPin] = useState('')
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineQueue, setOfflineQueue] = useState([])
  const [syncingOffline, setSyncingOffline] = useState(false)
  const [cameraMode, setCameraMode] = useState(null)
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [geoStatus, setGeoStatus] = useState('')
  const [pendingAnnouncement, setPendingAnnouncement] = useState(null)
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false)
  const [todayLog, setTodayLog] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState(null)
  const [todayBreaks, setTodayBreaks] = useState([])
  const [myPayslips, setMyPayslips] = useState([])
  const [myAttendance, setMyAttendance] = useState([])
  const [myCashAdvances, setMyCashAdvances] = useState([])
  const [myActiveCAs, setMyActiveCAs] = useState([])
  const [myCAHistory, setMyCAHistory] = useState([])
  const [showCAHistory, setShowCAHistory] = useState(false)
  const [myLeaveBalance, setMyLeaveBalance] = useState({ sick:5, vacation:5 })
  const [showLeaveRequest, setShowLeaveRequest] = useState(false)
  const [showMyLeaves, setShowMyLeaves] = useState(false)
  const [myLeaves, setMyLeaves] = useState([])
  const [myLeavesLoading, setMyLeavesLoading] = useState(false)
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
  // Reason dropdown presets
  const [requestCashReasonPreset, setRequestCashReasonPreset] = useState('')
  const [otRequestReasonPreset, setOtRequestReasonPreset] = useState('')
  const [disputeReasonPresets, setDisputeReasonPresets] = useState({})
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showOTRequest, setShowOTRequest] = useState(false)
  const [otRequestType, setOtRequestType] = useState('overtime')
  const [otRequestReason, setOtRequestReason] = useState('')
  const [otRequestMinutes, setOtRequestMinutes] = useState('')
  const [otRequestDate, setOtRequestDate] = useState('')
  const [adminMode, setAdminMode] = useState(false)
  const [adminRole, setAdminRole] = useState(null) // 'owner'|'hr'|'payroll'|'supervisor'
  const [adminEmployee, setAdminEmployee] = useState(null) // employee record of the logged-in admin
  const [showAdminAttendance, setShowAdminAttendance] = useState(false) // modal toggle
  const [cameFromAdmin, setCameFromAdmin] = useState(false) // tracks if employee portal was opened from admin
  const [adminCredentials] = useState({
    owner:    { code:'ADMIN001', pin:'admin2024', role:'owner',    name:'Owner' },
    hr:       { code:'ADMIN002', pin:'hr2024',    role:'hr',       name:'HR Admin' },
    payroll:  { code:'ADMIN003', pin:'pay2024',   role:'payroll',  name:'Payroll Officer' },
    supervisor:{ code:'ADMIN004', pin:'sup2024',  role:'supervisor',name:'Supervisor' },
  })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [employees, setEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [showDeactivated, setShowDeactivated] = useState(false)
  const [deactivatedEmployees, setDeactivatedEmployees] = useState([])
  const [payrollSearch, setPayrollSearch] = useState('')
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [saveEmployeeLoading, setSaveEmployeeLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [toast, setToast] = useState(null)
  // Audit trail
  const [auditLogs, setAuditLogs] = useState([])
  const [auditSearch, setAuditSearch] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  // Payroll approval
  const [payrollApprovalStatus, setPayrollApprovalStatus] = useState(null)
  const [payrollApproved, setPayrollApproved] = useState(false)
  // Employee self-view
  const [showMyProfile, setShowMyProfile] = useState(false)
  // Dashboard charts
  const [attendanceStats, setAttendanceStats] = useState([])
  const [payrollCostStats, setPayrollCostStats] = useState([])
  // LWOP tracking
  const [lwopDays, setLwopDays] = useState(0)
  // Department locations
  const [departmentLocations, setDepartmentLocations] = useState({})
  const [showDeptLocations, setShowDeptLocations] = useState(false)
  // 13th month details
  const [thirteenthDetails, setThirteenthDetails] = useState([])
  // Day off settings
  const [dayOffSettings, setDayOffSettings] = useState({})
  const [showDayOffSettings, setShowDayOffSettings] = useState(false)
  // Break limits
  const [breakUsedToday, setBreakUsedToday] = useState(false)
  const [breakTimerSeconds, setBreakTimerSeconds] = useState(0)
  const [breakTimerInterval, setBreakTimerInterval] = useState(null)
  const [editFields, setEditFields] = useState({})
  const [newEmpFields, setNewEmpFields] = useState({ code:'', name:'', position:'', pin:'', rate:'', hire_date:today, sick:0, vacation:0, sil:0, hasSss:false, hasPagibig:false, hasPhilhealth:false, payType:'daily', hourlyRate:0, gracePeriod:10, dob:'', gender:'', civil_status:'', address:'', contact:'', emergency_name:'', emergency_contact:'', employment_type:'regular', department:'', sss_no:'', pagibig_no:'', philhealth_no:'', tin_no:'', work_location:'', location_lat:'', location_lng:'', location_radius:'', bank_name:'', bank_account_number:'', bank_account_name:'' })
  const [finalPayEmployeeId, setFinalPayEmployeeId] = useState('')
  const [finalPayReason, setFinalPayReason] = useState('resigned')
  const [finalPayLastDate, setFinalPayLastDate] = useState(today)
  const [finalPayResult, setFinalPayResult] = useState(null)
  const [adminLogs, setAdminLogs] = useState([])
  const [adminDate, setAdminDate] = useState(today)
  const [absentEmployeeId, setAbsentEmployeeId] = useState('')
  const [absentDate, setAbsentDate] = useState(today)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [scheduleDate, setScheduleDate] = useState(today)
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [scheduleDuration, setScheduleDuration] = useState('1week')
  const [scheduleRepeat, setScheduleRepeat] = useState('all')
  const [bulkScheduleLoading, setBulkScheduleLoading] = useState(false)
  const [existingSchedules, setExistingSchedules] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [showResolvedLeaves, setShowResolvedLeaves] = useState(false)
  const [resolvedLeaves, setResolvedLeaves] = useState([])
  const [leaveDisapproveReason, setLeaveDisapproveReason] = useState({})
  const [showLeaveDisapproveBox, setShowLeaveDisapproveBox] = useState({})
  const [holidays, setHolidays] = useState([])
  const [newHolidayDate, setNewHolidayDate] = useState(today)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayType, setNewHolidayType] = useState('regular')
  const [timeAdjRequests, setTimeAdjRequests] = useState([])
  const [adjAdminReason, setAdjAdminReason] = useState({})
  const [cashAdvanceRequests, setCashAdvanceRequests] = useState([])
  const [installmentCounts, setInstallmentCounts] = useState({})
  const [showResolvedCA, setShowResolvedCA] = useState(false)
  const [resolvedCARequests, setResolvedCARequests] = useState([])
  const [caDisapproveReason, setCaDisapproveReason] = useState({})
  const [showCADisapproveBox, setShowCADisapproveBox] = useState({})
  const [payslipDisputes, setPayslipDisputes] = useState([])
  const [showResolvedDisputes, setShowResolvedDisputes] = useState(false)
  const [resolvedDisputes, setResolvedDisputes] = useState([])
  const [disputeAdminReason, setDisputeAdminReason] = useState({})
  const [processingItems, setProcessingItems] = useState({})
  const [adjustmentEmployeeId, setAdjustmentEmployeeId] = useState('')
  const [adjustmentDate, setAdjustmentDate] = useState(today)
  const [adjustmentType, setAdjustmentType] = useState('deduction')
  const [adjustmentCategory, setAdjustmentCategory] = useState('')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentNotes, setAdjustmentNotes] = useState('')
  // Contracts module
  const [contracts, setContracts] = useState([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [contractEmployeeId, setContractEmployeeId] = useState('')
  const [contractType, setContractType] = useState('regular')
  const [contractStart, setContractStart] = useState(today)
  const [contractEnd, setContractEnd] = useState('')
  const [contractFile, setContractFile] = useState(null)
  const [contractUploading, setContractUploading] = useState(false)
  const [contractSearch, setContractSearch] = useState('')
  const [viewingContract, setViewingContract] = useState(null)
  const [contractStorageType, setContractStorageType] = useState('digital')
  const [contractPhysicalLocation, setContractPhysicalLocation] = useState('')
  const [payrollStart, setPayrollStart] = useState(today)
  const [payrollEnd, setPayrollEnd] = useState(today)
  const [payrollMonth, setPayrollMonth] = useState(today.slice(0,7))
  const [payrollCutoff, setPayrollCutoff] = useState('11-25')
  const [payrollResults, setPayrollResults] = useState([])
  const [payrollSummary, setPayrollSummary] = useState(null)
  const [payrollComputing, setPayrollComputing] = useState(false)
  const [payrollHistory, setPayrollHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistoryPeriod, setSelectedHistoryPeriod] = useState(null)
  const [historyRecords, setHistoryRecords] = useState([])
  const [historySearch, setHistorySearch] = useState('')
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear().toString())
  const [remittancePeriod, setRemittancePeriod] = useState('')
  const [remittanceData, setRemittanceData] = useState(null)
  const [dtrEmployeeId, setDtrEmployeeId] = useState('')
  const [dtrMonth, setDtrMonth] = useState(today.slice(0,7))
  const [dtrRecords, setDtrRecords] = useState([])
  const [dtrStats, setDtrStats] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('')
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('')
  const [announcementViews, setAnnouncementViews] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [storeLocation, setStoreLocation] = useState({ lat: STORE_LAT, lng: STORE_LNG, radius: STORE_RADIUS_METERS })
  const [showLocationSetting, setShowLocationSetting] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')

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
    return () => stopCamera()
  }, [cameraMode])

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      showToast('✅ Back online! Syncing offline records...')
      syncOfflineQueue()
    }
    const goOffline = () => {
      setIsOnline(false)
      showToast('⚠️ You are offline. Time in/out will be queued.', 'red')
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  // Break timer - tick every second when on break
  useEffect(() => {
    if (todayBreaks.length > 0) {
      const openBreak = todayBreaks.find(b => !b.break_in)
      if (openBreak) {
        // Calculate seconds already elapsed
        const breakStartMins = minutesFromTime(openBreak.break_out)
        const nowMins = minutesFromTime(nowTime())
        const elapsed = Math.max(0, (nowMins - breakStartMins) * 60)
        setBreakTimerSeconds(elapsed)
        // Start ticking
        const interval = setInterval(() => {
          setBreakTimerSeconds(s => s + 1)
        }, 1000)
        setBreakTimerInterval(interval)
        return () => clearInterval(interval)
      } else {
        setBreakTimerSeconds(0)
        if (breakTimerInterval) { clearInterval(breakTimerInterval); setBreakTimerInterval(null) }
      }
    } else {
      setBreakTimerSeconds(0)
    }
  }, [todayBreaks])

  // ── Offline Queue ─────────────────────────────────────────────────────────
  async function syncOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem('offline_queue')||'[]')
    if (!queue.length) return
    setSyncingOffline(true)
    let synced = 0
    for (const item of queue) {
      try {
        if (item.type === 'timein') {
          const { data:existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', item.employee_id).eq('attendance_date', item.attendance_date).maybeSingle()
          if (!existing) {
            await supabase.from('attendance_logs').insert(item.data)
            synced++
          }
        } else if (item.type === 'timeout') {
          await supabase.from('attendance_logs').update(item.data).eq('id', item.log_id)
          synced++
        }
      } catch(e) { console.error('Sync error:', e) }
    }
    localStorage.setItem('offline_queue', '[]')
    setOfflineQueue([])
    setSyncingOffline(false)
    if (synced > 0) showToast(`✅ Synced ${synced} offline record(s)!`)
  }

  function queueOfflineAction(type, data) {
    const queue = JSON.parse(localStorage.getItem('offline_queue')||'[]')
    queue.push({ type, ...data, queued_at: new Date().toISOString() })
    localStorage.setItem('offline_queue', JSON.stringify(queue))
    setOfflineQueue(queue)
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, color='green') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false })
      setCameraStream(stream)
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch { alert('Camera access denied.'); setCameraMode(null) }
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
    const b64=dataUrl.split(',')[1], bs=atob(b64), ab=new ArrayBuffer(bs.length), ia=new Uint8Array(ab)
    for (let i=0;i<bs.length;i++) ia[i]=bs.charCodeAt(i)
    const blob = new Blob([ab], { type:'image/jpeg' })
    await supabase.storage.from('selfies').upload(fileName, blob, { upsert:true })
    const { data } = supabase.storage.from('selfies').getPublicUrl(fileName)
    return data.publicUrl
  }
  async function uploadProfilePhoto(file, empId) {
    const { error } = await supabase.storage.from('profile-photos').upload(`${empId}.jpg`, file, { upsert:true })
    if (error) throw error
    const { data } = supabase.storage.from('profile-photos').getPublicUrl(`${empId}.jpg`)
    return data.publicUrl
  }

  // ── Geofencing ────────────────────────────────────────────────────────────
  async function checkLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ ok:true }); return }
      setGeoStatus('Checking your location...')
      const dept = employee?.department
      const deptLoc = dept && departmentLocations[dept]
      const useLat = employee?.location_lat ? Number(employee.location_lat) : (deptLoc?.lat ? Number(deptLoc.lat) : storeLocation.lat)
      const useLng = employee?.location_lng ? Number(employee.location_lng) : (deptLoc?.lng ? Number(deptLoc.lng) : storeLocation.lng)
      const useRadius = employee?.location_radius ? Number(employee.location_radius) : (deptLoc?.radius ? Number(deptLoc.radius) : storeLocation.radius)
      const locationName = employee?.work_location || deptLoc?.name || 'store'
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, useLat, useLng)
          setGeoStatus('')
          if (dist <= useRadius) {
            resolve({ ok:true })
          } else {
            resolve({ ok:false, message:'You are ' + Math.round(dist) + 'm away from ' + locationName + '. Must be within ' + useRadius + 'm.' })
          }
        },
        () => { setGeoStatus(''); resolve({ ok:true }) },
        { timeout:8000, enableHighAccuracy:true }
      )
    })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function login() {
    setLoading(true)
    const { data, error } = await supabase.from('employees').select('*').eq('employee_code', employeeCode.trim()).eq('pin', pin.trim()).eq('is_active', true).single()
    setLoading(false)
    if (error || !data) { alert('Invalid Employee ID or PIN'); return }
    setEmployee(data)
    if (data.profile_photo_url) setProfilePhotoUrl(data.profile_photo_url)
  }

  // ── Smart Login: checks master creds first, then employee DB role ─────────
  async function handleLogin() {
    setLoading(true)
    // 1. Check master hardcoded credentials (owner only emergency access)
    const adminMatch = Object.values(adminCredentials).find(a=>a.code===employeeCode.trim()&&a.pin===pin.trim())
    if (adminMatch) { setLoading(false); openAdmin(adminMatch.role); return }
    // 2. Check employee database — look up by code + PIN
    const { data, error } = await supabase.from('employees').select('*').eq('employee_code', employeeCode.trim()).eq('pin', pin.trim()).eq('is_active', true).single()
    setLoading(false)
    if (error || !data) { alert('Invalid Employee ID or PIN. Please try again.'); return }
    // 3. If employee has an admin_role assigned, open admin panel with that role
    if (data.admin_role && ['owner','hr','payroll','supervisor'].includes(data.admin_role)) {
      openAdmin(data.admin_role, data)
      return
    }
    // 4. Regular employee — load portal
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
    setShowMyLeaves(false)
  }

  // ── Announcements ─────────────────────────────────────────────────────────
  async function checkAnnouncements(emp) {
    const { data:active } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending:false }).limit(1)
    if (!active || active.length===0) return
    const ann = active[0]
    const { data:viewed } = await supabase.from('announcement_views').select('id').eq('announcement_id', ann.id).eq('employee_id', emp.id).maybeSingle()
    if (!viewed) { setPendingAnnouncement(ann); setShowAnnouncementPopup(true) }
  }
  async function markAnnouncementViewed(ann) {
    await supabase.from('announcement_views').insert({ announcement_id:ann.id, employee_id:employee.id, employee_name:employee.full_name })
    setShowAnnouncementPopup(false); setPendingAnnouncement(null)
  }
  async function loadAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending:false })
    setAnnouncements(data || [])
  }
  async function addAnnouncement() {
    if (!newAnnouncementTitle || !newAnnouncementContent) { showToast('Please enter title and content.','red'); return }
    const { error } = await supabase.from('announcements').insert({ title:newAnnouncementTitle, content:newAnnouncementContent, is_active:true })
    if (error) { showToast('Failed: '+error.message,'red'); return }
    showToast('✅ Announcement posted!')
    setNewAnnouncementTitle(''); setNewAnnouncementContent(''); loadAnnouncements()
  }
  async function toggleAnnouncement(id, current) {
    await supabase.from('announcements').update({ is_active:!current }).eq('id', id)
    showToast(`✅ Announcement ${!current?'activated':'deactivated'}`); loadAnnouncements()
  }
  async function deleteAnnouncement(id) {
    if (!window.confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    showToast('✅ Announcement deleted'); loadAnnouncements()
  }

  // ── Employee Contracts ────────────────────────────────────────────────────
  async function loadContracts() {
    setContractsLoading(true)
    const { data } = await supabase.from('employee_contracts').select('*').order('created_at', { ascending:false })
    setContracts(data || [])
    setContractsLoading(false)
  }
  async function uploadContract() {
    if (!contractEmployeeId || !contractType || !contractStart) {
      showToast('Please complete all required fields.', 'red'); return
    }
    if (contractStorageType === 'digital' && !contractFile) {
      showToast('Please select a PDF file to upload.', 'red'); return
    }
    if (contractStorageType === 'physical' && !contractPhysicalLocation.trim()) {
      showToast('Please enter where the physical contract is stored.', 'red'); return
    }
    const emp = employees.find(e => e.id === contractEmployeeId)
    if (!emp) { showToast('Employee not found.', 'red'); return }
    setContractUploading(true)
    try {
      let fileUrl = null, fileName = null
      if (contractStorageType === 'digital' && contractFile) {
        const safeCode = emp.employee_code.replace(/[^a-zA-Z0-9]/g, '_')
        fileName = `${safeCode}_${contractType}_${contractStart}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage.from('contracts').upload(fileName, contractFile, { upsert: false })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fileName)
        fileUrl = urlData.publicUrl
      }
      const isExpired = contractEnd && contractEnd < today
      const status = isExpired ? 'expired' : 'active'
      const { error } = await supabase.from('employee_contracts').insert({
        employee_id: contractEmployeeId,
        employee_code: emp.employee_code,
        employee_name: emp.full_name,
        contract_type: contractType,
        start_date: contractStart,
        end_date: contractEnd || null,
        status,
        file_url: fileUrl,
        file_name: fileName,
        storage_type: contractStorageType,
        physical_location: contractStorageType === 'physical' ? contractPhysicalLocation.trim() : null
      })
      if (error) throw error
      await logAudit('CONTRACT LOGGED', 'Admin', emp.full_name, `${contractType} contract — ${contractStorageType === 'physical' ? 'Physical copy' : 'Digital PDF uploaded'}`)
      showToast(`✅ Contract logged for ${emp.full_name}!`)
      setContractEmployeeId(''); setContractType('regular'); setContractStart(today)
      setContractEnd(''); setContractFile(null); setContractPhysicalLocation('')
      setContractStorageType('digital')
      loadContracts()
    } catch(err) {
      showToast('Failed: ' + err.message, 'red')
    }
    setContractUploading(false)
  }
  async function deleteContract(contract) {
    if (!window.confirm(`Delete contract for ${contract.employee_name}? This cannot be undone.`)) return
    try {
      await supabase.storage.from('contracts').remove([contract.file_name])
    } catch(e) {}
    const { error } = await supabase.from('employee_contracts').delete().eq('id', contract.id)
    if (error) { showToast('Failed: ' + error.message, 'red'); return }
    await logAudit('CONTRACT DELETED', 'Admin', contract.employee_name, `${contract.contract_type} contract deleted`)
    showToast('✅ Contract deleted'); loadContracts()
  }
  async function updateContractStatus(id, status) {
    const { error } = await supabase.from('employee_contracts').update({ status }).eq('id', id)
    if (error) { showToast('Failed: ' + error.message, 'red'); return }
    showToast(`✅ Contract marked as ${status}`); loadContracts()
  }
  function printContractSummary(c) {
    const pw = window.open('', '_blank', 'width=800,height=600')
    const statusLabel = c.status === 'active' ? 'ACTIVE' : c.status === 'expired' ? 'EXPIRED' : 'TERMINATED'
    const statusColor = c.status === 'active' ? '#2d8a4e' : '#ca1b1b'
    const storageLabel = c.storage_type === 'physical'
      ? `Physical Copy on File — ${c.physical_location || 'Location not specified'}`
      : 'Digital PDF (uploaded to system)'
    pw.document.write(`<!DOCTYPE html><html><head><title>Contract Summary</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;padding:20mm;font-size:12px;color:#000;}
        @media print{@page{size:A4;margin:20mm;} .no-print{display:none;}}
        h1{font-size:22px;color:#ca1b1b;margin-bottom:4px;}
        .subtitle{color:#888;font-size:11px;margin-bottom:20px;}
        .header{text-align:center;border-bottom:3px solid #ca1b1b;padding-bottom:14px;margin-bottom:20px;}
        .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-weight:bold;font-size:12px;color:white;background:${statusColor};}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        td{padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;}
        td:first-child{width:40%;font-weight:bold;color:#555;background:#f9f9f9;}
        .section-title{background:#ca1b1b;color:white;padding:8px 12px;font-weight:bold;font-size:12px;margin-top:20px;}
        .footer{margin-top:50px;display:flex;justify-content:space-between;}
        .sig{text-align:center;}
        .sig-line{border-top:1px solid #000;width:180px;padding-top:6px;font-size:10px;color:#555;margin:0 auto;}
        .watermark{color:#888;font-size:11px;text-align:center;margin-top:30px;}
        .storage-box{background:${c.storage_type==='physical'?'#fff8dc':'#e8f5e9'};border:2px solid ${c.storage_type==='physical'?'#f5a623':'#2d8a4e'};border-radius:8px;padding:12px;margin-top:16px;}
      </style>
    </head><body>
      <div class="header">
        <h1>Roma's Donuts</h1>
        <div class="subtitle">Payroll &amp; Attendance System — Employee Contract Record</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div>
          <div style="font-size:20px;font-weight:bold;color:#333;">${c.employee_name}</div>
          <div style="color:#888;font-size:12px;">${c.employee_code}</div>
        </div>
        <div class="badge">${statusLabel}</div>
      </div>

      <div class="section-title">CONTRACT DETAILS</div>
      <table>
        <tr><td>Contract Type</td><td style="text-transform:capitalize;font-weight:bold;">${(c.contract_type||'').replace(/-/g,' ')}</td></tr>
        <tr><td>Start Date</td><td>${c.start_date || '—'}</td></tr>
        <tr><td>End Date</td><td>${c.end_date || 'Open-ended / No fixed end date'}</td></tr>
        <tr><td>Status</td><td style="color:${statusColor};font-weight:bold;">${statusLabel}</td></tr>
        <tr><td>Date Logged</td><td>${c.created_at ? new Date(c.created_at).toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'}) : '—'}</td></tr>
      </table>

      <div class="section-title">DOCUMENT STORAGE</div>
      <div class="storage-box">
        <strong>${c.storage_type === 'physical' ? '📁 Physical Copy on File' : '💻 Digital Copy in System'}</strong><br/>
        <span style="color:#555;font-size:12px;margin-top:4px;display:block;">${storageLabel}</span>
        ${c.storage_type === 'digital' && c.file_url ? `<span style="color:#888;font-size:11px;">File available in the system. Print a copy from the payroll portal.</span>` : ''}
      </div>

      <div class="footer">
        <div class="sig"><div class="sig-line">Employee Signature over Printed Name</div></div>
        <div class="sig"><div class="sig-line">HR / Authorized Signatory</div></div>
        <div class="sig"><div class="sig-line">Date</div></div>
      </div>

      <div class="watermark">This is an official contract record of Roma's Donuts. Generated on ${new Date().toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'})}.</div>

      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ PRINT</button>
      </div>
    </body></html>`)
    pw.document.close()
    setTimeout(() => { pw.focus(); pw.print() }, 600)
  }
  async function loadAnnouncementViews(annId) {
    const { data:all } = await supabase.from('employees').select('id,full_name,employee_code').eq('is_active', true)
    const { data:views } = await supabase.from('announcement_views').select('employee_id').eq('announcement_id', annId)
    const viewedIds = new Set(views?.map(v => v.employee_id) || [])
    setAnnouncementViews((all || []).map(e => ({ ...e, viewed:viewedIds.has(e.id) })))
  }

  // ── Employee Portal ───────────────────────────────────────────────────────
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
    const { data } = await supabase.from('payroll_records').select('*').eq('employee_id', emp.id).order('payroll_start', { ascending:false })
    setMyPayslips(data || [])
  }
  async function loadMyCashAdvances(emp) {
    // Load requests (pending/approved/disapproved)
    const { data: requests } = await supabase.from('cash_advance_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending:false })
    setMyCashAdvances(requests || [])
    // Load active unpaid balances
    const { data: active } = await supabase.from('cash_advances').select('*').eq('employee_id', emp.id).eq('status', 'Unpaid').order('advance_date', { ascending:false })
    setMyActiveCAs(active || [])
    // Load paid history
    const { data: history } = await supabase.from('cash_advances').select('*').eq('employee_id', emp.id).eq('status', 'Paid').order('advance_date', { ascending:false })
    setMyCAHistory(history || [])
  }
  async function loadMyAttendanceHistory(emp) {
    const { data } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('attendance_date', { ascending:false }).limit(30)
    setMyAttendance(data || [])
  }
  async function loadMyLeaveBalance(emp) {
    const yearStart = `${today.slice(0,4)}-01-01`
    const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').gte('leave_start', yearStart)
    const usedS = data?.filter(l=>l.leave_type==='Sick Leave').reduce((s,l)=>s+Number(l.duration_days||1),0)||0
    const usedV = data?.filter(l=>l.leave_type==='Vacation Leave').reduce((s,l)=>s+Number(l.duration_days||1),0)||0
    setMyLeaveBalance({ sick:Math.max(0,(emp.sick_leave_balance??5)-usedS), vacation:Math.max(0,(emp.vacation_leave_balance??5)-usedV) })
  }
  async function loadMyLeaves() {
    setMyLeavesLoading(true)
    const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', employee.id).order('created_at', { ascending:false })
    setMyLeavesLoading(false)
    setMyLeaves(data || [])
  }
  async function handleProfilePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUploadingPhoto(true)
    try {
      const url = await uploadProfilePhoto(file, employee.id)
      await supabase.from('employees').update({ profile_photo_url:url }).eq('id', employee.id)
      setProfilePhotoUrl(url); showToast('✅ Profile photo updated!')
    } catch(err) { showToast('Failed: '+err.message,'red') }
    setUploadingPhoto(false)
  }
  async function initiateTimeIn() {
    const geo = await checkLocation(); if (!geo.ok) { alert(geo.message); return }
    setCapturedPhoto(null); setCameraMode('timein')
  }
  async function initiateTimeOut() {
    if (!todayLog) { alert('You need to Time In first.'); return }
    if (todayLog.time_out) { alert('You already timed out today.'); return }
    const openBreak = todayBreaks.find(b=>!b.break_in)
    if (openBreak) { alert('Please Break In first before timing out.'); return }
    const geo = await checkLocation(); if (!geo.ok) { alert(geo.message); return }
    setCapturedPhoto(null); setCameraMode('timeout')
  }
  async function initiateBreakOut() {
    if (!todayLog || todayLog.time_out) { alert('You must be timed in to take a break.'); return }
    // Only 1 break per day
    if (todayBreaks.length > 0) { showToast('❌ You have already taken your break today. Only 1 break is allowed per day.','red'); return }
    const openBreak = todayBreaks.find(b=>!b.break_in)
    if (openBreak) { alert('You are already on break. Please Break In first.'); return }
    const { error } = await supabase.from('break_logs').insert({ attendance_log_id:todayLog.id, employee_id:employee.id, employee_name:employee.full_name, attendance_date:today, break_out:nowTime() })
    if (error) { showToast('Failed: '+error.message,'red'); return }
    loadTodayBreaks(todayLog.id); showToast('☕ Break started!')
  }
  async function initiateBreakIn() {
    const openBreak = todayBreaks.find(b=>!b.break_in)
    if (!openBreak) { alert('You are not currently on break.'); return }
    const duration = minutesFromTime(nowTime()) - minutesFromTime(openBreak.break_out)
    const { error } = await supabase.from('break_logs').update({ break_in:nowTime(), break_minutes:Math.max(0,duration) }).eq('id', openBreak.id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    loadTodayBreaks(todayLog.id); showToast('✅ Break ended!')
  }
  async function confirmTimeIn() {
    if (!capturedPhoto) { alert('Please take a selfie first.'); return }
    setLoading(true)
    // Offline handling
    if (!isOnline) {
      const gracePeriod = employee.grace_period_minutes ?? 10
      let lateMinutes = 0, status = 'No Assigned Shift'
      if (todaySchedule?.shift_start) {
        const cur = minutesFromTime(nowTime()), shiftS = minutesFromTime(todaySchedule.shift_start)
        const raw = Math.max(0, cur-shiftS); lateMinutes = raw > gracePeriod ? raw : 0
        status = lateMinutes > 0 ? 'Late' : 'On Time'
      }
      const offlineLog = { employee_id:employee.id, employee_code:employee.employee_code, employee_name:employee.full_name, attendance_date:today, shift_start:todaySchedule?.shift_start||null, shift_end:todaySchedule?.shift_end||null, time_in:nowTime(), late_minutes:lateMinutes, status, selfie_in_url:null }
      queueOfflineAction('timein', { employee_id:employee.id, attendance_date:today, data:offlineLog })
      setTodayLog({ ...offlineLog, id:'offline_'+Date.now() })
      setLoading(false); setCameraMode(null); setCapturedPhoto(null)
      showToast('📴 Offline — Time In saved locally. Will sync when online.')
      return
    }
    const { data:existing } = await supabase.from('attendance_logs').select('*').eq('employee_id', employee.id).eq('attendance_date', today).maybeSingle()
    if (existing) { setLoading(false); setTodayLog(existing); alert('Already timed in today.'); setCameraMode(null); return }
    let selfieUrl = null
    try { selfieUrl = await uploadSelfie(capturedPhoto, `timein_${employee.id}_${today}.jpg`) } catch(e){}
    const gracePeriod = employee.grace_period_minutes ?? 10
    let lateMinutes = 0, status = 'No Assigned Shift'
    if (todaySchedule?.shift_start) {
      const cur = minutesFromTime(nowTime()), shiftS = minutesFromTime(todaySchedule.shift_start)
      const raw = Math.max(0, cur-shiftS); lateMinutes = raw > gracePeriod ? raw : 0
      status = lateMinutes > 0 ? 'Late' : 'On Time'
    }
    const { data, error } = await supabase.from('attendance_logs').insert({ employee_id:employee.id, employee_code:employee.employee_code, employee_name:employee.full_name, attendance_date:today, shift_start:todaySchedule?.shift_start||null, shift_end:todaySchedule?.shift_end||null, time_in:nowTime(), late_minutes:lateMinutes, status, selfie_in_url:selfieUrl }).select().single()
    setLoading(false)
    if (error) { alert('Time In failed: '+error.message); return }
    setTodayLog(data); setCameraMode(null); setCapturedPhoto(null)
    await logAudit('TIME IN', employee.full_name, employee.full_name, `Timed in at ${data.time_in}`)
    alert('Time In saved successfully!')
  }
  async function confirmTimeOut() {
    if (!capturedPhoto) { alert('Please take a selfie first.'); return }
    setLoading(true)
    let undertimeMinutes=0, overtimeMinutes=0, status=todayLog.late_minutes>0?'Late':'Completed'
    const totalBreakMins = todayBreaks.reduce((s,b)=>s+Number(b.break_minutes||0),0)
    const excessBreakMins = Math.max(0, totalBreakMins-ALLOWED_BREAK_MINUTES)
    if (todaySchedule?.shift_end) {
      const cur=minutesFromTime(nowTime()), shiftE=minutesFromTime(todaySchedule.shift_end), diff=cur-shiftE
      undertimeMinutes = diff<0?Math.abs(diff):0; overtimeMinutes = diff>0?diff:0
      if (undertimeMinutes>0) status='Undertime - Pending Filing'
      if (overtimeMinutes>0) status='Overtime - Pending Filing'
    }
    let selfieUrl = null
    try { selfieUrl = await uploadSelfie(capturedPhoto, `timeout_${employee.id}_${today}.jpg`) } catch(e){}
    const { data, error } = await supabase.from('attendance_logs').update({ time_out:nowTime(), undertime_minutes:undertimeMinutes, overtime_minutes:overtimeMinutes, status, selfie_out_url:selfieUrl, total_break_minutes:totalBreakMins, excess_break_minutes:excessBreakMins, overtime_approved:null }).eq('id', todayLog.id).select().single()
    setLoading(false)
    if (error) { alert('Time Out failed: '+error.message); return }
    setTodayLog(data); setCameraMode(null); setCapturedPhoto(null)
    await logAudit('TIME OUT', employee.full_name, employee.full_name, `Timed out at ${data.time_out}`)
    let msg = 'Time Out saved successfully!'
    if (overtimeMinutes>0) msg += `\n\n${overtimeMinutes} min overtime — please file an OT request.`
    if (undertimeMinutes>0) msg += `\n\n${undertimeMinutes} min undertime — please file a UT request.`
    if (excessBreakMins>0) msg += `\n\n${excessBreakMins} min excess break will be deducted.`
    alert(msg)
  }
  async function submitTimeAdjRequest() {
    if (!otRequestReason || !otRequestMinutes || !otRequestDate) { alert('Please enter date, minutes and reason.'); return }
    const { error } = await supabase.from('time_adjustment_requests').insert({ employee_id:employee.id, employee_code:employee.employee_code, employee_name:employee.full_name, attendance_date:otRequestDate, request_type:otRequestType, minutes:Number(otRequestMinutes), employee_reason:otRequestReason, status:'pending' })
    if (error) { alert('Failed: '+error.message); return }
    alert(`${otRequestType==='overtime'?'Overtime':'Undertime'} request filed! Waiting for admin approval.`)
    setOtRequestReason(''); setOtRequestReasonPreset(''); setOtRequestMinutes(''); setShowOTRequest(false)
  }
  async function submitLeaveRequest() {
    if (!leaveStartDate||!leaveEndDate||!leaveType||!leaveReason) { alert('Please complete all fields'); return }
    const todayMid=new Date(); todayMid.setHours(0,0,0,0)
    const startD=new Date(leaveStartDate); startD.setHours(0,0,0,0)
    if ((startD-todayMid)/(1000*60*60*24)<2) { alert('Must be filed at least 3 days in advance.'); return }
    const dur=Math.ceil((new Date(leaveEndDate)-new Date(leaveStartDate))/(1000*60*60*24))+1
    if (leaveType==='Sick Leave'&&dur>myLeaveBalance.sick) { alert(`Only ${myLeaveBalance.sick} Sick Leave days remaining.`); return }
    if (leaveType==='Vacation Leave'&&dur>myLeaveBalance.vacation) { alert(`Only ${myLeaveBalance.vacation} Vacation Leave days remaining.`); return }
    const { error } = await supabase.from('leave_requests').insert({ employee_id:employee.id, employee_code:employee.employee_code, employee_name:employee.full_name, leave_start:leaveStartDate, leave_end:leaveEndDate, duration_days:dur, leave_type:leaveType, reason:leaveReason, status:'pending' })
    if (error) { alert(error.message); return }
    alert('Leave request submitted!'); setLeaveStartDate(''); setLeaveEndDate(''); setLeaveType(''); setLeaveReason(''); setShowLeaveRequest(false); loadMyLeaveBalance(employee)
  }
  async function submitCashAdvanceRequest() {
    if (!requestCashAmount||!requestCashReason) { alert('Please enter amount and reason.'); return }
    const amount=Number(requestCashAmount); if (amount<=0) { alert('Amount must be greater than 0.'); return }
    const { error } = await supabase.from('cash_advance_requests').insert({ employee_id:employee.id, employee_code:employee.employee_code, employee_name:employee.full_name, amount, reason:requestCashReason, status:'pending' })
    if (error) { alert('Failed: '+error.message); return }
    alert('Request submitted! Waiting for admin approval.')
    setRequestCashAmount(''); setRequestCashReason(''); setRequestCashReasonPreset(''); setShowCashAdvanceRequest(false); loadMyCashAdvances(employee)
  }
  async function agreePayslip(payId) {
    const { error } = await supabase.from('payroll_records').update({ employee_acknowledgement:'agreed' }).eq('id', payId)
    if (error) { alert('Failed: '+error.message); return }
    alert('Payslip acknowledged!'); loadMyPayslips(employee)
  }
  async function submitPayslipDispute(pay) {
    const reason = disputeReasons[pay.id]
    if (!reason?.trim()) { alert('Please enter your reason.'); return }
    const { error } = await supabase.from('payslip_disputes').insert({ employee_id:employee.id, employee_code:employee.employee_code, employee_name:employee.full_name, payroll_record_id:String(pay.id), payroll_start:pay.payroll_start, payroll_end:pay.payroll_end, reason, status:'pending' })
    if (error) { alert('Failed: '+error.message); return }
    await supabase.from('payroll_records').update({ employee_acknowledgement:'disputed' }).eq('id', pay.id)
    alert('Dispute submitted.'); setShowDisputeBox(p=>({...p,[pay.id]:false})); setDisputeReasons(p=>({...p,[pay.id]:''})); setDisputeReasonPresets(p=>({...p,[pay.id]:''})); loadMyPayslips(employee)
  }

  // ── Admin Functions ───────────────────────────────────────────────────────
  function canAccess(tab) {
    if (adminRole === 'owner') return true
    if (adminRole === 'hr') return ['dashboard','attendance','employees','schedule','holidays','leaveRequests','cashRequests','overtime','disputes','announcements','auditTrail','contracts'].includes(tab)
    if (adminRole === 'payroll') return ['dashboard','payroll','thirteenth','finalpay','adjustment','payrollHistory','remittance','dtr','bankDisbursement'].includes(tab)
    if (adminRole === 'supervisor') return ['dashboard','attendance','overtime','schedule'].includes(tab)
    return false
  }

  async function logAudit(action, by, target, details) {
    await supabase.from('audit_logs').insert({ action, performed_by:by, target_employee:target, details }).catch(()=>{})
  }

  // ── SIL Automation ────────────────────────────────────────────────────────
  async function autoApplySIL() {
    const { data:emps } = await supabase.from('employees').select('*').eq('is_active', true)
    let entitled=0, zeroed=0
    for (const emp of emps||[]) {
      if (!emp.hire_date) continue
      const yearsOfService=(new Date()-new Date(emp.hire_date))/(1000*60*60*24*365)
      if (yearsOfService>=1) {
        // Entitled to 5 SIL days — only set if not already manually adjusted above 0
        await supabase.from('employees').update({ sil_balance:5 }).eq('id', emp.id)
        entitled++
      } else {
        // Not yet entitled — zero out
        await supabase.from('employees').update({ sil_balance:0 }).eq('id', emp.id)
        zeroed++
      }
    }
    await logAudit('SIL AUTO-APPLIED','Admin','ALL',`Entitled: ${entitled} | Zeroed: ${zeroed}`)
    showToast(`✅ SIL updated — ${entitled} entitled, ${zeroed} not yet entitled`)
    loadEmployees()
  }

  // ── Audit Trail Viewer ────────────────────────────────────────────────────
  async function loadAuditTrail() {
    setAuditLoading(true)
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending:false }).limit(500)
    setAuditLogs(data || [])
    setAuditLoading(false)
  }

  // ── Dashboard Analytics ───────────────────────────────────────────────────
  async function loadDashboardCharts() {
    const year = today.slice(0,4)
    // Monthly attendance for last 6 months
    const months = Array.from({length:6}, (_,i) => {
      const d = new Date(); d.setMonth(d.getMonth()-i)
      return d.toISOString().slice(0,7)
    }).reverse()
    const stats = []
    for (const m of months) {
      const { data } = await supabase.from('attendance_logs').select('status').gte('attendance_date', m+'-01').lte('attendance_date', m+'-31')
      stats.push({
        month: m,
        present: data?.filter(l=>l.status!=='Absent'&&l.status).length||0,
        absent: data?.filter(l=>l.status==='Absent').length||0,
        late: data?.filter(l=>l.status==='Late').length||0,
      })
    }
    setAttendanceStats(stats)
    // Payroll cost last 6 months
    const { data: payData } = await supabase.from('payroll_records').select('payroll_start,net_pay').gte('payroll_start', year+'-01-01').order('payroll_start')
    const byPeriod = {}
    for (const p of payData||[]) {
      const k = p.payroll_start?.slice(0,7)||''
      byPeriod[k] = (byPeriod[k]||0) + Number(p.net_pay||0)
    }
    setPayrollCostStats(Object.entries(byPeriod).map(([m,v])=>({month:m, total:v})))
  }

  // ── Philippine Regular Holidays (auto-set) ────────────────────────────────
  async function addPhilippineHolidays(year) {
    const regularHolidays = [
      { date:`${year}-01-01`, name:"New Year's Day", type:'regular' },
      { date:`${year}-04-09`, name:"Araw ng Kagitingan (Day of Valor)", type:'regular' },
      { date:`${year}-05-01`, name:"Labor Day", type:'regular' },
      { date:`${year}-06-12`, name:"Independence Day", type:'regular' },
      { date:`${year}-08-25`, name:"National Heroes Day", type:'regular' },
      { date:`${year}-11-30`, name:"Bonifacio Day", type:'regular' },
      { date:`${year}-12-25`, name:"Christmas Day", type:'regular' },
      { date:`${year}-12-30`, name:"Rizal Day", type:'regular' },
    ]
    let added = 0
    for (const h of regularHolidays) {
      const { data: existing } = await supabase.from('holidays').select('id').eq('holiday_date', h.date).maybeSingle()
      if (!existing) {
        await supabase.from('holidays').insert({ holiday_date:h.date, holiday_name:h.name, holiday_type:h.type })
        added++
      }
    }
    await loadHolidays()
    showToast(`✅ Added ${added} Philippine regular holidays for ${year}!`)
  }

  // ── Department Location Management ────────────────────────────────────────
  function saveDepartmentLocations(locs) {
    setDepartmentLocations(locs)
    localStorage.setItem('dept_locations', JSON.stringify(locs))
    showToast('✅ Department locations saved!')
  }
  function loadDepartmentLocations() {
    try {
      const saved = localStorage.getItem('dept_locations')
      if (saved) setDepartmentLocations(JSON.parse(saved))
    } catch(e) {}
  }

  // ── Payroll Approval Workflow ─────────────────────────────────────────────
  async function approvePayroll(start, end) {
    const { error } = await supabase.from('payroll_records')
      .update({ payroll_approved: true, approved_by: 'Admin', approved_at: new Date().toISOString() })
      .eq('payroll_start', start).eq('payroll_end', end)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    setPayrollApproved(true)
    await logAudit('PAYROLL APPROVED','Admin','ALL',`Period: ${start} to ${end}`)
    showToast('✅ Payroll approved and released!')
  }
  async function detectStoreLocation() {
    setLocationStatus('Detecting location...')
    if (!navigator.geolocation) { setLocationStatus('GPS not available on this device.'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setStoreLocation(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setLocationStatus(`✅ Location detected: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`)
      },
      err => { setLocationStatus('❌ Could not detect location. Please enter manually.') },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }
  function openAdmin(role, empData) {
    setAdminMode(true); setAdminRole(role||'owner'); setEmployeeSearch(''); setSidebarOpen(false)
    if (empData) {
      setAdminEmployee(empData)
      // Pre-load their today log and schedule for the attendance modal
      loadTodayLog(empData); loadTodaySchedule(empData); loadTodayBreaks(null)
    }
    // Set default tab based on role
    const defaultTab = role==='payroll'?'payroll':role==='supervisor'?'attendance':role==='hr'?'employees':'dashboard'
    setActiveTab(defaultTab)
    loadEmployees(); loadAdminLogs(); loadLeaveRequests(); loadCashAdvanceRequests()
    loadHolidays(); loadTimeAdjRequests(); loadAnnouncements(); loadDashboard()
    loadDepartmentLocations(); loadDashboardCharts(); autoAcknowledgeExpired().catch(()=>{})
  }
  async function loadDashboard() {
    const { data:emps } = await supabase.from('employees').select('*').eq('is_active', true)
    const { data:todayLogs } = await supabase.from('attendance_logs').select('*').eq('attendance_date', today)
    const { data:pendingLeave } = await supabase.from('leave_requests').select('id').eq('status', 'pending')
    const { data:pendingCA } = await supabase.from('cash_advance_requests').select('id').eq('status', 'pending')
    const { data:pendingOT } = await supabase.from('time_adjustment_requests').select('id').eq('status', 'pending')
    const { data:pendingDisp } = await supabase.from('payslip_disputes').select('id').eq('status', 'pending')
    // Probationary employees due for regularization (hired 5-6 months ago, still probationary)
    const probDue = (emps||[]).filter(e => {
      if (e.employment_type !== 'probationary' || !e.hire_date) return false
      const hireDate = new Date(e.hire_date)
      const monthsEmployed = (new Date() - hireDate) / (1000*60*60*24*30)
      return monthsEmployed >= 5 && monthsEmployed <= 7
    })
    // Employees with birthdays this week
    const thisWeek = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
    const birthdays = (emps||[]).filter(e => e.date_of_birth && thisWeek.includes(e.date_of_birth.slice(5)))
    // Work anniversaries this week
    const anniversaries = (emps||[]).filter(e => e.hire_date && thisWeek.includes(e.hire_date.slice(5)) && e.hire_date.slice(0,4) !== today.slice(0,4))
    setDashboardData({
      totalEmployees: emps?.length||0,
      timedIn: todayLogs?.filter(l=>l.time_in&&!l.time_out).length||0,
      timedOut: todayLogs?.filter(l=>l.time_out).length||0,
      absent: todayLogs?.filter(l=>l.status==='Absent').length||0,
      pendingLeave: pendingLeave?.length||0,
      pendingCA: pendingCA?.length||0,
      pendingOT: pendingOT?.length||0,
      pendingDisputes: pendingDisp?.length||0,
      probDue, birthdays, anniversaries
    })
  }
  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('*').eq('is_active', true).order('full_name')
    setEmployees(data || [])
  }
  async function loadDeactivatedEmployees() {
    const { data } = await supabase.from('employees').select('*').eq('is_active', false).order('full_name')
    setDeactivatedEmployees(data || [])
  }
  async function reactivateEmployee(empId, empName) {
    if (!window.confirm(`Reactivate ${empName}?`)) return
    const { error } = await supabase.from('employees').update({ is_active: true }).eq('id', empId)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    await logAudit('EMPLOYEE REACTIVATED','Admin',empName,'Employee reactivated')
    showToast(`✅ ${empName} reactivated!`)
    loadDeactivatedEmployees(); loadEmployees()
  }
  async function loadAdminLogs() {
    const { data } = await supabase.from('attendance_logs').select('*').eq('attendance_date', adminDate).order('employee_name')
    setAdminLogs(data || [])
  }
  async function markAbsent() {
    if (!absentEmployeeId||!absentDate) { showToast('Please select employee and date.','red'); return }
    const emp = employees.find(e=>e.id===absentEmployeeId)
    const { data:existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', absentEmployeeId).eq('attendance_date', absentDate).maybeSingle()
    if (existing) { showToast('This employee already has a record for this date.','red'); return }
    const { error } = await supabase.from('attendance_logs').insert({ employee_id:absentEmployeeId, employee_code:emp?.employee_code||'', employee_name:emp?.full_name||'', attendance_date:absentDate, status:'Absent' })
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await logAudit('MARK ABSENT','Admin',emp?.full_name||'',`Marked absent on ${absentDate}`)
    showToast(`✅ ${emp?.full_name} marked Absent on ${absentDate}`)
    setAbsentEmployeeId('')
    loadAdminLogs()
  }
  async function loadLeaveRequests() {
    const { data } = await supabase.from('leave_requests').select('*').eq('status', 'pending').order('created_at', { ascending:false })
    setLeaveRequests(data || [])
  }
  async function loadResolvedLeaves() {
    const { data } = await supabase.from('leave_requests').select('*').in('status', ['approved','disapproved']).order('created_at', { ascending:false })
    setResolvedLeaves(data || [])
  }
  async function updateLeaveStatus(id, status, reason) {
    const { error } = await supabase.from('leave_requests').update({ status, admin_reason:reason||null }).eq('id', id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    await logAudit(`LEAVE ${status.toUpperCase()}`,'Admin','',`Leave ID ${id}`)
    setLeaveRequests(prev=>prev.filter(r=>r.id!==id))
    showToast(`✅ Leave ${status} successfully!`)
  }
  async function loadHolidays() {
    const { data } = await supabase.from('holidays').select('*').order('holiday_date')
    setHolidays(data || [])
  }
  async function addHoliday() {
    if (!newHolidayDate||!newHolidayName) { showToast('Please enter date and name.','red'); return }
    const { error } = await supabase.from('holidays').insert({ holiday_date:newHolidayDate, holiday_name:newHolidayName, holiday_type:newHolidayType })
    if (error) { showToast('Failed: '+error.message,'red'); return }
    showToast('✅ Holiday added!'); setNewHolidayName(''); loadHolidays()
  }
  async function deleteHoliday(id) {
    await supabase.from('holidays').delete().eq('id', id)
    setHolidays(prev=>prev.filter(h=>h.id!==id)); showToast('✅ Holiday deleted')
  }
  async function loadTimeAdjRequests() {
    const { data } = await supabase.from('time_adjustment_requests').select('*').eq('status', 'pending').order('created_at', { ascending:false })
    setTimeAdjRequests(data || [])
  }
  async function approveTimeAdj(req) {
    const { error } = await supabase.from('time_adjustment_requests').update({ status:'approved', reviewed_by:'Admin', reviewed_at:new Date().toISOString(), admin_reason:adjAdminReason[req.id]||'' }).eq('id', req.id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    if (req.request_type==='overtime') {
      await supabase.from('attendance_logs').update({ overtime_minutes:req.minutes, overtime_approved:true, status:'Overtime' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    } else {
      await supabase.from('attendance_logs').update({ undertime_minutes:req.minutes, status:'Undertime' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    }
    await logAudit(`${req.request_type.toUpperCase()} APPROVED`,'Admin',req.employee_name,`${req.minutes} min on ${req.attendance_date}`)
    setTimeAdjRequests(prev=>prev.filter(r=>r.id!==req.id))
    showToast('✅ OT/UT Approved successfully!')
  }
  async function rejectTimeAdj(req) {
    const reason = adjAdminReason[req.id]
    if (!reason?.trim()) { showToast('Please enter a reason for rejection.','red'); return }
    const { error } = await supabase.from('time_adjustment_requests').update({ status:'rejected', reviewed_by:'Admin', reviewed_at:new Date().toISOString(), admin_reason:reason }).eq('id', req.id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    if (req.request_type==='overtime') {
      await supabase.from('attendance_logs').update({ overtime_minutes:0, overtime_approved:false, status:'Completed' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    } else {
      await supabase.from('attendance_logs').update({ undertime_minutes:0, status:'Completed' }).eq('employee_id', req.employee_id).eq('attendance_date', req.attendance_date)
    }
    await logAudit(`${req.request_type.toUpperCase()} REJECTED`,'Admin',req.employee_name,`Reason: ${reason}`)
    setTimeAdjRequests(prev=>prev.filter(r=>r.id!==req.id))
    showToast('❌ OT/UT Rejected.','red')
  }
  async function saveEmployeeChanges() {
    setSaveEmployeeLoading(true)
    const { error } = await supabase.from('employees').update({ employee_code:editFields.code, full_name:editFields.name, position:editFields.position, pin:editFields.pin, daily_rate:Number(editFields.rate||0), has_sss:editFields.hasSss, has_pagibig:editFields.hasPagibig, has_philhealth:editFields.hasPhilhealth, hire_date:editFields.hireDate, sick_leave_balance:Number(editFields.sick||5), vacation_leave_balance:Number(editFields.vacation||5), sil_balance:Number(editFields.sil||5), pay_type:editFields.payType||'daily', hourly_rate:Number(editFields.hourlyRate||0), grace_period_minutes:Number(editFields.gracePeriod||10), date_of_birth:editFields.dob||null, gender:editFields.gender||'', civil_status:editFields.civil_status||'', home_address:editFields.address||'', contact_number:editFields.contact||'', emergency_contact_name:editFields.emergency_name||'', emergency_contact_number:editFields.emergency_contact||'', employment_type:editFields.employment_type||'regular', department:editFields.department||'', admin_role:editFields.admin_role||null }).eq('id', editingEmployeeId)
    setSaveEmployeeLoading(false)
    if (error) { showToast('❌ Failed to save: '+error.message,'red'); return }
    await logAudit('EMPLOYEE UPDATED','Admin',editFields.name,'Employee details updated')
    setSaveSuccess(editingEmployeeId)
    await loadEmployees()
    setTimeout(() => { setSaveSuccess(null); setEditingEmployeeId('') }, 2500)
  }
  async function addEmployee() {
    const f = newEmpFields
    if (!f.code||!f.name||!f.position||!f.pin) { showToast('Please complete all required fields','red'); return }
    const { error } = await supabase.from('employees').insert({ employee_code:f.code.toUpperCase(), full_name:f.name, position:f.position, pin:f.pin, daily_rate:Number(f.rate||0), is_active:true, has_sss:f.hasSss, has_pagibig:f.hasPagibig, has_philhealth:f.hasPhilhealth, hire_date:f.hire_date, sick_leave_balance:Number(f.sick||5), vacation_leave_balance:Number(f.vacation||5), sil_balance:Number(f.sil||5), pay_type:f.payType||'daily', hourly_rate:Number(f.hourlyRate||0), grace_period_minutes:Number(f.gracePeriod||10), date_of_birth:f.dob||null, gender:f.gender||'', civil_status:f.civil_status||'', home_address:f.address||'', contact_number:f.contact||'', emergency_contact_name:f.emergency_name||'', emergency_contact_number:f.emergency_contact||'', employment_type:f.employment_type||'regular', department:f.department||'' })
    if (error) { showToast('Failed: '+error.message,'red'); return }
    await logAudit('EMPLOYEE ADDED','Admin',f.name,'New employee added')
    showToast('✅ Employee added successfully!')
    setNewEmpFields({ code:'', name:'', position:'', pin:'', rate:'', hire_date:today, sick:0, vacation:0, sil:0, hasSss:false, hasPagibig:false, hasPhilhealth:false, payType:'daily', hourlyRate:0, gracePeriod:10, dob:'', gender:'', civil_status:'', address:'', contact:'', emergency_name:'', emergency_contact:'', employment_type:'regular', department:'', sss_no:'', pagibig_no:'', philhealth_no:'', tin_no:'', work_location:'', location_lat:'', location_lng:'', location_radius:'' })
    loadEmployees()
  }
  async function deactivateEmployee(empId, empName) {
    if (!window.confirm(`Deactivate ${empName}?`)) return
    const { error } = await supabase.from('employees').update({ is_active:false }).eq('id', empId)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    await logAudit('EMPLOYEE DEACTIVATED','Admin',empName,'Employee deactivated')
    showToast(`✅ ${empName} deactivated.`); loadEmployees()
  }
  async function loadCashAdvanceRequests() {
    const { data } = await supabase.from('cash_advance_requests').select('*').eq('status', 'pending').order('created_at', { ascending:false })
    setCashAdvanceRequests(data || [])
  }
  async function loadResolvedCARequests() {
    const { data } = await supabase.from('cash_advance_requests').select('*').in('status', ['approved','disapproved']).order('created_at', { ascending:false })
    setResolvedCARequests(data || [])
  }
  async function updateCashAdvanceStatus(id, newStatus) {
    const req = cashAdvanceRequests.find(r=>r.id===id); if (!req) return
    if (newStatus==='disapproved') {
      const reason = caDisapproveReason[id]
      if (!reason?.trim()) { showToast('Please enter a reason for disapproval.','red'); return }
      const { error } = await supabase.from('cash_advance_requests').update({ status:'disapproved', admin_reason:reason }).eq('id', id)
      if (error) { showToast('Failed: '+error.message,'red'); return }
      await logAudit('CA DISAPPROVED','Admin',req.employee_name,`Reason: ${reason}`)
      setCashAdvanceRequests(prev=>prev.filter(r=>r.id!==id))
      showToast('✅ Cash advance disapproved.','red'); return
    }
    const { error } = await supabase.from('cash_advance_requests').update({ status:'approved' }).eq('id', id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    const totalAmount=Number(req.amount), installments=Math.max(1,Number(installmentCounts[id]||1))
    const perPayroll=Math.ceil((totalAmount/installments)*100)/100
    await supabase.from('cash_advances').insert({ employee_id:req.employee_id, employee_code:req.employee_code, employee_name:req.employee_name, advance_date:today, amount:totalAmount, amount_paid:0, balance:totalAmount, per_payroll_deduction:perPayroll, installments_total:installments, installments_remaining:installments, notes:req.reason, status:'Unpaid' })
    await logAudit('CA APPROVED','Admin',req.employee_name,`${php(totalAmount)} in ${installments} installments`)
    setCashAdvanceRequests(prev=>prev.filter(r=>r.id!==id))
    showToast(`✅ Approved! ${php(perPayroll)} × ${installments} payroll(s).`)
  }
  async function loadPayslipDisputes() {
    const { data } = await supabase.from('payslip_disputes').select('*').eq('status', 'pending').order('created_at', { ascending:false })
    setPayslipDisputes(data || [])
  }
  async function loadResolvedDisputes() {
    const { data } = await supabase.from('payslip_disputes').select('*').eq('status', 'resolved').order('created_at', { ascending:false })
    setResolvedDisputes(data || [])
  }
  async function resolveDispute(id) {
    const reason = (disputeAdminReason[id] || '').trim()
    if (!reason) { showToast('❌ Please enter admin response before resolving.','red'); return }
    const { error } = await supabase.from('payslip_disputes').update({ status:'resolved', admin_reason:reason }).eq('id', id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); console.error(error); return }
    await logAudit('DISPUTE RESOLVED','Admin','',`Dispute ID ${id} — ${reason}`)
    setDisputeAdminReason(p=>({ ...p,[id]:'' }))
    setPayslipDisputes(prev=>prev.filter(d=>d.id!==id))
    showToast('✅ Dispute resolved and removed successfully!')
    // Reload to update resolved list
    loadResolvedDisputes()
  }
  async function saveAdjustment() {
    if (!adjustmentEmployeeId) { showToast('❌ Please select an employee.','red'); return }
    if (!adjustmentCategory.trim()) { showToast('❌ Please enter a category.','red'); return }
    if (!adjustmentAmount || isNaN(Number(adjustmentAmount)) || Number(adjustmentAmount) <= 0) { showToast('❌ Please enter a valid amount greater than 0.','red'); return }
    const emp = employees.find(e=>e.id===adjustmentEmployeeId)
    if (!emp) { showToast('❌ Employee not found.','red'); return }
    const payload = {
      employee_id: adjustmentEmployeeId,
      employee_code: emp.employee_code||'',
      employee_name: emp.full_name||'',
      adjustment_date: adjustmentDate||today,
      adjustment_type: adjustmentType,
      category: adjustmentCategory.trim(),
      amount: Number(adjustmentAmount),
      notes: adjustmentNotes||''
    }
    const { data, error } = await supabase.from('payroll_adjustments').insert(payload).select()
    if (error) { showToast('❌ Failed to save: '+error.message,'red'); console.error('Adjustment error:', error); return }
    await logAudit('ADJUSTMENT ADDED','Admin',emp.full_name,`${adjustmentType}: ${php(adjustmentAmount)} — ${adjustmentCategory}`)
    showToast(`✅ ${adjustmentType==='addition'?'Bonus':'Deduction'} of ${php(adjustmentAmount)} saved for ${emp.full_name}!`)
    setAdjustmentEmployeeId(''); setAdjustmentCategory(''); setAdjustmentAmount(''); setAdjustmentNotes('')
  }
  async function saveSchedule() {
    if (!selectedEmployeeId||!scheduleDate||!shiftStart||!shiftEnd) { showToast('Complete all fields.','red'); return }
    const { error } = await supabase.from('daily_schedules').upsert({ employee_id:selectedEmployeeId, schedule_date:scheduleDate, shift_start:shiftStart, shift_end:shiftEnd }, { onConflict:'employee_id,schedule_date' })
    if (error) { showToast('Failed: '+error.message,'red'); return }
    showToast('✅ Schedule saved!'); setSelectedEmployeeId(''); setShiftStart(''); setShiftEnd('')
  }
  async function saveBulkSchedule() {
    if (!shiftStart||!shiftEnd) { showToast('Please set shift start and end time.','red'); return }
    const targetEmployees = scheduleRepeat==='all' ? employees : employees.filter(e=>e.id===selectedEmployeeId)
    if (targetEmployees.length===0) { showToast('Please select an employee or choose All Employees.','red'); return }
    setBulkScheduleLoading(true)
    const startDate = new Date(scheduleDate)
    let days = 7
    if (scheduleDuration==='2weeks') days = 14
    else if (scheduleDuration==='1month') days = 30
    const records = []
    for (let d = 0; d < days; d++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + d)
      const dateStr = date.toISOString().slice(0,10)
      for (const emp of targetEmployees) {
        records.push({ employee_id: emp.id, schedule_date: dateStr, shift_start: shiftStart, shift_end: shiftEnd })
      }
    }
    // Upsert in batches of 50
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i+50)
      await supabase.from('daily_schedules').upsert(batch, { onConflict:'employee_id,schedule_date' })
    }
    setBulkScheduleLoading(false)
    await loadExistingSchedules()
    showToast(`✅ Schedule set for ${targetEmployees.length} employee(s) across ${days} days!`)
  }
  async function loadExistingSchedules() {
    const start = scheduleDate
    const end = new Date(new Date(scheduleDate).getTime() + 30*24*60*60*1000).toISOString().slice(0,10)
    const { data } = await supabase.from('daily_schedules').select('*,employees(full_name,employee_code)').gte('schedule_date', start).lte('schedule_date', end).order('schedule_date').order('employee_id')
    setExistingSchedules(data||[])
  }
  async function deleteSchedule(id) {
    await supabase.from('daily_schedules').delete().eq('id', id)
    setExistingSchedules(prev=>prev.filter(s=>s.id!==id))
    showToast('✅ Schedule removed')
  }
  function applyPayrollCutoff() {
    const [y,m] = payrollMonth.split('-').map(Number)
    if (payrollCutoff==='11-25') { setPayrollStart(`${y}-${String(m).padStart(2,'0')}-11`); setPayrollEnd(`${y}-${String(m).padStart(2,'0')}-25`) }
    else { const s=new Date(y,m-1,26),e=new Date(y,m,10); setPayrollStart(s.toISOString().slice(0,10)); setPayrollEnd(e.toISOString().slice(0,10)) }
  }
  async function computeFinalPay() {
    if (!finalPayEmployeeId||!finalPayLastDate) { showToast('Please select employee and last working date.','red'); return }
    const emp = employees.find(e=>e.id===finalPayEmployeeId); if (!emp) return
    const { data:allLogs } = await supabase.from('attendance_logs').select('*').eq('employee_id', finalPayEmployeeId).lte('attendance_date', finalPayLastDate).order('attendance_date', { ascending:false }).limit(60)
    const { data:lastPay } = await supabase.from('payroll_records').select('payroll_end').eq('employee_id', finalPayEmployeeId).order('payroll_end', { ascending:false }).limit(1)
    const lastPayEnd = lastPay?.[0]?.payroll_end || '2000-01-01'
    const unpaidDays = (allLogs?.filter(l=>l.time_in&&l.attendance_date>lastPayEnd)||[]).length
    const yearStart = `${finalPayLastDate.slice(0,4)}-01-01`
    const { data:yearPays } = await supabase.from('payroll_records').select('basic_pay').eq('employee_id', finalPayEmployeeId).gte('payroll_start', yearStart).lte('payroll_end', finalPayLastDate)
    const totalBasic = yearPays?.reduce((s,p)=>s+Number(p.basic_pay||0),0)||0
    const proRated13th = totalBasic/12
    const { data:leaves } = await supabase.from('leave_requests').select('*').eq('employee_id', finalPayEmployeeId).eq('status', 'approved').gte('leave_start', yearStart)
    const usedS=leaves?.filter(l=>l.leave_type==='Sick Leave').reduce((s,l)=>s+Number(l.duration_days||1),0)||0
    const usedV=leaves?.filter(l=>l.leave_type==='Vacation Leave').reduce((s,l)=>s+Number(l.duration_days||1),0)||0
    const unusedSIL=Math.max(0,(emp.sick_leave_balance||5)+(emp.vacation_leave_balance||5)-usedS-usedV)
    const silPay=unusedSIL*Number(emp.daily_rate||0)
    const hireDate=emp.hire_date?new Date(emp.hire_date):new Date(finalPayLastDate)
    const yearsOfService=Math.max(0,Math.floor((new Date(finalPayLastDate)-hireDate)/(1000*60*60*24*365)))
    let separationPay=0
    if (finalPayReason==='redundancy'||finalPayReason==='retrenchment') separationPay=Number(emp.daily_rate||0)*26*yearsOfService
    else if (finalPayReason==='authorized') separationPay=Number(emp.daily_rate||0)*13*yearsOfService
    else if (finalPayReason==='retirement') separationPay=Number(emp.daily_rate||0)*22.5*yearsOfService
    const { data:cas } = await supabase.from('cash_advances').select('*').eq('employee_id', finalPayEmployeeId).eq('status', 'Unpaid')
    const totalCA=cas?.reduce((s,c)=>s+Number(c.balance||0),0)||0
    const lastSalary=unpaidDays*Number(emp.daily_rate||0)
    setFinalPayResult({ employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position, hireDate:emp.hire_date||'N/A', lastDate:finalPayLastDate, yearsOfService, reason:finalPayReason, dailyRate:Number(emp.daily_rate||0), unpaidDays, lastSalary, proRated13th, unusedSIL, silPay, separationPay, totalCA, totalFinalPay:lastSalary+proRated13th+silPay+separationPay-totalCA })
  }
  async function processFinalPay() {
    if (!finalPayResult) return
    if (!window.confirm(`Process final pay for ${finalPayResult.employeeName} and deactivate?`)) return
    await supabase.from('employees').update({ is_active:false }).eq('id', finalPayEmployeeId)
    await supabase.from('final_pay_records').insert({ employee_id:finalPayEmployeeId, employee_name:finalPayResult.employeeName, employee_code:finalPayResult.employeeCode, separation_reason:finalPayReason, last_working_date:finalPayLastDate, last_salary:finalPayResult.lastSalary, pro_rated_13th:finalPayResult.proRated13th, sil_pay:finalPayResult.silPay, separation_pay:finalPayResult.separationPay, cash_advance_deduction:finalPayResult.totalCA, total_final_pay:finalPayResult.totalFinalPay }).catch(()=>{})
    await logAudit('FINAL PAY PROCESSED','Admin',finalPayResult.employeeName,`Total: ${php(finalPayResult.totalFinalPay)}`)
    showToast(`✅ Final pay processed. ${finalPayResult.employeeName} deactivated.`)
    setFinalPayResult(null); setFinalPayEmployeeId(''); loadEmployees()
  }
  async function loadPayrollHistory() {
    setHistoryLoading(true)
    // Get distinct payroll periods
    const { data } = await supabase
      .from('payroll_records')
      .select('payroll_start, payroll_end, employee_acknowledgement')
      .order('payroll_start', { ascending: false })
    setHistoryLoading(false)
    if (!data) return
    // Group by period
    const periods = {}
    for (const rec of data) {
      const key = `${rec.payroll_start}|${rec.payroll_end}`
      if (!periods[key]) {
        periods[key] = { payroll_start: rec.payroll_start, payroll_end: rec.payroll_end, total: 0, agreed: 0, disputed: 0, pending: 0 }
      }
      periods[key].total++
      if (rec.employee_acknowledgement === 'agreed') periods[key].agreed++
      else if (rec.employee_acknowledgement === 'disputed') periods[key].disputed++
      else periods[key].pending++
    }
    setPayrollHistory(Object.values(periods).sort((a,b) => b.payroll_start.localeCompare(a.payroll_start)))
  }

  async function loadHistoryRecords(start, end) {
    setSelectedHistoryPeriod({ start, end })
    setHistorySearch('')
    const { data } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('payroll_start', start)
      .eq('payroll_end', end)
      .order('employee_name')
    setHistoryRecords(data || [])
  }

  async function printDTR(empId, empName, empCode, month) {
    // month format: YYYY-MM
    const startDate = `${month}-01`
    const endDate = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).toISOString().slice(0,10)
    const { data: logs } = await supabase.from('attendance_logs').select('*')
      .eq('employee_id', empId).gte('attendance_date', startDate).lte('attendance_date', endDate)
      .order('attendance_date')
    const { data: emp } = await supabase.from('employees').select('*').eq('id', empId).single()
    const daysInMonth = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getDate()
    const monthName = new Date(month+'-01').toLocaleString('default', { month:'long', year:'numeric' })
    const totalDaysWorked = logs?.filter(l=>l.time_in).length || 0
    const totalAbsent = logs?.filter(l=>l.status==='Absent').length || 0
    const totalLate = logs?.reduce((s,l)=>s+Number(l.late_minutes||0),0) || 0
    const totalOT = logs?.filter(l=>l.overtime_approved===true).reduce((s,l)=>s+Number(l.overtime_minutes||0),0) || 0

    const rows = Array.from({length: daysInMonth}, (_,i) => {
      const dateStr = `${month}-${String(i+1).padStart(2,'0')}`
      const log = logs?.find(l=>l.attendance_date===dateStr)
      const dayName = new Date(dateStr).toLocaleDateString('en-US', {weekday:'short'})
      return `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:5px 8px;font-size:10px;color:#888;">${dayName}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;">${i+1}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;color:${log?.time_in?'#000':'#ccc'}">${log?.time_in||'—'}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;color:${log?.time_out?'#000':'#ccc'}">${log?.time_out||'—'}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;">${log?.total_break_minutes||0}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;color:${log?.late_minutes>0?'#ca1b1b':'#000'}">${log?.late_minutes||0}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;color:${log?.overtime_minutes>0?'#2d8a4e':'#000'}">${log?.overtime_approved?log.overtime_minutes:0}</td>
        <td style="padding:5px 8px;font-size:10px;text-align:center;">
          ${!log?'':log.status==='Absent'?'<span style="color:#ca1b1b;font-weight:bold;">ABS</span>':
          log.status==='Late'?'<span style="color:#f5a623;">LATE</span>':
          log.time_in?'<span style="color:#2d8a4e;">✓</span>':''}
        </td>
      </tr>`
    }).join('')

    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>DTR - ${empName} - ${monthName}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;padding:15mm;font-size:12px;color:#000;}
        table{width:100%;border-collapse:collapse;}
        th{background:#ca1b1b;color:white;padding:6px 8px;font-size:10px;}
        @media print{@page{size:A4 portrait;margin:10mm;}body{padding:5mm;}}
      </style></head><body>
      <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #ca1b1b;padding-bottom:10px;">
        <div style="font-size:20px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
        <div style="font-size:11px;color:#666;">Payroll &amp; Attendance System</div>
        <div style="font-size:15px;font-weight:bold;margin-top:6px;">DAILY TIME RECORD (DTR)</div>
        <div style="font-size:12px;margin-top:2px;">${monthName}</div>
      </div>
      <div style="background:#fff8dc;border:1px solid #ca1b1b;border-radius:6px;padding:10px;margin-bottom:14px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:15px;font-weight:bold;color:#ca1b1b;">${empName}</div>
          <div style="font-size:11px;color:#555;">Employee Code: ${empCode}</div>
          <div style="font-size:11px;color:#555;">Position: ${emp?.position||'—'} | Department: ${emp?.department||'—'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;">Days Worked: <strong>${totalDaysWorked}</strong></div>
          <div style="font-size:11px;">Absences: <strong style="color:#ca1b1b;">${totalAbsent}</strong></div>
          <div style="font-size:11px;">Total Late: <strong style="color:#f5a623;">${totalLate} min</strong></div>
          <div style="font-size:11px;">Total OT: <strong style="color:#2d8a4e;">${totalOT} min</strong></div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Day</th><th>Date</th><th>Time In</th><th>Time Out</th>
          <th>Break (min)</th><th>Late (min)</th><th>OT (min)</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f5f5f5;font-weight:bold;">
            <td colspan="2" style="padding:6px 8px;font-size:10px;">TOTALS</td>
            <td></td><td></td>
            <td style="padding:6px 8px;font-size:10px;text-align:center;">${logs?.reduce((s,l)=>s+Number(l.total_break_minutes||0),0)||0}</td>
            <td style="padding:6px 8px;font-size:10px;text-align:center;color:#ca1b1b;">${totalLate}</td>
            <td style="padding:6px 8px;font-size:10px;text-align:center;color:#2d8a4e;">${totalOT}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:30px;display:flex;justify-content:space-between;">
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:150px;padding-top:4px;font-size:10px;">Employee Signature</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:150px;padding-top:4px;font-size:10px;">Verified by</div></div>
      </div>
      <p style="text-align:center;font-size:9px;color:#aaa;margin-top:15px;">Generated by Roma's Donuts Payroll System</p>
    </body></html>`)
    pw.document.close()
    setTimeout(()=>{ pw.focus(); pw.print() },800)
  }

  function printHistoryPayslips(records, start, end) {
    if (!records.length) { showToast('No records to print.', 'red'); return }
    const pw = window.open('', '_blank', 'width=900,height=700')
    const html = records.map((pay, idx) => `
      <div class="payslip-wrap">
        <div style="width:145mm;min-height:210mm;padding:8mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000;background:white;">
          <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #ca1b1b;padding-bottom:8px;">
            <div style="font-size:20px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
            <div style="font-size:10px;color:#666;">Payroll &amp; Attendance System</div>
            <div style="font-size:13px;font-weight:bold;margin-top:4px;">EMPLOYEE PAYSLIP</div>
            <div style="font-size:10px;margin-top:2px;">Serial: ${pay.payslip_serial||'—'}</div>
            <div style="font-size:10px;color:#666;">Period: ${start} to ${end}</div>
          </div>
          <div style="background:#fff8dc;border:2px solid #ca1b1b;border-radius:6px;padding:8px;margin-bottom:10px;">
            <div style="font-size:15px;font-weight:bold;color:#ca1b1b;">${pay.employee_name}</div>
            <div style="font-size:12px;font-weight:bold;color:#555;">${pay.position||''}</div>
            <div style="font-size:10px;color:#888;">Code: ${pay.employee_code}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <tr style="background:#ca1b1b;color:white;">
              <th style="padding:5px 8px;text-align:left;font-size:10px;">Description</th>
              <th style="padding:5px 8px;text-align:right;font-size:10px;">Amount</th>
            </tr>
            <tr style="background:#f0fff0;"><td colspan="2" style="padding:4px 8px;font-weight:bold;color:#2d8a4e;font-size:10px;">EARNINGS</td></tr>
            <tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Basic Pay (${pay.worked_days||0} day(s) worked)</td><td style="padding:3px 8px;text-align:right;font-size:10px;">${'PHP '+Number(pay.basic_pay||0).toFixed(2)}</td></tr>
            ${Number(pay.overtime_pay||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Overtime Pay</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.overtime_pay).toFixed(2)}</td></tr>`:''}
            ${Number(pay.night_diff_pay||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Night Differential</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.night_diff_pay).toFixed(2)}</td></tr>`:''}
            ${Number(pay.holiday_pay||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Holiday Pay</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.holiday_pay).toFixed(2)}</td></tr>`:''}
            ${Number(pay.other_earnings||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Other Earnings / Bonus</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.other_earnings).toFixed(2)}</td></tr>`:''}
            <tr style="background:#e8f5e9;font-weight:bold;"><td style="padding:5px 8px;font-size:10px;">TOTAL EARNINGS</td><td style="padding:5px 8px;text-align:right;color:#2d8a4e;">${'PHP '+Number(pay.total_earnings||0).toFixed(2)}</td></tr>
            <tr style="background:#fff0f0;"><td colspan="2" style="padding:4px 8px;font-weight:bold;color:#ca1b1b;font-size:10px;">DEDUCTIONS</td></tr>
            ${Number(pay.late_deduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Late Deduction</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.late_deduction).toFixed(2)}</td></tr>`:''}
            ${Number(pay.undertime_deduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Undertime Deduction</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.undertime_deduction).toFixed(2)}</td></tr>`:''}
            ${Number(pay.cash_advance_deduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Cash Advance</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.cash_advance_deduction).toFixed(2)}</td></tr>`:''}
            ${Number(pay.sss_deduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">SSS Contribution</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.sss_deduction).toFixed(2)}</td></tr>`:''}
            ${Number(pay.pagibig_deduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Pag-IBIG Contribution</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.pagibig_deduction).toFixed(2)}</td></tr>`:''}
            ${Number(pay.philhealth_deduction||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">PhilHealth Contribution</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.philhealth_deduction).toFixed(2)}</td></tr>`:''}
            ${Number(pay.other_deductions||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Other Deductions</td><td style="padding:3px 8px;text-align:right;">${'PHP '+Number(pay.other_deductions).toFixed(2)}</td></tr>`:''}
            <tr style="background:#ffe8e8;font-weight:bold;"><td style="padding:5px 8px;font-size:10px;">TOTAL DEDUCTIONS</td><td style="padding:5px 8px;text-align:right;color:#ca1b1b;">${'PHP '+Number(pay.total_deductions||0).toFixed(2)}</td></tr>
          </table>
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;">
            <tr><td style="padding:4px 8px;font-size:10px;color:#555;">Days Worked</td><td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:bold;">${pay.worked_days||0}</td></tr>
            <tr><td style="padding:4px 8px;font-size:10px;color:#555;">Absences</td><td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:bold;color:#ca1b1b;">${pay.absent_days||0}</td></tr>
            <tr><td style="padding:4px 8px;font-size:10px;color:#555;">Period</td><td style="padding:4px 8px;text-align:right;font-size:10px;">${start} to ${end}</td></tr>
          </table>
          <div style="background:#ca1b1b;color:white;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;font-size:13px;">NET PAY</span>
            <span style="font-weight:bold;font-size:17px;">${'PHP '+Number(pay.net_pay||0).toFixed(2)}</span>
          </div>
          <div style="margin-top:20px;display:flex;justify-content:space-between;">
            <div style="text-align:center;"><div style="border-top:1px solid #000;width:110px;padding-top:4px;font-size:9px;">Employee Signature</div></div>
            <div style="text-align:center;"><div style="border-top:1px solid #000;width:110px;padding-top:4px;font-size:9px;">Authorized Signature</div></div>
          </div>
          <div style="text-align:center;font-size:9px;color:#999;margin-top:8px;">${pay.payslip_serial||''}</div>
        </div>
      </div>`).join('')
    pw.document.write(`<!DOCTYPE html><html><head><title>Payslips ${start} to ${end}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#e0e0e0;display:flex;flex-direction:column;align-items:center;padding:16px 0;}
        .payslip-wrap{background:white;width:145mm;margin:10px auto;box-shadow:0 2px 8px rgba(0,0,0,0.2);}
        @media print{
          @page{size:145mm 210mm;margin:0;}
          body{background:white;display:block;padding:0;}
          .payslip-wrap{box-shadow:none;margin:0;page-break-after:always;}
        }
      </style></head><body>${html}</body></html>`)
    pw.document.close()
    setTimeout(() => { pw.focus(); pw.print() }, 800)
  }

  function exportPayrollToCSV(records, start, end) {
    if (!records.length) { showToast('No records to export.', 'red'); return }
    const headers = [
      'Employee Code','Employee Name','Period Start','Period End','Worked Days',
      'Basic Pay','Overtime Pay','Night Differential','Holiday Pay','Other Earnings','Total Earnings',
      'Late Deduction','Undertime Deduction','Excess Break','Cash Advance','SSS','Pag-IBIG','PhilHealth',
      'Other Deductions','Total Deductions','Net Pay','Status','Serial No'
    ]
    const rows = records.map(r => [
      r.employee_code, r.employee_name, r.payroll_start||start, r.payroll_end||end, r.worked_days||0,
      Number(r.basic_pay||r.basicPay||0).toFixed(2),
      Number(r.overtime_pay||r.overtimePay||0).toFixed(2),
      Number(r.night_diff_pay||r.nightDiffPay||0).toFixed(2),
      Number(r.holiday_pay||r.holidayPay||0).toFixed(2),
      Number(r.other_earnings||r.adjustmentEarnings||0).toFixed(2),
      Number(r.total_earnings||r.totalEarnings||0).toFixed(2),
      Number(r.late_deduction||r.lateDeduction||0).toFixed(2),
      Number(r.undertime_deduction||r.undertimeDeduction||0).toFixed(2),
      Number(r.other_deductions||r.excessBreakDeduction||0).toFixed(2),
      Number(r.cash_advance_deduction||r.cashAdvanceDeduction||0).toFixed(2),
      Number(r.sss_deduction||r.sssDeduction||0).toFixed(2),
      Number(r.pagibig_deduction||r.pagibigDeduction||0).toFixed(2),
      Number(r.philhealth_deduction||r.philhealthDeduction||0).toFixed(2),
      Number(r.other_deductions||r.adjustmentDeductions||0).toFixed(2),
      Number(r.total_deductions||r.totalDeductions||0).toFixed(2),
      Number(r.net_pay||r.netPay||0).toFixed(2),
      r.employee_acknowledgement||'pending',
      r.payslip_serial||r.payslipSerial||''
    ])
    // Add totals row
    rows.push([])
    rows.push([
      '','TOTALS','','','',
      records.reduce((s,r)=>s+Number(r.basic_pay||r.basicPay||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.overtime_pay||r.overtimePay||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.night_diff_pay||r.nightDiffPay||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.holiday_pay||r.holidayPay||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.other_earnings||r.adjustmentEarnings||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.total_earnings||r.totalEarnings||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.late_deduction||r.lateDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.undertime_deduction||r.undertimeDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.other_deductions||r.excessBreakDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.cash_advance_deduction||r.cashAdvanceDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.sss_deduction||r.sssDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.pagibig_deduction||r.pagibigDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.philhealth_deduction||r.philhealthDeduction||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.other_deductions||r.adjustmentDeductions||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.total_deductions||r.totalDeductions||0),0).toFixed(2),
      records.reduce((s,r)=>s+Number(r.net_pay||r.netPay||0),0).toFixed(2),
      '','',''
    ])
    const csvContent = [headers, ...rows].map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob(['﻿'+csvContent], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Payroll_${start}_to_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('✅ Payroll exported to CSV!')
  }

  async function computePayroll() {
    const { data:existing } = await supabase.from('payroll_records').select('id,employee_acknowledgement').eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd)
    if (existing&&existing.length>0) {
      // Check if locked (all agreed or any agreed)
      const hasAgreed = existing.some(r=>r.employee_acknowledgement==='agreed')
      const allDone = existing.every(r=>r.employee_acknowledgement==='agreed'||r.employee_acknowledgement==='disputed')
      if (allDone) {
        showToast('🔒 This payroll period is locked — all employees have acknowledged.','red')
        return
      }
      if (hasAgreed) {
        if (!window.confirm('⚠️ WARNING: Some employees have already acknowledged this payroll. Overwriting will reset their acknowledgements. Are you sure?')) return
      } else {
        if (!window.confirm('Payroll for this period already exists. Overwrite?')) return
      }
      await supabase.from('payroll_records').delete().eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd)
    }
    setPayrollComputing(true)
    const { data:empList } = await supabase.from('employees').select('*').eq('is_active', true)
    const { data:holidayList } = await supabase.from('holidays').select('*').gte('holiday_date', payrollStart).lte('holiday_date', payrollEnd)
    const results = []
    const startDay = Number(payrollStart.split('-')[2])
    const isFirstCutoff = startDay>=11&&startDay<=25
    for (const emp of empList||[]) {
      const { data:logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).gte('attendance_date', payrollStart).lte('attendance_date', payrollEnd)
      const { data:leaves } = await supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').gte('leave_start', payrollStart).lte('leave_end', payrollEnd)
      const { data:cas } = await supabase.from('cash_advances').select('*').eq('employee_id', emp.id).eq('status', 'Unpaid')
      const { data:adjs } = await supabase.from('payroll_adjustments').select('*').eq('employee_id', emp.id).gte('adjustment_date', payrollStart).lte('adjustment_date', payrollEnd)
      const workedDays=logs?.filter(l=>l.time_in).length||0
      const absentDays=logs?.filter(l=>l.status==='Absent').length||0
      const paidLeaveDays=leaves?.filter(l=>l.is_paid).length||0
      const dailyRate=Number(emp.daily_rate||0)
      const hourlyRate=dailyRate/8
      const minuteRate=hourlyRate/60

      // ── Hourly-based Basic Pay (computed from actual clock-in/out) ──────────
      const workedLogs=logs?.filter(l=>l.time_in&&l.time_out)||[]
      let basicPay=0, totalWorkedMinutes=0
      for (const log of workedLogs) {
        const inM=minutesFromTime(log.time_in)
        const outM=minutesFromTime(log.time_out)+(minutesFromTime(log.time_out)<minutesFromTime(log.time_in)?24*60:0)
        const breakMins=Number(log.total_break_minutes||0)
        const actualMins=Math.max(0,outM-inM-breakMins)
        totalWorkedMinutes+=actualMins
        basicPay+=actualMins*minuteRate
      }
      // Add paid leave days at full daily rate
      basicPay+=paidLeaveDays*dailyRate

      // ── Birthday Pay ────────────────────────────────────────────────────────
      let birthdayPay=0
      if (emp.date_of_birth) {
        const bdMMDD=emp.date_of_birth.slice(5) // MM-DD
        // Check dates in both the payroll year and next year (for Jan cutoffs)
        const years=[payrollStart.slice(0,4), String(Number(payrollStart.slice(0,4))+1)]
        for (const yr of years) {
          const bdFull=`${yr}-${bdMMDD}`
          if (bdFull>=payrollStart&&bdFull<=payrollEnd) {
            const workedLog=workedLogs.find(l=>l.attendance_date===bdFull)
            if (workedLog) {
              // Worked on birthday → 200% = base already counted above, add extra 100%
              const inM=minutesFromTime(workedLog.time_in)
              const outM=minutesFromTime(workedLog.time_out)+(minutesFromTime(workedLog.time_out)<minutesFromTime(workedLog.time_in)?24*60:0)
              const brkMins=Number(workedLog.total_break_minutes||0)
              const actualMins=Math.max(0,outM-inM-brkMins)
              birthdayPay+=actualMins*minuteRate // extra 100% on top → total 200%
            } else {
              // Didn't work but birthday falls in period → give full day pay
              birthdayPay+=dailyRate
            }
          }
        }
      }

      // ── Overtime ─────────────────────────────────────────────────────────────
      const overtimeMinutes=logs?.filter(l=>l.overtime_approved===true).reduce((s,l)=>s+Number(l.overtime_minutes||0),0)||0
      const overtimePay=overtimeMinutes*minuteRate*1.25

      // ── Night Differential (10%) ──────────────────────────────────────────────
      let nightDiffPay=0
      for (const log of workedLogs) {
        const inM=minutesFromTime(log.time_in),outM=minutesFromTime(log.time_out)+(minutesFromTime(log.time_out)<minutesFromTime(log.time_in)?24*60:0)
        const os=Math.max(inM,22*60),oe=Math.min(outM,30*60)
        if (oe>os) nightDiffPay+=(oe-os)*minuteRate*0.10
      }

      // ── Holiday Pay ────────────────────────────────────────────────────────────
      let holidayPay=0
      for (const h of holidayList||[]) {
        const worked=workedLogs.find(l=>l.attendance_date===h.holiday_date)
        if (h.holiday_type==='regular') holidayPay+=worked?dailyRate:0   // extra 100% on top of hourly pay → 200% total
        else if (h.holiday_type==='special') holidayPay+=worked?dailyRate*0.3:0  // 30% premium
      }

      // ── Cash Advance, Adjustments, Government Contributions ───────────────────
      let caDeduction=0
      for (const ca of cas||[]) caDeduction+=ca.per_payroll_deduction?Number(ca.per_payroll_deduction):Number(ca.balance||0)
      let adjEarnings=0,adjDeductions=0
      for (const adj of adjs||[]) { if (adj.adjustment_type==='addition') adjEarnings+=Number(adj.amount||0); else adjDeductions+=Number(adj.amount||0) }
      const sssDeduction=workedDays>0&&emp.has_sss&&isFirstCutoff?375:0
      const pagibigDeduction=workedDays>0&&emp.has_pagibig&&!isFirstCutoff?200:0
      const philhealthDeduction=workedDays>0&&emp.has_philhealth&&!isFirstCutoff?250:0
      const totalEarnings=basicPay+birthdayPay+overtimePay+nightDiffPay+holidayPay+adjEarnings
      const totalDeductions=caDeduction+sssDeduction+pagibigDeduction+philhealthDeduction+adjDeductions
      const lateMinutesInfo=logs?.reduce((s,l)=>s+Number(l.late_minutes||0),0)||0
      const undertimeMinutesInfo=logs?.reduce((s,l)=>s+Number(l.undertime_minutes||0),0)||0
      results.push({ employeeId:emp.id, employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position||'', workedDays, absentDays, paidLeaveDays, totalWorkedMinutes, hourlyRate, basicPay, birthdayPay, overtimePay, overtimeMinutes, nightDiffPay, holidayPay, adjustmentEarnings:adjEarnings, totalEarnings, cashAdvanceDeduction:caDeduction, sssDeduction, pagibigDeduction, philhealthDeduction, adjustmentDeductions:adjDeductions, totalDeductions, netPay:totalEarnings-totalDeductions, lateMinutes:lateMinutesInfo, undertimeMinutes:undertimeMinutesInfo, bankName:emp.bank_name||'', bankAccount:emp.bank_account_number||'', mobileNumber:emp.contact_number||'' })
    } // end for emp
    for (const pay of results) {
      const { data:empCAs } = await supabase.from('cash_advances').select('*').eq('employee_id', pay.employeeId).eq('status', 'Unpaid')
      for (const ca of empCAs||[]) {
        const ded=ca.per_payroll_deduction?Number(ca.per_payroll_deduction):Number(ca.balance||0)
        const newBal=Math.max(0,Number(ca.balance||0)-ded), newRem=Math.max(0,Number(ca.installments_remaining||1)-1)
        await supabase.from('cash_advances').update({ amount_paid:Number(ca.amount_paid||0)+ded, balance:newBal, installments_remaining:newRem, status:newBal<=0||newRem<=0?'Paid':'Unpaid' }).eq('id', ca.id)
      }
      await supabase.from('payroll_records').insert([{ employee_id:pay.employeeId, employee_code:pay.employeeCode, employee_name:pay.employeeName, payroll_start:payrollStart, payroll_end:payrollEnd, worked_days:pay.workedDays, basic_pay:pay.basicPay, birthday_pay:pay.birthdayPay||0, overtime_pay:pay.overtimePay, night_diff_pay:pay.nightDiffPay, holiday_pay:pay.holidayPay, other_earnings:pay.adjustmentEarnings, total_earnings:pay.totalEarnings, late_minutes:pay.lateMinutes||0, undertime_minutes:pay.undertimeMinutes||0, cash_advance_deduction:pay.cashAdvanceDeduction, sss_deduction:pay.sssDeduction, pagibig_deduction:pay.pagibigDeduction, philhealth_deduction:pay.philhealthDeduction, other_deductions:pay.adjustmentDeductions, total_deductions:pay.totalDeductions, net_pay:pay.netPay, employee_acknowledgement:'pending', payslip_serial:genSerial(payrollStart,results.indexOf(pay)) }])
    }
    const s={ totalEmployees:results.length, totalBasicPay:results.reduce((a,p)=>a+p.basicPay,0), totalBirthdayPay:results.reduce((a,p)=>a+(p.birthdayPay||0),0), totalOvertimePay:results.reduce((a,p)=>a+p.overtimePay,0), totalNightDiff:results.reduce((a,p)=>a+p.nightDiffPay,0), totalHolidayPay:results.reduce((a,p)=>a+p.holidayPay,0), totalEarnings:results.reduce((a,p)=>a+p.totalEarnings,0), totalDeductions:results.reduce((a,p)=>a+p.totalDeductions,0), totalNetPay:results.reduce((a,p)=>a+p.netPay,0), totalSSS:results.reduce((a,p)=>a+p.sssDeduction,0), totalPagibig:results.reduce((a,p)=>a+p.pagibigDeduction,0), totalPhilhealth:results.reduce((a,p)=>a+p.philhealthDeduction,0), totalCA:results.reduce((a,p)=>a+p.cashAdvanceDeduction,0) }
    setPayrollResults(results); setPayrollSummary(s); setPayrollComputing(false)
    await logAudit('PAYROLL COMPUTED','Admin','ALL',`${payrollStart} to ${payrollEnd} — ${results.length} employees`)
    showToast('✅ Payroll computed successfully!')
    // Schedule auto-acknowledge after 5 days (stored in DB as a flag)
    const deadline = new Date(); deadline.setDate(deadline.getDate()+5)
    await supabase.from('payroll_periods').upsert({
      payroll_start: payrollStart, payroll_end: payrollEnd,
      acknowledge_deadline: deadline.toISOString().slice(0,10),
      computed_at: new Date().toISOString()
    }, { onConflict:'payroll_start,payroll_end' }).then(()=>{}).catch(()=>{})
  }

  // Auto-acknowledge expired payslips (called on admin dashboard load)
  async function autoAcknowledgeExpired() {
    const { data: periods } = await supabase.from('payroll_periods').select('*').lte('acknowledge_deadline', today)
    for (const period of periods||[]) {
      await supabase.from('payroll_records')
        .update({ employee_acknowledgement: 'auto-acknowledged' })
        .eq('payroll_start', period.payroll_start)
        .eq('payroll_end', period.payroll_end)
        .eq('employee_acknowledgement', 'pending')
    }
  }
  function printAllPayslips() {
    if (payrollResults.length===0) { showToast('No payroll results to print.','red'); return }
    const pw = window.open('','_blank','width=900,height=700')
    const html = payrollResults.map((pay,idx)=>buildPayslipHTML(pay,payrollStart,payrollEnd,idx)).join('')
    pw.document.write(`<!DOCTYPE html><html><head><title>All Payslips</title>${printCSS}</head><body>${html}</body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },800)
  }
  function printSinglePayslip(pay, idx) {
    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>Payslip</title>${printCSS}</head><body>${buildPayslipHTML(pay,payrollStart,payrollEnd,idx)}</body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },800)
  }
  function printFinalPay(fp) {
    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>Final Pay</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:15mm;font-size:12px;color:#000;}
      @media print{@page{size:A4;margin:15mm;}}</style></head><body>
      <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #ca1b1b;padding-bottom:10px;">
        <div style="font-size:22px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
        <div style="font-size:10px;color:#666;">Payroll &amp; Attendance System</div>
        <div style="font-size:16px;font-weight:bold;margin-top:4px;">FINAL PAY SLIP</div>
      </div>
      <div style="background:#fff8dc;border:2px solid #ca1b1b;border-radius:6px;padding:10px;margin-bottom:14px;">
        <div style="font-size:18px;font-weight:bold;color:#ca1b1b;">${fp.employeeName}</div>
        <div style="font-size:13px;font-weight:bold;color:#555;">${fp.position||''}</div>
        <div style="font-size:11px;color:#888;">Code: ${fp.employeeCode}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr style="background:#f5f5f5;"><td style="padding:6px 10px;font-weight:bold;border:1px solid #eee;">Hire Date</td><td style="padding:6px 10px;border:1px solid #eee;">${fp.hireDate}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;border:1px solid #eee;">Last Working Date</td><td style="padding:6px 10px;border:1px solid #eee;">${fp.lastDate}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:6px 10px;font-weight:bold;border:1px solid #eee;">Years of Service</td><td style="padding:6px 10px;border:1px solid #eee;">${fp.yearsOfService} year(s)</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;border:1px solid #eee;">Separation Reason</td><td style="padding:6px 10px;border:1px solid #eee;">${fp.reason}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:6px 10px;font-weight:bold;border:1px solid #eee;">Daily Rate</td><td style="padding:6px 10px;border:1px solid #eee;">${php(fp.dailyRate)}</td></tr>
      </table>
      <div style="background:#e8f5e9;padding:8px 10px;font-weight:bold;color:#2d8a4e;margin-bottom:2px;border-radius:4px;">FINAL PAY COMPONENTS</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr><td style="padding:5px 10px;border:1px solid #eee;">Last Salary (${fp.unpaidDays} day(s))</td><td style="padding:5px 10px;text-align:right;border:1px solid #eee;">${php(fp.lastSalary)}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:5px 10px;border:1px solid #eee;">Pro-rated 13th Month Pay</td><td style="padding:5px 10px;text-align:right;border:1px solid #eee;">${php(fp.proRated13th)}</td></tr>
        <tr><td style="padding:5px 10px;border:1px solid #eee;">Unused SIL (${fp.unusedSIL} day(s))</td><td style="padding:5px 10px;text-align:right;border:1px solid #eee;">${php(fp.silPay)}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:5px 10px;border:1px solid #eee;">Separation Pay</td><td style="padding:5px 10px;text-align:right;border:1px solid #eee;">${php(fp.separationPay)}</td></tr>
      </table>
      <div style="background:#fff0f0;padding:8px 10px;font-weight:bold;color:#ca1b1b;margin-bottom:2px;border-radius:4px;">DEDUCTIONS</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr><td style="padding:5px 10px;border:1px solid #eee;">Outstanding Cash Advance</td><td style="padding:5px 10px;text-align:right;border:1px solid #eee;">${php(fp.totalCA)}</td></tr>
      </table>
      <div style="background:#ca1b1b;color:white;padding:12px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:bold;font-size:14px;">TOTAL FINAL PAY</span>
        <span style="font-weight:bold;font-size:20px;">${php(fp.totalFinalPay)}</span>
      </div>
      <div style="margin-top:40px;display:flex;justify-content:space-between;">
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:150px;padding-top:4px;font-size:10px;">Employee Signature</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:150px;padding-top:4px;font-size:10px;">Authorized Signature</div></div>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },800)
  }

  // ── Camera Screen ─────────────────────────────────────────────────────────
  if (cameraMode) {
    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px', zIndex:9999 }}>
        <h2 style={{ color:'white', marginBottom:'8px', fontSize:'18px' }}>{cameraMode==='timein'?'📸 Selfie for Time In':'📸 Selfie for Time Out'}</h2>
        <p style={{ color:'#aaa', marginBottom:'16px', fontSize:'13px' }}>Take a clear selfie to confirm your attendance</p>
        {!capturedPhoto ? (
          <>
            <video ref={videoRef} autoPlay playsInline style={{ width:'100%', maxWidth:'360px', borderRadius:'14px', border:'3px solid #ca1b1b' }} />
            <canvas ref={canvasRef} style={{ display:'none' }} />
            <button style={{ ...btnRed, maxWidth:'360px', marginTop:'16px' }} onClick={capturePhoto}>📸 TAKE SELFIE</button>
          </>
        ) : (
          <>
            <img src={capturedPhoto} alt="Selfie" style={{ width:'100%', maxWidth:'360px', borderRadius:'14px', border:'3px solid #2d8a4e' }} />
            <div style={{ display:'flex', gap:'10px', marginTop:'16px', width:'100%', maxWidth:'360px' }}>
              <button style={{ ...btnGray, flex:1, marginTop:0 }} onClick={retakePhoto}>🔄 RETAKE</button>
              <button style={{ ...btnGreen, flex:1, marginTop:0 }} onClick={cameraMode==='timein'?confirmTimeIn:confirmTimeOut} disabled={loading}>{loading?'⏳ SAVING...':'✅ CONFIRM'}</button>
            </div>
          </>
        )}
        <button style={{ ...btnGray, maxWidth:'360px', marginTop:'12px' }} onClick={()=>{ setCameraMode(null); setCapturedPhoto(null); stopCamera() }}>CANCEL</button>
      </div>
    )
  }

  // ── Admin Render ──────────────────────────────────────────────────────────
  if (adminMode) {
    const tabs = [
      ['dashboard','🏠 Dashboard'],['attendance','📋 Attendance'],['employees','👥 Employees'],['auditTrail','📜 Audit Trail'],
      ['schedule','📅 Schedule'],['holidays','🗓️ Holidays'],['overtime','⏰ OT / UT Requests'],
      ['adjustment','⚙️ Adjustment'],['payroll','💰 Payroll'],['thirteenth','🎁 13th Month'],
      ['finalpay','📄 Final Pay'],['payrollHistory','📂 Payroll History'],['remittance','🏛️ Remittance Report'],['dtr','📋 DTR Print'],['bankDisbursement','🏦 Bank Disbursement'],['announcements','📢 Announcements'],
      ['leaveRequests','🏖️ Leave Requests 🔔'],['cashRequests','💵 CA Requests 🔔'],['disputes','⚠️ Disputes 🔔'],['contracts','📄 Contracts'],
    ].filter(([key]) => canAccess(key))
    const filteredResults = payrollResults.filter(p=>p.employeeName.toLowerCase().includes(payrollSearch.toLowerCase())||p.employeeCode.toLowerCase().includes(payrollSearch.toLowerCase()))

    // ── Open full employee portal from admin panel ─────────────────────────
    const openAdminEmployeePortal = () => {
      if (!adminEmployee) { showToast('No employee record linked to your admin account. Ask owner to assign your employee profile.', 'red'); return }
      setEmployee(adminEmployee)
      setProfilePhotoUrl(adminEmployee.profile_photo_url || null)
      loadTodayLog(adminEmployee)
      loadTodaySchedule(adminEmployee)
      loadMyPayslips(adminEmployee)
      loadMyCashAdvances(adminEmployee)
      loadMyAttendanceHistory(adminEmployee)
      loadMyLeaveBalance(adminEmployee)
      checkAnnouncements(adminEmployee)
      setCameFromAdmin(true)
      setAdminMode(false)
    }

    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f0f0f0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {showPayrollReminder && (
          <div style={{ background:'#ca1b1b', color:'white', padding:'10px 20px', textAlign:'center', fontWeight:'bold', fontSize:'13px', flexShrink:0, zIndex:100 }}>
            🔔 PAYROLL REMINDER: Salary release is on the {currentDay===11?'15th':'30th'}. Please compute and release payroll on time!
          </div>
        )}
        {toast && (
          <div style={{ position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:toast.color==='red'?'#ca1b1b':'#2d8a4e', color:'white', padding:'12px 28px', borderRadius:'10px', fontWeight:'bold', fontSize:'14px', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', whiteSpace:'nowrap', pointerEvents:'none' }}>
            {toast.msg}
          </div>
        )}
        <div style={{ flex:1, display:'flex', flexDirection:isMobile?'column':'row', overflow:'hidden' }}>
          {isMobile && (
            <div style={{ background:'#ca1b1b', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <img src="/logo.png" alt="Logo" style={{ width:'30px', height:'30px', objectFit:'contain' }} />
                <span style={{ color:'white', fontWeight:'bold', fontSize:'15px' }}>Admin Dashboard</span>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {adminEmployee && (
                  <button onClick={openAdminEmployeePortal} style={{ background:'#2d8a4e', border:'none', color:'white', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }}>⏰ MY TIME</button>
                )}
                <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.5)', color:'white', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold' }}>{sidebarOpen?'✕':'☰'}</button>
              </div>
            </div>
          )}

          {(!isMobile||sidebarOpen) && (
            <div style={{ width:isMobile?'100%':'240px', minWidth:isMobile?'auto':'240px', background:'#fff8f8', borderRight:isMobile?'none':'2px solid #eee', padding:'14px 10px', display:'flex', flexDirection:'column', gap:'4px', flexShrink:0, overflowY:'auto', height:isMobile?'auto':'100%' }}>
              {!isMobile && (
                <>
                  <img src="/logo.png" alt="Logo" style={{ width:'65px', height:'65px', objectFit:'contain', margin:'0 auto 4px' }} />
                  <h2 style={{ color:'#ca1b1b', textAlign:'center', margin:'0 0 8px', fontSize:'13px' }}>Admin Dashboard</h2>
                </>
              )}
              {/* Role badge */}
              <div style={{ background:'#ca1b1b', color:'white', borderRadius:'8px', padding:'6px 10px', marginBottom:'6px', textAlign:'center', fontSize:'11px', fontWeight:'bold' }}>
                {adminRole==='owner'?'👑 Owner':adminRole==='hr'?'👤 HR Admin':adminRole==='payroll'?'💰 Payroll Officer':'👁 Supervisor'}
              </div>
              {tabs.filter(([key])=>canAccess(key)).map(([key,label])=>(
                <button key={key} onClick={()=>{
                  setActiveTab(key); setSidebarOpen(false)
                  if(key==='leaveRequests') loadLeaveRequests()
                  if(key==='cashRequests') loadCashAdvanceRequests()
                  if(key==='disputes') loadPayslipDisputes()
                  if(key==='overtime') loadTimeAdjRequests()
                  if(key==='holidays') loadHolidays()
                  if(key==='announcements') loadAnnouncements()
                  if(key==='dashboard') { loadDashboard(); loadDashboardCharts() }
                  if(key==='auditTrail') loadAuditTrail()
                  if(key==='payrollHistory') loadPayrollHistory()
                  if(key==='remittance') loadPayrollHistory()
                  if(key==='dtr') loadEmployees()
                  if(key==='contracts') { loadContracts(); loadEmployees() }
                }} style={{ padding:'9px 10px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'12px', textAlign:'left', width:'100%', background:activeTab===key?'#ca1b1b':'#f0f0f0', color:activeTab===key?'white':'#333' }}>{label}</button>
              ))}
              {adminEmployee && (
                <button style={{ padding:'9px 10px', borderRadius:'8px', border:'2px solid #2d8a4e', cursor:'pointer', fontWeight:'bold', fontSize:'12px', textAlign:'left', width:'100%', background:'#e8f5e9', color:'#2d8a4e', marginTop:'8px' }} onClick={openAdminEmployeePortal}>⏰ MY ATTENDANCE</button>
              )}
              <button style={{ padding:'9px 10px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'12px', textAlign:'left', width:'100%', background:'#222', color:'white', marginTop:'4px' }} onClick={()=>{ setAdminMode(false); setAdminEmployee(null) }}>← Back to Login</button>
            </div>
          )}

          <div style={{ flex:1, minWidth:0, padding:isMobile?'14px':'28px', overflowY:'auto', height:'100%', background:'#fafafa' }}>

            {/* DASHBOARD */}
            {activeTab==='dashboard' && (
              <div>
                <h2 style={h2s}>🏠 Dashboard — {today}</h2>
                {!dashboardData && <p style={{ color:'#888' }}>Loading...</p>}
                {dashboardData && (
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
                    {[
                      ['👥 Total Employees', dashboardData.totalEmployees, 'blue', 'employees'],
                      ['🟢 Timed In', dashboardData.timedIn, 'green', 'attendance'],
                      ['✅ Timed Out', dashboardData.timedOut, 'gray', 'attendance'],
                      ['🔴 Absent Today', dashboardData.absent, 'red', 'attendance'],
                      ['🏖️ Pending Leave', dashboardData.pendingLeave, dashboardData.pendingLeave>0?'orange':'gray', 'leaveRequests'],
                      ['💵 Pending CA', dashboardData.pendingCA, dashboardData.pendingCA>0?'orange':'gray', 'cashRequests'],
                      ['⏰ Pending OT/UT', dashboardData.pendingOT, dashboardData.pendingOT>0?'orange':'gray', 'overtime'],
                      ['⚠️ Disputes', dashboardData.pendingDisputes, dashboardData.pendingDisputes>0?'red':'gray', 'disputes'],
                    ].map(([label,value,color,tab])=>(
                      <div key={label} onClick={()=>{ setActiveTab(tab); if(tab==='leaveRequests')loadLeaveRequests(); if(tab==='cashRequests')loadCashAdvanceRequests(); if(tab==='overtime')loadTimeAdjRequests(); if(tab==='disputes')loadPayslipDisputes(); }} style={{ background:'white', border:`2px solid ${color==='red'?'#ca1b1b':color==='green'?'#2d8a4e':color==='orange'?'#f5a623':color==='blue'?'#4a90d9':'#ddd'}`, borderRadius:'12px', padding:'16px', textAlign:'center', cursor:'pointer', userSelect:'none', transition:'all 0.15s' }} onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 4px 15px rgba(0,0,0,0.12)' }} onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none' }}>
                        <p style={{ color:'#888', fontSize:'11px', margin:'0 0 6px' }}>{label}</p>
                        <p style={{ fontWeight:'bold', fontSize:'26px', margin:'0 0 4px', color:color==='red'?'#ca1b1b':color==='green'?'#2d8a4e':color==='orange'?'#f5a623':color==='blue'?'#4a90d9':'#555' }}>{value}</p>
                        <p style={{ color:'#bbb', fontSize:'10px', margin:0 }}>tap to view →</p>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginBottom:'12px' }}>
                    <button style={{ ...btnGreen, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={async()=>{ await loadDashboard(); await loadDashboardCharts(); showToast('✅ Dashboard refreshed!') }}>🔄 REFRESH</button>
                    {(adminRole==='owner'||adminRole==='hr') && (
                      <button style={{ ...btnBlack, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={autoApplySIL}>🌿 AUTO-APPLY SIL</button>
                    )}
                  </div>

                {/* Probationary Alerts */}
                {dashboardData?.probDue?.length > 0 && (
                  <div style={{ background:'#fff8dc', border:'2px solid #f5a623', borderRadius:'12px', padding:'14px', marginBottom:'14px' }}>
                    <p style={{ fontWeight:'bold', color:'#f5a623', fontSize:'13px', margin:'0 0 8px' }}>⚠️ Probationary Employees Due for Review ({dashboardData.probDue.length})</p>
                    {dashboardData.probDue.map(e=>{
                      const months = Math.floor((new Date()-new Date(e.hire_date))/(1000*60*60*24*30))
                      return (
                        <div key={e.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee', flexWrap:'wrap', gap:'6px' }}>
                          <div>
                            <span style={{ fontWeight:'bold', fontSize:'13px' }}>{e.full_name}</span>
                            <span style={{ color:'#888', fontSize:'11px', marginLeft:'8px' }}>{e.employee_code} | {e.position}</span>
                          </div>
                          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                            <Badge label={`${months} months in`} color="orange" />
                            <button style={{ ...btnGreen, width:'auto', padding:'4px 10px', marginTop:0, fontSize:'11px' }} onClick={async()=>{
                              await supabase.from('employees').update({ employment_type:'regular' }).eq('id', e.id)
                              await logAudit('REGULARIZED','Admin',e.full_name,`Regularized after ${months} months`)
                              showToast(`✅ ${e.full_name} regularized!`)
                              loadDashboard()
                            }}>✅ REGULARIZE</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Birthdays & Anniversaries */}
                {(dashboardData?.birthdays?.length > 0 || dashboardData?.anniversaries?.length > 0) && (
                  <div style={{ background:'#f0fff0', border:'1px solid #c8e6c9', borderRadius:'12px', padding:'14px', marginBottom:'14px' }}>
                    {dashboardData.birthdays?.length > 0 && (
                      <div style={{ marginBottom:dashboardData.anniversaries?.length>0?'10px':0 }}>
                        <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 6px' }}>🎂 Birthdays This Week</p>
                        {dashboardData.birthdays.map(e=>(
                          <p key={e.id} style={cps}>🎉 <strong>{e.full_name}</strong> — {e.date_of_birth?.slice(5)}</p>
                        ))}
                      </div>
                    )}
                    {dashboardData.anniversaries?.length > 0 && (
                      <div>
                        <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 6px' }}>🏆 Work Anniversaries This Week</p>
                        {dashboardData.anniversaries.map(e=>{
                          const years = new Date().getFullYear() - new Date(e.hire_date).getFullYear()
                          return <p key={e.id} style={cps}>🎊 <strong>{e.full_name}</strong> — {years} year(s)</p>
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Attendance Chart */}
                {attendanceStats.length > 0 && (
                  <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'18px', marginTop:'20px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 16px', fontSize:'14px' }}>📊 Monthly Attendance (Last 6 Months)</h3>
                    <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', height:'120px', borderBottom:'2px solid #eee', paddingBottom:'8px' }}>
                      {attendanceStats.map(s=>{
                        const max = Math.max(...attendanceStats.map(x=>x.present+x.absent+x.late), 1)
                        const total = s.present+s.absent+s.late
                        return (
                          <div key={s.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', height:'100%', justifyContent:'flex-end' }}>
                            <span style={{ fontSize:'10px', color:'#888', marginBottom:'2px' }}>{total}</span>
                            <div style={{ width:'100%', display:'flex', flexDirection:'column', borderRadius:'4px 4px 0 0', overflow:'hidden' }}>
                              <div style={{ background:'#2d8a4e', height:`${(s.present/Math.max(total,1))*80}px`, width:'100%', minHeight:s.present>0?2:0 }} title={`Present: ${s.present}`} />
                              <div style={{ background:'#f5a623', height:`${(s.late/Math.max(total,1))*80}px`, width:'100%', minHeight:s.late>0?2:0 }} title={`Late: ${s.late}`} />
                              <div style={{ background:'#ca1b1b', height:`${(s.absent/Math.max(total,1))*80}px`, width:'100%', minHeight:s.absent>0?2:0 }} title={`Absent: ${s.absent}`} />
                            </div>
                            <span style={{ fontSize:'9px', color:'#888', marginTop:'4px', textAlign:'center' }}>{s.month.slice(5)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex', gap:'16px', marginTop:'10px', flexWrap:'wrap' }}>
                      {[['#2d8a4e','Present'],['#f5a623','Late'],['#ca1b1b','Absent']].map(([c,l])=>(
                        <div key={l} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <div style={{ width:'12px', height:'12px', background:c, borderRadius:'2px' }} />
                          <span style={{ fontSize:'11px', color:'#555' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payroll Cost Chart */}
                {payrollCostStats.length > 0 && (
                  <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'18px', marginTop:'12px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 16px', fontSize:'14px' }}>💰 Payroll Cost This Year</h3>
                    <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', height:'100px', borderBottom:'2px solid #eee', paddingBottom:'8px' }}>
                      {payrollCostStats.map(s=>{
                        const max = Math.max(...payrollCostStats.map(x=>x.total), 1)
                        return (
                          <div key={s.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', height:'100%', justifyContent:'flex-end' }}>
                            <span style={{ fontSize:'9px', color:'#888' }}>₱{(s.total/1000).toFixed(0)}k</span>
                            <div style={{ background:'#ca1b1b', width:'100%', height:`${(s.total/max)*80}px`, borderRadius:'4px 4px 0 0', minHeight:s.total>0?4:0 }} />
                            <span style={{ fontSize:'9px', color:'#888', marginTop:'4px' }}>{s.month.slice(5)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                  <button style={{ ...btnBlack, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={()=>setShowLocationSetting(!showLocationSetting)}>📍 SET STORE LOCATION</button>
                </div>
                {showLocationSetting && (
                  <div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'20px', marginTop:'16px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 12px', fontSize:'15px' }}>📍 Store Location Settings</h3>
                    <p style={{ color:'#888', fontSize:'13px', marginBottom:'14px' }}>Set the GPS coordinates of your store. Employees must be within the radius to time in/out.</p>
                    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
                      <div style={{ flex:1, minWidth:'140px' }}>
                        <label style={lblS}>Latitude:</label>
                        <input type="number" step="0.000001" value={storeLocation.lat} onChange={e=>setStoreLocation(p=>({...p,lat:Number(e.target.value)}))} style={inputStyle} />
                      </div>
                      <div style={{ flex:1, minWidth:'140px' }}>
                        <label style={lblS}>Longitude:</label>
                        <input type="number" step="0.000001" value={storeLocation.lng} onChange={e=>setStoreLocation(p=>({...p,lng:Number(e.target.value)}))} style={inputStyle} />
                      </div>
                      <div style={{ flex:1, minWidth:'120px' }}>
                        <label style={lblS}>Radius (meters):</label>
                        <input type="number" value={storeLocation.radius} onChange={e=>setStoreLocation(p=>({...p,radius:Number(e.target.value)}))} style={inputStyle} />
                      </div>
                    </div>
                    {locationStatus && <p style={{ color: locationStatus.includes('✅')?'#2d8a4e':'#ca1b1b', fontSize:'13px', margin:'0 0 10px', fontWeight:'bold' }}>{locationStatus}</p>}
                    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={detectStoreLocation}>🎯 DETECT MY LOCATION</button>
                      <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={()=>{ showToast('✅ Store location saved!'); setShowLocationSetting(false); setLocationStatus('') }}>💾 SAVE LOCATION</button>
                    </div>
                    <div style={{ background:'#f9f9f9', borderRadius:'8px', padding:'10px', marginTop:'12px', fontSize:'12px', color:'#666' }}>
                      <p style={{ margin:'0 0 4px', fontWeight:'bold', color:'#333' }}>Current Store Location:</p>
                      <p style={{ margin:'2px 0' }}>📍 Lat: {storeLocation.lat} | Lng: {storeLocation.lng}</p>
                      <p style={{ margin:'2px 0' }}>📏 Radius: {storeLocation.radius} meters</p>
                      <p style={{ margin:'8px 0 0', color:'#aaa', fontSize:'11px' }}>💡 Tip: Use Google Maps to find exact coordinates. Right-click your store → Copy coordinates.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AUDIT TRAIL */}
            {activeTab==='auditTrail' && (
              <div>
                <h2 style={h2s}>📜 Audit Trail</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'14px' }}>Complete log of all admin actions. Last 500 records.</p>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px', alignItems:'flex-end' }}>
                  <div style={{ flex:1 }}>
                    <input placeholder="🔍 Search by action, employee, or admin..." value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                  </div>
                  <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={async()=>{ await loadAuditTrail(); showToast('✅ Audit trail refreshed!') }}>🔄 REFRESH</button>
                </div>
                {auditLoading && <p style={{ color:'#888', textAlign:'center', padding:'20px' }}>⏳ Loading audit trail...</p>}
                {!auditLoading && auditLogs.length===0 && <p style={{ color:'#888' }}>No audit logs found.</p>}
                <div style={{ border:'1px solid #eee', borderRadius:'10px', overflow:'hidden' }}>
                  {auditLogs
                    .filter(l=>`${l.action} ${l.performed_by} ${l.target_employee} ${l.details}`.toLowerCase().includes(auditSearch.toLowerCase()))
                    .map((log,i)=>(
                      <div key={log.id} style={{ padding:'10px 14px', background:i%2===0?'white':'#fafafa', borderBottom:'1px solid #eee', display:'flex', gap:'12px', alignItems:'flex-start', flexWrap:'wrap' }}>
                        <div style={{ minWidth:'140px', flexShrink:0 }}>
                          <span style={{ fontSize:'11px', color:'#aaa', fontFamily:'monospace' }}>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap', marginBottom:'2px' }}>
                            <Badge label={log.action} color={
                              log.action?.includes('APPROVED')||log.action?.includes('ADDED')||log.action?.includes('TIME IN')?'green':
                              log.action?.includes('REJECTED')||log.action?.includes('DEACTIVATED')||log.action?.includes('ABSENT')?'red':
                              log.action?.includes('UPDATED')||log.action?.includes('RESOLVED')?'blue':'gray'
                            } />
                            <span style={{ fontSize:'12px', color:'#555' }}>by <strong>{log.performed_by}</strong></span>
                            {log.target_employee && <span style={{ fontSize:'12px', color:'#888' }}>→ {log.target_employee}</span>}
                          </div>
                          {log.details && <p style={{ fontSize:'12px', color:'#888', margin:0 }}>{log.details}</p>}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* ATTENDANCE */}
            {activeTab==='attendance' && (
              <div>
                <h2 style={h2s}>Attendance Records</h2>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px', alignItems:'flex-end' }}>
                  <input type="date" value={adminDate} onChange={e=>setAdminDate(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                  <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={async()=>{ await loadAdminLogs(); showToast('✅ Attendance loaded!') }}>LOAD</button>
                </div>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'14px', marginBottom:'18px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 10px', fontSize:'13px' }}>Mark Employee as Absent</h3>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
                    <div style={{ flex:1, minWidth:'160px' }}><EmployeeSelect value={absentEmployeeId} onChange={setAbsentEmployeeId} employees={employees} /></div>
                    <input type="date" value={absentDate} onChange={e=>setAbsentDate(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                    <button style={{ ...btnRed, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={markAbsent}>MARK ABSENT</button>
                  </div>
                </div>
                {adminLogs.length===0 && <p style={{ color:'#888' }}>No records for this date. Click LOAD to fetch.</p>}
                {adminLogs.map(log=>(
                  <div key={log.id} style={cardS}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'6px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        {employees.find(e=>e.employee_code===log.employee_code)?.profile_photo_url ?
                          <img src={employees.find(e=>e.employee_code===log.employee_code).profile_photo_url} alt="" style={{ width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover', border:'2px solid #ca1b1b', flexShrink:0 }} /> :
                          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>👤</div>
                        }
                        <strong style={{ color:'#ca1b1b', fontSize:'14px' }}>{log.employee_name}</strong>
                      </div>
                      <Badge label={log.status||'—'} color={log.status==='Absent'?'red':log.status==='Late'?'orange':log.status?.includes('Overtime')||log.status==='On Time'?'green':'gray'} />
                    </div>
                    <p style={cps}>Schedule: {log.shift_start||'None'} – {log.shift_end||'None'}</p>
                    <p style={cps}>In: <strong>{log.time_in||'—'}</strong> | Out: <strong>{log.time_out||'—'}</strong> | Late: {log.late_minutes||0}m | Break: {log.total_break_minutes||0}m</p>
                    <div style={{ display:'flex', gap:'10px', marginTop:'8px', flexWrap:'wrap' }}>
                      {log.selfie_in_url && <div style={{ textAlign:'center' }}><p style={{ ...cps, marginBottom:'3px', fontWeight:'bold' }}>📸 Time In</p><img src={log.selfie_in_url} alt="In" style={{ width:'80px', height:'80px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2d8a4e', cursor:'pointer' }} onClick={()=>window.open(log.selfie_in_url,'_blank')} /><p style={{ fontSize:'10px', color:'#aaa' }}>click to enlarge</p></div>}
                      {log.selfie_out_url && <div style={{ textAlign:'center' }}><p style={{ ...cps, marginBottom:'3px', fontWeight:'bold' }}>📸 Time Out</p><img src={log.selfie_out_url} alt="Out" style={{ width:'80px', height:'80px', objectFit:'cover', borderRadius:'8px', border:'2px solid #ca1b1b', cursor:'pointer' }} onClick={()=>window.open(log.selfie_out_url,'_blank')} /><p style={{ fontSize:'10px', color:'#aaa' }}>click to enlarge</p></div>}
                      {!log.selfie_in_url && !log.selfie_out_url && log.status!=='Absent' && <p style={{ ...cps, color:'#aaa', fontStyle:'italic' }}>No selfies recorded</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPLOYEES */}
            {activeTab==='employees' && (
              <div>
                <h2 style={h2s}>Employees</h2>
                <input placeholder="Search name, code, or position..." value={employeeSearch} onChange={e=>setEmployeeSearch(e.target.value)} style={inputStyle} />
                {employeeSearch.trim() && employees.filter(emp=>`${emp.full_name} ${emp.employee_code} ${emp.position}`.toLowerCase().includes(employeeSearch.toLowerCase())).map(emp=>(
                  <div key={emp.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      {emp.profile_photo_url?<img src={emp.profile_photo_url} alt="" style={{ width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', border:'2px solid #ca1b1b' }} />:<div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'#ddd', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>👤</div>}
                      <div>
                        <strong style={{ color:'#ca1b1b' }}>{emp.full_name}</strong>
                        <p style={cps}>{emp.employee_code} | {emp.position} | {emp.department||'—'}</p>
                        <p style={cps}>{php(emp.daily_rate)}/day | {emp.gender||'—'} | {emp.civil_status||'—'}</p>
                        <p style={cps}>📞 {emp.contact_number||'—'} | 🏠 {emp.home_address||'—'}</p>
                        <p style={cps}>🚨 {emp.emergency_contact_name||'—'} — {emp.emergency_contact_number||'—'}</p>
                        <p style={cps}>SL: {emp.sick_leave_balance||5}d | VL: {emp.vacation_leave_balance||5}d | SIL: {emp.sil_balance||5}d</p>
                        <p style={cps}>{emp.has_sss?'✅':'❌'} SSS &nbsp;{emp.has_pagibig?'✅':'❌'} Pag-IBIG &nbsp;{emp.has_philhealth?'✅':'❌'} PhilHealth</p>
                      </div>
                    </div>
                  </div>
                ))}

                <h3 style={{ color:'#ca1b1b', marginTop:'16px', marginBottom:'10px' }}>➕ Add New Employee</h3>
                <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                  {[['📋 Basic Information'],[['Employee Code *','code'],['Full Name *','name'],['Position *','position'],['PIN *','pin'],['Department','department']]].length && null}
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>📋 Basic Information</p>
                  {[['Employee Code *','code'],['Full Name *','name'],['Position / Job Title *','position'],['PIN *','pin']].map(([pl,f])=>(
                    <input key={f} placeholder={pl} value={newEmpFields[f]||''} onChange={e=>setNewEmpFields(p=>({...p,[f]:e.target.value}))} style={inputStyle} />
                  ))}
                  <label style={lblS}>Department:</label>
                  <select value={newEmpFields.department||''} onChange={e=>setNewEmpFields(p=>({...p,department:e.target.value}))} style={inputStyle}>
                    <option value="">Select Department</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Service Crew">Service Crew</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Production">Production</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Security">Security</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                  <label style={lblS}>Employment Type:</label>
                  <select value={newEmpFields.employment_type} onChange={e=>setNewEmpFields(p=>({...p,employment_type:e.target.value}))} style={inputStyle}>
                    <option value="regular">Regular</option><option value="probationary">Probationary</option><option value="part-time">Part-Time</option><option value="contractual">Contractual</option>
                  </select>
                  {adminRole==='owner' && (<>
                  <label style={lblS}>🔐 Admin Role (Owner only — grants system access):</label>
                  <select value={newEmpFields.admin_role||''} onChange={e=>setNewEmpFields(p=>({...p,admin_role:e.target.value||null}))} style={{ ...inputStyle, borderColor:newEmpFields.admin_role?'#ca1b1b':'#ddd', fontWeight:newEmpFields.admin_role?'bold':'normal' }}>
                    <option value="">— None (Regular Employee) —</option>
                    <option value="owner">👑 Owner — Full Access</option>
                    <option value="hr">👤 HR Admin — People & Attendance</option>
                    <option value="payroll">💰 Payroll Officer — Payroll & Finance</option>
                    <option value="supervisor">👁 Supervisor — Attendance & Schedules</option>
                  </select>
                  </>)}
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>👤 Personal Information</p>
                  <label style={lblS}>Date of Birth:</label>
                  <input type="date" value={newEmpFields.dob||''} onChange={e=>setNewEmpFields(p=>({...p,dob:e.target.value}))} style={inputStyle} />
                  <label style={lblS}>Gender:</label>
                  <select value={newEmpFields.gender||''} onChange={e=>setNewEmpFields(p=>({...p,gender:e.target.value}))} style={inputStyle}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select>
                  <label style={lblS}>Civil Status:</label>
                  <select value={newEmpFields.civil_status||''} onChange={e=>setNewEmpFields(p=>({...p,civil_status:e.target.value}))} style={inputStyle}><option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select>
                  {[['Home Address','address'],['Contact Number','contact']].map(([pl,f])=>(
                    <input key={f} placeholder={pl} value={newEmpFields[f]||''} onChange={e=>setNewEmpFields(p=>({...p,[f]:e.target.value}))} style={inputStyle} />
                  ))}
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>🚨 Emergency Contact</p>
                  {[['Emergency Contact Name','emergency_name'],['Emergency Contact Number','emergency_contact']].map(([pl,f])=>(
                    <input key={f} placeholder={pl} value={newEmpFields[f]||''} onChange={e=>setNewEmpFields(p=>({...p,[f]:e.target.value}))} style={inputStyle} />
                  ))}
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>💰 Compensation</p>
                  <input placeholder="Daily Rate (PHP)" type="number" value={newEmpFields.rate||''} onChange={e=>setNewEmpFields(p=>({...p,rate:e.target.value}))} style={inputStyle} />
                  <label style={lblS}>Pay Type:</label>
                  <select value={newEmpFields.payType} onChange={e=>setNewEmpFields(p=>({...p,payType:e.target.value}))} style={inputStyle}><option value="daily">Daily Rate</option><option value="hourly">Hourly Rate</option></select>
                  <label style={lblS}>Hire Date:</label>
                  <input type="date" value={newEmpFields.hire_date} onChange={e=>setNewEmpFields(p=>({...p,hire_date:e.target.value}))} style={inputStyle} />
                  <label style={lblS}>Grace Period (minutes):</label>
                  <input type="number" value={newEmpFields.gracePeriod} onChange={e=>setNewEmpFields(p=>({...p,gracePeriod:e.target.value}))} style={inputStyle} />
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>📅 Leave & Benefits</p>
                  <div style={{ display:'flex', gap:'10px' }}>
                    <div style={{ flex:1 }}><label style={lblS}>Sick Leave (days/yr):</label><input type="number" value={newEmpFields.sick} onChange={e=>setNewEmpFields(p=>({...p,sick:e.target.value}))} style={inputStyle} /></div>
                    <div style={{ flex:1 }}><label style={lblS}>Vacation Leave (days/yr):</label><input type="number" value={newEmpFields.vacation} onChange={e=>setNewEmpFields(p=>({...p,vacation:e.target.value}))} style={inputStyle} /></div>
                  </div>
                  <label style={lblS}>Service Incentive Leave (days/yr):</label>
                  <input type="number" value={newEmpFields.sil} onChange={e=>setNewEmpFields(p=>({...p,sil:e.target.value}))} style={inputStyle} />
                  <div style={{ background:'white', borderRadius:'10px', padding:'12px', border:'1px solid #eee' }}>
                    <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:'0 0 8px', fontSize:'13px' }}>🏛️ Government Contributions & IDs</p>
                    <label style={lblS}><input type="checkbox" checked={newEmpFields.hasSss} onChange={e=>setNewEmpFields(p=>({...p,hasSss:e.target.checked}))} style={{ marginRight:'8px' }} />SSS — PHP 375 (11–25 cutoff)</label>
                    {newEmpFields.hasSss && <input placeholder="SSS ID Number" value={newEmpFields.sss_no||''} onChange={e=>setNewEmpFields(p=>({...p,sss_no:e.target.value}))} style={{ ...inputStyle, marginBottom:'8px' }} />}
                    <label style={lblS}><input type="checkbox" checked={newEmpFields.hasPagibig} onChange={e=>setNewEmpFields(p=>({...p,hasPagibig:e.target.checked}))} style={{ marginRight:'8px' }} />Pag-IBIG — PHP 200 (26–10 cutoff)</label>
                    {newEmpFields.hasPagibig && <input placeholder="Pag-IBIG ID Number" value={newEmpFields.pagibig_no||''} onChange={e=>setNewEmpFields(p=>({...p,pagibig_no:e.target.value}))} style={{ ...inputStyle, marginBottom:'8px' }} />}
                    <label style={lblS}><input type="checkbox" checked={newEmpFields.hasPhilhealth} onChange={e=>setNewEmpFields(p=>({...p,hasPhilhealth:e.target.checked}))} style={{ marginRight:'8px' }} />PhilHealth — PHP 250 (26–10 cutoff)</label>
                    {newEmpFields.hasPhilhealth && <input placeholder="PhilHealth ID Number" value={newEmpFields.philhealth_no||''} onChange={e=>setNewEmpFields(p=>({...p,philhealth_no:e.target.value}))} style={{ ...inputStyle, marginBottom:'8px' }} />}
                    <label style={lblS}>TIN Number (BIR):</label>
                    <input placeholder="Tax Identification Number" value={newEmpFields.tin_no||''} onChange={e=>setNewEmpFields(p=>({...p,tin_no:e.target.value}))} style={inputStyle} />
                  </div>
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px', borderBottom:'1px solid #eee', paddingBottom:'6px' }}>📍 Work Location (for Time In/Out geofencing)</p>
                  <p style={{ color:'#888', fontSize:'12px', marginBottom:'8px' }}>Leave blank to use the store's default location set in Dashboard. Fill this for employees who work at a different location (e.g. production, delivery hub, satellite office).</p>
                  <input placeholder="Location Name (e.g. Production Area, Warehouse)" value={newEmpFields.work_location||''} onChange={e=>setNewEmpFields(p=>({...p,work_location:e.target.value}))} style={inputStyle} />
                  <div style={{ display:'flex', gap:'10px' }}>
                    <div style={{ flex:1 }}><label style={lblS}>Latitude:</label><input type="number" step="0.000001" placeholder="e.g. 15.4755" value={newEmpFields.location_lat||''} onChange={e=>setNewEmpFields(p=>({...p,location_lat:e.target.value}))} style={inputStyle} /></div>
                    <div style={{ flex:1 }}><label style={lblS}>Longitude:</label><input type="number" step="0.000001" placeholder="e.g. 120.5963" value={newEmpFields.location_lng||''} onChange={e=>setNewEmpFields(p=>({...p,location_lng:e.target.value}))} style={inputStyle} /></div>
                    <div style={{ flex:1 }}><label style={lblS}>Radius (m):</label><input type="number" placeholder="e.g. 200" value={newEmpFields.location_radius||''} onChange={e=>setNewEmpFields(p=>({...p,location_radius:e.target.value}))} style={inputStyle} /></div>
                  </div>
                </div>
                <button style={btnGreen} onClick={addEmployee}>➕ ADD EMPLOYEE</button>

                <h3 style={{ color:'#ca1b1b', marginTop:'24px', marginBottom:'10px' }}>👥 Employee List ({employees.length})</h3>
                <div style={{ border:'2px solid #ca1b1b', borderRadius:'12px', overflow:'hidden', background:'white' }}>
                  {employees.map((emp,i)=>(
                    <div key={emp.id} style={{ borderBottom:i<employees.length-1?'1px solid #eee':'none', padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                        <div style={{ display:'flex', gap:'10px', alignItems:'center', flex:1, minWidth:0 }}>
                          {emp.profile_photo_url?<img src={emp.profile_photo_url} alt="" style={{ width:'38px', height:'38px', borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />:<div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>👤</div>}
                          <div style={{ minWidth:0 }}>
                            <strong style={{ color:'#ca1b1b', fontSize:'14px' }}>{emp.full_name}</strong>
                            <p style={cps}>{emp.employee_code} | {emp.position} | {emp.department||'—'} | <Badge label={emp.employment_type||'regular'} color="blue" />{emp.admin_role&&<> | <Badge label={emp.admin_role==='owner'?'👑 Owner':emp.admin_role==='hr'?'👤 HR':emp.admin_role==='payroll'?'💰 Payroll':'👁 Supervisor'} color={emp.admin_role==='owner'?'red':'green'} /></>}</p>
                            <p style={cps}>{php(emp.daily_rate)}/day | Hire: {emp.hire_date||'N/A'} | Grace: {emp.grace_period_minutes||10}min</p>
                            <p style={cps}>👤 {emp.gender||'—'} | {emp.civil_status||'—'} | DOB: {emp.date_of_birth||'—'}</p>
                            <p style={cps}>📞 {emp.contact_number||'—'} | 🏠 {emp.home_address||'—'}</p>
                            <p style={cps}>🚨 {emp.emergency_contact_name||'—'} — {emp.emergency_contact_number||'—'}</p>
                            <p style={cps}>SL: {emp.sick_leave_balance||5}d | VL: {emp.vacation_leave_balance||5}d | SIL: {emp.sil_balance||5}d</p>
                            <p style={cps}>{emp.has_sss?'✅':'❌'} SSS &nbsp;{emp.has_pagibig?'✅':'❌'} Pag-IBIG &nbsp;{emp.has_philhealth?'✅':'❌'} PhilHealth</p>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                          <button style={btnYellow} onClick={()=>{ setEditingEmployeeId(emp.id); setEditFields({ code:emp.employee_code||'', name:emp.full_name||'', position:emp.position||'', pin:emp.pin||'', rate:emp.daily_rate||'', hasSss:emp.has_sss||false, hasPagibig:emp.has_pagibig||false, hasPhilhealth:emp.has_philhealth||false, hireDate:emp.hire_date||today, sick:emp.sick_leave_balance||5, vacation:emp.vacation_leave_balance||5, sil:emp.sil_balance||5, payType:emp.pay_type||'daily', hourlyRate:emp.hourly_rate||0, gracePeriod:emp.grace_period_minutes||10, dob:emp.date_of_birth||'', gender:emp.gender||'', civil_status:emp.civil_status||'', address:emp.home_address||'', contact:emp.contact_number||'', emergency_name:emp.emergency_contact_name||'', emergency_contact:emp.emergency_contact_number||'', employment_type:emp.employment_type||'regular', department:emp.department||'', sss_no:emp.sss_no||'', pagibig_no:emp.pagibig_no||'', philhealth_no:emp.philhealth_no||'', tin_no:emp.tin_no||'', work_location:emp.work_location||'', location_lat:emp.location_lat||'', location_lng:emp.location_lng||'', location_radius:emp.location_radius||'', admin_role:emp.admin_role||'' }) }}>✏ EDIT</button>
                          <button style={{ ...btnRed, width:'auto', padding:'6px 10px', marginTop:0, fontSize:'12px' }} onClick={()=>deactivateEmployee(emp.id, emp.full_name)}>🚫</button>
                        </div>
                      </div>
                      {editingEmployeeId===emp.id && (
                        <div style={{ marginTop:'12px', background:'#f9f9f9', padding:'16px', borderRadius:'10px', border:'1px solid #ddd' }}>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', marginBottom:'8px' }}>📋 Basic Information</p>
                          {[['Employee Code','code'],['Full Name','name'],['Position','position'],['PIN','pin']].map(([pl,f])=>(
                            <input key={f} placeholder={pl} value={editFields[f]||''} onChange={e=>setEditFields(p=>({...p,[f]:e.target.value}))} style={inputStyle} />
                          ))}
                          <label style={lblS}>Department:</label>
                          <select value={editFields.department||''} onChange={e=>setEditFields(p=>({...p,department:e.target.value}))} style={inputStyle}>
                            <option value="">Select Department</option>
                            <option value="Kitchen">Kitchen</option>
                            <option value="Cashier">Cashier</option>
                            <option value="Service Crew">Service Crew</option>
                            <option value="Delivery">Delivery</option>
                            <option value="Production">Production</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                            <option value="Security">Security</option>
                            <option value="Maintenance">Maintenance</option>
                          </select>
                          <label style={lblS}>Employment Type:</label>
                          <select value={editFields.employment_type||'regular'} onChange={e=>setEditFields(p=>({...p,employment_type:e.target.value}))} style={inputStyle}><option value="regular">Regular</option><option value="probationary">Probationary</option><option value="part-time">Part-Time</option><option value="contractual">Contractual</option></select>
                          {adminRole==='owner' && (<>
                          <label style={lblS}>🔐 Admin Role (Owner only — grants system access):</label>
                          <select value={editFields.admin_role||''} onChange={e=>setEditFields(p=>({...p,admin_role:e.target.value||null}))} style={{ ...inputStyle, borderColor:editFields.admin_role?'#ca1b1b':'#ddd', fontWeight:editFields.admin_role?'bold':'normal' }}>
                            <option value="">— None (Regular Employee) —</option>
                            <option value="owner">👑 Owner — Full Access</option>
                            <option value="hr">👤 HR Admin — People & Attendance</option>
                            <option value="payroll">💰 Payroll Officer — Payroll & Finance</option>
                            <option value="supervisor">👁 Supervisor — Attendance & Schedules</option>
                          </select>
                          </>)}
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px' }}>👤 Personal Information</p>
                          <label style={lblS}>Date of Birth:</label>
                          <input type="date" value={editFields.dob||''} onChange={e=>setEditFields(p=>({...p,dob:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Gender:</label>
                          <select value={editFields.gender||''} onChange={e=>setEditFields(p=>({...p,gender:e.target.value}))} style={inputStyle}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select>
                          <label style={lblS}>Civil Status:</label>
                          <select value={editFields.civil_status||''} onChange={e=>setEditFields(p=>({...p,civil_status:e.target.value}))} style={inputStyle}><option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select>
                          {[['Home Address','address'],['Contact Number','contact']].map(([pl,f])=>(
                            <input key={f} placeholder={pl} value={editFields[f]||''} onChange={e=>setEditFields(p=>({...p,[f]:e.target.value}))} style={inputStyle} />
                          ))}
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px' }}>🚨 Emergency Contact</p>
                          {[['Emergency Contact Name','emergency_name'],['Emergency Contact Number','emergency_contact']].map(([pl,f])=>(
                            <input key={f} placeholder={pl} value={editFields[f]||''} onChange={e=>setEditFields(p=>({...p,[f]:e.target.value}))} style={inputStyle} />
                          ))}
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px' }}>💰 Compensation</p>
                          <input placeholder="Daily Rate (PHP)" type="number" value={editFields.rate||''} onChange={e=>setEditFields(p=>({...p,rate:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Pay Type:</label>
                          <select value={editFields.payType||'daily'} onChange={e=>setEditFields(p=>({...p,payType:e.target.value}))} style={inputStyle}><option value="daily">Daily Rate</option><option value="hourly">Hourly Rate</option></select>
                          <label style={lblS}>Hire Date:</label>
                          <input type="date" value={editFields.hireDate||''} onChange={e=>setEditFields(p=>({...p,hireDate:e.target.value}))} style={inputStyle} />
                          <label style={lblS}>Grace Period (minutes):</label>
                          <input type="number" value={editFields.gracePeriod||10} onChange={e=>setEditFields(p=>({...p,gracePeriod:e.target.value}))} style={inputStyle} />
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 8px' }}>📅 Leave & Benefits</p>
                          <div style={{ display:'flex', gap:'10px' }}>
                            <div style={{ flex:1 }}><label style={lblS}>Sick Leave:</label><input type="number" value={editFields.sick||5} onChange={e=>setEditFields(p=>({...p,sick:e.target.value}))} style={inputStyle} /></div>
                            <div style={{ flex:1 }}><label style={lblS}>Vacation Leave:</label><input type="number" value={editFields.vacation||5} onChange={e=>setEditFields(p=>({...p,vacation:e.target.value}))} style={inputStyle} /></div>
                          </div>
                          <label style={lblS}>SIL (days/yr):</label>
                          <input type="number" value={editFields.sil||5} onChange={e=>setEditFields(p=>({...p,sil:e.target.value}))} style={inputStyle} />
                          <div style={{ background:'white', borderRadius:'10px', padding:'12px', border:'1px solid #eee', marginBottom:'12px' }}>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:'0 0 8px', fontSize:'13px' }}>🏛️ Government Contributions & IDs</p>
                            <label style={lblS}><input type="checkbox" checked={editFields.hasSss||false} onChange={e=>setEditFields(p=>({...p,hasSss:e.target.checked}))} style={{ marginRight:'8px' }} />SSS</label>
                            {editFields.hasSss && <input placeholder="SSS ID Number" value={editFields.sss_no||''} onChange={e=>setEditFields(p=>({...p,sss_no:e.target.value}))} style={{ ...inputStyle, marginBottom:'8px' }} />}
                            <label style={lblS}><input type="checkbox" checked={editFields.hasPagibig||false} onChange={e=>setEditFields(p=>({...p,hasPagibig:e.target.checked}))} style={{ marginRight:'8px' }} />Pag-IBIG</label>
                            {editFields.hasPagibig && <input placeholder="Pag-IBIG ID Number" value={editFields.pagibig_no||''} onChange={e=>setEditFields(p=>({...p,pagibig_no:e.target.value}))} style={{ ...inputStyle, marginBottom:'8px' }} />}
                            <label style={lblS}><input type="checkbox" checked={editFields.hasPhilhealth||false} onChange={e=>setEditFields(p=>({...p,hasPhilhealth:e.target.checked}))} style={{ marginRight:'8px' }} />PhilHealth</label>
                            {editFields.hasPhilhealth && <input placeholder="PhilHealth ID Number" value={editFields.philhealth_no||''} onChange={e=>setEditFields(p=>({...p,philhealth_no:e.target.value}))} style={{ ...inputStyle, marginBottom:'8px' }} />}
                            <label style={lblS}>TIN Number (BIR):</label>
                            <input placeholder="Tax Identification Number" value={editFields.tin_no||''} onChange={e=>setEditFields(p=>({...p,tin_no:e.target.value}))} style={inputStyle} />
                          </div>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'12px 0 6px' }}>📍 Work Location (Geofencing)</p>
                          <p style={{ color:'#888', fontSize:'12px', marginBottom:'8px' }}>Leave blank to use default store location. Set for employees at different sites.</p>
                          <input placeholder="Location Name (e.g. Production Area)" value={editFields.work_location||''} onChange={e=>setEditFields(p=>({...p,work_location:e.target.value}))} style={inputStyle} />
                          <div style={{ display:'flex', gap:'8px' }}>
                            <div style={{ flex:1 }}><label style={lblS}>Latitude:</label><input type="number" step="0.000001" value={editFields.location_lat||''} onChange={e=>setEditFields(p=>({...p,location_lat:e.target.value}))} style={inputStyle} /></div>
                            <div style={{ flex:1 }}><label style={lblS}>Longitude:</label><input type="number" step="0.000001" value={editFields.location_lng||''} onChange={e=>setEditFields(p=>({...p,location_lng:e.target.value}))} style={inputStyle} /></div>
                            <div style={{ flex:1 }}><label style={lblS}>Radius (m):</label><input type="number" value={editFields.location_radius||''} onChange={e=>setEditFields(p=>({...p,location_radius:e.target.value}))} style={inputStyle} /></div>
                          </div>
                          {saveSuccess===editingEmployeeId && (
                            <div style={{ background:'#e8f5e9', border:'2px solid #2d8a4e', borderRadius:'10px', padding:'12px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'10px' }}>
                              <span style={{ fontSize:'20px' }}>✅</span>
                              <p style={{ color:'#2d8a4e', fontWeight:'bold', margin:0, fontSize:'14px' }}>Employee Updated Successfully!</p>
                            </div>
                          )}
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={saveEmployeeChanges} disabled={saveEmployeeLoading} style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0, opacity:saveEmployeeLoading?0.7:1 }}>{saveEmployeeLoading?'⏳ SAVING...':'💾 SAVE CHANGES'}</button>
                            <button onClick={()=>{ setEditingEmployeeId(''); setSaveSuccess(null) }} style={{ ...btnGray, width:'auto', padding:'10px 18px', marginTop:0 }}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCHEDULE */}
            {activeTab==='schedule' && (
              <div>
                <h2 style={h2s}>📅 Schedule Management</h2>

                {/* Day Off Settings */}
                <div style={{ background:'#f0f4ff', border:'2px solid #4a90d9', borderRadius:'14px', padding:'16px', marginBottom:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                    <h3 style={{ color:'#4a90d9', margin:0, fontSize:'14px' }}>🏖️ Weekly Day Off Settings</h3>
                    <button style={{ ...btnBlack, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'12px', background:'#4a90d9' }} onClick={()=>setShowDayOffSettings(!showDayOffSettings)}>
                      {showDayOffSettings?'▲ HIDE':'▼ CONFIGURE'}
                    </button>
                  </div>
                  <p style={{ color:'#888', fontSize:'12px', margin:0 }}>All employees are entitled to 1 day off per week. Set the default day off per department or per employee.</p>
                  {showDayOffSettings && (
                    <div style={{ marginTop:'14px' }}>
                      <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', marginBottom:'8px' }}>Default Day Off by Department:</p>
                      {['Kitchen','Cashier','Service Crew','Delivery','Production','Supervisor','Manager','Admin','Security','Maintenance'].map(dept=>(
                        <div key={dept} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', background:'white', padding:'8px 12px', borderRadius:'8px', border:'1px solid #eee' }}>
                          <span style={{ fontSize:'13px', fontWeight:'bold', color:'#333', minWidth:'120px' }}>{dept}</span>
                          <select value={dayOffSettings[dept]||'Sunday'} onChange={e=>setDayOffSettings(p=>({...p,[dept]:e.target.value}))} style={{ ...inputStyle, marginBottom:0, flex:1 }}>
                            {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d=><option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      ))}
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 18px', marginTop:'8px' }} onClick={()=>{
                        localStorage.setItem('day_off_settings', JSON.stringify(dayOffSettings))
                        showToast('✅ Day off settings saved!')
                        setShowDayOffSettings(false)
                      }}>💾 SAVE DAY OFF SETTINGS</button>
                    </div>
                  )}
                </div>

                {/* Department Locations for Geofencing */}
                <div style={{ background:'#fff8f0', border:'2px solid #f5a623', borderRadius:'14px', padding:'16px', marginBottom:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                    <h3 style={{ color:'#f5a623', margin:0, fontSize:'14px' }}>📍 Department Locations (Geofencing)</h3>
                    <button style={{ ...btnBlack, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'12px', background:'#f5a623' }} onClick={()=>setShowDeptLocations(!showDeptLocations)}>
                      {showDeptLocations?'▲ HIDE':'▼ CONFIGURE'}
                    </button>
                  </div>
                  <p style={{ color:'#888', fontSize:'12px', margin:0 }}>Set a GPS location per department. Employees in that department must be within the radius when timing in/out. Individual employee location (set in employee profile) takes priority over department location.</p>
                  {showDeptLocations && (
                    <div style={{ marginTop:'14px' }}>
                      {['Kitchen','Cashier','Service Crew','Delivery','Production','Supervisor','Manager','Admin','Security','Maintenance'].map(dept=>(
                        <div key={dept} style={{ background:'white', borderRadius:'10px', padding:'12px', marginBottom:'10px', border:'1px solid #eee' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 8px' }}>📌 {dept}</p>
                          <input placeholder="Location Name (e.g. Main Kitchen, Warehouse)" value={departmentLocations[dept]?.name||''} onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],name:e.target.value}}))} style={{ ...inputStyle, marginBottom:'6px' }} />
                          <div style={{ display:'flex', gap:'8px' }}>
                            <div style={{ flex:1 }}><label style={lblS}>Latitude:</label><input type="number" step="0.000001" value={departmentLocations[dept]?.lat||''} onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],lat:e.target.value}}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                            <div style={{ flex:1 }}><label style={lblS}>Longitude:</label><input type="number" step="0.000001" value={departmentLocations[dept]?.lng||''} onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],lng:e.target.value}}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                            <div style={{ flex:1 }}><label style={lblS}>Radius (m):</label><input type="number" value={departmentLocations[dept]?.radius||200} onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],radius:e.target.value}}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                          </div>
                        </div>
                      ))}
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 18px', marginTop:'4px' }} onClick={()=>saveDepartmentLocations(departmentLocations)}>💾 SAVE ALL LOCATIONS</button>
                    </div>
                  )}
                </div>

                {/* Bulk Schedule Creator */}
                <div style={{ background:'#f9f9f9', borderRadius:'14px', padding:'18px', marginBottom:'20px', border:'2px solid #ca1b1b' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 14px', fontSize:'15px' }}>⚡ Bulk Schedule Creator</h3>

                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
                    <div style={{ flex:1, minWidth:'160px' }}>
                      <label style={lblS}>Apply To:</label>
                      <select value={scheduleRepeat} onChange={e=>setScheduleRepeat(e.target.value)} style={inputStyle}>
                        <option value="all">👥 All Active Employees</option>
                        <option value="one">👤 One Employee</option>
                      </select>
                    </div>
                    {scheduleRepeat==='one' && (
                      <div style={{ flex:2, minWidth:'200px' }}>
                        <label style={lblS}>Select Employee:</label>
                        <EmployeeSelect value={selectedEmployeeId} onChange={setSelectedEmployeeId} employees={employees} />
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
                    <div style={{ flex:1, minWidth:'140px' }}>
                      <label style={lblS}>Start Date:</label>
                      <input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                    </div>
                    <div style={{ flex:1, minWidth:'140px' }}>
                      <label style={lblS}>Duration:</label>
                      <select value={scheduleDuration} onChange={e=>setScheduleDuration(e.target.value)} style={{ ...inputStyle, marginBottom:0 }}>
                        <option value="1day">📅 Single Day</option>
                        <option value="1week">📅 1 Week (7 days)</option>
                        <option value="2weeks">📅 2 Weeks (14 days)</option>
                        <option value="1month">📅 1 Month (30 days)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
                    <div style={{ flex:1 }}>
                      <label style={lblS}>Shift Start:</label>
                      <input type="time" value={shiftStart} onChange={e=>setShiftStart(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={lblS}>Shift End:</label>
                      <input type="time" value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                    </div>
                  </div>

                  {shiftStart && shiftEnd && (
                    <div style={{ background:'#fff8dc', borderRadius:'8px', padding:'10px', marginBottom:'12px', fontSize:'13px', color:'#555' }}>
                      ⏰ Shift: <strong>{shiftStart} – {shiftEnd}</strong> &nbsp;|&nbsp;
                      📅 Duration: <strong>{scheduleDuration==='1day'?'1 Day':scheduleDuration==='1week'?'7 Days':scheduleDuration==='2weeks'?'14 Days':'30 Days'}</strong> &nbsp;|&nbsp;
                      👥 Apply to: <strong>{scheduleRepeat==='all'?`All ${employees.length} employees`:employees.find(e=>e.id===selectedEmployeeId)?.full_name||'—'}</strong>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <button style={{ ...btnGreen, width:'auto', padding:'11px 20px', marginTop:0 }}
                      onClick={scheduleDuration==='1day'?saveSchedule:saveBulkSchedule}
                      disabled={bulkScheduleLoading}>
                      {bulkScheduleLoading ? '⏳ SAVING...' : '💾 APPLY SCHEDULE'}
                    </button>
                    <button style={{ ...btnBlack, width:'auto', padding:'11px 20px', marginTop:0 }}
                      onClick={loadExistingSchedules}>
                      👁 VIEW EXISTING
                    </button>
                  </div>
                </div>

                {/* Existing Schedules */}
                {existingSchedules.length > 0 && (
                  <div>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 12px', fontSize:'14px' }}>📋 Upcoming Schedules (next 30 days from start date)</h3>
                    <div style={{ overflowX:'auto', borderRadius:'10px', border:'1px solid #eee' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                        <thead>
                          <tr style={{ background:'#ca1b1b', color:'white' }}>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Date</th>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Employee</th>
                            <th style={{ padding:'8px 10px', textAlign:'center' }}>Shift</th>
                            <th style={{ padding:'8px 10px', textAlign:'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {existingSchedules.map((s,i)=>(
                            <tr key={s.id} style={{ background:i%2===0?'white':'#fafafa', borderBottom:'1px solid #eee' }}>
                              <td style={{ padding:'7px 10px' }}>{s.schedule_date} <span style={{ color:'#aaa', fontSize:'11px' }}>({new Date(s.schedule_date).toLocaleDateString('en-US',{weekday:'short'})})</span></td>
                              <td style={{ padding:'7px 10px' }}>{s.employees?.full_name||'—'} <span style={{ color:'#aaa' }}>({s.employees?.employee_code||''})</span></td>
                              <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:'bold', color:'#ca1b1b' }}>{s.shift_start} – {s.shift_end}</td>
                              <td style={{ padding:'7px 10px', textAlign:'center' }}>
                                <button style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }} onClick={()=>deleteSchedule(s.id)}>🗑 REMOVE</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HOLIDAYS */}
            {activeTab==='holidays' && (
              <div>
                <h2 style={h2s}>Holiday Calendar</h2>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'16px', fontSize:'13px', color:'#555' }}>
                  <strong style={{ color:'#ca1b1b' }}>Holiday Pay Rules (DOLE):</strong><br/>
                  🔴 Regular Holiday — Worked: <strong>200%</strong> | Not Worked: <strong>100%</strong> (paid even if absent)<br/>
                  🟡 Special Non-Working — Worked: <strong>130%</strong> | Not Worked: <strong>No Pay (NWNP)</strong>
                </div>

                {/* Auto-add Philippine Holidays */}
                <div style={{ background:'#f0fff0', border:'1px solid #c8e6c9', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
                  <h3 style={{ color:'#2d8a4e', margin:'0 0 8px', fontSize:'14px' }}>🇵🇭 Philippine Regular Holidays</h3>
                  <p style={{ color:'#888', fontSize:'12px', margin:'0 0 10px' }}>Auto-add all official Philippine regular holidays. Skips any already added.</p>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {[today.slice(0,4), String(Number(today.slice(0,4))+1)].map(yr=>(
                      <button key={yr} style={{ ...btnGreen, width:'auto', padding:'8px 16px', marginTop:0 }} onClick={()=>addPhilippineHolidays(yr)}>
                        🇵🇭 ADD {yr} HOLIDAYS
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual add — Special Non-Working only */}
                <div style={{ background:'#f9f9f9', borderRadius:'10px', padding:'14px', marginBottom:'18px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 10px', fontSize:'14px' }}>➕ Add Special Non-Working Holiday</h3>
                  <p style={{ color:'#888', fontSize:'12px', margin:'0 0 10px' }}>Special non-working holidays (proclamation days, local holidays) must be added manually by admin.</p>
                  <label style={lblS}>Date:</label>
                  <input type="date" value={newHolidayDate} onChange={e=>setNewHolidayDate(e.target.value)} style={inputStyle} />
                  <label style={lblS}>Holiday Name:</label>
                  <input placeholder="e.g. EDSA Anniversary, Local Fiesta" value={newHolidayName} onChange={e=>setNewHolidayName(e.target.value)} style={inputStyle} />
                  <label style={lblS}>Type:</label>
                  <select value={newHolidayType} onChange={e=>setNewHolidayType(e.target.value)} style={inputStyle}>
                    <option value="regular">Regular Holiday (200% worked / 100% not worked)</option>
                    <option value="special">Special Non-Working (130% worked / No Pay if absent)</option>
                  </select>
                  <button style={btnGreen} onClick={addHoliday}>➕ ADD HOLIDAY</button>
                </div>

                {holidays.length===0 && <p style={{ color:'#888' }}>No holidays added yet.</p>}
                <div style={{ border:'1px solid #eee', borderRadius:'10px', overflow:'hidden' }}>
                  {holidays.map((h,i)=>(
                    <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:i%2===0?'white':'#fafafa', borderBottom:i<holidays.length-1?'1px solid #eee':'none' }}>
                      <div>
                        <strong style={{ color:h.holiday_type==='regular'?'#ca1b1b':'#f5a623', fontSize:'13px' }}>{h.holiday_name}</strong>
                        <p style={cps}>{h.holiday_date} — <Badge label={h.holiday_type==='regular'?'Regular 200%':'Special 130%'} color={h.holiday_type==='regular'?'red':'orange'} /></p>
                      </div>
                      <button style={{ ...btnRed, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'12px' }} onClick={()=>deleteHoliday(h.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OT/UT REQUESTS */}
            {activeTab==='overtime' && (
              <div>
                <h2 style={h2s}>Overtime / Undertime Requests</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={async()=>{ await loadTimeAdjRequests(); showToast('✅ OT/UT requests refreshed!') }}>🔄 REFRESH</button>
                {timeAdjRequests.length===0 && <p style={{ color:'#888' }}>No pending requests.</p>}
                {timeAdjRequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:`2px solid ${req.request_type==='overtime'?'#2d8a4e':'#f5a623'}`, background:req.request_type==='overtime'?'#f0fff0':'#fffbf0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'6px' }}>
                      <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{req.employee_name}</strong>
                      <Badge label={req.request_type==='overtime'?'OVERTIME':'UNDERTIME'} color={req.request_type==='overtime'?'green':'orange'} />
                    </div>
                    <p style={cps}>Date: {req.attendance_date} | Minutes: <strong>{req.minutes}</strong></p>
                    <p style={cps}>Employee Reason: <em>"{req.employee_reason}"</em></p>
                    <label style={lblS}>Admin Response / Reason (required for rejection):</label>
                    <textarea placeholder="Enter your response..." value={adjAdminReason[req.id]||''} onChange={e=>setAdjAdminReason(p=>({...p,[req.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                    <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={async(e)=>{ const btn=e.currentTarget; btn.disabled=true; btn.textContent='Processing...'; await approveTimeAdj(req); btn.disabled=false; btn.textContent='✅ APPROVE' }}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={async(e)=>{ const btn=e.currentTarget; btn.disabled=true; btn.textContent='Processing...'; await rejectTimeAdj(req); btn.disabled=false; btn.textContent='❌ REJECT' }}>❌ REJECT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ADJUSTMENT */}
            {activeTab==='adjustment' && (
              <div>
                <h2 style={h2s}>Payroll Adjustment</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'15px' }}>Add bonuses or deductions. Applied automatically during payroll computation.</p>
                <EmployeeSelect value={adjustmentEmployeeId} onChange={setAdjustmentEmployeeId} employees={employees} />
                <input type="date" value={adjustmentDate} onChange={e=>setAdjustmentDate(e.target.value)} style={inputStyle} />
                <select value={adjustmentType} onChange={e=>setAdjustmentType(e.target.value)} style={inputStyle}><option value="deduction">Deduction</option><option value="addition">Addition / Bonus</option></select>
                <input placeholder="Category (e.g. Bonus, Penalty)" value={adjustmentCategory} onChange={e=>setAdjustmentCategory(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Amount (PHP)" value={adjustmentAmount} onChange={e=>setAdjustmentAmount(e.target.value)} style={inputStyle} />
                <input placeholder="Notes (optional)" value={adjustmentNotes} onChange={e=>setAdjustmentNotes(e.target.value)} style={inputStyle} />
                <button style={btnGreen} onClick={saveAdjustment}>💾 SAVE ADJUSTMENT</button>
              </div>
            )}

            {/* PAYROLL */}
            {activeTab==='payroll' && (
              <div>
                <h2 style={h2s}>Payroll Computation</h2>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'15px', fontSize:'13px', color:'#666' }}>
                  <strong style={{ color:'#ca1b1b' }}>Rules:</strong> 11–25 → SSS (PHP 375) | 26–10 → Pag-IBIG (PHP 200) + PhilHealth (PHP 250) | Only approved OT/UT computed
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px', alignItems:'flex-end' }}>
                  <input type="month" value={payrollMonth} onChange={e=>setPayrollMonth(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                  <select value={payrollCutoff} onChange={e=>setPayrollCutoff(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }}><option value="11-25">11th – 25th (SSS)</option><option value="26-10">26th – 10th (PagIBIG+PhilHealth)</option></select>
                  <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={applyPayrollCutoff}>APPLY DATES</button>
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px' }}>
                  <div><label style={lblS}>From:</label><input type="date" value={payrollStart} onChange={e=>setPayrollStart(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                  <div><label style={lblS}>To:</label><input type="date" value={payrollEnd} onChange={e=>setPayrollEnd(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px' }}>
                  <button style={{ ...btnBlack, width:'auto', padding:'12px 22px', marginTop:0 }} onClick={computePayroll} disabled={payrollComputing}>{payrollComputing?'⏳ COMPUTING...':'🧮 COMPUTE PAYROLL'}</button>
                  <button style={{ ...btnGreen, width:'auto', padding:'12px 22px', marginTop:0 }} onClick={printAllPayslips} disabled={payrollResults.length===0}>🖨 PRINT ALL</button>
                  <button style={{ background:'#4a90d9', color:'white', padding:'12px 22px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', marginTop:0, opacity:payrollResults.length===0?0.5:1 }} onClick={()=>exportPayrollToCSV(payrollResults, payrollStart, payrollEnd)} disabled={payrollResults.length===0}>📊 EXPORT CSV</button>
                </div>
                {payrollSummary && (
                  <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'18px', marginBottom:'22px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 12px' }}>📊 Summary — {payrollStart} to {payrollEnd}</h3>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:'8px' }}>
                      {[['Employees',payrollSummary.totalEmployees],['Basic Pay',php(payrollSummary.totalBasicPay)],['🎂 Birthday Pay',php(payrollSummary.totalBirthdayPay||0)],['Overtime',php(payrollSummary.totalOvertimePay)],['Night Diff',php(payrollSummary.totalNightDiff)],['Holiday Pay',php(payrollSummary.totalHolidayPay)],['Total Earnings',php(payrollSummary.totalEarnings)],['SSS',php(payrollSummary.totalSSS)],['Pag-IBIG',php(payrollSummary.totalPagibig)],['PhilHealth',php(payrollSummary.totalPhilhealth)],['Cash Advance',php(payrollSummary.totalCA)],['Total Deductions',php(payrollSummary.totalDeductions)],['TOTAL NET PAY',php(payrollSummary.totalNetPay)]].map(([l,v])=>(
                        <div key={l} style={{ background:'white', borderRadius:'8px', padding:'10px', border:'1px solid #eee' }}>
                          <p style={{ color:'#888', fontSize:'11px', margin:'0 0 3px' }}>{l}</p>
                          <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'13px', margin:0 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {payrollResults.length>0 && <input placeholder="🔍 Search employee..." value={payrollSearch} onChange={e=>setPayrollSearch(e.target.value)} style={{ ...inputStyle, marginBottom:'16px' }} />}
                {filteredResults.map((pay,idx)=>(
                  <div key={pay.employeeCode} style={{ ...cardS, marginBottom:'20px', border:'1px solid #ddd' }}>
                    <div style={{ padding:'16px', fontSize:'13px' }}>
                      <div style={{ textAlign:'center', marginBottom:'10px', borderBottom:'2px solid #ca1b1b', paddingBottom:'8px' }}>
                        <img src="/logo.png" alt="" style={{ width:'44px', height:'44px', objectFit:'contain' }} />
                        <div style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px' }}>Roma's Donuts</div>
                        <div style={{ fontWeight:'bold' }}>EMPLOYEE PAYSLIP</div>
                        <div style={{ color:'#666', fontSize:'11px' }}>Serial: {genSerial(payrollStart,payrollResults.indexOf(pay))} | {payrollStart} to {payrollEnd}</div>
                      </div>
                      <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                        <div style={{ fontSize:'16px', fontWeight:'bold', color:'#ca1b1b' }}>{pay.employeeName}</div>
                        <div style={{ fontSize:'13px', fontWeight:'bold', color:'#555' }}>{pay.position}</div>
                        <div style={{ fontSize:'11px', color:'#888' }}>Code: {pay.employeeCode} | Worked: {pay.workedDays}d | Absent: {pay.absentDays}d</div>
                      </div>
                      <div style={{ color:'#2d8a4e', fontWeight:'bold', marginBottom:'4px' }}>EARNINGS</div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#888', marginBottom:'6px' }}>
                        <span>Hourly Rate: {php(pay.hourlyRate)}/hr | Hours Worked: {Math.floor((pay.totalWorkedMinutes||0)/60)}h {(pay.totalWorkedMinutes||0)%60}m</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between' }}><span>Basic Pay</span><span>{php(pay.basicPay)}</span></div>
                      {(pay.birthdayPay||0)>0&&<div style={{ display:'flex', justifyContent:'space-between', color:'#e91e63' }}><span>🎂 Birthday Pay (200%)</span><span>{php(pay.birthdayPay)}</span></div>}
                      {pay.overtimePay>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Overtime Pay ({pay.overtimeMinutes}min)</span><span>{php(pay.overtimePay)}</span></div>}
                      {pay.nightDiffPay>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Night Differential</span><span>{php(pay.nightDiffPay)}</span></div>}
                      {pay.holidayPay>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Holiday Pay</span><span>{php(pay.holidayPay)}</span></div>}
                      {pay.adjustmentEarnings>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Other Earnings</span><span>{php(pay.adjustmentEarnings)}</span></div>}
                      {(pay.lateMinutes||0)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#f5a623' }}><span>ℹ️ Late: {pay.lateMinutes}min (embedded in hours)</span><span>—</span></div>}
                      {(pay.undertimeMinutes||0)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#f5a623' }}><span>ℹ️ Undertime: {pay.undertimeMinutes}min (embedded in hours)</span><span>—</span></div>}
                      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold', borderTop:'1px solid #eee', marginTop:'4px', paddingTop:'4px' }}><span>Total Earnings</span><span style={{ color:'#2d8a4e' }}>{php(pay.totalEarnings)}</span></div>
                      <div style={{ color:'#ca1b1b', fontWeight:'bold', margin:'8px 0 4px' }}>DEDUCTIONS</div>
                      {pay.cashAdvanceDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Cash Advance</span><span>{php(pay.cashAdvanceDeduction)}</span></div>}
                      {pay.sssDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>SSS</span><span>{php(pay.sssDeduction)}</span></div>}
                      {pay.pagibigDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Pag-IBIG</span><span>{php(pay.pagibigDeduction)}</span></div>}
                      {pay.philhealthDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>PhilHealth</span><span>{php(pay.philhealthDeduction)}</span></div>}
                      {pay.adjustmentDeductions>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Other Deductions</span><span>{php(pay.adjustmentDeductions)}</span></div>}
                      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold', borderTop:'1px solid #eee', marginTop:'4px', paddingTop:'4px' }}><span>Total Deductions</span><span style={{ color:'#ca1b1b' }}>{php(pay.totalDeductions)}</span></div>
                      <div style={{ background:'#ca1b1b', color:'white', padding:'10px 14px', borderRadius:'8px', marginTop:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:'bold', fontSize:'14px' }}>NET PAY</span>
                        <span style={{ fontWeight:'bold', fontSize:'18px' }}>{php(pay.netPay)}</span>
                      </div>
                      <button style={{ ...btnBlack, width:'auto', padding:'8px 16px', marginTop:'10px', fontSize:'12px' }} onClick={()=>printSinglePayslip(pay, payrollResults.indexOf(pay))}>🖨 PRINT THIS PAYSLIP</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PAYROLL HISTORY */}
            {activeTab==='payrollHistory' && (
              <div>
                <h2 style={h2s}>📂 Payroll History</h2>

                {/* Period List */}
                {!selectedHistoryPeriod && (
                  <div>
                    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end', marginBottom:'16px' }}>
                      <div>
                        <label style={lblS}>Filter by Year:</label>
                        <select value={historyYear} onChange={e=>setHistoryYear(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }}>
                          {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={async()=>{ await loadPayrollHistory(); showToast('✅ Payroll history refreshed!') }}>🔄 REFRESH</button>
                    </div>
                    {historyLoading && <p style={{ color:'#888' }}>⏳ Loading payroll history...</p>}
                    {!historyLoading && payrollHistory.length===0 && <p style={{ color:'#888' }}>No payroll records found.</p>}
                    {payrollHistory
                      .filter(p=>p.payroll_start.startsWith(historyYear))
                      .map(period=>(
                        <div key={period.payroll_start+period.payroll_end} style={{ ...cardS, border:'2px solid #ca1b1b', background:'white', cursor:'pointer' }} onClick={()=>loadHistoryRecords(period.payroll_start, period.payroll_end)}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                            <div>
                              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px', margin:'0 0 4px' }}>
                                📅 {period.payroll_start} → {period.payroll_end}
                              </p>
                              <p style={cps}>Total Employees: <strong>{period.total}</strong></p>
                              <div style={{ display:'flex', gap:'8px', marginTop:'6px', flexWrap:'wrap' }}>
                                <Badge label={`✅ Agreed: ${period.agreed}`} color="green" />
                                {period.disputed>0 && <Badge label={`⚠️ Disputed: ${period.disputed}`} color="red" />}
                                {period.pending>0 && <Badge label={`🔔 Pending: ${period.pending}`} color="orange" />}
                              </div>
                            </div>
                            <button style={{ ...btnBlack, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }}>VIEW →</button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* Period Detail View */}
                {selectedHistoryPeriod && (
                  <div>
                    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginBottom:'16px' }}>
                      <button style={{ ...btnGray, width:'auto', padding:'8px 16px', marginTop:0 }} onClick={()=>{ setSelectedHistoryPeriod(null); setHistoryRecords([]) }}>← BACK TO LIST</button>
                      <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>
                        {selectedHistoryPeriod.start} to {selectedHistoryPeriod.end}
                      </h3>
                    </div>

                    {/* Summary Banner */}
                    {historyRecords.length>0 && (
                      <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                        <h3 style={{ color:'#ca1b1b', margin:'0 0 10px', fontSize:'14px' }}>📊 Period Summary</h3>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'8px' }}>
                          {[
                            ['Employees', historyRecords.length],
                            ['Total Earnings', 'PHP '+historyRecords.reduce((s,r)=>s+Number(r.total_earnings||0),0).toFixed(2)],
                            ['Total Deductions', 'PHP '+historyRecords.reduce((s,r)=>s+Number(r.total_deductions||0),0).toFixed(2)],
                            ['Total Net Pay', 'PHP '+historyRecords.reduce((s,r)=>s+Number(r.net_pay||0),0).toFixed(2)],
                          ].map(([l,v])=>(
                            <div key={l} style={{ background:'white', borderRadius:'8px', padding:'10px', border:'1px solid #eee' }}>
                              <p style={{ color:'#888', fontSize:'11px', margin:'0 0 3px' }}>{l}</p>
                              <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'13px', margin:0 }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }}
                        onClick={()=>printHistoryPayslips(historyRecords, selectedHistoryPeriod.start, selectedHistoryPeriod.end)}>
                        🖨 PRINT ALL PAYSLIPS
                      </button>
                      <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }}
                        onClick={()=>exportPayrollToCSV(historyRecords, selectedHistoryPeriod.start, selectedHistoryPeriod.end)}>
                        📊 EXPORT TO CSV
                      </button>
                      <button style={{ background:'#8b5cf6', color:'white', padding:'10px 18px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', marginTop:0 }}
                        onClick={async()=>{
                          const empId = prompt('Enter Employee ID or code for DTR:')
                          if(!empId) return
                          const emp = employees.find(e=>e.employee_code===empId.toUpperCase()||e.id===empId)
                          if(!emp){ showToast('Employee not found.','red'); return }
                          await printDTR(emp.id, emp.full_name, emp.employee_code, selectedHistoryPeriod.start.slice(0,7))
                        }}>
                        📋 PRINT DTR
                      </button>
                    </div>

                    {/* Search */}
                    <input placeholder="🔍 Search employee..." value={historySearch} onChange={e=>setHistorySearch(e.target.value)} style={{ ...inputStyle, marginBottom:'14px' }} />

                    {/* Records */}
                    {historyRecords
                      .filter(r=>r.employee_name.toLowerCase().includes(historySearch.toLowerCase())||r.employee_code.toLowerCase().includes(historySearch.toLowerCase()))
                      .map((pay,idx)=>(
                        <div key={pay.id} style={{ ...cardS, marginBottom:'14px', border:'1px solid #ddd' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                            <div>
                              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px', margin:0 }}>{pay.employee_name}</p>
                              <p style={cps}>{pay.employee_code} | Worked: {pay.worked_days}d</p>
                              {pay.payslip_serial && <p style={{ fontSize:'11px', color:'#aaa', fontFamily:'monospace', margin:'2px 0' }}>{pay.payslip_serial}</p>}
                            </div>
                            <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                              {pay.employee_acknowledgement==='agreed' && <Badge label="✅ Agreed" color="green" />}
                              {pay.employee_acknowledgement==='disputed' && <Badge label="⚠️ Disputed" color="red" />}
                              {(pay.employee_acknowledgement==='pending'||!pay.employee_acknowledgement) && <Badge label="🔔 Pending" color="orange" />}
                              <button style={{ ...btnBlack, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'12px' }}
                                onClick={()=>printHistoryPayslips([pay], selectedHistoryPeriod.start, selectedHistoryPeriod.end)}>
                                🖨 PRINT
                              </button>
                            </div>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', fontSize:'12px' }}>
                            <div style={{ background:'#f0fff0', borderRadius:'6px', padding:'8px' }}>
                              <p style={{ color:'#2d8a4e', fontWeight:'bold', margin:'0 0 4px', fontSize:'11px' }}>EARNINGS</p>
                              <p style={{ margin:'2px 0', color:'#555' }}>Basic: PHP {Number(pay.basic_pay||0).toFixed(2)}</p>
                              {Number(pay.overtime_pay||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>OT: PHP {Number(pay.overtime_pay).toFixed(2)}</p>}
                              {Number(pay.holiday_pay||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>Holiday: PHP {Number(pay.holiday_pay).toFixed(2)}</p>}
                              {Number(pay.night_diff_pay||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>Night Diff: PHP {Number(pay.night_diff_pay).toFixed(2)}</p>}
                              <p style={{ margin:'4px 0 0', fontWeight:'bold', color:'#2d8a4e' }}>Total: PHP {Number(pay.total_earnings||0).toFixed(2)}</p>
                            </div>
                            <div style={{ background:'#fff0f0', borderRadius:'6px', padding:'8px' }}>
                              <p style={{ color:'#ca1b1b', fontWeight:'bold', margin:'0 0 4px', fontSize:'11px' }}>DEDUCTIONS</p>
                              {Number(pay.late_deduction||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>Late: PHP {Number(pay.late_deduction).toFixed(2)}</p>}
                              {Number(pay.undertime_deduction||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>UT: PHP {Number(pay.undertime_deduction).toFixed(2)}</p>}
                              {Number(pay.sss_deduction||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>SSS: PHP {Number(pay.sss_deduction).toFixed(2)}</p>}
                              {Number(pay.pagibig_deduction||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>Pag-IBIG: PHP {Number(pay.pagibig_deduction).toFixed(2)}</p>}
                              {Number(pay.philhealth_deduction||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>PhilHealth: PHP {Number(pay.philhealth_deduction).toFixed(2)}</p>}
                              {Number(pay.cash_advance_deduction||0)>0 && <p style={{ margin:'2px 0', color:'#555' }}>CA: PHP {Number(pay.cash_advance_deduction).toFixed(2)}</p>}
                              <p style={{ margin:'4px 0 0', fontWeight:'bold', color:'#ca1b1b' }}>Total: PHP {Number(pay.total_deductions||0).toFixed(2)}</p>
                            </div>
                          </div>
                          <div style={{ background:'#ca1b1b', color:'white', padding:'8px 12px', borderRadius:'6px', marginTop:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontWeight:'bold', fontSize:'13px' }}>NET PAY</span>
                            <span style={{ fontWeight:'bold', fontSize:'16px' }}>PHP {Number(pay.net_pay||0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

            {/* 13TH MONTH */}
            {activeTab==='thirteenth' && (
              <div>
                <h2 style={h2s}>🎁 13th Month Pay</h2>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'16px', fontSize:'13px', color:'#555' }}>
                  <strong style={{ color:'#ca1b1b' }}>Formula:</strong> Total Basic Pay for the year ÷ 12 = 13th Month Pay (DOLE mandated, tax-exempt up to ₱90,000)
                </div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px', alignItems:'flex-end' }}>
                  <div><label style={lblS}>From:</label><input type="date" value={payrollStart} onChange={e=>setPayrollStart(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                  <div><label style={lblS}>To:</label><input type="date" value={payrollEnd} onChange={e=>setPayrollEnd(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                </div>
                <button style={{ ...btnGreen, marginBottom:'8px' }} onClick={async()=>{
                  const { data:empList } = await supabase.from('employees').select('*').eq('is_active', true)
                  const r=[]
                  for (const emp of empList||[]) {
                    const { data:records } = await supabase.from('payroll_records').select('basic_pay,payroll_start,payroll_end').eq('employee_id', emp.id).gte('payroll_start', payrollStart).lte('payroll_end', payrollEnd).order('payroll_start')
                    const totalBasic=records?.reduce((s,rec)=>s+Number(rec.basic_pay||0),0)||0
                    const periods = records?.length||0
                    r.push({ employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position||'', department:emp.department||'', hireDate:emp.hire_date||'—', totalBasic, thirteenthMonth:totalBasic/12, periods, dailyRate:Number(emp.daily_rate||0) })
                  }
                  setThirteenthDetails(r); setPayrollResults(r); showToast('✅ 13th Month computed!')
                }}>🧮 COMPUTE 13TH MONTH</button>

                {thirteenthDetails.length>0 && (
                  <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
                    <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={()=>{
                      const pw = window.open('','_blank','width=900,height=700')
                      const html = thirteenthDetails.map((pay,idx)=>`
                        <div class="payslip-wrap">
                          <div style="width:145mm;min-height:105mm;padding:8mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000;background:white;">
                            <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #ca1b1b;padding-bottom:6px;">
                              <div style="font-size:18px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
                              <div style="font-size:12px;font-weight:bold;margin-top:2px;">13TH MONTH PAY SLIP</div>
                              <div style="font-size:10px;color:#666;">Period: ${payrollStart} to ${payrollEnd}</div>
                            </div>
                            <div style="background:#fff8dc;border:2px solid #ca1b1b;border-radius:6px;padding:8px;margin-bottom:8px;">
                              <div style="font-size:14px;font-weight:bold;color:#ca1b1b;">${pay.employeeName}</div>
                              <div style="font-size:11px;color:#555;">${pay.position} | ${pay.department}</div>
                              <div style="font-size:10px;color:#888;">Code: ${pay.employeeCode} | Hire Date: ${pay.hireDate}</div>
                            </div>
                            <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
                              <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-size:10px;">Payroll Cutoffs Included</td><td style="padding:4px 8px;text-align:right;font-size:10px;">${pay.periods}</td></tr>
                              <tr><td style="padding:4px 8px;font-size:10px;">Total Basic Pay (Year)</td><td style="padding:4px 8px;text-align:right;font-size:10px;">PHP ${pay.totalBasic.toFixed(2)}</td></tr>
                              <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-size:10px;">Formula</td><td style="padding:4px 8px;text-align:right;font-size:10px;">PHP ${pay.totalBasic.toFixed(2)} ÷ 12</td></tr>
                            </table>
                            <div style="background:#ca1b1b;color:white;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                              <span style="font-weight:bold;font-size:12px;">13TH MONTH PAY</span>
                              <span style="font-weight:bold;font-size:16px;">PHP ${pay.thirteenthMonth.toFixed(2)}</span>
                            </div>
                            <div style="margin-top:16px;display:flex;justify-content:space-between;">
                              <div style="text-align:center;"><div style="border-top:1px solid #000;width:100px;padding-top:3px;font-size:9px;">Employee Signature</div></div>
                              <div style="text-align:center;"><div style="border-top:1px solid #000;width:100px;padding-top:3px;font-size:9px;">Authorized By</div></div>
                            </div>
                          </div>
                        </div>`).join('')
                      pw.document.write(`<!DOCTYPE html><html><head><title>13th Month Pay</title>
                        <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#e0e0e0;display:flex;flex-direction:column;align-items:center;padding:16px 0;}
                        .payslip-wrap{background:white;width:145mm;margin:10px auto;box-shadow:0 2px 8px rgba(0,0,0,0.2);}
                        @media print{@page{size:145mm 210mm;margin:0;}body{background:white;display:block;padding:0;}.payslip-wrap{box-shadow:none;margin:0;page-break-after:always;}}</style>
                        </head><body>${html}</body></html>`)
                      pw.document.close(); setTimeout(()=>{pw.focus();pw.print()},800)
                    }}>🖨 PRINT ALL</button>
                    <div style={{ background:'#e8f5e9', borderRadius:'8px', padding:'10px 16px', border:'1px solid #c8e6c9' }}>
                      <span style={{ fontSize:'12px', color:'#555' }}>Total Payout: </span>
                      <span style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'14px' }}>{php(thirteenthDetails.reduce((s,r)=>s+r.thirteenthMonth,0))}</span>
                    </div>
                  </div>
                )}

                {thirteenthDetails.map((pay,idx)=>(
                  <div key={pay.employeeCode} style={{ ...cardS, border:'1px solid #ddd' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <div>
                        <strong style={{ color:'#ca1b1b', fontSize:'14px' }}>{pay.employeeName}</strong>
                        <p style={cps}>{pay.employeeCode} | {pay.position} | {pay.department}</p>
                        <p style={cps}>Hire Date: {pay.hireDate} | Cutoffs: {pay.periods}</p>
                        <p style={cps}>Total Basic (Year): {php(pay.totalBasic)} ÷ 12</p>
                        <h3 style={{ color:'#ca1b1b', margin:'6px 0 0', fontSize:'15px' }}>13th Month: {php(pay.thirteenthMonth)}</h3>
                      </div>
                      <button style={{ ...btnBlack, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>{
                        const pw = window.open('','_blank','width=700,height=500')
                        pw.document.write(`<!DOCTYPE html><html><head><title>13th Month - ${pay.employeeName}</title>
                          <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#e0e0e0;display:flex;justify-content:center;padding:10px;}
                          .wrap{background:white;box-shadow:0 2px 8px rgba(0,0,0,0.2);}
                          @media print{@page{size:145mm 210mm;margin:0;}body{background:white;padding:0;}.wrap{box-shadow:none;}}</style>
                          </head><body><div class="wrap">
                          <div style="width:145mm;min-height:105mm;padding:8mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000;">
                            <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #ca1b1b;padding-bottom:6px;">
                              <div style="font-size:18px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
                              <div style="font-size:12px;font-weight:bold;">13TH MONTH PAY SLIP</div>
                              <div style="font-size:10px;color:#666;">Period: ${payrollStart} to ${payrollEnd}</div>
                            </div>
                            <div style="background:#fff8dc;border:2px solid #ca1b1b;border-radius:6px;padding:8px;margin-bottom:8px;">
                              <div style="font-size:14px;font-weight:bold;color:#ca1b1b;">${pay.employeeName}</div>
                              <div style="font-size:11px;color:#555;">${pay.position} | ${pay.department}</div>
                              <div style="font-size:10px;color:#888;">Code: ${pay.employeeCode} | Hire Date: ${pay.hireDate}</div>
                            </div>
                            <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
                              <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-size:10px;">Cutoff Periods Included</td><td style="padding:4px 8px;text-align:right;font-size:10px;">${pay.periods}</td></tr>
                              <tr><td style="padding:4px 8px;font-size:10px;">Total Basic Pay (Year)</td><td style="padding:4px 8px;text-align:right;font-size:10px;">PHP ${pay.totalBasic.toFixed(2)}</td></tr>
                              <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-size:10px;">Computation</td><td style="padding:4px 8px;text-align:right;font-size:10px;">PHP ${pay.totalBasic.toFixed(2)} ÷ 12 months</td></tr>
                            </table>
                            <div style="background:#ca1b1b;color:white;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;">
                              <span style="font-weight:bold;font-size:12px;">13TH MONTH PAY</span>
                              <span style="font-weight:bold;font-size:16px;">PHP ${pay.thirteenthMonth.toFixed(2)}</span>
                            </div>
                            <div style="margin-top:16px;display:flex;justify-content:space-between;">
                              <div style="text-align:center;"><div style="border-top:1px solid #000;width:100px;padding-top:3px;font-size:9px;">Employee Signature</div></div>
                              <div style="text-align:center;"><div style="border-top:1px solid #000;width:100px;padding-top:3px;font-size:9px;">Authorized By</div></div>
                            </div>
                          </div></div></body></html>`)
                        pw.document.close(); setTimeout(()=>{pw.focus();pw.print()},800)
                      }}>🖨 PRINT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* FINAL PAY */}
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
                  <button style={btnGreen} onClick={computeFinalPay}>🧮 COMPUTE FINAL PAY</button>
                </div>
                {finalPayResult && (
                  <div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'20px' }}>
                    <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'8px', padding:'12px', marginBottom:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:'18px', fontWeight:'bold', color:'#ca1b1b' }}>{finalPayResult.employeeName}</div>
                      <div style={{ fontSize:'14px', fontWeight:'bold', color:'#555' }}>{finalPayResult.position}</div>
                      <div style={{ fontSize:'11px', color:'#888' }}>Code: {finalPayResult.employeeCode}</div>
                    </div>
                    <p style={cps}><strong>Hire Date:</strong> {finalPayResult.hireDate} | <strong>Last Day:</strong> {finalPayResult.lastDate}</p>
                    <p style={cps}><strong>Years of Service:</strong> {finalPayResult.yearsOfService} | <strong>Reason:</strong> {finalPayResult.reason}</p>
                    <p style={cps}><strong>Daily Rate:</strong> {php(finalPayResult.dailyRate)}</p>
                    <hr style={{ margin:'12px 0', borderColor:'#eee' }} />
                    <p style={{ color:'#2d8a4e', fontWeight:'bold', marginBottom:'6px' }}>FINAL PAY COMPONENTS</p>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span>Last Salary ({finalPayResult.unpaidDays} days)</span><span>{php(finalPayResult.lastSalary)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span>Pro-rated 13th Month</span><span>{php(finalPayResult.proRated13th)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span>Unused SIL ({finalPayResult.unusedSIL} days)</span><span>{php(finalPayResult.silPay)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span>Separation Pay</span><span>{php(finalPayResult.separationPay)}</span></div>
                    <hr style={{ margin:'12px 0', borderColor:'#eee' }} />
                    <p style={{ color:'#ca1b1b', fontWeight:'bold', marginBottom:'6px' }}>DEDUCTIONS</p>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span>Outstanding Cash Advance</span><span>{php(finalPayResult.totalCA)}</span></div>
                    <div style={{ background:'#ca1b1b', color:'white', padding:'12px 16px', borderRadius:'8px', marginTop:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontWeight:'bold', fontSize:'14px' }}>TOTAL FINAL PAY</span>
                      <span style={{ fontWeight:'bold', fontSize:'20px' }}>{php(finalPayResult.totalFinalPay)}</span>
                    </div>
                    <div style={{ display:'flex', gap:'10px', marginTop:'16px', flexWrap:'wrap' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={processFinalPay}>✅ PROCESS & DEACTIVATE</button>
                      <button style={{ ...btnBlack, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={()=>printFinalPay(finalPayResult)}>🖨 PRINT</button>
                      <button style={{ ...btnGray, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={()=>setFinalPayResult(null)}>CANCEL</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* REMITTANCE REPORT */}
            {activeTab==='remittance' && (
              <div>
                <h2 style={h2s}>🏛️ Government Remittance Report</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'16px' }}>Generate SSS, Pag-IBIG, and PhilHealth contribution summaries per payroll period for government filing.</p>
                <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
                  <label style={lblS}>Select Payroll Period:</label>
                  <select value={remittancePeriod} onChange={e=>setRemittancePeriod(e.target.value)} style={inputStyle}>
                    <option value="">Select a period...</option>
                    {payrollHistory.map(p=>(
                      <option key={p.payroll_start+p.payroll_end} value={`${p.payroll_start}|${p.payroll_end}`}>
                        {p.payroll_start} to {p.payroll_end}
                      </option>
                    ))}
                  </select>
                  <button style={btnGreen} onClick={async()=>{
                    if(!remittancePeriod){ showToast('Please select a period.','red'); return }
                    const [start,end] = remittancePeriod.split('|')
                    const { data } = await supabase.from('payroll_records').select('*').eq('payroll_start', start).eq('payroll_end', end).order('employee_name')
                    if(!data||!data.length){ showToast('No records found for this period.','red'); return }
                    const sss = data.filter(r=>Number(r.sss_deduction||0)>0)
                    const pagibig = data.filter(r=>Number(r.pagibig_deduction||0)>0)
                    const philhealth = data.filter(r=>Number(r.philhealth_deduction||0)>0)
                    setRemittanceData({
                      start, end, records: data,
                      sss: { list: sss, totalEmployee: sss.reduce((s,r)=>s+Number(r.sss_deduction||0),0), totalEmployer: sss.length * 900 },
                      pagibig: { list: pagibig, totalEmployee: pagibig.reduce((s,r)=>s+Number(r.pagibig_deduction||0),0), totalEmployer: pagibig.length * 200 },
                      philhealth: { list: philhealth, totalEmployee: philhealth.reduce((s,r)=>s+Number(r.philhealth_deduction||0),0), totalEmployer: philhealth.length * 250 },
                    })
                    showToast('✅ Remittance report generated!')
                  }}>🧮 GENERATE REPORT</button>
                </div>

                {remittanceData && (
                  <div>
                    <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
                      <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={()=>{
                        const pw = window.open('','_blank','width=900,height=700')
                        const tableRows = (list, field) => list.map(r=>`
                          <tr>
                            <td style="padding:5px 8px;border:1px solid #eee;">${r.employee_code}</td>
                            <td style="padding:5px 8px;border:1px solid #eee;">${r.employee_name}</td>
                            <td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${Number(r[field]||0).toFixed(2)}</td>
                            <td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${(field==='sss_deduction'?900:field==='pagibig_deduction'?200:250).toFixed(2)}</td>
                            <td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${(Number(r[field]||0)+(field==='sss_deduction'?900:field==='pagibig_deduction'?200:250)).toFixed(2)}</td>
                          </tr>`).join('')
                        pw.document.write(`<!DOCTYPE html><html><head><title>Remittance Report</title>
                          <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:15mm;font-size:11px;}
                          @media print{@page{size:A4;margin:10mm;}}</style></head><body>
                          <div style="text-align:center;margin-bottom:14px;border-bottom:2px solid #ca1b1b;padding-bottom:8px;">
                            <div style="font-size:18px;font-weight:bold;color:#ca1b1b;">Roma's Donuts</div>
                            <div style="font-size:13px;font-weight:bold;margin-top:4px;">GOVERNMENT REMITTANCE REPORT</div>
                            <div style="font-size:11px;color:#666;">Period: ${remittanceData.start} to ${remittanceData.end}</div>
                          </div>
                          <div style="margin-bottom:16px;">
                            <div style="font-weight:bold;color:#ca1b1b;margin-bottom:6px;font-size:12px;">📋 SSS CONTRIBUTIONS</div>
                            <table style="width:100%;border-collapse:collapse;">
                              <tr style="background:#ca1b1b;color:white;"><th style="padding:5px 8px;">Code</th><th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;text-align:right;">Employee Share</th><th style="padding:5px 8px;text-align:right;">Employer Share</th><th style="padding:5px 8px;text-align:right;">Total</th></tr>
                              ${tableRows(remittanceData.sss.list,'sss_deduction')}
                              <tr style="background:#f5f5f5;font-weight:bold;"><td colspan="2" style="padding:5px 8px;border:1px solid #eee;">TOTAL</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${remittanceData.sss.totalEmployee.toFixed(2)}</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${remittanceData.sss.totalEmployer.toFixed(2)}</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${(remittanceData.sss.totalEmployee+remittanceData.sss.totalEmployer).toFixed(2)}</td></tr>
                            </table>
                          </div>
                          <div style="margin-bottom:16px;">
                            <div style="font-weight:bold;color:#ca1b1b;margin-bottom:6px;font-size:12px;">📋 PAG-IBIG CONTRIBUTIONS</div>
                            <table style="width:100%;border-collapse:collapse;">
                              <tr style="background:#ca1b1b;color:white;"><th style="padding:5px 8px;">Code</th><th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;text-align:right;">Employee Share</th><th style="padding:5px 8px;text-align:right;">Employer Share</th><th style="padding:5px 8px;text-align:right;">Total</th></tr>
                              ${tableRows(remittanceData.pagibig.list,'pagibig_deduction')}
                              <tr style="background:#f5f5f5;font-weight:bold;"><td colspan="2" style="padding:5px 8px;border:1px solid #eee;">TOTAL</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${remittanceData.pagibig.totalEmployee.toFixed(2)}</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${remittanceData.pagibig.totalEmployer.toFixed(2)}</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${(remittanceData.pagibig.totalEmployee+remittanceData.pagibig.totalEmployer).toFixed(2)}</td></tr>
                            </table>
                          </div>
                          <div style="margin-bottom:16px;">
                            <div style="font-weight:bold;color:#ca1b1b;margin-bottom:6px;font-size:12px;">📋 PHILHEALTH CONTRIBUTIONS</div>
                            <table style="width:100%;border-collapse:collapse;">
                              <tr style="background:#ca1b1b;color:white;"><th style="padding:5px 8px;">Code</th><th style="padding:5px 8px;">Name</th><th style="padding:5px 8px;text-align:right;">Employee Share</th><th style="padding:5px 8px;text-align:right;">Employer Share</th><th style="padding:5px 8px;text-align:right;">Total</th></tr>
                              ${tableRows(remittanceData.philhealth.list,'philhealth_deduction')}
                              <tr style="background:#f5f5f5;font-weight:bold;"><td colspan="2" style="padding:5px 8px;border:1px solid #eee;">TOTAL</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${remittanceData.philhealth.totalEmployee.toFixed(2)}</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${remittanceData.philhealth.totalEmployer.toFixed(2)}</td><td style="padding:5px 8px;border:1px solid #eee;text-align:right;">PHP ${(remittanceData.philhealth.totalEmployee+remittanceData.philhealth.totalEmployer).toFixed(2)}</td></tr>
                            </table>
                          </div>
                          <div style="background:#ca1b1b;color:white;padding:10px 14px;border-radius:6px;display:flex;justify-content:space-between;">
                            <span style="font-weight:bold;">GRAND TOTAL REMITTANCE</span>
                            <span style="font-weight:bold;">PHP ${(remittanceData.sss.totalEmployee+remittanceData.sss.totalEmployer+remittanceData.pagibig.totalEmployee+remittanceData.pagibig.totalEmployer+remittanceData.philhealth.totalEmployee+remittanceData.philhealth.totalEmployer).toFixed(2)}</span>
                          </div>
                        </body></html>`)
                        pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },800)
                      }}>🖨 PRINT REMITTANCE REPORT</button>
                    </div>

                    {/* Summary Cards */}
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
                      {[
                        { name:'SSS', emp: remittanceData.sss.totalEmployee, employer: remittanceData.sss.totalEmployer, count: remittanceData.sss.list.length },
                        { name:'Pag-IBIG', emp: remittanceData.pagibig.totalEmployee, employer: remittanceData.pagibig.totalEmployer, count: remittanceData.pagibig.list.length },
                        { name:'PhilHealth', emp: remittanceData.philhealth.totalEmployee, employer: remittanceData.philhealth.totalEmployer, count: remittanceData.philhealth.list.length },
                      ].map(r=>(
                        <div key={r.name} style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'12px', padding:'16px' }}>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:'0 0 10px' }}>🏛️ {r.name}</p>
                          <p style={cps}>Employees: <strong>{r.count}</strong></p>
                          <p style={cps}>Employee Share: <strong>{php(r.emp)}</strong></p>
                          <p style={cps}>Employer Share: <strong>{php(r.employer)}</strong></p>
                          <div style={{ background:'#ca1b1b', color:'white', borderRadius:'6px', padding:'6px 10px', marginTop:'8px', display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:'12px', fontWeight:'bold' }}>Total</span>
                            <span style={{ fontSize:'13px', fontWeight:'bold' }}>{php(r.emp+r.employer)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DTR PRINT */}
            {activeTab==='dtr' && (
              <div>
                <h2 style={h2s}>📋 DTR — Daily Time Record</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'16px' }}>View and print the official Daily Time Record for any employee filtered by month.</p>

                <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
                    <div style={{ flex:1, minWidth:'180px' }}>
                      <label style={lblS}>Select Employee:</label>
                      <EmployeeSelect value={dtrEmployeeId} onChange={v=>{ setDtrEmployeeId(v); setDtrRecords([]); setDtrStats(null) }} employees={employees} />
                    </div>
                    <div>
                      <label style={lblS}>Month:</label>
                      <input type="month" value={dtrMonth} onChange={e=>{ setDtrMonth(e.target.value); setDtrRecords([]); setDtrStats(null) }} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', marginTop:'12px', flexWrap:'wrap' }}>
                    <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={async()=>{
                      if(!dtrEmployeeId){ showToast('Please select an employee.','red'); return }
                      const emp = employees.find(e=>e.id===dtrEmployeeId)
                      if(!emp) return
                      const startDate = `${dtrMonth}-01`
                      const endDate = new Date(Number(dtrMonth.split('-')[0]), Number(dtrMonth.split('-')[1]), 0).toISOString().slice(0,10)
                      const { data: logs } = await supabase.from('attendance_logs').select('*')
                        .eq('employee_id', dtrEmployeeId)
                        .gte('attendance_date', startDate)
                        .lte('attendance_date', endDate)
                        .order('attendance_date')
                      const daysInMonth = new Date(Number(dtrMonth.split('-')[0]), Number(dtrMonth.split('-')[1]), 0).getDate()
                      const allDays = Array.from({length: daysInMonth}, (_,i)=>{
                        const dateStr = `${dtrMonth}-${String(i+1).padStart(2,'0')}`
                        const log = logs?.find(l=>l.attendance_date===dateStr)
                        const dayName = new Date(dateStr).toLocaleDateString('en-US',{weekday:'short'})
                        return { dateStr, day: i+1, dayName, log }
                      })
                      setDtrRecords(allDays)
                      setDtrStats({
                        emp,
                        totalWorked: logs?.filter(l=>l.time_in).length||0,
                        totalAbsent: logs?.filter(l=>l.status==='Absent').length||0,
                        totalLate: logs?.reduce((s,l)=>s+Number(l.late_minutes||0),0)||0,
                        totalOT: logs?.filter(l=>l.overtime_approved===true).reduce((s,l)=>s+Number(l.overtime_minutes||0),0)||0,
                        totalBreak: logs?.reduce((s,l)=>s+Number(l.total_break_minutes||0),0)||0,
                      })
                    }}>🔍 VIEW DTR</button>
                    <button style={{ ...btnBlack, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={async()=>{
                      if(!dtrEmployeeId){ showToast('Please select an employee.','red'); return }
                      const emp = employees.find(e=>e.id===dtrEmployeeId)
                      if(!emp){ showToast('Employee not found.','red'); return }
                      await printDTR(emp.id, emp.full_name, emp.employee_code, dtrMonth)
                    }}>🖨 PRINT DTR</button>
                  </div>
                </div>

                {/* DTR On-Screen View */}
                {dtrStats && dtrRecords.length > 0 && (
                  <div>
                    {/* Employee Header */}
                    <div style={{ background:'#fff8dc', border:'2px solid #ca1b1b', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
                        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                          {dtrStats.emp.profile_photo_url ?
                            <img src={dtrStats.emp.profile_photo_url} alt="" style={{ width:'50px', height:'50px', borderRadius:'50%', objectFit:'cover', border:'2px solid #ca1b1b' }} /> :
                            <div style={{ width:'50px', height:'50px', borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>👤</div>
                          }
                          <div>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'16px', margin:0 }}>{dtrStats.emp.full_name}</p>
                            <p style={cps}>{dtrStats.emp.employee_code} | {dtrStats.emp.position}</p>
                            <p style={cps}>{dtrStats.emp.department||'—'} | {new Date(dtrMonth+'-01').toLocaleString('default',{month:'long',year:'numeric'})}</p>
                          </div>
                        </div>
                        {/* Monthly Summary */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                          {[
                            ['Days Worked', dtrStats.totalWorked, '#2d8a4e'],
                            ['Absences', dtrStats.totalAbsent, '#ca1b1b'],
                            ['Late (min)', dtrStats.totalLate, '#f5a623'],
                            ['OT (min)', dtrStats.totalOT, '#4a90d9'],
                            ['Break (min)', dtrStats.totalBreak, '#888'],
                          ].map(([label, value, color])=>(
                            <div key={label} style={{ background:'white', borderRadius:'8px', padding:'8px', textAlign:'center', minWidth:'80px' }}>
                              <p style={{ fontSize:'10px', color:'#888', margin:'0 0 2px' }}>{label}</p>
                              <p style={{ fontWeight:'bold', color, fontSize:'16px', margin:0 }}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* DTR Table */}
                    <div style={{ overflowX:'auto', borderRadius:'10px', border:'1px solid #eee' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                        <thead>
                          <tr style={{ background:'#ca1b1b', color:'white' }}>
                            <th style={{ padding:'8px 10px', textAlign:'left', fontSize:'12px', whiteSpace:'nowrap' }}>Day</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>Date</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>Time In</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>Time Out</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>Break</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>Late</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>OT</th>
                            <th style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dtrRecords.map(({ dateStr, day, dayName, log }, i)=>{
                            const isWeekend = new Date(dateStr).getDay()===0||new Date(dateStr).getDay()===6
                            const rowBg = isWeekend?'#f5f5f5':log?.status==='Absent'?'#fff5f5':i%2===0?'white':'#fafafa'
                            return (
                              <tr key={dateStr} style={{ background:rowBg, borderBottom:'1px solid #eee' }}>
                                <td style={{ padding:'7px 10px', fontWeight:'bold', color:isWeekend?'#aaa':'#333', fontSize:'12px' }}>{dayName}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center', color:isWeekend?'#aaa':'#333', fontSize:'12px' }}>{day}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center', color:log?.time_in?'#2d8a4e':'#ccc', fontSize:'12px', fontWeight:log?.time_in?'bold':'normal' }}>{log?.time_in||'—'}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center', color:log?.time_out?'#333':'#ccc', fontSize:'12px' }}>{log?.time_out||'—'}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center', fontSize:'12px', color:'#888' }}>{log?.total_break_minutes||0}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center', fontSize:'12px', color:Number(log?.late_minutes||0)>0?'#ca1b1b':'#888', fontWeight:Number(log?.late_minutes||0)>0?'bold':'normal' }}>{log?.late_minutes||0}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center', fontSize:'12px', color:log?.overtime_approved?'#2d8a4e':'#888', fontWeight:log?.overtime_approved?'bold':'normal' }}>{log?.overtime_approved?log.overtime_minutes:0}</td>
                                <td style={{ padding:'7px 10px', textAlign:'center' }}>
                                  {!log && isWeekend ? <span style={{ fontSize:'11px', color:'#aaa' }}>REST</span> :
                                   !log ? <span style={{ fontSize:'11px', color:'#ccc' }}>—</span> :
                                   log.status==='Absent' ? <Badge label="ABS" color="red" /> :
                                   log.status==='Late' ? <Badge label="LATE" color="orange" /> :
                                   log.time_in ? <Badge label="✓" color="green" /> : <span style={{ color:'#ccc' }}>—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#222', color:'white', fontWeight:'bold' }}>
                            <td colSpan={2} style={{ padding:'8px 10px', fontSize:'12px' }}>TOTALS</td>
                            <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>{dtrStats.totalWorked} days</td>
                            <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}></td>
                            <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px' }}>{dtrStats.totalBreak} min</td>
                            <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px', color:'#f5a623' }}>{dtrStats.totalLate} min</td>
                            <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px', color:'#4ade80' }}>{dtrStats.totalOT} min</td>
                            <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'12px', color:'#ca1b1b' }}>{dtrStats.totalAbsent} ABS</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ANNOUNCEMENTS */}
            {activeTab==='announcements' && (
              <div>
                <h2 style={h2s}>📢 Announcements</h2>
                <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 10px', fontSize:'14px' }}>Post New Announcement</h3>
                  <input placeholder="Title" value={newAnnouncementTitle} onChange={e=>setNewAnnouncementTitle(e.target.value)} style={inputStyle} />
                  <textarea placeholder="Announcement content..." value={newAnnouncementContent} onChange={e=>setNewAnnouncementContent(e.target.value)} style={{ ...inputStyle, minHeight:'80px', resize:'vertical' }} />
                  <button style={btnGreen} onClick={addAnnouncement}>📢 POST ANNOUNCEMENT</button>
                </div>
                {announcements.length===0 && <p style={{ color:'#888' }}>No announcements yet.</p>}
                {announcements.map(ann=>(
                  <div key={ann.id} style={{ ...cardS, border:`2px solid ${ann.is_active?'#ca1b1b':'#ccc'}`, background:ann.is_active?'#fff8dc':'#f9f9f9' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'6px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
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
                    <button style={{ ...btnBlack, width:'auto', padding:'6px 14px', marginTop:'8px', fontSize:'12px' }} onClick={()=>{ loadAnnouncementViews(ann.id) }}>👁 VIEW STATUS</button>
                    {announcementViews.length>0 && (
                      <div style={{ marginTop:'10px', background:'white', borderRadius:'8px', padding:'10px', border:'1px solid #ddd', maxHeight:'200px', overflowY:'auto' }}>
                        <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 8px', color:'#ca1b1b' }}>Who has/hasn't seen this:</p>
                        {announcementViews.map(v=>(
                          <div key={v.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f5f5f5' }}>
                            <span style={{ fontSize:'13px' }}>{v.full_name} ({v.employee_code})</span>
                            <Badge label={v.viewed?'✅ Viewed':'🔔 Not Seen'} color={v.viewed?'green':'red'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* LEAVE REQUESTS */}
            {activeTab==='leaveRequests' && (
              <div>
                <h2 style={h2s}>Leave Requests</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={async()=>{ await loadLeaveRequests(); showToast('✅ Leave requests refreshed!') }}>🔄 REFRESH</button>
                {leaveRequests.length===0 && <p style={{ color:'#888' }}>No pending leave requests.</p>}
                {leaveRequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{req.employee_name}</strong>
                    <p style={cps}>Code: {req.employee_code}</p>
                    <p style={cps}>Leave: {req.leave_start} to {req.leave_end} ({req.duration_days} day(s))</p>
                    <p style={cps}>Type: {req.leave_type} | Reason: <em>"{req.reason}"</em></p>
                    <div style={{ display:'flex', gap:'8px', marginTop:'10px', flexWrap:'wrap' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={async(e)=>{ const btn=e.currentTarget; btn.disabled=true; btn.textContent='Processing...'; await updateLeaveStatus(req.id,'approved',''); btn.disabled=false; btn.textContent='✅ APPROVE' }}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={(e)=>{ e.stopPropagation(); setShowLeaveDisapproveBox(p=>({...p,[req.id]:!p[req.id]})) }}>❌ DISAPPROVE</button>
                    </div>
                    {showLeaveDisapproveBox[req.id] && (
                      <div style={{ marginTop:'10px' }}>
                        <textarea placeholder="Reason for disapproval (required)..." value={leaveDisapproveReason[req.id]||''} onChange={e=>setLeaveDisapproveReason(p=>({...p,[req.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={async(e)=>{ const btn=e.currentTarget; const r=leaveDisapproveReason[req.id]; if(!r?.trim()){showToast('Please enter a reason.','red');return;} btn.disabled=true; btn.textContent='Processing...'; await updateLeaveStatus(req.id,'disapproved',r); setShowLeaveDisapproveBox(p=>({...p,[req.id]:false})); btn.disabled=false }}>CONFIRM DISAPPROVE</button>
                      </div>
                    )}
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop:'20px' }} onClick={async()=>{ await loadResolvedLeaves(); setShowResolvedLeaves(!showResolvedLeaves) }}>{showResolvedLeaves?'🔼 HIDE':'🔽 VIEW'} APPROVED / REJECTED LEAVES</button>
                {showResolvedLeaves && resolvedLeaves.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'1px solid #ccc', marginTop:'8px' }}>
                    <strong>{req.employee_name}</strong>
                    <p style={cps}>{req.leave_start} to {req.leave_end} | {req.leave_type} | Reason: {req.reason}</p>
                    {req.admin_reason && <p style={cps}>Admin Reason: <em>"{req.admin_reason}"</em></p>}
                    <p style={{ fontWeight:'bold', color:req.status==='approved'?'#2d8a4e':'#ca1b1b', margin:'4px 0' }}>Status: {req.status}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CA REQUESTS */}
            {activeTab==='cashRequests' && (
              <div>
                <h2 style={h2s}>Cash Advance Requests</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={async()=>{ await loadCashAdvanceRequests(); showToast('✅ Cash advance requests refreshed!') }}>🔄 REFRESH</button>
                {cashAdvanceRequests.length===0 && <p style={{ color:'#888' }}>No pending requests.</p>}
                {cashAdvanceRequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{req.employee_name}</strong>
                    <p style={cps}>Code: {req.employee_code} | Reason: <em>"{req.reason}"</em></p>
                    <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'17px', margin:'6px 0' }}>Amount: {php(req.amount)}</p>
                    <label style={lblS}>Number of Payroll Deductions:</label>
                    <input type="number" min="1" max="24" value={installmentCounts[req.id]||1} onChange={e=>{ const v=parseInt(e.target.value)||1; setInstallmentCounts(p=>({...p,[req.id]:Math.max(1,v)})) }} style={{ ...inputStyle, marginBottom:'4px' }} />
                    <p style={{ color:'#888', fontSize:'12px', marginBottom:'10px' }}>{php(Number(req.amount)/Math.max(1,installmentCounts[req.id]||1))} per payroll cutoff</p>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0, opacity:processingItems[req.id]?0.6:1 }} disabled={processingItems[req.id]} onClick={async()=>{ setProcessingItems(p=>({...p,[req.id]:true})); await updateCashAdvanceStatus(req.id,'approved'); setProcessingItems(p=>({...p,[req.id]:false})) }}>{processingItems[req.id]?'⏳ Processing...':'✅ APPROVE'}</button>
                      <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0 }} onClick={(e)=>{ e.stopPropagation(); setShowCADisapproveBox(p=>({...p,[req.id]:!p[req.id]})) }}>❌ DISAPPROVE</button>
                    </div>
                    {showCADisapproveBox[req.id] && (
                      <div style={{ marginTop:'10px' }}>
                        <textarea placeholder="Reason for disapproval (required)..." value={caDisapproveReason[req.id]||''} onChange={e=>setCaDisapproveReason(p=>({...p,[req.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0, opacity:processingItems['dis_'+req.id]?0.6:1 }} disabled={processingItems['dis_'+req.id]} onClick={async()=>{ setProcessingItems(p=>({...p,['dis_'+req.id]:true})); await updateCashAdvanceStatus(req.id,'disapproved'); setShowCADisapproveBox(p=>({...p,[req.id]:false})); setProcessingItems(p=>({...p,['dis_'+req.id]:false})) }}>{processingItems['dis_'+req.id]?'⏳ Processing...':'CONFIRM DISAPPROVE'}</button>
                      </div>
                    )}
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop:'20px' }} onClick={async()=>{ await loadResolvedCARequests(); setShowResolvedCA(!showResolvedCA) }}>{showResolvedCA?'🔼 HIDE':'🔽 VIEW'} RESOLVED REQUESTS</button>
                {showResolvedCA && resolvedCARequests.map(req=>(
                  <div key={req.id} style={{ ...cardS, border:'1px solid #ccc', marginTop:'8px' }}>
                    <strong>{req.employee_name}</strong>
                    <p style={cps}>Amount: {php(req.amount)} | Reason: {req.reason}</p>
                    {req.admin_reason && <p style={cps}>Admin Reason: <em>"{req.admin_reason}"</em></p>}
                    <p style={{ fontWeight:'bold', color:req.status==='approved'?'#2d8a4e':'#ca1b1b', margin:'4px 0' }}>Status: {req.status}</p>
                  </div>
                ))}
              </div>
            )}

            {/* BANK DISBURSEMENT */}
            {activeTab==='bankDisbursement' && (
              <div>
                <h2 style={h2s}>🏦 Bank Disbursement</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'16px' }}>Generate a payroll disbursement file to upload to your bank's online payroll portal (BDO, BPI, UnionBank, Landbank, GCash Business).</p>
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'14px', marginBottom:'20px', fontSize:'13px' }}>
                  <strong style={{ color:'#ca1b1b' }}>📌 How it works:</strong>
                  <ol style={{ margin:'8px 0 0 16px', color:'#555', lineHeight:'1.8' }}>
                    <li>Select the payroll period you want to disburse</li>
                    <li>Choose your bank format</li>
                    <li>Click Generate — a CSV file will download</li>
                    <li>Upload the CSV to your bank's online payroll system</li>
                    <li>Bank will process and credit employees' accounts</li>
                  </ol>
                  <p style={{ color:'#888', fontSize:'12px', marginTop:'10px' }}>⚠️ Make sure each employee has a bank account number saved in their profile.</p>
                </div>
                {/* Period Selector */}
                <div style={{ background:'white', border:'1px solid #eee', borderRadius:'12px', padding:'18px', marginBottom:'16px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 14px', fontSize:'14px' }}>📅 Select Payroll Period</h3>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end', marginBottom:'12px' }}>
                    <div><label style={lblS}>From:</label><input type="date" value={payrollStart} onChange={e=>setPayrollStart(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                    <div><label style={lblS}>To:</label><input type="date" value={payrollEnd} onChange={e=>setPayrollEnd(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} /></div>
                    <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={async()=>{
                      const { data } = await supabase.from('payroll_records').select('*').eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd)
                      if (!data?.length) { showToast('No payroll records found for this period. Please compute payroll first.','red'); return }
                      setPayrollResults(data.map(r=>({ employeeId:r.employee_id, employeeName:r.employee_name, employeeCode:r.employee_code, position:r.position, workedDays:r.worked_days, netPay:Number(r.net_pay||0), basicPay:Number(r.basic_pay||0), birthdayPay:Number(r.birthday_pay||0), overtimePay:Number(r.overtime_pay||0), totalEarnings:Number(r.total_earnings||0), totalDeductions:Number(r.total_deductions||0) })))
                      showToast(`✅ Loaded ${data.length} employee records`)
                    }}>📂 LOAD PERIOD</button>
                  </div>
                  {payrollResults.length>0 && (
                    <div style={{ background:'#f0fff0', borderRadius:'8px', padding:'12px', border:'1px solid #c8e6c9' }}>
                      <p style={{ fontWeight:'bold', color:'#2d8a4e', margin:'0 0 6px' }}>✅ {payrollResults.length} employees loaded</p>
                      <p style={cps}>Total Net Pay: <strong>{php(payrollResults.reduce((s,p)=>s+Number(p.netPay||0),0))}</strong></p>
                    </div>
                  )}
                </div>
                {/* Bank Format Selector */}
                {payrollResults.length>0 && (
                  <div style={{ background:'white', border:'1px solid #eee', borderRadius:'12px', padding:'18px', marginBottom:'16px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 14px', fontSize:'14px' }}>🏦 Choose Bank Format & Generate</h3>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                      {[
                        { bank:'BDO', color:'#003087', desc:'BDO PayRoll CSV format', fields:'Account No,Name,Amount,Currency,Remarks' },
                        { bank:'BPI', color:'#cc0000', desc:'BPI Direct Payroll format', fields:'Account Number,Name,Amount,Remarks' },
                        { bank:'UnionBank', color:'#e65100', desc:'UnionBank Online Payroll', fields:'AccountNo,BeneficiaryName,Amount,Particulars' },
                        { bank:'Landbank', color:'#1a5276', desc:'Landbank iAccess Payroll', fields:'Account,Name,Amount,Description' },
                        { bank:'GCash', color:'#0072bc', desc:'GCash Business Disbursement', fields:'Mobile Number,Name,Amount,Reference' },
                        { bank:'Generic', color:'#555', desc:'Generic / Other Banks', fields:'Employee Code,Name,Bank,Account No,Amount,Net Pay' },
                      ].map(({bank,color,desc,fields})=>(
                        <div key={bank} style={{ border:`2px solid ${color}`, borderRadius:'10px', padding:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                          <p style={{ fontWeight:'bold', color, fontSize:'14px', margin:0 }}>🏦 {bank}</p>
                          <p style={{ fontSize:'12px', color:'#888', margin:0 }}>{desc}</p>
                          <p style={{ fontSize:'11px', color:'#aaa', margin:0, fontFamily:'monospace' }}>{fields}</p>
                          <button style={{ ...btnRed, background:color, marginTop:'4px', fontSize:'12px', padding:'9px' }} onClick={()=>{
                            const rows = []
                            if (bank==='BDO') {
                              rows.push(['AccountNo','BeneficiaryName','Amount','Currency','Remarks'])
                              payrollResults.forEach(p=>rows.push([p.bankAccount||'','`'+p.employeeName,p.netPay.toFixed(2),'PHP',`Payroll ${payrollStart} to ${payrollEnd}`]))
                            } else if (bank==='BPI') {
                              rows.push(['Account Number','Name','Amount','Remarks'])
                              payrollResults.forEach(p=>rows.push([p.bankAccount||'',p.employeeName,p.netPay.toFixed(2),`Payroll ${payrollStart} to ${payrollEnd}`]))
                            } else if (bank==='UnionBank') {
                              rows.push(['AccountNo','BeneficiaryName','Amount','Particulars'])
                              payrollResults.forEach(p=>rows.push([p.bankAccount||'',p.employeeName,p.netPay.toFixed(2),`Salary ${payrollEnd}`]))
                            } else if (bank==='Landbank') {
                              rows.push(['Account','Name','Amount','Description'])
                              payrollResults.forEach(p=>rows.push([p.bankAccount||'',p.employeeName,p.netPay.toFixed(2),`Payroll ${payrollStart}-${payrollEnd}`]))
                            } else if (bank==='GCash') {
                              rows.push(['Mobile Number','Name','Amount','Reference'])
                              payrollResults.forEach(p=>rows.push([p.mobileNumber||p.bankAccount||'',p.employeeName,p.netPay.toFixed(2),`${p.employeeCode}-${payrollEnd}`]))
                            } else {
                              rows.push(['Employee Code','Name','Bank','Account No','Net Pay'])
                              payrollResults.forEach(p=>rows.push([p.employeeCode,p.employeeName,p.bankName||'',p.bankAccount||'',p.netPay.toFixed(2)]))
                            }
                            const csv = rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n')
                            const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'})
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href=url; a.download=`${bank}_Payroll_${payrollStart}_to_${payrollEnd}.csv`; a.click()
                            URL.revokeObjectURL(url)
                            showToast(`✅ ${bank} disbursement file downloaded!`)
                          }}>⬇️ DOWNLOAD {bank} FILE</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:'#fff8dc', borderRadius:'8px', padding:'12px', marginTop:'16px', border:'1px solid #f5c518' }}>
                      <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 6px' }}>📌 Next Steps After Download</p>
                      <p style={{ fontSize:'12px', color:'#555', margin:0, lineHeight:'1.8' }}>1. Log in to your bank's online payroll portal<br/>2. Go to "Payroll Disbursement" or "Batch Transfer"<br/>3. Upload the downloaded CSV file<br/>4. Review the entries and total amount<br/>5. Submit for processing (may need 2FA approval)<br/>6. Bank processes within 1–3 banking days</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DISPUTES */}
            {activeTab==='disputes' && (
              <div>
                <h2 style={h2s}>Payslip Disputes</h2>
                <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginBottom:'15px' }} onClick={async()=>{ await loadPayslipDisputes(); showToast('✅ Disputes refreshed!') }}>🔄 REFRESH</button>
                {payslipDisputes.length===0 && <p style={{ color:'#888' }}>No pending disputes.</p>}
                {payslipDisputes.map(d=>(
                  <div key={d.id} style={{ ...cardS, border:'2px solid #ca1b1b', background:'#fff8dc' }}>
                    <strong style={{ color:'#ca1b1b', fontSize:'15px' }}>{d.employee_name}</strong>
                    <p style={cps}>Cutoff: {d.payroll_start} to {d.payroll_end}</p>
                    <p style={cps}>Employee Reason: <em>"{d.reason}"</em></p>
                    <p style={cps}>Filed: {new Date(d.created_at).toLocaleDateString()}</p>
                    <label style={lblS}>Admin Response (required to resolve):</label>
                    <textarea placeholder="Enter your response or resolution..." value={disputeAdminReason[d.id]||''} onChange={e=>setDisputeAdminReason(p=>({...p,[d.id]:e.target.value}))} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                    <button style={{ ...btnGreen, width:'auto', padding:'8px 16px', marginTop:'8px', opacity:processingItems['res_'+d.id]?0.6:1 }} disabled={processingItems['res_'+d.id]} onClick={async()=>{ setProcessingItems(p=>({...p,['res_'+d.id]:true})); await resolveDispute(d.id); setProcessingItems(p=>({...p,['res_'+d.id]:false})) }}>{processingItems['res_'+d.id]?'⏳ Resolving...':'✅ MARK AS RESOLVED'}</button>
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop:'20px' }} onClick={async()=>{ await loadResolvedDisputes(); setShowResolvedDisputes(!showResolvedDisputes) }}>{showResolvedDisputes?'🔼 HIDE':'🔽 VIEW'} RESOLVED DISPUTES</button>
                {showResolvedDisputes && resolvedDisputes.map(d=>(
                  <div key={d.id} style={{ ...cardS, border:'1px solid #ccc', marginTop:'8px' }}>
                    <strong>{d.employee_name}</strong>
                    <p style={cps}>Cutoff: {d.payroll_start} to {d.payroll_end}</p>
                    <p style={cps}>Reason: {d.reason}</p>
                    {d.admin_reason && <p style={cps}>Admin Response: <em>"{d.admin_reason}"</em></p>}
                    <p style={{ fontWeight:'bold', color:'#2d8a4e', margin:'4px 0' }}>✅ Resolved</p>
                  </div>
                ))}
              </div>
            )}

            {/* CONTRACTS */}
            {activeTab==='contracts' && (
              <div>
                <h2 style={h2s}>📄 Employee Contracts</h2>
                <p style={{ color:'#888', fontSize:'13px', marginBottom:'16px' }}>Upload, store, and track PDF employment contracts per employee. Supports contract type, start/end dates, and status tracking.</p>

                {/* Required Supabase setup note */}
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'14px', marginBottom:'20px', fontSize:'13px' }}>
                  <strong style={{ color:'#ca1b1b' }}>⚙️ Required Supabase Setup (one-time):</strong>
                  <p style={{ color:'#555', margin:'8px 0 4px' }}>1. Create a table <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'4px' }}>employee_contracts</code> with columns: id (uuid PK), employee_id (uuid), employee_code (text), employee_name (text), contract_type (text), start_date (date), end_date (date, nullable), status (text), file_url (text, nullable), file_name (text, nullable), storage_type (text), physical_location (text, nullable), created_at (timestamptz default now())</p>
                  <p style={{ color:'#555', margin:'4px 0' }}>2. For digital uploads: Create a Supabase Storage bucket named <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'4px' }}>contracts</code> with public access enabled.</p>
                </div>

                {/* Upload Form */}
                <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'20px', marginBottom:'20px' }}>
                  <h3 style={{ color:'#ca1b1b', margin:'0 0 16px', fontSize:'14px' }}>📋 Log New Contract</h3>

                  <label style={lblS}>Employee:</label>
                  <EmployeeSelect value={contractEmployeeId} onChange={setContractEmployeeId} employees={employees} />

                  <label style={lblS}>Contract Type:</label>
                  <select value={contractType} onChange={e=>setContractType(e.target.value)} style={inputStyle}>
                    <option value="regular">Regular Employment</option>
                    <option value="probationary">Probationary Employment</option>
                    <option value="project-based">Project-Based</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="fixed-term">Fixed-Term</option>
                    <option value="part-time">Part-Time</option>
                    <option value="apprenticeship">Apprenticeship / OJT</option>
                  </select>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    <div>
                      <label style={lblS}>Start Date:</label>
                      <input type="date" value={contractStart} onChange={e=>setContractStart(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                    </div>
                    <div>
                      <label style={lblS}>End Date <span style={{ color:'#aaa', fontWeight:'normal' }}>(optional)</span>:</label>
                      <input type="date" value={contractEnd} onChange={e=>setContractEnd(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                    </div>
                  </div>

                  {/* Storage Type Toggle */}
                  <div style={{ marginTop:'14px' }}>
                    <label style={lblS}>Where is this contract stored?</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <button
                        onClick={()=>setContractStorageType('physical')}
                        style={{ padding:'12px', borderRadius:'10px', border:`2px solid ${contractStorageType==='physical'?'#f5a623':'#ddd'}`, background:contractStorageType==='physical'?'#fff8dc':'white', cursor:'pointer', fontWeight:'bold', fontSize:'13px', color:contractStorageType==='physical'?'#ca1b1b':'#888', transition:'all 0.2s' }}
                      >
                        📁 Physical Copy<br/><span style={{ fontWeight:'normal', fontSize:'11px', color:'#888' }}>Signed paper on file</span>
                      </button>
                      <button
                        onClick={()=>setContractStorageType('digital')}
                        style={{ padding:'12px', borderRadius:'10px', border:`2px solid ${contractStorageType==='digital'?'#4a90d9':'#ddd'}`, background:contractStorageType==='digital'?'#e8f0fe':'white', cursor:'pointer', fontWeight:'bold', fontSize:'13px', color:contractStorageType==='digital'?'#4a90d9':'#888', transition:'all 0.2s' }}
                      >
                        💻 Digital PDF<br/><span style={{ fontWeight:'normal', fontSize:'11px', color:'#888' }}>Upload scanned file</span>
                      </button>
                    </div>
                  </div>

                  {/* Physical location field */}
                  {contractStorageType === 'physical' && (
                    <div style={{ marginTop:'12px', background:'#fff8dc', borderRadius:'10px', padding:'12px', border:'1px solid #f5a623' }}>
                      <label style={{ ...lblS, color:'#ca1b1b' }}>📍 Where is the physical contract stored?</label>
                      <input
                        type="text"
                        placeholder="e.g. Filing cabinet, Drawer 2 — HR Office"
                        value={contractPhysicalLocation}
                        onChange={e=>setContractPhysicalLocation(e.target.value)}
                        style={inputStyle}
                      />
                      <p style={{ color:'#888', fontSize:'12px', margin:'-6px 0 0' }}>Be specific so you can find it easily later.</p>
                    </div>
                  )}

                  {/* Digital file upload */}
                  {contractStorageType === 'digital' && (
                    <div style={{ marginTop:'12px', background:'#e8f0fe', borderRadius:'10px', padding:'12px', border:'1px solid #4a90d9' }}>
                      <label style={{ ...lblS, color:'#4a90d9' }}>📎 Upload PDF Contract:</label>
                      <input type="file" accept=".pdf,application/pdf" onChange={e=>setContractFile(e.target.files[0]||null)} style={{ ...inputStyle, padding:'8px', cursor:'pointer', marginBottom:0 }} />
                      {contractFile && (
                        <p style={{ fontSize:'12px', color:'#2d8a4e', margin:'6px 0 0', fontWeight:'bold' }}>✅ {contractFile.name} ({(contractFile.size/1024).toFixed(1)} KB)</p>
                      )}
                      <p style={{ color:'#888', fontSize:'11px', marginTop:'6px' }}>Use Adobe Scan or Microsoft Lens to scan physical contracts into PDF.</p>
                    </div>
                  )}

                  <button
                    style={{ ...btnGreen, marginTop:'16px', opacity:contractUploading?0.6:1 }}
                    disabled={contractUploading}
                    onClick={uploadContract}
                  >
                    {contractUploading ? '⏳ Saving...' : contractStorageType==='physical' ? '📁 LOG PHYSICAL CONTRACT' : '📤 UPLOAD DIGITAL CONTRACT'}
                  </button>
                </div>

                {/* Search & List */}
                <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
                  <input
                    placeholder="Search by employee name or code..."
                    value={contractSearch}
                    onChange={e=>setContractSearch(e.target.value)}
                    style={{ ...inputStyle, marginBottom:0, flex:1, minWidth:'180px' }}
                  />
                  <button style={{ ...btnGreen, width:'auto', padding:'10px 18px', marginTop:0 }} onClick={()=>{ loadContracts(); showToast('✅ Contracts refreshed!') }}>🔄 REFRESH</button>
                </div>

                {contractsLoading && <p style={{ color:'#888', textAlign:'center', padding:'20px' }}>⏳ Loading contracts...</p>}

                {!contractsLoading && contracts.length === 0 && (
                  <div style={{ textAlign:'center', padding:'30px', color:'#888' }}>
                    <p style={{ fontSize:'32px', margin:'0 0 10px' }}>📂</p>
                    <p style={{ fontWeight:'bold', fontSize:'14px' }}>No contracts uploaded yet.</p>
                    <p style={{ fontSize:'13px' }}>Upload the first contract using the form above.</p>
                  </div>
                )}

                {!contractsLoading && contracts
                  .filter(c => {
                    if (!contractSearch) return true
                    const q = contractSearch.toLowerCase()
                    return c.employee_name?.toLowerCase().includes(q) || c.employee_code?.toLowerCase().includes(q)
                  })
                  .map(c => {
                    const statusColor = c.status==='active'?'green':c.status==='expired'?'red':'gray'
                    const statusLabel = c.status==='active'?'✅ Active':c.status==='expired'?'⛔ Expired':'🔴 Terminated'
                    const isExpiringSoon = c.end_date && c.status==='active' && (new Date(c.end_date)-new Date())/(1000*60*60*24) <= 30
                    return (
                      <div key={c.id} style={{ ...cardS, border:`2px solid ${c.status==='active'?'#c8e6c9':c.status==='expired'?'#ffcdd2':'#eee'}`, background:c.status==='active'?'#f0fff4':c.status==='expired'?'#fff5f5':'#fafafa', marginBottom:'12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', color:'#333', fontSize:'14px', margin:'0 0 2px' }}>{c.employee_name}</p>
                            <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{c.employee_code}</p>
                          </div>
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
                            <Badge label={c.storage_type==='physical'?'📁 Physical':'💻 Digital'} color={c.storage_type==='physical'?'yellow':'blue'} />
                            <Badge label={statusLabel} color={statusColor} />
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', marginBottom:'6px' }}>
                          <p style={cps}>📋 Type: <strong style={{ color:'#333', textTransform:'capitalize' }}>{c.contract_type?.replace(/-/g,' ')}</strong></p>
                          <p style={cps}>📅 Start: <strong style={{ color:'#333' }}>{c.start_date}</strong></p>
                          <p style={cps}>🗓️ End: <strong style={{ color:isExpiringSoon?'#f5a623':'#333' }}>{c.end_date || 'Open-ended'}{isExpiringSoon?' ⚠️ Expiring soon!':''}</strong></p>
                          <p style={cps}>🕐 Logged: {new Date(c.created_at).toLocaleDateString()}</p>
                        </div>
                        {c.storage_type==='physical' && c.physical_location && (
                          <div style={{ background:'#fff8dc', borderRadius:'8px', padding:'8px 10px', marginBottom:'10px', border:'1px solid #f5a623' }}>
                            <p style={{ margin:0, fontSize:'12px', color:'#555' }}>📍 <strong>Stored at:</strong> {c.physical_location}</p>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                          <button style={{ ...btnBlack, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>printContractSummary(c)}>🖨️ PRINT SUMMARY</button>
                          {c.storage_type==='digital' && c.file_url && (
                            <a href={c.file_url} target="_blank" rel="noopener noreferrer" style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px', textDecoration:'none', display:'inline-block', textAlign:'center' }}>
                              📄 VIEW PDF
                            </a>
                          )}
                          {c.status==='active' && (
                            <button style={{ ...btnGray, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>updateContractStatus(c.id,'terminated')}>🔴 TERMINATE</button>
                          )}
                          {c.status!=='active' && (
                            <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>updateContractStatus(c.id,'active')}>✅ REACTIVATE</button>
                          )}
                          <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>deleteContract(c)}>🗑️ DELETE</button>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ── Employee Portal ───────────────────────────────────────────────────────
  if (employee) {
    const onBreak = todayBreaks.length>0 && !todayBreaks[todayBreaks.length-1]?.break_in
    const totalBreakMins = todayBreaks.reduce((s,b)=>s+Number(b.break_minutes||0),0)

    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg,#ca1b1b,#fdd412)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Sticky Header */}
        <div style={{ background:'rgba(0,0,0,0.25)', backdropFilter:'blur(8px)', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, zIndex:100 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ position:'relative' }}>
              {profilePhotoUrl ?
                <img src={profilePhotoUrl} alt="Profile" style={{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'2px solid white' }} /> :
                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', border:'2px solid white' }}>👤</div>
              }
              <label style={{ position:'absolute', bottom:'-2px', right:'-2px', background:'#ca1b1b', color:'white', borderRadius:'50%', width:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'9px', border:'1px solid white' }}>
                📷<input type="file" accept="image/*" onChange={handleProfilePhotoUpload} style={{ display:'none' }} />
              </label>
            </div>
            <div>
              <p style={{ color:'white', fontWeight:'bold', fontSize:'14px', margin:0 }}>{employee.full_name}</p>
              <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', margin:0 }}>{employee.position} — {employee.employee_code}</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {cameFromAdmin && (
              <button style={{ background:'white', color:'#ca1b1b', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={()=>{ setEmployee(null); setProfilePhotoUrl(null); setCameFromAdmin(false); setAdminMode(true); setSidebarOpen(false); loadEmployees(); loadDashboard(); loadDashboardCharts() }}>← ADMIN</button>
            )}
            {!cameFromAdmin && (
              <button style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'1px solid rgba(255,255,255,0.5)', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={logout}>🚪 LOGOUT</button>
            )}
            {cameFromAdmin && (
              <button style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'1px solid rgba(255,255,255,0.5)', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={()=>{ logout(); setCameFromAdmin(false); setAdminEmployee(null); setAdminRole(null) }}>🚪 LOGOUT</button>
            )}
          </div>
        </div>

        {showAnnouncementPopup && pendingAnnouncement && (
          <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div style={{ background:'white', borderRadius:'16px', padding:'24px', maxWidth:'420px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <span style={{ fontSize:'36px' }}>📢</span>
                <h2 style={{ color:'#ca1b1b', margin:'8px 0 4px' }}>New Announcement</h2>
              </div>
              <h3 style={{ color:'#333', margin:'0 0 10px' }}>{pendingAnnouncement.title}</h3>
              <p style={{ color:'#555', fontSize:'14px', lineHeight:'1.6' }}>{pendingAnnouncement.content}</p>
              <button style={{ ...btnRed, marginTop:'16px' }} onClick={()=>markAnnouncementViewed(pendingAnnouncement)}>✅ I'VE READ THIS</button>
            </div>
          </div>
        )}
        {toast && (
          <div style={{ position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:toast.color==='red'?'#ca1b1b':'#2d8a4e', color:'white', padding:'12px 28px', borderRadius:'10px', fontWeight:'bold', fontSize:'14px', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', whiteSpace:'nowrap', pointerEvents:'none' }}>{toast.msg}</div>
        )}

        {/* Scrollable Content Area */}
        <div style={{ flex:1, overflowY:'auto', padding:isMobile?'12px':'24px', display:'flex', justifyContent:'center' }}>
        <div style={{ background:'white', borderRadius:isMobile?'16px':'20px', padding:isMobile?'16px':'24px', width:'100%', maxWidth:'600px', boxShadow:'0 10px 40px rgba(0,0,0,0.2)', marginBottom:'16px' }}>
        {uploadingPhoto && <p style={{ color:'#888', fontSize:'12px', margin:'0 0 8px', textAlign:'center' }}>⏳ Uploading photo...</p>}
        {cameFromAdmin && (
            <div style={{ background:'#ca1b1b', borderRadius:'10px', padding:'8px 14px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:'white', fontWeight:'bold', fontSize:'12px' }}>👑 Admin View — {adminRole?.toUpperCase()}</span>
            </div>
          )}
          <div style={{ textAlign:'center', marginBottom:'12px' }}>
            <p style={{ color:'#888', margin:'0', fontSize:'13px' }}>{employee.position} — {employee.employee_code}</p>
          </div>

          {!isOnline && (
            <div style={{ background:'#ca1b1b', color:'white', borderRadius:'10px', padding:'10px 14px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>📴 Offline Mode</p>
                <p style={{ fontSize:'11px', margin:0, opacity:0.8 }}>Time in/out will sync when internet returns</p>
              </div>
              <span style={{ fontSize:'20px' }}>🔴</span>
            </div>
          )}
          {syncingOffline && (
            <div style={{ background:'#2d8a4e', color:'white', borderRadius:'10px', padding:'10px 14px', marginBottom:'10px', textAlign:'center' }}>
              <p style={{ fontWeight:'bold', fontSize:'13px', margin:0 }}>⏳ Syncing offline records...</p>
            </div>
          )}
          {geoStatus && <p style={{ color:'#f5a623', textAlign:'center', fontWeight:'bold', fontSize:'13px', margin:'0 0 8px' }}>{geoStatus}</p>}

          <div style={{ background:'#f9f9f9', borderRadius:'12px', padding:'12px', marginBottom:'10px' }}>
            <p style={{ margin:'3px 0', fontSize:'13px' }}>📅 Shift: <strong>{todaySchedule?`${todaySchedule.shift_start} – ${todaySchedule.shift_end}`:'No Assigned Shift'}</strong></p>
            <p style={{ margin:'3px 0', fontSize:'13px' }}>🟢 In: <strong>{todayLog?.time_in||'Not yet'}</strong> &nbsp; 🔴 Out: <strong>{todayLog?.time_out||'Not yet'}</strong></p>
            <p style={{ margin:'3px 0', fontSize:'13px' }}>☕ Break: <strong>{totalBreakMins} min used</strong>
              {totalBreakMins>60&&!onBreak&&<span style={{ color:'#ca1b1b', fontWeight:'bold', marginLeft:'6px' }}>⚠️ Exceeded 60min limit</span>}
            </p>
            {onBreak && (
              <div style={{ background: breakTimerSeconds >= 3600 ? '#ca1b1b' : breakTimerSeconds >= 3000 ? '#f5a623' : '#2d8a4e', borderRadius:'10px', padding:'10px 14px', margin:'6px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:'white', fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>☕ Currently on Break</p>
                  <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', margin:0 }}>
                    {breakTimerSeconds >= 3600 ? '🚨 OVERTIME! Please Break In now!' : breakTimerSeconds >= 3000 ? '⚠️ Almost at 60min limit!' : '✅ Within allowed break time'}
                  </p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'white', fontWeight:'bold', fontSize:'22px', margin:0, fontFamily:'monospace' }}>
                    {String(Math.floor(breakTimerSeconds/60)).padStart(2,'0')}:{String(breakTimerSeconds%60).padStart(2,'0')}
                  </p>
                  <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', margin:0 }}>/ 60:00 allowed</p>
                </div>
              </div>
            )}
            {todayBreaks.length>0&&todayBreaks.map((b,i)=>(
              <p key={b.id} style={{ margin:'2px 0', fontSize:'11px', color:'#888' }}>Break {i+1}: {b.break_out} {b.break_in?`→ ${b.break_in} (${b.break_minutes}min)`:'→ ongoing'}</p>
            ))}
            <p style={{ margin:'3px 0', fontSize:'13px' }}>📌 Status: <strong>{todayLog?.status||'No record yet'}</strong></p>
            {(todayLog?.selfie_in_url||todayLog?.selfie_out_url)&&(
              <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                {todayLog?.selfie_in_url&&<img src={todayLog.selfie_in_url} alt="IN" style={{ width:'50px', height:'50px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2d8a4e' }} />}
                {todayLog?.selfie_out_url&&<img src={todayLog.selfie_out_url} alt="OUT" style={{ width:'50px', height:'50px', objectFit:'cover', borderRadius:'8px', border:'2px solid #ca1b1b' }} />}
              </div>
            )}
          </div>

          <div style={{ background:'#e8f5e9', borderRadius:'10px', padding:'8px 14px', marginBottom:'10px', display:'flex', gap:'20px', justifyContent:'center' }}>
            <div style={{ textAlign:'center' }}><p style={{ fontSize:'11px', color:'#888', margin:'0 0 2px' }}>Sick Leave</p><p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'16px', margin:0 }}>{myLeaveBalance.sick}d</p></div>
            <div style={{ textAlign:'center' }}><p style={{ fontSize:'11px', color:'#888', margin:'0 0 2px' }}>Vacation Leave</p><p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'16px', margin:0 }}>{myLeaveBalance.vacation}d</p></div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'6px' }}>
            <button style={{ ...btnGreen, margin:0, opacity:todayLog?0.5:1, fontSize:'13px' }} onClick={initiateTimeIn} disabled={loading||!!todayLog}>⏰ TIME IN</button>
            <button style={{ ...btnBlack, margin:0, opacity:(!todayLog||!!todayLog?.time_out)?0.5:1, fontSize:'13px' }} onClick={initiateTimeOut} disabled={loading||!todayLog||!!todayLog?.time_out}>⏰ TIME OUT</button>
            <button style={{ background:'#4a90d9', color:'white', padding:'11px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', opacity:(!todayLog||!!todayLog?.time_out||onBreak)?0.5:1 }} onClick={initiateBreakOut} disabled={!todayLog||!!todayLog?.time_out||onBreak}>☕ BREAK OUT</button>
            <button style={{ background:'#f5a623', color:'white', padding:'11px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', opacity:!onBreak?0.5:1 }} onClick={initiateBreakIn} disabled={!onBreak}>☕ BREAK IN</button>
          </div>
          <button style={{ background:'#8b5cf6', color:'white', padding:'11px', border:'none', borderRadius:'10px', width:'100%', cursor:'pointer', fontWeight:'bold', fontSize:'13px', marginBottom:'4px', opacity:(!todayLog||!todayLog?.time_out)?0.5:1 }} onClick={()=>{ closeAllPanels(); setShowOTRequest(!showOTRequest) }} disabled={!todayLog||!todayLog?.time_out}>📝 FILE OT / UNDERTIME REQUEST</button>
          <p style={{ color:'#888', fontSize:'11px', textAlign:'center', margin:'2px 0 10px' }}>📸 Selfie required | 📍 Must be at store location</p>

          {showOTRequest && (
            <div style={{ background:'#f9f9f9', padding:'14px', borderRadius:'12px', border:'1px solid #ddd', marginBottom:'8px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'12px' }} onClick={()=>setShowOTRequest(false)}>← BACK</button>
              <h3 style={{ color:'#8b5cf6', margin:'0 0 10px', fontSize:'14px' }}>📝 File OT / Undertime Request</h3>
              <label style={lblS}>Date of OT / Undertime:</label>
              <input type="date" value={otRequestDate} max={today} onChange={e=>setOtRequestDate(e.target.value)} style={inputStyle} />
              <label style={lblS}>Request Type:</label>
              <select value={otRequestType} onChange={e=>setOtRequestType(e.target.value)} style={inputStyle}><option value="overtime">Overtime</option><option value="undertime">Undertime</option></select>
              <label style={lblS}>Minutes:</label>
              <input type="number" placeholder="Number of minutes" value={otRequestMinutes} onChange={e=>setOtRequestMinutes(e.target.value)} style={inputStyle} />
              <label style={lblS}>Reason:</label>
              <select
                value={otRequestReasonPreset}
                onChange={e => {
                  const val = e.target.value
                  setOtRequestReasonPreset(val)
                  if (val !== 'Others') setOtRequestReason(val)
                  else setOtRequestReason('')
                }}
                style={inputStyle}
              >
                <option value="">— Select a reason —</option>
                {otRequestType === 'overtime' ? (
                  <>
                    <option value="Operational requirements / volume of work">Operational requirements / volume of work</option>
                    <option value="Rush order / client deadline">Rush order / client deadline</option>
                    <option value="Staff shortage / manpower gap">Staff shortage / manpower gap</option>
                    <option value="Management request">Management request</option>
                    <option value="Inventory or restocking task">Inventory or restocking task</option>
                  </>
                ) : (
                  <>
                    <option value="Medical / health appointment">Medical / health appointment</option>
                    <option value="Family emergency">Family emergency</option>
                    <option value="Personal matter (pre-approved)">Personal matter (pre-approved)</option>
                    <option value="Early release approved by supervisor">Early release approved by supervisor</option>
                    <option value="School / educational obligation">School / educational obligation</option>
                  </>
                )}
                <option value="Others">Others (please specify)</option>
              </select>
              {otRequestReasonPreset === 'Others' && (
                <textarea
                  placeholder="Please describe your reason..."
                  value={otRequestReason}
                  onChange={e => setOtRequestReason(e.target.value)}
                  style={{ ...inputStyle, minHeight:'70px', resize:'none' }}
                />
              )}
              <button style={{ background:'#8b5cf6', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', cursor:'pointer', fontWeight:'bold', fontSize:'14px' }} onClick={submitTimeAdjRequest}>SUBMIT REQUEST</button>
            </div>
          )}

          <button style={{ ...btnRed, background:'#ca1b1b' }} onClick={()=>{ closeAllPanels(); setShowLeaveRequest(!showLeaveRequest) }}>🏖️ FILE LEAVE REQUEST</button>
          {showLeaveRequest && (
            <div style={{ background:'#f9f9f9', padding:'14px', borderRadius:'12px', border:'1px solid #ddd', marginTop:'8px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'10px' }} onClick={()=>setShowLeaveRequest(false)}>← BACK</button>
              <input type="date" value={leaveStartDate} min={new Date(Date.now()+3*24*60*60*1000).toISOString().split('T')[0]} onChange={e=>setLeaveStartDate(e.target.value)} style={inputStyle} />
              <input type="date" value={leaveEndDate} onChange={e=>setLeaveEndDate(e.target.value)} style={inputStyle} />
              {leaveStartDate&&leaveEndDate&&<p style={{ color:'#ca1b1b', fontWeight:'bold', marginBottom:'8px', fontSize:'13px' }}>Duration: {Math.ceil((new Date(leaveEndDate)-new Date(leaveStartDate))/(1000*60*60*24))+1} day(s)</p>}
              <select value={leaveType} onChange={e=>setLeaveType(e.target.value)} style={inputStyle}><option value="">Select Leave Type</option><option value="Sick Leave">Sick Leave ({myLeaveBalance.sick} days left)</option><option value="Vacation Leave">Vacation Leave ({myLeaveBalance.vacation} days left)</option><option value="Emergency Leave">Emergency Leave</option></select>
              <textarea placeholder="Reason for leave..." value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} style={{ ...inputStyle, minHeight:'70px', resize:'none' }} />
              <button style={btnGreen} onClick={submitLeaveRequest}>SUBMIT LEAVE REQUEST</button>
            </div>
          )}

          <button style={{ background:'#e8505b', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={()=>{ closeAllPanels(); setShowMyLeaves(!showMyLeaves); if(!showMyLeaves) loadMyLeaves() }}>{showMyLeaves?'🔼 HIDE':'🔽 VIEW'} MY LEAVE HISTORY</button>
          {showMyLeaves && (
            <div style={{ marginTop:'10px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'10px' }} onClick={()=>setShowMyLeaves(false)}>← BACK</button>
              {myLeavesLoading && <p style={{ color:'#888', fontSize:'13px', textAlign:'center', padding:'12px' }}>⏳ Loading leave history...</p>}

              {!myLeavesLoading && myLeaves.length===0 && (
                <div style={{ textAlign:'center', padding:'20px', color:'#888' }}>
                  <p style={{ fontSize:'24px', margin:'0 0 8px' }}>📭</p>
                  <p style={{ fontSize:'14px' }}>No leave requests filed yet.</p>
                </div>
              )}

              {!myLeavesLoading && myLeaves.length > 0 && (
                <div>
                  {/* Leave Balance Summary */}
                  <div style={{ background:'#e8f5e9', borderRadius:'12px', padding:'14px', marginBottom:'12px', border:'1px solid #c8e6c9' }}>
                    <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 10px' }}>📊 This Year's Leave Balance</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      <div style={{ background:'white', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                        <p style={{ fontSize:'11px', color:'#888', margin:'0 0 4px' }}>Sick Leave Used</p>
                        <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'18px', margin:'0 0 2px' }}>
                          {myLeaves.filter(l=>l.leave_type==='Sick Leave'&&l.status==='approved').reduce((s,l)=>s+Number(l.duration_days||1),0)}d
                        </p>
                        <p style={{ fontSize:'11px', color:'#888', margin:0 }}>{myLeaveBalance.sick}d remaining</p>
                      </div>
                      <div style={{ background:'white', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                        <p style={{ fontSize:'11px', color:'#888', margin:'0 0 4px' }}>Vacation Leave Used</p>
                        <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'18px', margin:'0 0 2px' }}>
                          {myLeaves.filter(l=>l.leave_type==='Vacation Leave'&&l.status==='approved').reduce((s,l)=>s+Number(l.duration_days||1),0)}d
                        </p>
                        <p style={{ fontSize:'11px', color:'#888', margin:0 }}>{myLeaveBalance.vacation}d remaining</p>
                      </div>
                    </div>
                  </div>

                  {/* Pending Leaves */}
                  {myLeaves.filter(l=>l.status==='pending').length > 0 && (
                    <div style={{ marginBottom:'12px' }}>
                      <p style={{ fontWeight:'bold', color:'#f5a623', fontSize:'13px', margin:'0 0 8px' }}>⏳ Pending Approval</p>
                      {myLeaves.filter(l=>l.status==='pending').map(leave=>(
                        <div key={leave.id} style={{ ...cardS, border:'1px solid #f5a623', background:'#fffbf0' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'6px' }}>
                            <div>
                              <p style={{ margin:'0 0 2px', fontWeight:'bold', color:'#333', fontSize:'13px' }}>{leave.leave_type}</p>
                              <p style={cps}>{leave.leave_start} to {leave.leave_end} ({leave.duration_days} day(s))</p>
                              <p style={cps}>Reason: {leave.reason}</p>
                              <p style={{ ...cps, color:'#aaa' }}>Filed: {new Date(leave.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge label="⏳ Pending" color="orange" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Approved Leaves */}
                  {myLeaves.filter(l=>l.status==='approved').length > 0 && (
                    <div style={{ marginBottom:'12px' }}>
                      <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 8px' }}>✅ Approved Leaves</p>
                      {myLeaves.filter(l=>l.status==='approved').map(leave=>(
                        <div key={leave.id} style={{ ...cardS, border:'1px solid #c8e6c9', background:'#f0fff0' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'6px' }}>
                            <div>
                              <p style={{ margin:'0 0 2px', fontWeight:'bold', color:'#333', fontSize:'13px' }}>{leave.leave_type}</p>
                              <p style={cps}>{leave.leave_start} to {leave.leave_end} ({leave.duration_days} day(s))</p>
                              <p style={cps}>Reason: {leave.reason}</p>
                              <p style={{ ...cps, color:'#aaa' }}>Filed: {new Date(leave.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge label="✅ Approved" color="green" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Disapproved Leaves */}
                  {myLeaves.filter(l=>l.status==='disapproved').length > 0 && (
                    <div style={{ marginBottom:'12px' }}>
                      <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 8px' }}>❌ Disapproved Leaves</p>
                      {myLeaves.filter(l=>l.status==='disapproved').map(leave=>(
                        <div key={leave.id} style={{ ...cardS, border:'1px solid #ffcdd2', background:'#fff5f5' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'6px' }}>
                            <div>
                              <p style={{ margin:'0 0 2px', fontWeight:'bold', color:'#333', fontSize:'13px' }}>{leave.leave_type}</p>
                              <p style={cps}>{leave.leave_start} to {leave.leave_end} ({leave.duration_days} day(s))</p>
                              <p style={cps}>Reason: {leave.reason}</p>
                              {leave.admin_reason && <p style={{ ...cps, color:'#ca1b1b' }}>Admin Reason: <em>"{leave.admin_reason}"</em></p>}
                              <p style={{ ...cps, color:'#aaa' }}>Filed: {new Date(leave.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge label="❌ Disapproved" color="red" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button style={{ background:'#f5a623', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={()=>{ closeAllPanels(); setShowCashAdvanceRequest(!showCashAdvanceRequest) }}>💵 REQUEST CASH ADVANCE</button>
          {showCashAdvanceRequest && (
            <div style={{ background:'#f9f9f9', padding:'14px', borderRadius:'12px', border:'1px solid #ddd', marginTop:'8px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'10px' }} onClick={()=>setShowCashAdvanceRequest(false)}>← BACK</button>
              <p style={{ color:'#888', fontSize:'13px', margin:'0 0 10px' }}>Once approved, deducted from next payroll cutoff.</p>
              <input type="number" placeholder="Amount (PHP)" value={requestCashAmount} onChange={e=>setRequestCashAmount(e.target.value)} style={inputStyle} />
              <label style={lblS}>Reason for Cash Advance:</label>
              <select
                value={requestCashReasonPreset}
                onChange={e => {
                  const val = e.target.value
                  setRequestCashReasonPreset(val)
                  if (val !== 'Others') setRequestCashReason(val)
                  else setRequestCashReason('')
                }}
                style={inputStyle}
              >
                <option value="">— Select a reason —</option>
                <option value="Personal emergency">Personal emergency</option>
                <option value="Medical / health expense">Medical / health expense</option>
                <option value="Educational expense (tuition, school supplies)">Educational expense (tuition, school supplies)</option>
                <option value="Family needs / household expense">Family needs / household expense</option>
                <option value="Home repair or renovation">Home repair or renovation</option>
                <option value="Burial / bereavement expense">Burial / bereavement expense</option>
                <option value="Others">Others (please specify)</option>
              </select>
              {requestCashReasonPreset === 'Others' && (
                <textarea
                  placeholder="Please describe your reason..."
                  value={requestCashReason}
                  onChange={e => setRequestCashReason(e.target.value)}
                  style={{ ...inputStyle, minHeight:'70px', resize:'none' }}
                />
              )}
              <button style={btnGreen} onClick={submitCashAdvanceRequest}>SUBMIT REQUEST</button>
            </div>
          )}

          <button style={{ background:'#f5a623', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={()=>{ closeAllPanels(); setShowCashAdvances(!showCashAdvances); if(!showCashAdvances) loadMyCashAdvances(employee) }}>{showCashAdvances?'🔼 HIDE':'🔽 VIEW'} MY CASH ADVANCES</button>
          {showCashAdvances && (
            <div style={{ marginTop:'10px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'10px' }} onClick={()=>setShowCashAdvances(false)}>← BACK</button>

              {/* Active Balance Summary */}
              {myActiveCAs.length > 0 && (
                <div style={{ background:'#fff8dc', border:'2px solid #f5a623', borderRadius:'12px', padding:'14px', marginBottom:'12px' }}>
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:'0 0 10px' }}>💳 Outstanding Cash Advance Balance</p>
                  {myActiveCAs.map(ca => (
                    <div key={ca.id} style={{ background:'white', borderRadius:'10px', padding:'12px', marginBottom:'8px', border:'1px solid #eee' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px' }}>
                        <div>
                          <p style={{ margin:'0 0 4px', fontWeight:'bold', color:'#333', fontSize:'13px' }}>
                            Original: {php(ca.amount)}
                          </p>
                          <p style={cps}>Date: {ca.advance_date} | Reason: {ca.notes||'—'}</p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ margin:0, fontWeight:'bold', color:'#ca1b1b', fontSize:'16px' }}>{php(ca.balance)}</p>
                          <p style={{ margin:0, fontSize:'11px', color:'#888' }}>remaining</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginTop:'10px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <span style={{ fontSize:'11px', color:'#888' }}>Paid: {php(ca.amount_paid||0)}</span>
                          <span style={{ fontSize:'11px', color:'#888' }}>Remaining: {php(ca.balance)}</span>
                        </div>
                        <div style={{ background:'#eee', borderRadius:'999px', height:'8px', overflow:'hidden' }}>
                          <div style={{ background:'#2d8a4e', height:'100%', borderRadius:'999px', width:`${Math.min(100, ((Number(ca.amount_paid)||0)/Number(ca.amount||1))*100).toFixed(0)}%`, transition:'width 0.3s' }} />
                        </div>
                        <p style={{ fontSize:'11px', color:'#888', margin:'4px 0 0', textAlign:'center' }}>
                          {Math.min(100,((Number(ca.amount_paid)||0)/Number(ca.amount||1))*100).toFixed(0)}% paid •
                          {ca.installments_remaining} installment(s) left •
                          {php(ca.per_payroll_deduction)} per cutoff
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Total outstanding */}
                  <div style={{ background:'#ca1b1b', color:'white', borderRadius:'8px', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px' }}>
                    <span style={{ fontWeight:'bold', fontSize:'13px' }}>TOTAL OUTSTANDING</span>
                    <span style={{ fontWeight:'bold', fontSize:'16px' }}>{php(myActiveCAs.reduce((s,c)=>s+Number(c.balance||0),0))}</span>
                  </div>
                </div>
              )}

              {myActiveCAs.length === 0 && myCAHistory.length === 0 && myCashAdvances.filter(c=>c.status==='pending').length === 0 && (
                <div style={{ textAlign:'center', padding:'20px', color:'#888' }}>
                  <p style={{ fontSize:'24px', margin:'0 0 8px' }}>✅</p>
                  <p style={{ fontSize:'14px', fontWeight:'bold', color:'#2d8a4e' }}>No outstanding cash advances</p>
                  <p style={{ fontSize:'13px' }}>You have no unpaid balance.</p>
                </div>
              )}

              {/* Pending Requests */}
              {myCashAdvances.filter(c=>c.status==='pending').length > 0 && (
                <div style={{ marginBottom:'12px' }}>
                  <p style={{ fontWeight:'bold', color:'#f5a623', fontSize:'13px', margin:'0 0 8px' }}>⏳ Pending Requests</p>
                  {myCashAdvances.filter(c=>c.status==='pending').map(ca=>(
                    <div key={ca.id} style={{ ...cardS, border:'1px solid #f5a623', background:'#fffbf0' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <p style={{ margin:'0 0 2px', fontWeight:'bold', color:'#333' }}>{php(ca.amount)}</p>
                          <p style={cps}>{ca.reason}</p>
                          <p style={{ ...cps, color:'#aaa' }}>{new Date(ca.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge label="⏳ Pending" color="orange" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Disapproved Requests */}
              {myCashAdvances.filter(c=>c.status==='disapproved').length > 0 && (
                <div style={{ marginBottom:'12px' }}>
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 8px' }}>❌ Disapproved Requests</p>
                  {myCashAdvances.filter(c=>c.status==='disapproved').map(ca=>(
                    <div key={ca.id} style={{ ...cardS, border:'1px solid #ddd', background:'#fff5f5' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                          <p style={{ margin:'0 0 2px', fontWeight:'bold', color:'#333' }}>{php(ca.amount)}</p>
                          <p style={cps}>Reason: {ca.reason}</p>
                          {ca.admin_reason && <p style={{ ...cps, color:'#ca1b1b' }}>Admin: {ca.admin_reason}</p>}
                        </div>
                        <Badge label="❌ Disapproved" color="red" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Paid History Toggle */}
              {myCAHistory.length > 0 && (
                <div>
                  <button style={{ ...btnGray, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>setShowCAHistory(!showCAHistory)}>
                    {showCAHistory?'🔼 HIDE':'🔽 VIEW'} PAID HISTORY ({myCAHistory.length})
                  </button>
                  {showCAHistory && (
                    <div style={{ marginTop:'10px' }}>
                      <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 8px' }}>✅ Fully Paid Cash Advances</p>
                      {myCAHistory.map(ca=>(
                        <div key={ca.id} style={{ ...cardS, border:'1px solid #ddd', background:'#f0fff0' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                              <p style={{ margin:'0 0 2px', fontWeight:'bold', color:'#333' }}>{php(ca.amount)}</p>
                              <p style={cps}>{ca.advance_date} | {ca.notes||'—'}</p>
                            </div>
                            <Badge label="✅ Fully Paid" color="green" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          <button style={{ background:'#4a90d9', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={()=>{ closeAllPanels(); setShowMyAttendance(!showMyAttendance) }}>{showMyAttendance?'🔼 HIDE':'🔽 VIEW'} MY ATTENDANCE HISTORY</button>
          {showMyAttendance && (
            <div style={{ marginTop:'10px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'10px' }} onClick={()=>setShowMyAttendance(false)}>← BACK</button>
              {myAttendance.length===0&&<p style={{ color:'#888', fontSize:'13px' }}>No attendance records found.</p>}
              {myAttendance.map(log=>(
                <div key={log.id} style={{ ...cardS, borderLeft:`4px solid ${log.status==='Absent'?'#ca1b1b':log.status==='Late'?'#f5a623':'#2d8a4e'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
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

          {employee?.is_admin&&(
            <button style={{ ...btnBlack, background:'#444', marginTop:'8px' }} onClick={()=>openAdmin('owner')}>🔧 ADMIN PANEL</button>
          )}

          <button style={{ ...btnBlack, background:'#222', marginTop:'8px' }} onClick={()=>{ closeAllPanels(); setShowPayslips(!showPayslips) }}>{showPayslips?'🔼 HIDE':'🔽 VIEW'} MY PAYSLIPS</button>
          {showPayslips && (
            <div style={{ marginTop:'10px' }}>
              <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555', marginBottom:'10px' }} onClick={()=>setShowPayslips(false)}>← BACK</button>
              {myPayslips.length===0&&<p style={{ color:'#888', fontSize:'13px' }}>No payslips found.</p>}
              {myPayslips.map(pay=>(
                <div key={pay.id} style={cardS}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px', marginBottom:'6px' }}>
                    <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>Payslip</h3>
                    {pay.payslip_serial&&<span style={{ fontSize:'11px', color:'#aaa', fontFamily:'monospace' }}>{pay.payslip_serial}</span>}
                    {pay.employee_acknowledgement==='agreed'&&<Badge label="✅ Agreed" color="green" />}
                    {pay.employee_acknowledgement==='disputed'&&<Badge label="⚠️ Disputed" color="red" />}
                    {(pay.employee_acknowledgement==='pending'||!pay.employee_acknowledgement)&&<Badge label="🔔 Pending" color="orange" />}
                  </div>
                  <p style={cps}>Period: {pay.payroll_start} to {pay.payroll_end}</p>
                  {(pay.employee_acknowledgement==='pending'||!pay.employee_acknowledgement) && (
                    <p style={{ fontSize:'11px', color:'#ca1b1b', margin:'2px 0', fontWeight:'bold' }}>⏰ Please acknowledge within 5 days of release</p>
                  )}
                  {pay.employee_acknowledgement==='auto-acknowledged' && (
                    <p style={{ fontSize:'11px', color:'#888', margin:'2px 0' }}>🤖 Auto-acknowledged after 5-day deadline</p>
                  )}
                  <p style={cps}>Basic: {php(pay.basic_pay)} | Earnings: {php(pay.total_earnings)} | Deductions: {php(pay.total_deductions)}</p>
                  <h3 style={{ color:'#ca1b1b', margin:'6px 0' }}>Net Pay: {php(pay.net_pay)}</h3>
                  {(pay.employee_acknowledgement==='pending'||!pay.employee_acknowledgement)&&(
                    <div style={{ marginTop:'10px' }}>
                      <p style={{ color:'#888', fontSize:'13px', margin:'0 0 8px' }}>Please review and acknowledge this payslip.</p>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button style={{ ...btnGreen, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'13px' }} onClick={()=>agreePayslip(pay.id)}>✅ AGREE</button>
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'13px' }} onClick={()=>setShowDisputeBox(p=>({...p,[pay.id]:!p[pay.id]}))}>❌ DISAGREE</button>
                      </div>
                      {showDisputeBox[pay.id]&&(
                        <div style={{ marginTop:'10px' }}>
                          <label style={lblS}>Reason for Dispute:</label>
                          <select
                            value={disputeReasonPresets[pay.id]||''}
                            onChange={e => {
                              const val = e.target.value
                              setDisputeReasonPresets(p=>({...p,[pay.id]:val}))
                              if (val !== 'Others') setDisputeReasons(p=>({...p,[pay.id]:val}))
                              else setDisputeReasons(p=>({...p,[pay.id]:''}))
                            }}
                            style={inputStyle}
                          >
                            <option value="">— Select a reason —</option>
                            <option value="Wrong computation / incorrect net pay">Wrong computation / incorrect net pay</option>
                            <option value="Missing overtime or undertime credit">Missing overtime or undertime credit</option>
                            <option value="Incorrect deduction applied">Incorrect deduction applied</option>
                            <option value="Unauthorized or excessive deduction">Unauthorized or excessive deduction</option>
                            <option value="Missing allowance or bonus">Missing allowance or bonus</option>
                            <option value="Incorrect attendance or leave count">Incorrect attendance or leave count</option>
                            <option value="Others">Others (please specify)</option>
                          </select>
                          {(disputeReasonPresets[pay.id]==='Others') && (
                            <textarea
                              placeholder="Explain why you disagree..."
                              value={disputeReasons[pay.id]||''}
                              onChange={e=>setDisputeReasons(p=>({...p,[pay.id]:e.target.value}))}
                              style={{ ...inputStyle, minHeight:'70px', resize:'none' }}
                            />
                          )}
                          <button style={btnRed} onClick={()=>submitPayslipDispute(pay)}>SUBMIT DISPUTE</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button style={{ background:'#4a90d9', color:'white', padding:'12px', border:'none', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={()=>setShowMyProfile(!showMyProfile)}>
            {showMyProfile?'🔼 HIDE':'👤 VIEW'} MY PROFILE
          </button>
          {showMyProfile && (
            <div style={{ background:'#f9f9f9', borderRadius:'14px', padding:'16px', marginTop:'10px', border:'1px solid #eee' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>👤 My Profile</h3>
                <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555' }} onClick={()=>setShowMyProfile(false)}>← BACK</button>
              </div>
              {[
                ['Full Name', employee.full_name],
                ['Employee Code', employee.employee_code],
                ['Position', employee.position||'—'],
                ['Department', employee.department||'—'],
                ['Employment Type', employee.employment_type||'—'],
                ['Hire Date', employee.hire_date||'—'],
                ['Daily Rate', php(employee.daily_rate||0)],
                ['Pay Type', employee.pay_type||'daily'],
                ['Date of Birth', employee.date_of_birth||'—'],
                ['Gender', employee.gender||'—'],
                ['Civil Status', employee.civil_status||'—'],
                ['Contact Number', employee.contact_number||'—'],
                ['Home Address', employee.home_address||'—'],
                ['Emergency Contact', `${employee.emergency_contact_name||'—'} — ${employee.emergency_contact_number||'—'}`],
              ].map(([label, value])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #eee', flexWrap:'wrap', gap:'4px' }}>
                  <span style={{ fontSize:'12px', color:'#888', fontWeight:'bold' }}>{label}</span>
                  <span style={{ fontSize:'12px', color:'#333', textAlign:'right' }}>{value}</span>
                </div>
              ))}
              <div style={{ marginTop:'12px', background:'white', borderRadius:'10px', padding:'10px', border:'1px solid #eee' }}>
                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'12px', margin:'0 0 6px' }}>🏛️ Government Contributions</p>
                {employee.has_sss && <p style={cps}>✅ SSS {employee.sss_no?`— ${employee.sss_no}`:''}</p>}
                {employee.has_pagibig && <p style={cps}>✅ Pag-IBIG {employee.pagibig_no?`— ${employee.pagibig_no}`:''}</p>}
                {employee.has_philhealth && <p style={cps}>✅ PhilHealth {employee.philhealth_no?`— ${employee.philhealth_no}`:''}</p>}
                {employee.tin_no && <p style={cps}>📋 TIN: {employee.tin_no}</p>}
              </div>
              <div style={{ marginTop:'8px', background:'#e8f5e9', borderRadius:'10px', padding:'10px', border:'1px solid #c8e6c9' }}>
                <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'12px', margin:'0 0 6px' }}>📅 Leave Balances</p>
                <p style={cps}>Sick Leave: {myLeaveBalance.sick} day(s) remaining</p>
                <p style={cps}>Vacation Leave: {myLeaveBalance.vacation} day(s) remaining</p>
              </div>
            </div>
          )}
          {cameFromAdmin ? (
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              <button style={{ ...btnRed, background:'#ca1b1b', flex:1, marginTop:0 }} onClick={()=>{
                setEmployee(null); setProfilePhotoUrl(null); setCameFromAdmin(false)
                setAdminMode(true); setSidebarOpen(false)
                loadEmployees(); loadDashboard(); loadDashboardCharts()
              }}>← ADMIN PANEL</button>
              <button style={{ ...btnGray, flex:1, marginTop:0 }} onClick={()=>{ logout(); setCameFromAdmin(false); setAdminEmployee(null); setAdminRole(null) }}>🚪 LOGOUT</button>
            </div>
          ) : (
            <button style={{ ...btnGray, marginTop:'8px' }} onClick={logout}>🚪 LOGOUT</button>
          )}
        </div>
        </div>
      </div>
    )
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg,#ca1b1b,#fdd412)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', boxSizing:'border-box', overflow:'auto' }}>
      {toast && (
        <div style={{ position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:toast.color==='red'?'#ca1b1b':'#2d8a4e', color:'white', padding:'12px 28px', borderRadius:'10px', fontWeight:'bold', fontSize:'14px', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', whiteSpace:'nowrap', pointerEvents:'none' }}>{toast.msg}</div>
      )}
      <div style={{ background:'white', borderRadius:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', width:'100%', maxWidth:'440px', padding:'36px 32px', boxSizing:'border-box' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <img src="/logo.png" alt="Logo" style={{ width:'90px', height:'90px', objectFit:'contain', display:'block', margin:'0 auto 10px' }} />
          <h1 style={{ color:'#ca1b1b', margin:'0 0 4px', fontSize:'26px', fontWeight:'900', letterSpacing:'-0.5px' }}>Roma's Donuts</h1>
          <p style={{ color:'#aaa', margin:0, fontSize:'13px' }}>Payroll & Attendance System</p>
        </div>
        <input placeholder="Employee ID or Admin Code" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)} style={{ ...inputStyle, fontSize:'15px', padding:'14px' }} />
        <input placeholder="PIN" type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') handleLogin() }} style={{ ...inputStyle, fontSize:'15px', padding:'14px' }} />
        <button style={{ ...btnRed, padding:'15px', fontSize:'16px', borderRadius:'12px', letterSpacing:'1px' }} onClick={handleLogin} disabled={loading}>{loading?'⏳ PLEASE WAIT...':'LOGIN'}</button>
        {employeeCode.toUpperCase()==='ADMIN001' && (
          <p style={{ color:'#bbb', fontSize:'10px', marginTop:'10px', textAlign:'center' }}>👑 Master Owner Access</p>
        )}
        <p style={{ color:'#ccc', fontSize:'11px', textAlign:'center', marginTop:'20px' }}>Roma's Donuts © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
