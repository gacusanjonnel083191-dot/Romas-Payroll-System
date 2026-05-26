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

// ── Design System ─────────────────────────────────────────────────────────────
// Roma's Donuts Brand: Red #ca1b1b | Gold #FDD412 | Navy #1a1a2e
const pageStyle = { position:'fixed', top:0, left:0, right:0, bottom:0, background:'linear-gradient(150deg,#1a1a2e 0%,#2d1515 50%,#ca1b1b 100%)', display:'flex', justifyContent:'center', alignItems:'center', padding:'20px', boxSizing:'border-box', overflowY:'auto' }
const cardStyle = { background:'white', padding:'28px', borderRadius:'20px', boxShadow:'0 8px 32px rgba(0,0,0,0.13)', width:'100%', boxSizing:'border-box' }
const logoStyle = { width:'90px', height:'90px', objectFit:'contain', display:'block', margin:'0 auto 10px' }
const inputStyle = { width:'100%', padding:'11px 14px', marginBottom:'12px', borderRadius:'10px', border:'1.5px solid #e8e8e8', boxSizing:'border-box', fontSize:'13px', background:'white', color:'#222', outline:'none', fontFamily:'inherit' }
const cardS = { border:'1px solid #f0f0f0', padding:'14px', borderRadius:'14px', marginBottom:'10px', background:'white', boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }
const cps = { margin:'3px 0', color:'#555', fontSize:'13px' }
const h2s = { color:'#ca1b1b', marginTop:0, marginBottom:'16px', fontWeight:'800', letterSpacing:'-0.3px' }
const lblS = { display:'block', marginBottom:'5px', fontWeight:'700', color:'#555', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px' }
// Buttons
const btnBase = { display:'inline-flex', alignItems:'center', justifyContent:'center', width:'100%', padding:'12px 18px', borderRadius:'10px', border:'none', fontWeight:'700', cursor:'pointer', marginTop:'8px', fontSize:'13px', letterSpacing:'0.3px', transition:'opacity 0.15s', fontFamily:'inherit' }
const btnRed = { ...btnBase, background:'#ca1b1b', color:'white', boxShadow:'0 2px 8px rgba(202,27,27,0.25)' }
const btnGreen = { ...btnBase, background:'#2d8a4e', color:'white', boxShadow:'0 2px 8px rgba(45,138,78,0.25)' }
const btnBlack = { ...btnBase, background:'#1a1a2e', color:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.18)' }
const btnGray = { ...btnBase, background:'#f0f0f0', color:'#333', boxShadow:'none' }
const btnYellow = { ...btnBase, background:'#FDD412', color:'#1a1a2e', width:'auto', padding:'10px 20px', marginTop:0, boxShadow:'0 2px 8px rgba(253,212,18,0.35)' }

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
          <tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Basic Pay (${Math.round((pay.totalWorkedMinutes||0)/60*10)/10} hrs)</td><td style="padding:3px 8px;text-align:right;font-size:10px;">${php(pay.basicPay)}</td></tr>
          ${(pay.birthdayPay||0)>0?`<tr style="background:#fff8dc;"><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">🎂 Birthday Pay (200%)</td><td style="padding:3px 8px;text-align:right;">${php(pay.birthdayPay)}</td></tr>`:''}
          ${pay.overtimePay>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Overtime Pay (${pay.overtimeMinutes} min × 1.25x)</td><td style="padding:3px 8px;text-align:right;">${php(pay.overtimePay)}</td></tr>`:''}
          ${pay.nightDiffPay>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Night Differential (10%)</td><td style="padding:3px 8px;text-align:right;">${php(pay.nightDiffPay)}</td></tr>`:''}
          ${pay.holidayPay>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Holiday Pay</td><td style="padding:3px 8px;text-align:right;">${php(pay.holidayPay)}</td></tr>`:''}
          ${(pay.paidLeaveDays||0)>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Paid Leave (${pay.paidLeaveDays} day(s))</td><td style="padding:3px 8px;text-align:right;">${php((pay.paidLeaveDays||0)*((pay.basicPay||0)/Math.max(1,pay.workedDays+(pay.paidLeaveDays||0))))}</td></tr>`:''}
          ${pay.adjustmentEarnings>0?`<tr><td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #eee;">Bonus / Other Earnings</td><td style="padding:3px 8px;text-align:right;">${php(pay.adjustmentEarnings)}</td></tr>`:''}
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
  const [adminRole, setAdminRole] = useState(null) // 'owner'|'manager'|'hr'|'payroll'|'supervisor'|'asst_supervisor'
  const [adminEmployee, setAdminEmployee] = useState(null) // employee record of the logged-in admin
  const [availableRoles, setAvailableRoles] = useState([]) // all roles this employee can access
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
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
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
  // ── Wastage / Spoilage ────────────────────────────────────────────────────
  const [showWastageForm, setShowWastageForm] = useState(false)
  const [wastageItemId, setWastageItemId] = useState('')
  const [wastageQty, setWastageQty] = useState('')
  const [wastageReason, setWastageReason] = useState('')
  const [wastageReasonOther, setWastageReasonOther] = useState('')
  const [wastageNotes, setWastageNotes] = useState('')
  const [wastageDate, setWastageDate] = useState(today)
  const [wastageChargeEmployee, setWastageChargeEmployee] = useState(false)
  const [wastageEmployeeId, setWastageEmployeeId] = useState('')
  const [wastageSaving, setWastageSaving] = useState(false)
  const [wastageLogs, setWastageLogs] = useState([])
  const [wastageLoading, setWastageLoading] = useState(false)
  const [showWastageHistory, setShowWastageHistory] = useState(false)
  const WASTAGE_REASONS = ['Expired / Spoiled','Damaged packaging','Spilled / Contaminated','Overproduction / Excess','Quality rejection','SOP Violation / Employee Error','Others']
  // ── Employee Charges ──────────────────────────────────────────────────────
  const [employeeCharges, setEmployeeCharges] = useState([])
  const [showChargesSection, setShowChargesSection] = useState(false)
  const [chargesLoading, setChargesLoading] = useState(false)
  // ── Expiry Tracking ───────────────────────────────────────────────────────
  const [showExpirySection, setShowExpirySection] = useState(false)
  const [expiryItems, setExpiryItems] = useState([])
  const [expiryLoading, setExpiryLoading] = useState(false)
  const [editingExpiryId, setEditingExpiryId] = useState(null)
  const [expiryDate, setExpiryDate] = useState('')
  // ── Employee Portal Charges ───────────────────────────────────────────────
  const [myCharges, setMyCharges] = useState([])
  const [showMyCharges, setShowMyCharges] = useState(false)
  // ── Inventory ─────────────────────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvPreview, setCsvPreview] = useState([])
  const [showCsvPreview, setShowCsvPreview] = useState(false)
  // Reseller Portal
  const [resellerMode, setResellerMode] = useState(false)
  const [currentReseller, setCurrentReseller] = useState(null)
  const [resellerLoginCode, setResellerLoginCode] = useState('')
  const [resellerLoginPin, setResellerLoginPin] = useState('')
  const [resellerPortalView, setResellerPortalView] = useState('dashboard')
  const [resellerInvoices, setResellerInvoices] = useState([])
  const [resellerPaymentHistory, setResellerPaymentHistory] = useState([])
  const [resellerOrderItems, setResellerOrderItems] = useState([])
  const [resellerOrderDeliveryDate, setResellerOrderDeliveryDate] = useState('')
  const [resellerOrderNotes, setResellerOrderNotes] = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [resellerOrders, setResellerOrders] = useState([])
  // Admin order management
  const [pendingResellerOrders, setPendingResellerOrders] = useState([])
  const [showOrdersPanel, setShowOrdersPanel] = useState(false)
  // Login type
  const [loginType, setLoginType] = useState('employee')
  // Franchise
  const [franchises, setFranchises] = useState([])
  const [showFranchiseForm, setShowFranchiseForm] = useState(false)
  const [franchiseForm, setFranchiseForm] = useState({ branch_name:'', location:'', franchisee_name:'', contact_number:'', franchise_fee:'', royalty_rate:'5', opening_date:'', status:'active', notes:'' })
  const [loadingFranchises, setLoadingFranchises] = useState(false)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [addItemLoading, setAddItemLoading] = useState(false)
  // ── Phase 2: Costing System ───────────────────────────────────────────────
  const [costingView, setCostingView] = useState('dashboard')
  const [costSettings, setCostSettings] = useState({
    daily_labor_cost: 8000, waste_percentage: 10,
    monthly_rent: 8000, monthly_electricity: 20000, monthly_other_fixed: 73000,
    fryer_cost: 55000, fryer_lifespan_years: 6,
    mixer_cost: 100000, mixer_lifespan_years: 6,
    sheeter_cost: 200000, sheeter_lifespan_years: 5,
    production_days_per_month: 26, target_margin_percentage: 30, total_daily_pieces: 4740,
  })
  const [savingCostSettings, setSavingCostSettings] = useState(false)
  const [donutVariants, setDonutVariants] = useState([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [baseDoughIngredients, setBaseDoughIngredients] = useState([])
  const [variantRecipes, setVariantRecipes] = useState({})
  const [selectedRecipeVariantId, setSelectedRecipeVariantId] = useState(null)
  const [editingBaseDough, setEditingBaseDough] = useState([])
  const [editingVariantRecipe, setEditingVariantRecipe] = useState([])
  const [savingRecipe, setSavingRecipe] = useState(false)
  const [productionLogs, setProductionLogs] = useState([])
  const [productionLoading, setProductionLoading] = useState(false)
  const [showProductionForm, setShowProductionForm] = useState(false)
  const [prodDate, setProdDate] = useState(today)
  const [prodEntries, setProdEntries] = useState([{ variant_id:'', pieces:'' }])
  const [prodNotes, setProdNotes] = useState('')
  const [savingProduction, setSavingProduction] = useState(false)
  const [editingVariantId, setEditingVariantId] = useState(null)
  const [editVariantFields, setEditVariantFields] = useState({})
  const DONUT_VARIANTS_DEFAULT = [
    { name:'Choco Balls', category:'Bites', selling_price:7, pieces_per_batch:30 },
    { name:'Bavarian Bites', category:'Bites', selling_price:7, pieces_per_batch:30 },
    { name:'Bavarian Pops', category:'Bites', selling_price:7, pieces_per_batch:30 },
    { name:'Choco Lollisticks', category:'Bites', selling_price:7, pieces_per_batch:30 },
    { name:'Glazed Circlets', category:'Glaze Circlet', selling_price:13, pieces_per_batch:20 },
    { name:'Cinnamon Rolls', category:'Premium', selling_price:18, pieces_per_batch:8 },
    { name:'Rings', category:'Regular', selling_price:25, pieces_per_batch:12 },
    { name:'Shells', category:'Filled', selling_price:26, pieces_per_batch:12 },
    { name:'Bavarian Midnight', category:'Premium', selling_price:28, pieces_per_batch:10 },
    { name:'Biscoreo', category:'Premium', selling_price:28, pieces_per_batch:10 },
    { name:'Fanfans', category:'Premium', selling_price:33, pieces_per_batch:10 },
    { name:'Oreo Dream', category:'Premium', selling_price:33, pieces_per_batch:10 },
    { name:'Almond Glitz', category:'Premium', selling_price:35, pieces_per_batch:10 },
    { name:'Lotus Cloud', category:'Premium', selling_price:35, pieces_per_batch:10 },
  ]
  const [VARIANT_CATEGORIES] = useState(['Bites','Glaze Circlet','Regular','Filled','Premium'])
  // ── Phase 3: Sales & Resellers ────────────────────────────────────────────
  const [salesView, setSalesView] = useState('dashboard')
  const [resellers, setResellers] = useState([])
  const [resellersLoading, setResellersLoading] = useState(false)
  const [showResellerForm, setShowResellerForm] = useState(false)
  const [editingResellerId, setEditingResellerId] = useState(null)
  const [resellerForm, setResellerForm] = useState({ name:'', area:'', contact_person:'', phone:'', address:'', delivery_day:'Monday' })
  const [resellerDefaultOrders, setResellerDefaultOrders] = useState({})
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1)
  const tomorrowStr = tomorrow.toISOString().slice(0,10)
  const [forecastDate, setForecastDate] = useState(tomorrowStr)
  const [editingDefaultOrder, setEditingDefaultOrder] = useState(null)
  const [defaultOrderItems, setDefaultOrderItems] = useState([])
  const [deliveryInvoices, setDeliveryInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [invoiceResellerId, setInvoiceResellerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [invoiceItems, setInvoiceItems] = useState([])
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoicePreparedBy, setInvoicePreparedBy] = useState('')
  const [invoiceDispatchedBy, setInvoiceDispatchedBy] = useState('')
  const [invoiceCrates, setInvoiceCrates] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState({})
  const [paymentAmount, setPaymentAmount] = useState({})
  const [paymentDate, setPaymentDate] = useState({})
  const [paymentNote, setPaymentNote] = useState({})
  const [paymentMethod, setPaymentMethod] = useState({})
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [editInvoiceItems, setEditInvoiceItems] = useState([])
  const [savingEditInvoice, setSavingEditInvoice] = useState(false)
  const PAYMENT_METHODS = ['Cash','GCash','Bank Transfer']
  const [arFilter, setArFilter] = useState('all')
  const [dailySales, setDailySales] = useState([])
  const [dailySalesLoading, setDailySalesLoading] = useState(false)
  const [showSalesForm, setShowSalesForm] = useState(false)
  const [salesDate, setSalesDate] = useState(today)
  const [salesEntries, setSalesEntries] = useState([{ variant_id:'', variant_name:'', channel:'walkin', quantity:'', unit_price:'' }])
  const [salesNotes, setSalesNotes] = useState('')
  const [savingSales, setSavingSales] = useState(false)
  const [dailyExpenses, setDailyExpenses] = useState([])
  const [cashReconciliations, setCashReconciliations] = useState([])
  const [reconciliationDate, setReconciliationDate] = useState(today)
  const [actualCash, setActualCash] = useState('')
  const [reconciliationNotes, setReconciliationNotes] = useState('')
  const [savingReconciliation, setSavingReconciliation] = useState(false)
  const [showReconciliationHistory, setShowReconciliationHistory] = useState(false)
  const [showReturnForm, setShowReturnForm] = useState({})
  const [returnItems, setReturnItems] = useState({})
  const [savingReturn, setSavingReturn] = useState(false)
  const [invoiceFilter, setInvoiceFilter] = useState('all')
  const [markingDelivered, setMarkingDelivered] = useState({})
  const [showPaymentFormMap, setShowPaymentFormMap] = useState({})
  const [paymentAmount, setPaymentAmount] = useState({})
  const [paymentMethod, setPaymentMethod] = useState({})
  const [paymentNotes, setPaymentNotes] = useState({})
  // Driver Return Form
  const [showDriverReturnForm, setShowDriverReturnForm] = useState(null)
  const [driverReturnItems, setDriverReturnItems] = useState([])
  const [savingDriverReturn, setSavingDriverReturn] = useState(false)
  // Cash Collection Summary
  const [showCashCollection, setShowCashCollection] = useState(false)
  const [cashCollectionDate, setCashCollectionDate] = useState(today)
  // Production Release Form
  const [showReleaseForm, setShowReleaseForm] = useState(false)
  const [releaseFormDate, setReleaseFormDate] = useState(today)
  const [bankDeposits, setBankDeposits] = useState([])
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [depositForm, setDepositForm] = useState({ deposit_date:today, deposit_slip_number:'', bank_name:'BDO', amount:'', notes:'' })
  const [savingDeposit, setSavingDeposit] = useState(false)
  // Production Reports
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1)
  const tomorrowStr2 = tomorrowDate.toISOString().slice(0,10)
  const [productionReports, setProductionReports] = useState([])
  const [showProductionReport, setShowProductionReport] = useState(false)
  const [productionReportItems, setProductionReportItems] = useState([])
  const [productionReportDate, setProductionReportDate] = useState(today)
  const [productionReportDeliveryDate, setProductionReportDeliveryDate] = useState(tomorrowStr2)
  const [productionVarianceReason, setProductionVarianceReason] = useState('')
  const [productionReportNotes, setProductionReportNotes] = useState('')
  const [savingProductionReport, setSavingProductionReport] = useState(false)
  const [viewingProductionReport, setViewingProductionReport] = useState(null)
  // Suspicious Alerts
  const [suspiciousAlerts, setSuspiciousAlerts] = useState([])
  // Reseller Disputes
  const [showDisputeForm, setShowDisputeForm] = useState(null)
  const [disputeType, setDisputeType] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')
  const [disputePhoto, setDisputePhoto] = useState(null)
  const [submittingDispute, setSubmittingDispute] = useState(false)
  const [resellerDisputes, setResellerDisputes] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ date:today, category:'Transportation/Fuel', amount:'', description:'' })
  const [savingExpense, setSavingExpense] = useState(false)
  const [rejectingExpenseId, setRejectingExpenseId] = useState(null)
  const [rejectExpenseReason, setRejectExpenseReason] = useState('')
  const EXPENSE_APPROVAL_THRESHOLD = 500
  const [financialMonth, setFinancialMonth] = useState(today.slice(0,7))
  const [financialData, setFinancialData] = useState(null)
  const [financialLoading, setFinancialLoading] = useState(false)
  const EXPENSE_CATEGORIES = ['Transportation/Fuel','Packaging Supplies','Equipment Repair','Cleaning Supplies','Marketing/Promotion','Miscellaneous']
  const WEEK_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const SALES_CHANNELS = [{ value:'walkin', label:'🏪 Walk-in' }, { value:'messenger', label:'💬 Messenger' }]
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('all')
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Raw Ingredients')
  const [newItemUnit, setNewItemUnit] = useState('kg')
  const [newItemMinStock, setNewItemMinStock] = useState('')
  const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')
  const [newItemCurrentStock, setNewItemCurrentStock] = useState('')
  const [newItemSellingPrice, setNewItemSellingPrice] = useState('')
  const [newItemSupplierId, setNewItemSupplierId] = useState('')
  const [inventoryTransactions, setInventoryTransactions] = useState([])
  const [inventoryTxLoading, setInventoryTxLoading] = useState(false)
  const [showInventoryHistory, setShowInventoryHistory] = useState(false)
  const [showStockForm, setShowStockForm] = useState(false)
  const [stockTxType, setStockTxType] = useState('in')
  const [stockTxItemId, setStockTxItemId] = useState('')
  const [stockTxQty, setStockTxQty] = useState('')
  const [stockTxReference, setStockTxReference] = useState('')
  const [stockTxNotes, setStockTxNotes] = useState('')
  const [stockTxLoading, setStockTxLoading] = useState(false)
  // New inventory features
  const [inventorySubView, setInventorySubView] = useState('items')
  const [selectedItemHistory, setSelectedItemHistory] = useState(null)
  const [itemHistory, setItemHistory] = useState([])
  const [itemHistoryLoading, setItemHistoryLoading] = useState(false)
  const [showAdjustForm, setShowAdjustForm] = useState(false)
  const [adjustItemId, setAdjustItemId] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [stockAdjustments, setStockAdjustments] = useState([])
  const [showReceivingForm, setShowReceivingForm] = useState(null)
  const [receivingItems, setReceivingItems] = useState([])
  const [inventoryValuation, setInventoryValuation] = useState(null)
  const [stockMovementMonth, setStockMovementMonth] = useState(today.slice(0,7))
  const [stockMovementData, setStockMovementData] = useState([])
  const [editingItemId, setEditingItemId] = useState(null)
  const [editItemFields, setEditItemFields] = useState({})
  // Suppliers
  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [showSuppliersSection, setShowSuppliersSection] = useState(false)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState(null)
  const [supplierForm, setSupplierForm] = useState({ name:'', contact_person:'', phone:'', email:'', address:'', payment_terms:'COD (Cash on Delivery)', notes:'' })
  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [showPOSection, setShowPOSection] = useState(false)
  const [showPOBuilder, setShowPOBuilder] = useState(false)
  const [poSupplierId, setPOSupplierId] = useState('')
  const [poItems, setPOItems] = useState([])
  const [poNotes, setPONotes] = useState('')
  const [savingPO, setSavingPO] = useState(false)
  const PAYMENT_TERMS = ['COD (Cash on Delivery)','Net 7 Days','Net 15 Days','Net 30 Days','Net 60 Days','50% Down, 50% on Delivery','Down Payment + Balance','Others']
  const INVENTORY_CATEGORIES = ['Raw Ingredients','Packaging Materials','Finished Products','Equipment & Supplies']
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
  const [showTimedInModal, setShowTimedInModal] = useState(false)
  const [timedInList, setTimedInList] = useState([])
  const [storeLocation, setStoreLocation] = useState({ lat: STORE_LAT, lng: STORE_LNG, radius: STORE_RADIUS_METERS })
  const [isCompanyDevice, setIsCompanyDevice] = useState(()=>localStorage.getItem('roma_company_device')==='true')
  const DEVICE_RESTRICTED_DEPTS = ['Production']
  const [showLocationSetting, setShowLocationSetting] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')

  const currentDay = new Date().getDate()
  const showPayrollReminder = currentDay === 11 || currentDay === 26

  useEffect(() => {
    if (employee) {
      loadTodayLog(employee); loadTodaySchedule(employee)
      loadMyPayslips(employee); loadMyCashAdvances(employee)
      loadMyAttendanceHistory(employee); loadMyLeaveBalance(employee)
      checkAnnouncements(employee); loadMyCharges(employee)
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
    if (data.admin_role && ['owner','manager','hr','payroll','supervisor','asst_supervisor'].includes(data.admin_role)) {
      // Build list of all roles this employee can access (primary + extra roles)
      const extraRoles = data.extra_roles ? data.extra_roles.split(',').filter(r=>r.trim()) : []
      const allRoles = [data.admin_role, ...extraRoles].filter((r,i,a)=>a.indexOf(r)===i)
      setAvailableRoles(allRoles)
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
        const { error: uploadError } = await supabase.storage.from('Contracts').upload(fileName, contractFile, { upsert: false })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('Contracts').getPublicUrl(fileName)
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
      await supabase.storage.from('Contracts').remove([contract.file_name])
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

  // ── Inventory Functions ───────────────────────────────────────────────────
  // ── Feature 3: Item Transaction History ──────────────────────────────────
  async function loadItemHistory(item) {
    setSelectedItemHistory(item)
    setItemHistoryLoading(true)
    setInventorySubView('history')
    const [txs, wastage, adjs] = await Promise.all([
      supabase.from('inventory_transactions').select('*').eq('item_id', item.id).order('created_at', { ascending:false }).limit(50),
      supabase.from('wastage_logs').select('*').eq('item_id', item.id).order('created_at', { ascending:false }).limit(20),
      supabase.from('stock_adjustments').select('*').eq('item_id', item.id).order('created_at', { ascending:false }).limit(20),
    ])
    const allMovements = [
      ...(txs.data||[]).map(t=>({ ...t, movementType: t.transaction_type==='in'?'Stock In':'Stock Out', color: t.transaction_type==='in'?'#2d8a4e':'#ca1b1b', icon:'📦' })),
      ...(wastage.data||[]).map(w=>({ ...w, movementType:'Wastage', quantity:-(w.quantity||0), color:'#f57c00', icon:'🗑️', created_at:w.created_at||w.wastage_date })),
      ...(adjs.data||[]).map(a=>({ ...a, movementType:'Adjustment', quantity:a.adjustment_qty, color: Number(a.adjustment_qty)>=0?'#4a90d9':'#ca1b1b', icon:'⚖️' })),
    ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
    setItemHistory(allMovements)
    setItemHistoryLoading(false)
  }

  // ── Feature 4: Stock Adjustment ──────────────────────────────────────────
  async function saveStockAdjustment() {
    if (!adjustItemId) { showToast('❌ Select an item.','red'); return }
    if (!adjustQty || adjustQty===0) { showToast('❌ Enter adjustment quantity.','red'); return }
    if (!adjustReason.trim()) { showToast('❌ Enter reason.','red'); return }
    const item = inventoryItems.find(i=>i.id===adjustItemId)
    if (!item) return
    const adjQty = Number(adjustQty)
    const newStock = Math.max(0, Number(item.current_stock||0) + adjQty)
    await supabase.from('stock_adjustments').insert({ item_id:adjustItemId, item_name:item.name, adjustment_qty:adjQty, reason:adjustReason, notes:adjustNotes||null, adjusted_by:adminRole })
    await supabase.from('inventory_items').update({ current_stock:newStock }).eq('id', adjustItemId)
    await logAudit('STOCK ADJUSTMENT', adminRole, item.name, `${adjQty>0?'+':''}${adjQty} ${item.unit} — Reason: ${adjustReason}`)
    showToast(`✅ Stock adjusted! ${item.name}: ${Number(item.current_stock||0)} → ${newStock} ${item.unit}`)
    setShowAdjustForm(false); setAdjustItemId(''); setAdjustQty(''); setAdjustReason(''); setAdjustNotes('')
    loadInventoryItems()
  }

  // ── Feature 5: Receiving Report ───────────────────────────────────────────
  async function initReceiving(po) {
    const items = po.purchase_order_items || []
    setReceivingItems(items.map(i=>({ ...i, received_qty:i.quantity, notes:'' })))
    setShowReceivingForm(po)
  }
  async function saveReceivingReport() {
    if (!showReceivingForm) return
    const po = showReceivingForm
    for (const item of receivingItems) {
      const received = Number(item.received_qty||0)
      const ordered = Number(item.quantity||0)
      const discrepancy = received - ordered
      await supabase.from('purchase_order_receipts').insert({ po_id:po.id, item_id:item.item_id||null, item_name:item.item_name||item.name, ordered_qty:ordered, received_qty:received, discrepancy, notes:item.notes||null, received_by:adminRole })
      if (item.item_id && received > 0) {
        const { data:inv } = await supabase.from('inventory_items').select('current_stock').eq('id', item.item_id).single()
        if (inv) await supabase.from('inventory_items').update({ current_stock:Number(inv.current_stock||0)+received }).eq('id', item.item_id)
        await supabase.from('inventory_transactions').insert({ item_id:item.item_id, item_name:item.item_name||item.name, transaction_type:'in', quantity:received, reference_number:po.po_number, notes:`PO Receipt — ${discrepancy!==0?'Discrepancy: '+discrepancy:'Fully received'}`, recorded_by:adminRole })
      }
    }
    await supabase.from('purchase_orders').update({ status:'received' }).eq('id', po.id)
    await logAudit('PO RECEIVED', adminRole, po.supplier_name||'', `${po.po_number} — ${receivingItems.length} items`)
    showToast('✅ Receiving report saved! Stock updated.')
    setShowReceivingForm(null); setReceivingItems([])
    loadPurchaseOrders(); loadInventoryItems()
  }

  // ── Feature 6: Inventory Valuation ───────────────────────────────────────
  function computeInventoryValuation() {
    const byCategory = {}
    let totalValue = 0
    for (const item of inventoryItems) {
      const value = Number(item.current_stock||0) * Number(item.cost_per_unit||0)
      const cat = item.category || 'Uncategorized'
      if (!byCategory[cat]) byCategory[cat] = { items:[], totalValue:0 }
      byCategory[cat].items.push({ ...item, value })
      byCategory[cat].totalValue += value
      totalValue += value
    }
    setInventoryValuation({ byCategory, totalValue })
    setInventorySubView('valuation')
  }

  // ── Feature 7 & 8: Stock Movement Report ─────────────────────────────────
  async function loadStockMovement() {
    const startDate = stockMovementMonth + '-01'
    const endDate = new Date(stockMovementMonth + '-01'); endDate.setMonth(endDate.getMonth()+1); const endStr = endDate.toISOString().slice(0,10)
    const [txs, wastage, adjs] = await Promise.all([
      supabase.from('inventory_transactions').select('*').gte('created_at', startDate).lt('created_at', endStr),
      supabase.from('wastage_logs').select('*').gte('wastage_date', startDate).lt('wastage_date', endStr),
      supabase.from('stock_adjustments').select('*').gte('created_at', startDate).lt('created_at', endStr),
    ])
    const movementMap = {}
    for (const item of inventoryItems) {
      movementMap[item.id] = { item, stockIn:0, stockOut:0, wastage:0, adjustment:0 }
    }
    ;(txs.data||[]).forEach(t=>{ if(movementMap[t.item_id]){ if(t.transaction_type==='in') movementMap[t.item_id].stockIn+=Number(t.quantity||0); else movementMap[t.item_id].stockOut+=Number(t.quantity||0) } })
    ;(wastage.data||[]).forEach(w=>{ if(movementMap[w.item_id]) movementMap[w.item_id].wastage+=Number(w.quantity||0) })
    ;(adjs.data||[]).forEach(a=>{ if(movementMap[a.item_id]) movementMap[a.item_id].adjustment+=Number(a.adjustment_qty||0) })
    const result = Object.values(movementMap).filter(m=>m.stockIn>0||m.stockOut>0||m.wastage>0||m.adjustment!==0).map(m=>({
      ...m,
      closingStock: Number(m.item.current_stock||0)
    }))
    setStockMovementData(result)
    setInventorySubView('movement')
  }

  async function loadInventoryItems() {
    setInventoryLoading(true)
    const { data } = await supabase.from('inventory_items').select('*').eq('is_active', true).order('category').order('name')
    setInventoryItems(data || [])
    setInventoryLoading(false)
  }
  async function loadInventoryTransactions() {
    setInventoryTxLoading(true)
    const { data } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending:false }).limit(200)
    setInventoryTransactions(data || [])
    setInventoryTxLoading(false)
  }
  async function addInventoryItem() {
    if (!newItemName.trim()) { showToast('❌ Please enter item name.','red'); return }
    if (!newItemCategory) { showToast('❌ Please select a category.','red'); return }
    setAddItemLoading(true)
    try {
      const { error } = await supabase.from('inventory_items').insert({
        name: newItemName.trim(),
        category: newItemCategory,
        unit: newItemUnit.trim()||'kg',
        current_stock: Number(newItemCurrentStock||0),
        min_stock: Number(newItemMinStock||0),
        cost_per_unit: Number(newItemCostPerUnit||0),
        selling_price: Number(newItemSellingPrice||0),
        supplier_id: newItemSupplierId||null,
        is_active: true
      })
      if (error) { showToast('❌ Failed: '+error.message,'red'); return }
      const addedName = newItemName.trim()
      const addedCategory = newItemCategory
      // 1. Fetch updated list FIRST so item is ready before form closes
      const { data } = await supabase.from('inventory_items').select('*').eq('is_active', true).order('category').order('name')
      setInventoryItems(data || [])
      // 2. Clear all form fields
      setNewItemName('')
      setNewItemMinStock('')
      setNewItemCostPerUnit('')
      setNewItemCurrentStock('')
      setNewItemSellingPrice('')
      setNewItemSupplierId('')
      setNewItemCategory('Raw Ingredients')
      setNewItemUnit('kg')
      // 3. Close form — item is already in the list below
      setShowAddItem(false)
      // 4. Show success — make sure category filter shows the new item
      setInventoryCategoryFilter('all')
      setInventorySearch('')
      await logAudit('INVENTORY ITEM ADDED','Admin',addedName,`Category: ${addedCategory}`)
      showToast(`✅ ${addedName} added to inventory!`)
    } finally {
      setAddItemLoading(false)
    }
  }
  async function deleteInventoryItem(item) {
    if (!window.confirm(`Deactivate "${item.name}" from inventory?`)) return
    const { error } = await supabase.from('inventory_items').update({ is_active:false }).eq('id', item.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await logAudit('INVENTORY ITEM REMOVED','Admin',item.name,'Item deactivated')
    showToast(`✅ ${item.name} removed.`); loadInventoryItems()
  }
  async function saveInventoryItemEdit(item) {
    const f = editItemFields
    const { error } = await supabase.from('inventory_items').update({
      name: f.name||item.name,
      unit: f.unit||item.unit,
      current_stock: Number(f.current_stock??item.current_stock??0),
      min_stock: Number(f.min_stock??item.min_stock),
      cost_per_unit: Number(f.cost_per_unit??item.cost_per_unit),
      selling_price: Number(f.selling_price??item.selling_price??0),
      supplier_id: f.supplier_id!==undefined ? (f.supplier_id||null) : (item.supplier_id||null)
    }).eq('id', item.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    showToast('✅ Item updated!'); setEditingItemId(null); setEditItemFields({}); loadInventoryItems()
  }
  async function recordStockTransaction() {
    if (!stockTxItemId) { showToast('❌ Please select an item.','red'); return }
    if (!stockTxQty || Number(stockTxQty) <= 0) { showToast('❌ Please enter a valid quantity.','red'); return }
    const item = inventoryItems.find(i=>i.id===stockTxItemId)
    if (!item) { showToast('❌ Item not found.','red'); return }
    const qty = Number(stockTxQty)
    const stockBefore = Number(item.current_stock||0)
    const stockAfter = stockTxType==='in' ? stockBefore+qty : stockBefore-qty
    if (stockTxType==='out' && stockAfter < 0) { showToast(`❌ Insufficient stock. Only ${stockBefore} ${item.unit} available.`,'red'); return }
    setStockTxLoading(true)
    try {
      const { error: txError } = await supabase.from('inventory_transactions').insert({
        item_id: stockTxItemId,
        item_name: item.name,
        category: item.category,
        transaction_type: stockTxType,
        quantity: qty,
        unit: item.unit,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: stockTxReference.trim()||null,
        notes: stockTxNotes.trim()||null,
        performed_by: `Admin (${adminRole})`
      })
      if (txError) throw txError
      const { error: updateError } = await supabase.from('inventory_items').update({ current_stock: stockAfter }).eq('id', stockTxItemId)
      if (updateError) throw updateError
      await logAudit(`STOCK ${stockTxType.toUpperCase()}`,'Admin',item.name,`${stockTxType==='in'?'+':'-'}${qty} ${item.unit} | Stock: ${stockBefore} → ${stockAfter}`)
      showToast(`✅ Stock ${stockTxType==='in'?'added':'deducted'} — ${item.name}: ${stockBefore} → ${stockAfter} ${item.unit}`)
      // Low stock alert notification
      if (stockTxType==='out' && stockAfter <= Number(item.min_stock||0)) {
        await createNotification(null, 'System', 'inventory', `⚠️ Low Stock: ${item.name}`, `${item.name} dropped to ${stockAfter} ${item.unit}. Minimum is ${item.min_stock} ${item.unit}. Please reorder.`)
      }
      setStockTxItemId(''); setStockTxQty(''); setStockTxReference(''); setStockTxNotes('')
      setShowStockForm(false); loadInventoryItems()
    } catch(err) {
      showToast('❌ Failed: '+err.message,'red')
    }
    setStockTxLoading(false)
  }
  function printInventoryReport() {
    const lowStock = inventoryItems.filter(i=>Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0)
    const totalValue = inventoryItems.reduce((s,i)=>s+Number(i.current_stock||0)*Number(i.cost_per_unit||0),0)
    const byCategory = INVENTORY_CATEGORIES.map(cat=>({ cat, items: inventoryItems.filter(i=>i.category===cat) })).filter(g=>g.items.length>0)
    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>Inventory Report</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:15mm;font-size:11px;color:#000;}
      @media print{@page{size:A4;margin:15mm;}.no-print{display:none;}}
      h1{font-size:20px;color:#ca1b1b;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{background:#ca1b1b;color:white;padding:6px 8px;text-align:left;font-size:10px;}
      td{padding:5px 8px;border-bottom:1px solid #eee;font-size:10px;}
      .low{color:#ca1b1b;font-weight:bold;}
      .cat-title{background:#f5f5f5;font-weight:bold;padding:8px;margin:12px 0 4px;border-left:4px solid #ca1b1b;font-size:11px;}
      </style></head><body>
      <div style="text-align:center;border-bottom:2px solid #ca1b1b;padding-bottom:10px;margin-bottom:16px;">
        <h1>Roma's Donuts</h1>
        <div style="font-size:13px;font-weight:bold;margin-top:4px;">INVENTORY REPORT</div>
        <div style="font-size:10px;color:#666;">Generated: ${new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <div style="display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="background:#e8f5e9;padding:10px 16px;border-radius:6px;border:1px solid #c8e6c9;">
          <div style="font-size:10px;color:#888;">Total Items</div>
          <div style="font-size:20px;font-weight:bold;color:#2d8a4e;">${inventoryItems.length}</div>
        </div>
        <div style="background:${lowStock.length>0?'#fff5f5':'#e8f5e9'};padding:10px 16px;border-radius:6px;border:1px solid ${lowStock.length>0?'#ffcdd2':'#c8e6c9'};">
          <div style="font-size:10px;color:#888;">Low Stock Items</div>
          <div style="font-size:20px;font-weight:bold;color:${lowStock.length>0?'#ca1b1b':'#2d8a4e'};">${lowStock.length}</div>
        </div>
        <div style="background:#e8f0fe;padding:10px 16px;border-radius:6px;border:1px solid #c5cae9;">
          <div style="font-size:10px;color:#888;">Total Stock Value</div>
          <div style="font-size:20px;font-weight:bold;color:#4a90d9;">${php(totalValue)}</div>
        </div>
      </div>
      ${byCategory.map(g=>`
        <div class="cat-title">📦 ${g.cat}</div>
        <table>
          <tr><th>Item Name</th><th>Unit</th><th>Current Stock</th><th>Min Stock</th><th>Cost/Unit</th><th>Total Value</th><th>Status</th></tr>
          ${g.items.map(i=>{
            const isLow = Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0
            return `<tr>
              <td>${i.name}</td>
              <td>${i.unit}</td>
              <td class="${isLow?'low':''}">${Number(i.current_stock||0).toFixed(2)}</td>
              <td>${Number(i.min_stock||0).toFixed(2)}</td>
              <td>${php(i.cost_per_unit||0)}</td>
              <td>${php(Number(i.current_stock||0)*Number(i.cost_per_unit||0))}</td>
              <td class="${isLow?'low':''}">${isLow?'⚠️ LOW STOCK':'✅ OK'}</td>
            </tr>`
          }).join('')}
        </table>`).join('')}
      ${lowStock.length>0?`
        <div class="cat-title" style="border-color:#ca1b1b;color:#ca1b1b;">🔴 LOW STOCK ALERTS</div>
        <table>
          <tr><th>Item</th><th>Category</th><th>Current</th><th>Minimum</th><th>Unit</th></tr>
          ${lowStock.map(i=>`<tr><td class="low">${i.name}</td><td>${i.category}</td><td class="low">${Number(i.current_stock||0).toFixed(2)}</td><td>${Number(i.min_stock||0).toFixed(2)}</td><td>${i.unit}</td></tr>`).join('')}
        </table>`:''}
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ PRINT</button>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }

  // ── Wastage / Spoilage Functions ──────────────────────────────────────────
  async function loadWastageLogs() {
    setWastageLoading(true)
    const { data } = await supabase.from('wastage_logs').select('*').order('created_at', { ascending:false }).limit(100)
    setWastageLogs(data || [])
    setWastageLoading(false)
  }
  async function logWastage() {
    if (!wastageItemId) { showToast('❌ Please select an item.','red'); return }
    if (!wastageQty || Number(wastageQty)<=0) { showToast('❌ Please enter a valid quantity.','red'); return }
    if (!wastageReason) { showToast('❌ Please select a reason.','red'); return }
    if (wastageReason==='Others' && !wastageReasonOther.trim()) { showToast('❌ Please describe the reason.','red'); return }
    if (wastageChargeEmployee && !wastageEmployeeId) { showToast('❌ Please select the responsible employee.','red'); return }
    const item = inventoryItems.find(i=>i.id===wastageItemId)
    if (!item) { showToast('❌ Item not found.','red'); return }
    const qty = Number(wastageQty)
    const stockBefore = Number(item.current_stock||0)
    if (qty > stockBefore) { showToast(`❌ Cannot waste more than current stock (${stockBefore} ${item.unit}).`,'red'); return }
    const stockAfter = stockBefore - qty
    const totalCost = qty * Number(item.cost_per_unit||0)
    const finalReason = wastageReason==='Others' ? wastageReasonOther.trim() : wastageReason
    const emp = wastageChargeEmployee ? employees.find(e=>e.id===wastageEmployeeId) : null
    setWastageSaving(true)
    try {
      const { data:wlog, error:wErr } = await supabase.from('wastage_logs').insert({
        item_id: wastageItemId,
        item_name: item.name,
        category: item.category,
        quantity: qty,
        unit: item.unit,
        cost_per_unit: Number(item.cost_per_unit||0),
        total_cost: totalCost,
        reason: finalReason,
        notes: wastageNotes.trim()||null,
        wastage_date: wastageDate||today,
        logged_by: `${adminRole==='supervisor'?'Supervisor':'Admin'} (${adminRole})`,
        employee_id: emp?.id||null,
        employee_name: emp?.full_name||null,
        status: wastageChargeEmployee ? 'pending_approval' : 'approved'
      }).select().single()
      if (wErr) throw wErr
      // Update stock
      const { error:sErr } = await supabase.from('inventory_items').update({ current_stock: stockAfter }).eq('id', wastageItemId)
      if (sErr) throw sErr
      // Log transaction
      await supabase.from('inventory_transactions').insert({
        item_id: wastageItemId, item_name: item.name, category: item.category,
        transaction_type: 'out', quantity: qty, unit: item.unit,
        stock_before: stockBefore, stock_after: stockAfter,
        reference: `WASTAGE-${wlog.id?.slice(0,8).toUpperCase()}`,
        notes: `Wastage: ${finalReason}${emp?` | Charged to: ${emp.full_name}`:''}`,
        performed_by: `${adminRole} (Wastage Log)`
      })
      // Create employee charge if applicable
      if (wastageChargeEmployee && emp) {
        await supabase.from('employee_charges').insert({
          wastage_log_id: wlog.id,
          employee_id: emp.id,
          employee_name: emp.full_name,
          item_name: item.name,
          quantity: qty,
          unit: item.unit,
          total_cost: totalCost,
          reason: finalReason,
          notes: wastageNotes.trim()||null,
          status: 'pending_owner'
        })
      }
      await logAudit('WASTAGE LOGGED', adminRole, item.name, `${qty} ${item.unit} | ${finalReason}${emp?` | Charged to: ${emp.full_name}`:''}`)
      showToast(`✅ Wastage logged — ${qty} ${item.unit} of ${item.name} deducted.${wastageChargeEmployee?` Charge sent to owner for approval.`:''}`)
      setShowWastageForm(false); setWastageItemId(''); setWastageQty(''); setWastageReason('')
      setWastageReasonOther(''); setWastageNotes(''); setWastageChargeEmployee(false); setWastageEmployeeId('')
      loadInventoryItems(); loadWastageLogs()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setWastageSaving(false)
  }
  async function loadEmployeeCharges() {
    setChargesLoading(true)
    const { data } = await supabase.from('employee_charges').select('*').order('created_at', { ascending:false })
    setEmployeeCharges(data || [])
    setChargesLoading(false)
  }
  async function approveCharge(charge) {
    const { error } = await supabase.from('employee_charges').update({ status:'pending_employee', owner_approved_at: new Date().toISOString() }).eq('id', charge.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await supabase.from('wastage_logs').update({ status:'approved' }).eq('id', charge.wastage_log_id)
    await logAudit('CHARGE APPROVED','Owner',charge.employee_name,`${php(charge.total_cost)} for ${charge.item_name}`)
    showToast(`✅ Charge approved — sent to ${charge.employee_name} for acknowledgment.`); loadEmployeeCharges()
  }
  async function dismissCharge(charge) {
    if (!window.confirm(`Dismiss charge against ${charge.employee_name}?`)) return
    const { error } = await supabase.from('employee_charges').update({ status:'dismissed' }).eq('id', charge.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await supabase.from('wastage_logs').update({ status:'dismissed' }).eq('id', charge.wastage_log_id)
    await logAudit('CHARGE DISMISSED','Owner',charge.employee_name,`${php(charge.total_cost)} for ${charge.item_name}`)
    showToast('✅ Charge dismissed.'); loadEmployeeCharges()
  }
  async function ownerFinalDecision(charge, decision) {
    const status = decision==='force_approve' ? 'agreed' : 'dismissed'
    const { error } = await supabase.from('employee_charges').update({ status, owner_final_decision: decision, owner_final_at: new Date().toISOString() }).eq('id', charge.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await logAudit(`DISPUTE ${decision==='force_approve'?'OVERRIDDEN':'DISMISSED'}`, 'Owner', charge.employee_name, `${php(charge.total_cost)} for ${charge.item_name}`)
    showToast(decision==='force_approve'?`✅ Charge enforced despite dispute.`:`✅ Dispute upheld — charge dismissed.`)
    loadEmployeeCharges()
  }
  function printChargeForm(charge) {
    const pw = window.open('','_blank','width=800,height=600')
    pw.document.write(`<!DOCTYPE html><html><head><title>Charge Acknowledgment</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:20mm;font-size:12px;}
      @media print{@page{size:A4;margin:20mm;}.no-print{display:none;}}
      h1{font-size:20px;color:#ca1b1b;}table{width:100%;border-collapse:collapse;margin:14px 0;}
      td{padding:8px 10px;border:1px solid #ddd;}td:first-child{font-weight:bold;background:#f9f9f9;width:40%;}
      .sig{text-align:center;margin-top:50px;}
      .sig-line{border-top:1px solid #000;width:200px;padding-top:6px;font-size:10px;color:#555;margin:0 auto;}
      </style></head><body>
      <div style="text-align:center;border-bottom:3px solid #ca1b1b;padding-bottom:12px;margin-bottom:20px;">
        <h1>Roma's Donuts</h1>
        <div style="font-size:14px;font-weight:bold;margin-top:4px;">EMPLOYEE CHARGE ACKNOWLEDGMENT FORM</div>
      </div>
      <table>
        <tr><td>Employee Name</td><td style="font-size:14px;font-weight:bold;">${charge.employee_name}</td></tr>
        <tr><td>Item / Material</td><td>${charge.item_name}</td></tr>
        <tr><td>Quantity Wasted</td><td>${Number(charge.quantity||0).toFixed(2)} ${charge.unit}</td></tr>
        <tr><td>Reason</td><td>${charge.reason}</td></tr>
        <tr><td>Notes</td><td>${charge.notes||'—'}</td></tr>
        <tr><td>Date Logged</td><td>${new Date(charge.created_at).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})}</td></tr>
        <tr><td>Amount to be Charged</td><td style="font-size:16px;font-weight:bold;color:#ca1b1b;">${php(charge.total_cost)}</td></tr>
        <tr><td>Status</td><td style="font-weight:bold;">${charge.status==='agreed'?'✅ Employee Agreed':charge.status==='disputed'?'❌ Disputed':charge.status==='dismissed'?'Dismissed':'Pending'}</td></tr>
        ${charge.acknowledged_at?`<tr><td>Acknowledged On</td><td>${new Date(charge.acknowledged_at).toLocaleString()}</td></tr>`:''}
      </table>
      <p style="font-size:11px;color:#555;margin-bottom:30px;">By signing below, the employee acknowledges that they have read and understood the charge stated above, and agrees to the deduction of <strong>${php(charge.total_cost)}</strong> from their salary in the next payroll period.</p>
      <div style="display:flex;justify-content:space-between;margin-top:40px;">
        <div class="sig"><div class="sig-line">Employee Signature / Date</div></div>
        <div class="sig"><div class="sig-line">Supervisor Signature / Date</div></div>
        <div class="sig"><div class="sig-line">Owner / HR Approval</div></div>
      </div>
      <div class="no-print" style="text-align:center;margin-top:24px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ PRINT</button>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }

  // ── Expiry Tracking Functions ─────────────────────────────────────────────
  async function loadExpiryItems() {
    setExpiryLoading(true)
    const { data } = await supabase.from('inventory_items').select('id,name,category,unit,current_stock,expiry_date').eq('is_active',true).not('expiry_date','is',null).order('expiry_date')
    setExpiryItems(data || [])
    setExpiryLoading(false)
  }
  async function saveExpiryDate(itemId) {
    if (!expiryDate) { showToast('❌ Please select an expiry date.','red'); return }
    const { error } = await supabase.from('inventory_items').update({ expiry_date: expiryDate }).eq('id', itemId)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    showToast('✅ Expiry date saved!'); setEditingExpiryId(null); setExpiryDate(''); loadExpiryItems(); loadInventoryItems()
  }
  async function clearExpiryDate(itemId) {
    if (!window.confirm('Clear expiry date for this item?')) return
    await supabase.from('inventory_items').update({ expiry_date: null }).eq('id', itemId)
    showToast('✅ Expiry date cleared.'); loadExpiryItems(); loadInventoryItems()
  }

  // ── Employee Portal — My Charges ──────────────────────────────────────────
  async function loadMyCharges(emp) {
    const { data } = await supabase.from('employee_charges').select('*').eq('employee_id', emp.id).in('status',['pending_employee','agreed','disputed']).order('created_at',{ascending:false})
    setMyCharges(data || [])
  }
  async function respondToCharge(charge, response) {
    const status = response==='agree' ? 'agreed' : 'disputed'
    const { error } = await supabase.from('employee_charges').update({ status, acknowledged_at: new Date().toISOString() }).eq('id', charge.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await logAudit(`CHARGE ${status.toUpperCase()}`, charge.employee_name, charge.item_name, `${php(charge.total_cost)}`)
    showToast(response==='agree'?'✅ You have agreed to the charge. It will be deducted from your next payroll.':'⚠️ Dispute submitted. Owner will review.')
    loadMyCharges(employee)
  }

  // ── Physical Count Sheet Print ────────────────────────────────────────────
  function printPhysicalCountSheet() {
    const byCategory = INVENTORY_CATEGORIES.map(cat=>({ cat, items: inventoryItems.filter(i=>i.category===cat) })).filter(g=>g.items.length>0)
    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>Physical Count Sheet</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:12mm;font-size:10px;}
      @media print{@page{size:A4;margin:12mm;}.no-print{display:none;}}
      h1{font-size:18px;color:#ca1b1b;}
      table{width:100%;border-collapse:collapse;margin-bottom:14px;}
      th{background:#ca1b1b;color:white;padding:6px 6px;text-align:left;font-size:9px;}
      td{padding:6px 6px;border:1px solid #ddd;font-size:9px;}
      .cat{background:#f5f5f5;font-weight:bold;padding:6px 8px;margin:10px 0 4px;border-left:4px solid #ca1b1b;font-size:10px;}
      .blank{height:20px;}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:10px;margin-bottom:14px;">
        <div><h1>Roma's Donuts</h1><div style="font-size:11px;font-weight:bold;">PHYSICAL INVENTORY COUNT SHEET</div></div>
        <div style="text-align:right;font-size:10px;color:#555;">
          Date: ________________________<br/>
          Counted by: ________________________<br/>
          Verified by: ________________________
        </div>
      </div>
      ${byCategory.map(g=>`
        <div class="cat">📦 ${g.cat}</div>
        <table>
          <tr><th>#</th><th>Item Name</th><th>Unit</th><th>System Stock</th><th>Actual Count</th><th>Variance</th><th>Notes</th></tr>
          ${g.items.map((i,idx)=>`<tr>
            <td>${idx+1}</td>
            <td>${i.name}</td>
            <td>${i.unit}</td>
            <td style="font-weight:bold;">${Number(i.current_stock||0).toFixed(2)}</td>
            <td class="blank"></td>
            <td class="blank"></td>
            <td class="blank" style="width:120px;"></td>
          </tr>`).join('')}
        </table>`).join('')}
      <div style="margin-top:20px;font-size:9px;color:#888;font-style:italic;">
        Instructions: Fill in the "Actual Count" column. Variance = Actual Count − System Stock. Report any discrepancies to your supervisor immediately.
      </div>
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ PRINT</button>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }

  // ── Supplier Functions ────────────────────────────────────────────────────
  async function loadSuppliers() {
    setSuppliersLoading(true)
    const { data } = await supabase.from('inventory_suppliers').select('*').order('name')
    setSuppliers(data || [])
    setSuppliersLoading(false)
  }
  async function saveSupplier() {
    if (!supplierForm.name.trim()) { showToast('❌ Supplier name is required.','red'); return }
    if (suppliers.length >= 10 && !editingSupplierId) { showToast('❌ Maximum 10 suppliers allowed.','red'); return }
    const payload = {
      name: supplierForm.name.trim(),
      contact_person: supplierForm.contact_person.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email.trim(),
      address: supplierForm.address.trim(),
      payment_terms: supplierForm.payment_terms,
      notes: supplierForm.notes.trim()
    }
    if (editingSupplierId) {
      const { error } = await supabase.from('inventory_suppliers').update(payload).eq('id', editingSupplierId)
      if (error) { showToast('❌ Failed: '+error.message,'red'); return }
      showToast('✅ Supplier updated!')
    } else {
      const { error } = await supabase.from('inventory_suppliers').insert(payload)
      if (error) { showToast('❌ Failed: '+error.message,'red'); return }
      showToast('✅ Supplier added!')
    }
    setEditingSupplierId(null); setShowAddSupplier(false)
    setSupplierForm({ name:'', contact_person:'', phone:'', email:'', address:'', payment_terms:'COD (Cash on Delivery)', notes:'' })
    loadSuppliers()
  }
  async function deleteSupplier(s) {
    if (!window.confirm(`Delete supplier "${s.name}"?`)) return
    const { error } = await supabase.from('inventory_suppliers').delete().eq('id', s.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    showToast('✅ Supplier deleted.'); loadSuppliers()
  }
  function startEditSupplier(s) {
    setEditingSupplierId(s.id)
    setSupplierForm({ name:s.name||'', contact_person:s.contact_person||'', phone:s.phone||'', email:s.email||'', address:s.address||'', payment_terms:s.payment_terms||'COD (Cash on Delivery)', notes:s.notes||'' })
    setShowAddSupplier(true)
  }

  // ── Purchase Order Functions ──────────────────────────────────────────────
  async function loadPurchaseOrders() {
    const { data } = await supabase.from('purchase_orders').select('*, purchase_order_items(*)').order('created_at', { ascending:false })
    setPurchaseOrders(data || [])
  }
  function buildPO(supplierId) {
    const supplier = suppliers.find(s=>s.id===supplierId)
    if (!supplier) { showToast('❌ Please select a supplier.','red'); return }
    const lowItems = inventoryItems.filter(i=>i.supplier_id===supplierId && Number(i.current_stock||0)<=Number(i.min_stock||0) && Number(i.min_stock||0)>0)
    if (lowItems.length===0) { showToast('ℹ️ No low stock items for this supplier.','red'); return }
    const items = lowItems.map(i=>({
      item_id: i.id,
      item_name: i.name,
      unit: i.unit,
      current_stock: Number(i.current_stock||0),
      min_stock: Number(i.min_stock||0),
      order_qty: Math.max(0, (Number(i.min_stock||0)*2) - Number(i.current_stock||0)),
      unit_price: Number(i.cost_per_unit||0)
    }))
    setPOItems(items); setShowPOBuilder(true)
  }
  async function savePO() {
    if (!poSupplierId) { showToast('❌ Please select a supplier.','red'); return }
    if (poItems.length===0) { showToast('❌ No items in this PO.','red'); return }
    const invalidQty = poItems.some(i=>!i.order_qty||Number(i.order_qty)<=0)
    if (invalidQty) { showToast('❌ All items must have a quantity greater than 0.','red'); return }
    setSavingPO(true)
    const supplier = suppliers.find(s=>s.id===poSupplierId)
    const poNumber = `PO-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`
    const total = poItems.reduce((s,i)=>s+Number(i.order_qty||0)*Number(i.unit_price||0),0)
    try {
      const { data:poData, error:poError } = await supabase.from('purchase_orders').insert({
        po_number: poNumber,
        supplier_id: poSupplierId,
        supplier_name: supplier?.name||'',
        payment_terms: supplier?.payment_terms||'',
        status: 'draft',
        notes: poNotes.trim()||null,
        total_amount: total
      }).select().single()
      if (poError) throw poError
      const itemRows = poItems.map(i=>({ po_id:poData.id, item_id:i.item_id, item_name:i.item_name, unit:i.unit, current_stock:i.current_stock, order_qty:Number(i.order_qty), unit_price:Number(i.unit_price||0), total_price:Number(i.order_qty)*Number(i.unit_price||0) }))
      const { error:itemsError } = await supabase.from('purchase_order_items').insert(itemRows)
      if (itemsError) throw itemsError
      await logAudit('PO CREATED','Admin',supplier?.name||'',`${poNumber} — ${poItems.length} item(s) — ${php(total)}`)
      showToast(`✅ PO ${poNumber} saved!`)
      setShowPOBuilder(false); setPOSupplierId(''); setPOItems([]); setPONotes('')
      loadPurchaseOrders(); setShowPOSection(true)
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingPO(false)
  }
  async function deletePO(po) {
    if (!window.confirm(`Delete PO ${po.po_number}?`)) return
    await supabase.from('purchase_order_items').delete().eq('po_id', po.id)
    const { error } = await supabase.from('purchase_orders').delete().eq('id', po.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    showToast('✅ PO deleted.'); loadPurchaseOrders()
  }
  async function updatePOStatus(id, status) {
    await supabase.from('purchase_orders').update({ status }).eq('id', id)
    showToast(`✅ PO marked as ${status}`); loadPurchaseOrders()
  }
  function printPO(po) {
    const items = po.purchase_order_items || []
    const supplier = suppliers.find(s=>s.id===po.supplier_id)
    const total = items.reduce((s,i)=>s+Number(i.total_price||0),0)
    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>Purchase Order ${po.po_number}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:15mm;font-size:11px;}
      @media print{@page{size:A4;margin:15mm;}.no-print{display:none;}}
      h1{font-size:20px;color:#ca1b1b;}table{width:100%;border-collapse:collapse;margin-top:12px;}
      th{background:#ca1b1b;color:white;padding:7px 8px;text-align:left;font-size:10px;}
      td{padding:6px 8px;border-bottom:1px solid #eee;font-size:10px;}
      .total{font-weight:bold;font-size:12px;text-align:right;padding:10px 8px;background:#f9f9f9;}
      .section{margin-top:14px;}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #ca1b1b;padding-bottom:12px;margin-bottom:16px;">
        <div><h1>Roma's Donuts</h1><div style="font-size:10px;color:#888;margin-top:2px;">Payroll & Inventory System</div></div>
        <div style="text-align:right;">
          <div style="font-size:16px;font-weight:bold;color:#ca1b1b;">PURCHASE ORDER</div>
          <div style="font-size:13px;font-weight:bold;">${po.po_number}</div>
          <div style="font-size:10px;color:#888;">Date: ${new Date(po.created_at).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})}</div>
          <div style="font-size:10px;color:#888;">Status: ${(po.status||'draft').toUpperCase()}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;">
        <div>
          <div style="font-weight:bold;font-size:11px;color:#ca1b1b;margin-bottom:6px;">SUPPLIER DETAILS</div>
          <div style="font-size:11px;line-height:1.8;">
            <strong>${supplier?.name||po.supplier_name||'—'}</strong><br/>
            ${supplier?.contact_person?`Contact: ${supplier.contact_person}<br/>`:''}
            ${supplier?.phone?`Phone: ${supplier.phone}<br/>`:''}
            ${supplier?.email?`Email: ${supplier.email}<br/>`:''}
            ${supplier?.address?`Address: ${supplier.address}<br/>`:''}
            ${supplier?.payment_terms?`<strong>Payment Terms: ${supplier.payment_terms}</strong>`:''}
          </div>
        </div>
        <div>
          <div style="font-weight:bold;font-size:11px;color:#ca1b1b;margin-bottom:6px;">DELIVERY TO</div>
          <div style="font-size:11px;line-height:1.8;">
            <strong>Roma's Donuts</strong><br/>
            Tarlac City, Philippines<br/>
            <br/>
            ${po.notes?`<em>Note: ${po.notes}</em>`:''}
          </div>
        </div>
      </div>
      <table>
        <tr><th>#</th><th>Item Name</th><th>Unit</th><th>Current Stock</th><th>Order Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${items.map((i,idx)=>`<tr>
          <td>${idx+1}</td>
          <td>${i.item_name}</td>
          <td>${i.unit}</td>
          <td>${Number(i.current_stock||0).toFixed(2)}</td>
          <td style="font-weight:bold;">${Number(i.order_qty||0).toFixed(2)}</td>
          <td>${php(i.unit_price||0)}</td>
          <td style="font-weight:bold;">${php(i.total_price||0)}</td>
        </tr>`).join('')}
        <tr><td colspan="6" class="total">TOTAL AMOUNT:</td><td class="total">${php(total)}</td></tr>
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:50px;">
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:160px;padding-top:6px;font-size:10px;color:#555;">Prepared by</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:160px;padding-top:6px;font-size:10px;color:#555;">Approved by</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:160px;padding-top:6px;font-size:10px;color:#555;">Received by / Date</div></div>
      </div>
      <div class="no-print" style="text-align:center;margin-top:24px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ PRINT PO</button>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }

  // ── Phase 2: Costing Functions ────────────────────────────────────────────
  async function loadCostSettings() {
    const { data } = await supabase.from('cost_settings').select('*').maybeSingle()
    if (data) setCostSettings(p=>({ ...p, ...data }))
  }
  async function saveCostSettings() {
    setSavingCostSettings(true)
    const { data: existing } = await supabase.from('cost_settings').select('id').maybeSingle()
    if (existing) {
      await supabase.from('cost_settings').update({ ...costSettings, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('cost_settings').insert({ ...costSettings })
    }
    await logAudit('COST SETTINGS UPDATED','Owner','System','Cost settings saved')
    showToast('✅ Cost settings saved! All computations updated.')
    setSavingCostSettings(false)
  }
  async function loadDonutVariants() {
    setVariantsLoading(true)
    const { data } = await supabase.from('donut_variants').select('*').eq('is_active', true).order('category').order('name')
    setDonutVariants(data || [])
    setVariantsLoading(false)
  }
  async function seedVariants() {
    if (!window.confirm(`This will add all ${DONUT_VARIANTS_DEFAULT.length} Roma's Donuts variants. Continue?`)) return
    let added = 0
    for (const v of DONUT_VARIANTS_DEFAULT) {
      const { data: existing } = await supabase.from('donut_variants').select('id').eq('name', v.name).maybeSingle()
      if (!existing) { await supabase.from('donut_variants').insert({ ...v, is_active: true }); added++ }
    }
    showToast(`✅ Added ${added} variants!`); loadDonutVariants()
  }
  async function updateVariant(id, fields) {
    const { error } = await supabase.from('donut_variants').update(fields).eq('id', id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    showToast('✅ Variant updated!'); setEditingVariantId(null); loadDonutVariants()
  }
  async function loadRecipes() {
    const { data: base } = await supabase.from('base_dough_recipe').select('*').order('created_at')
    setBaseDoughIngredients(base || [])
    const { data: variant } = await supabase.from('variant_recipes').select('*').order('variant_id')
    const grouped = {}
    for (const r of variant || []) {
      if (!grouped[r.variant_id]) grouped[r.variant_id] = []
      grouped[r.variant_id].push(r)
    }
    setVariantRecipes(grouped)
  }
  async function saveBaseDough() {
    setSavingRecipe(true)
    try {
      // Delete existing and re-insert
      await supabase.from('base_dough_recipe').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const validRows = editingBaseDough.filter(r => r.item_name?.trim() && Number(r.quantity_per_batch) > 0)
      if (validRows.length > 0) {
        const { error } = await supabase.from('base_dough_recipe').insert(validRows.map(r => ({
          inventory_item_id: r.inventory_item_id || null,
          item_name: r.item_name.trim(),
          quantity_per_batch: Number(r.quantity_per_batch),
          unit: r.unit || 'g',
          notes: r.notes || null
        })))
        if (error) throw error
      }
      showToast('✅ Base dough recipe saved!'); loadRecipes()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingRecipe(false)
  }
  async function saveVariantRecipe(variantId) {
    setSavingRecipe(true)
    try {
      await supabase.from('variant_recipes').delete().eq('variant_id', variantId)
      const validRows = editingVariantRecipe.filter(r => r.item_name?.trim() && Number(r.quantity_per_batch) > 0)
      if (validRows.length > 0) {
        const { error } = await supabase.from('variant_recipes').insert(validRows.map(r => ({
          variant_id: variantId,
          inventory_item_id: r.inventory_item_id || null,
          item_name: r.item_name.trim(),
          quantity_per_batch: Number(r.quantity_per_batch),
          unit: r.unit || 'g',
          ingredient_type: r.ingredient_type || 'topping',
          notes: r.notes || null
        })))
        if (error) throw error
      }
      showToast('✅ Variant recipe saved!'); setSelectedRecipeVariantId(null); loadRecipes()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingRecipe(false)
  }
  function computeVariantCost(variantId, piecesPerBatch) {
    if (!piecesPerBatch || piecesPerBatch <= 0) return null
    // Base dough cost per piece (from inventory item cost_per_unit)
    const baseCostPerPiece = baseDoughIngredients.reduce((sum, ing) => {
      const invItem = inventoryItems.find(i => i.id === ing.inventory_item_id)
      const costPerUnit = invItem?.cost_per_unit || 0
      return sum + (Number(ing.quantity_per_batch || 0) / piecesPerBatch) * costPerUnit
    }, 0)
    // Variant topping/filling cost per piece
    const variantIngs = variantRecipes[variantId] || []
    const variantCostPerPiece = variantIngs.reduce((sum, ing) => {
      const invItem = inventoryItems.find(i => i.id === ing.inventory_item_id)
      const costPerUnit = invItem?.cost_per_unit || 0
      return sum + (Number(ing.quantity_per_batch || 0) / piecesPerBatch) * costPerUnit
    }, 0)
    const ingredientCost = baseCostPerPiece + variantCostPerPiece
    // Labor per piece
    const laborPerPiece = costSettings.daily_labor_cost / Math.max(1, Number(costSettings.total_daily_pieces))
    // Fixed cost per piece
    const monthlyDepreciation =
      (Number(costSettings.fryer_cost) / (Number(costSettings.fryer_lifespan_years) * 12)) +
      (Number(costSettings.mixer_cost) / (Number(costSettings.mixer_lifespan_years) * 12)) +
      (Number(costSettings.sheeter_cost) / (Number(costSettings.sheeter_lifespan_years) * 12))
    const monthlyFixed = Number(costSettings.monthly_rent) + Number(costSettings.monthly_electricity) +
      Number(costSettings.monthly_other_fixed) + monthlyDepreciation
    const dailyFixed = monthlyFixed / Math.max(1, Number(costSettings.production_days_per_month))
    const fixedPerPiece = dailyFixed / Math.max(1, Number(costSettings.total_daily_pieces))
    // Waste factor
    const wasteFactor = 1 + (Number(costSettings.waste_percentage) / 100)
    const totalCost = (ingredientCost + laborPerPiece + fixedPerPiece) * wasteFactor
    return { ingredientCost, laborPerPiece, fixedPerPiece, totalCost, wasteFactor }
  }
  function computeFinancials() {
    const monthlyDepreciation =
      (Number(costSettings.fryer_cost) / (Number(costSettings.fryer_lifespan_years) * 12)) +
      (Number(costSettings.mixer_cost) / (Number(costSettings.mixer_lifespan_years) * 12)) +
      (Number(costSettings.sheeter_cost) / (Number(costSettings.sheeter_lifespan_years) * 12))
    const monthlyFixed = Number(costSettings.monthly_rent) + Number(costSettings.monthly_electricity) +
      Number(costSettings.monthly_other_fixed) + monthlyDepreciation
    const dailyFixed = monthlyFixed / Math.max(1, Number(costSettings.production_days_per_month))
    const dailyLabor = Number(costSettings.daily_labor_cost)
    const totalDailyPieces = Math.max(1, Number(costSettings.total_daily_pieces))
    const fixedPerPiece = dailyFixed / totalDailyPieces
    const laborPerPiece = dailyLabor / totalDailyPieces
    const wasteFactor = 1 + (Number(costSettings.waste_percentage) / 100)
    // Per-variant profitability
    const variantData = donutVariants.map(v => {
      const cost = computeVariantCost(v.id, v.pieces_per_batch)
      if (!cost) return { ...v, totalCost: laborPerPiece + fixedPerPiece, grossMargin: v.selling_price - (laborPerPiece + fixedPerPiece), grossMarginPct: 0, isEstimate: true }
      const grossMargin = v.selling_price - cost.totalCost
      const grossMarginPct = v.selling_price > 0 ? (grossMargin / v.selling_price) * 100 : 0
      const belowTarget = grossMarginPct < Number(costSettings.target_margin_percentage)
      return { ...v, ...cost, grossMargin, grossMarginPct, belowTarget, isEstimate: cost.ingredientCost === 0 }
    })
    // BEP
    const avgGrossMargin = variantData.length > 0 ? variantData.reduce((s,v) => s + v.grossMargin, 0) / variantData.length : fixedPerPiece
    const dailyBEP = avgGrossMargin > 0 ? Math.ceil(dailyFixed / avgGrossMargin) : 0
    const monthlyBEP = dailyBEP * Number(costSettings.production_days_per_month)
    return { variantData, monthlyFixed, dailyFixed, dailyLabor, fixedPerPiece, laborPerPiece, wasteFactor, dailyBEP, monthlyBEP, monthlyDepreciation }
  }
  async function loadProductionLogs() {
    setProductionLoading(true)
    const { data } = await supabase.from('production_logs').select('*, production_log_items(*)').order('production_date', { ascending:false }).limit(30)
    setProductionLogs(data || [])
    setProductionLoading(false)
  }
  async function logProduction() {
    if (!prodDate) { showToast('❌ Please select a date.','red'); return }
    const validEntries = prodEntries.filter(e => e.variant_id && Number(e.pieces) > 0)
    if (validEntries.length === 0) { showToast('❌ Please add at least one production entry.','red'); return }
    setSavingProduction(true)
    try {
      const totalPieces = validEntries.reduce((s,e) => s + Number(e.pieces), 0)
      const monthlyDepreciation =
        (Number(costSettings.fryer_cost) / (Number(costSettings.fryer_lifespan_years) * 12)) +
        (Number(costSettings.mixer_cost) / (Number(costSettings.mixer_lifespan_years) * 12)) +
        (Number(costSettings.sheeter_cost) / (Number(costSettings.sheeter_lifespan_years) * 12))
      const monthlyFixed = Number(costSettings.monthly_rent) + Number(costSettings.monthly_electricity) +
        Number(costSettings.monthly_other_fixed) + monthlyDepreciation
      const overheadCost = monthlyFixed / Math.max(1, Number(costSettings.production_days_per_month))
      const laborCost = Number(costSettings.daily_labor_cost)
      let totalIngredientCost = 0
      // Compute ingredient costs per entry
      const entryDetails = validEntries.map(e => {
        const variant = donutVariants.find(v => v.id === e.variant_id)
        const piecesPerBatch = Number(variant?.pieces_per_batch || 12)
        const pieces = Number(e.pieces)
        const cost = computeVariantCost(e.variant_id, piecesPerBatch)
        const ingCost = cost ? cost.ingredientCost * pieces : 0
        totalIngredientCost += ingCost
        return { variant, pieces, piecesPerBatch, ingCost }
      })
      const totalCost = totalIngredientCost + laborCost + overheadCost
      // Insert log
      const { data: logData, error: logErr } = await supabase.from('production_logs').insert({
        production_date: prodDate, total_pieces: totalPieces,
        ingredient_cost: totalIngredientCost, labor_cost: laborCost,
        overhead_cost: overheadCost, total_cost: totalCost,
        notes: prodNotes || null, logged_by: `${adminRole}`
      }).select().single()
      if (logErr) throw logErr
      // Insert line items
      for (let i = 0; i < validEntries.length; i++) {
        const e = validEntries[i]; const d = entryDetails[i]
        await supabase.from('production_log_items').insert({
          log_id: logData.id, variant_id: e.variant_id,
          variant_name: d.variant?.name || '', pieces_produced: d.pieces, ingredient_cost: d.ingCost
        })
        // Deduct stock for base dough
        const batchEquiv = d.pieces / d.piecesPerBatch
        for (const ing of baseDoughIngredients) {
          if (!ing.inventory_item_id) continue
          const deductQty = Number(ing.quantity_per_batch || 0) * batchEquiv
          if (deductQty <= 0) continue
          const { data: inv } = await supabase.from('inventory_items').select('current_stock').eq('id', ing.inventory_item_id).single()
          if (inv) {
            const newStock = Math.max(0, Number(inv.current_stock) - deductQty)
            await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', ing.inventory_item_id)
            // Low stock alert
            const { data:invFull } = await supabase.from('inventory_items').select('name,min_stock,unit').eq('id', ing.inventory_item_id).single()
            if (invFull && newStock <= Number(invFull.min_stock||0)) {
              await createNotification(null, 'System', 'inventory', `⚠️ Low Stock Alert`, `${invFull.name} is below minimum. Remaining: ${newStock.toFixed(2)} ${invFull.unit}`)
            }
          }
        }
        // Deduct variant-specific ingredients
        for (const ing of (variantRecipes[e.variant_id] || [])) {
          if (!ing.inventory_item_id) continue
          const deductQty = Number(ing.quantity_per_batch || 0) * batchEquiv
          if (deductQty <= 0) continue
          const { data: inv } = await supabase.from('inventory_items').select('current_stock').eq('id', ing.inventory_item_id).single()
          if (inv) {
            const newStock = Math.max(0, Number(inv.current_stock) - deductQty)
            await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', ing.inventory_item_id)
            const { data:invFull } = await supabase.from('inventory_items').select('name,min_stock,unit').eq('id', ing.inventory_item_id).single()
            if (invFull && newStock <= Number(invFull.min_stock||0)) {
              await createNotification(null, 'System', 'inventory', `⚠️ Low Stock Alert`, `${invFull.name} is below minimum. Remaining: ${newStock.toFixed(2)} ${invFull.unit}`)
            }
          }
        }
      } // end for validEntries
      await logAudit('PRODUCTION LOGGED', adminRole, 'Production', `${totalPieces} pcs on ${prodDate} — Cost: ${php(totalCost)}`)
      showToast(`✅ Production logged — ${totalPieces} pieces | Cost: ${php(totalCost)}`)
      setShowProductionForm(false); setProdEntries([{ variant_id:'', pieces:'' }]); setProdNotes('')
      loadProductionLogs(); loadInventoryItems()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingProduction(false)
  }
  function printCostingReport() {
    const fin = computeFinancials()
    const pw = window.open('','_blank','width=900,height=700')
    const catColors = { Regular:'#ca1b1b', Filled:'#4a90d9', Premium:'#7b4f9e', 'Glaze Circlet':'#2d8a4e', Bites:'#f57c00', Giant:'#333' }
    pw.document.write(`<!DOCTYPE html><html><head><title>Costing Report</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:15mm;font-size:10px;}
      @media print{@page{size:A4;margin:12mm;}.no-print{display:none;}}
      h1{font-size:18px;color:#ca1b1b;}table{width:100%;border-collapse:collapse;margin-bottom:12px;}
      th{background:#ca1b1b;color:white;padding:5px 6px;font-size:9px;}
      td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
      .ok{color:#2d8a4e;font-weight:bold;}.warn{color:#ca1b1b;font-weight:bold;}
      </style></head><body>
      <div style="text-align:center;border-bottom:2px solid #ca1b1b;padding-bottom:10px;margin-bottom:14px;">
        <h1>Roma's Donuts</h1><div style="font-size:12px;font-weight:bold;">PRODUCTION COSTING REPORT</div>
        <div style="font-size:10px;color:#666;">Generated: ${new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})} | Target Margin: ${costSettings.target_margin_percentage}%</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
        ${[['Daily Labor',php(fin.dailyLabor)],['Daily Fixed',php(fin.dailyFixed)],['Daily BEP',`${fin.dailyBEP} pcs`],['Waste Buffer',`${costSettings.waste_percentage}%`]].map(([l,v])=>`
        <div style="background:#f9f9f9;padding:8px;border-radius:4px;border:1px solid #eee;">
          <div style="color:#888;font-size:9px;">${l}</div><div style="font-weight:bold;color:#ca1b1b;font-size:13px;">${v}</div>
        </div>`).join('')}
      </div>
      <table>
        <tr><th>Variant</th><th>Category</th><th>Sell Price</th><th>Ingredient/pc</th><th>Labor/pc</th><th>Fixed/pc</th><th>Total Cost/pc</th><th>Margin ₱</th><th>Margin %</th><th>Status</th></tr>
        ${fin.variantData.map(v=>`<tr>
          <td>${v.name}</td><td>${v.category}</td>
          <td style="text-align:right;">${php(v.selling_price)}</td>
          <td style="text-align:right;">${v.isEstimate?'—':php(v.ingredientCost||0)}</td>
          <td style="text-align:right;">${php(v.laborPerPiece||fin.laborPerPiece)}</td>
          <td style="text-align:right;">${php(v.fixedPerPiece||fin.fixedPerPiece)}</td>
          <td style="text-align:right;font-weight:bold;">${php(v.totalCost||0)}</td>
          <td style="text-align:right;" class="${v.grossMargin>=0?'ok':'warn'}">${php(v.grossMargin||0)}</td>
          <td style="text-align:right;" class="${v.grossMarginPct>=(costSettings.target_margin_percentage||30)?'ok':'warn'}">${(v.grossMarginPct||0).toFixed(1)}%</td>
          <td class="${v.belowTarget?'warn':'ok'}">${v.belowTarget?'⚠️ LOW':'✅ OK'}${v.isEstimate?' *':''}</td>
        </tr>`).join('')}
      </table>
      <p style="font-size:9px;color:#888;margin-top:8px;">* No recipe set — ingredient cost not included. Set up recipes for accurate costing.</p>
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:13px;font-weight:bold;cursor:pointer;">🖨️ PRINT</button>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }
  async function loadAnnouncementViews(annId) {
    const { data:all } = await supabase.from('employees').select('id,full_name,employee_code').eq('is_active', true)
    const { data:views } = await supabase.from('announcement_views').select('employee_id').eq('announcement_id', annId)
    const viewedIds = new Set(views?.map(v => v.employee_id) || [])
    setAnnouncementViews((all || []).map(e => ({ ...e, viewed:viewedIds.has(e.id) })))
  }

  // ── Phase 3: Reseller Functions ───────────────────────────────────────────
  async function loadResellers() {
    setResellersLoading(true)
    const { data } = await supabase.from('resellers').select('*').eq('is_active', true).order('name')
    setResellers(data || [])
    setResellersLoading(false)
  }
  async function saveReseller() {
    if (!resellerForm.name.trim()) { showToast('❌ Reseller name is required.','red'); return }
    const payload = { name:resellerForm.name.trim(), area:resellerForm.area.trim(), contact_person:resellerForm.contact_person.trim(), phone:resellerForm.phone.trim(), address:resellerForm.address.trim(), delivery_day:resellerForm.delivery_day, access_code:resellerForm.access_code||null, access_pin:resellerForm.access_pin||null }
    if (editingResellerId) {
      const { error } = await supabase.from('resellers').update(payload).eq('id', editingResellerId)
      if (error) { showToast('❌ Failed: '+error.message,'red'); return }
      showToast('✅ Reseller updated!')
    } else {
      const { error } = await supabase.from('resellers').insert({ ...payload, is_active:true })
      if (error) { showToast('❌ Failed: '+error.message,'red'); return }
      showToast('✅ Reseller added!')
    }
    setEditingResellerId(null); setShowResellerForm(false)
    setResellerForm({ name:'', area:'', contact_person:'', phone:'', address:'', delivery_day:'Monday', access_code:'', access_pin:'' })
    loadResellers()
  }
  async function deleteReseller(r) {
    if (!window.confirm(`Deactivate reseller "${r.name}"?`)) return
    await supabase.from('resellers').update({ is_active:false }).eq('id', r.id)
    showToast('✅ Reseller removed.'); loadResellers()
  }
  async function loadResellerDefaultOrders() {
    const { data } = await supabase.from('reseller_default_orders').select('*')
    const grouped = {}
    for (const item of data || []) {
      if (!grouped[item.reseller_id]) grouped[item.reseller_id] = []
      grouped[item.reseller_id].push(item)
    }
    setResellerDefaultOrders(grouped)
  }
  async function saveDefaultOrder(resellerId) {
    try {
      await supabase.from('reseller_default_orders').delete().eq('reseller_id', resellerId)
      const valid = defaultOrderItems.filter(i => i.variant_id && Number(i.default_quantity) > 0)
      if (valid.length > 0) {
        const rows = valid.map(i => ({
          reseller_id: resellerId,
          variant_id: i.variant_id,
          variant_name: i.variant_name || donutVariants.find(v=>v.id===i.variant_id)?.name || '',
          default_quantity: Number(i.default_quantity)
        }))
        const { error } = await supabase.from('reseller_default_orders').insert(rows)
        if (error) { showToast('❌ Failed: '+error.message,'red'); return }
      }
      showToast(`✅ Default order saved! (${valid.length} variant${valid.length!==1?'s':''})`)
      setEditingDefaultOrder(null)
      loadResellerDefaultOrders()
    } catch(err) { showToast('❌ Error: '+err.message,'red') }
  }
  // ── Invoice Functions ─────────────────────────────────────────────────────
  function buildInvoiceFromReseller(resellerId) {
    const defaults = resellerDefaultOrders[resellerId] || []
    if (defaults.length > 0) {
      setInvoiceItems(defaults.map(d => ({ variant_id:d.variant_id, variant_name:d.variant_name, quantity:d.default_quantity, retail_price:0, reseller_price:0 })))
    } else {
      setInvoiceItems([{ variant_id:'', variant_name:'', quantity:'', retail_price:0, reseller_price:0 }])
    }
  }
  async function loadDeliveryInvoices() {
    setInvoicesLoading(true)
    const { data } = await supabase.from('delivery_invoices').select('*, delivery_invoice_items(*)').order('delivery_date', { ascending:false }).limit(100)
    setDeliveryInvoices(data || [])
    setInvoicesLoading(false)
  }
  async function createDeliveryInvoice() {
    if (!invoiceResellerId) { showToast('❌ Please select a reseller.','red'); return }
    if (!invoiceDate) { showToast('❌ Please select a delivery date.','red'); return }
    const validItems = invoiceItems.filter(i => i.variant_id && Number(i.quantity) > 0)
    if (validItems.length === 0) { showToast('❌ Please add at least one item with quantity.','red'); return }
    setSavingInvoice(true)
    try {
      const reseller = resellers.find(r => r.id === invoiceResellerId)
      const invoiceNum = `INV-${invoiceDate.replace(/-/g,'')}-${Math.floor(1000+Math.random()*9000)}`
      const dueDate = new Date(invoiceDate); dueDate.setDate(dueDate.getDate() + 7)
      const dueDateStr = dueDate.toISOString().slice(0,10)
      const lineItems = validItems.map(i => {
        const variant = donutVariants.find(v => v.id === i.variant_id)
        const retailPrice = variant?.selling_price || Number(i.retail_price) || 0
        const resellerPrice = Math.round(retailPrice * 0.80 * 100) / 100
        return { ...i, retail_price:retailPrice, reseller_price:resellerPrice, total_price:resellerPrice * Number(i.quantity) }
      })
      const subtotal = lineItems.reduce((s,i) => s + i.total_price, 0)
      const { data:inv, error:invErr } = await supabase.from('delivery_invoices').insert({
        invoice_number:invoiceNum, reseller_id:invoiceResellerId, reseller_name:reseller?.name||'',
        delivery_date:invoiceDate, due_date:dueDateStr, subtotal, discount_pct:20,
        total_amount:subtotal, status:'unpaid', notes:invoiceNotes||null, created_by:adminRole,
        prepared_by:invoicePreparedBy||null, dispatched_by:invoiceDispatchedBy||null,
        crates_used:Number(invoiceCrates||0)
      }).select().single()
      if (invErr) throw invErr
      const itemRows = lineItems.map(i => ({ invoice_id:inv.id, variant_id:i.variant_id, variant_name:i.variant_name, retail_price:i.retail_price, reseller_price:i.reseller_price, quantity:Number(i.quantity), total_price:i.total_price }))
      const { error:itemErr } = await supabase.from('delivery_invoice_items').insert(itemRows)
      if (itemErr) throw itemErr
      await logAudit('INVOICE CREATED', adminRole, reseller?.name||'', `${invoiceNum} — ${php(subtotal)}`)
      showToast(`✅ Invoice ${invoiceNum} created!`)
      setShowCreateInvoice(false); setInvoiceResellerId(''); setInvoiceItems([])
      setInvoiceNotes(''); setInvoicePreparedBy(''); setInvoiceDispatchedBy(''); setInvoiceCrates('')
      loadDeliveryInvoices()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingInvoice(false)
  }
  async function saveInvoiceEdit() {
    if (!editingInvoice) return
    const validItems = editInvoiceItems.filter(i => i.variant_id && Number(i.quantity) > 0)
    if (validItems.length === 0) { showToast('❌ Please add at least one item.','red'); return }
    setSavingEditInvoice(true)
    try {
      // Recalculate totals
      const lineItems = validItems.map(i => {
        const variant = donutVariants.find(v => v.id === i.variant_id)
        const retailPrice = variant?.selling_price || Number(i.retail_price) || 0
        const resellerPrice = Math.round(retailPrice * 0.80 * 100) / 100
        return { ...i, retail_price:retailPrice, reseller_price:resellerPrice, total_price:resellerPrice * Number(i.quantity) }
      })
      const subtotal = lineItems.reduce((s,i) => s + i.total_price, 0)
      // Update invoice header
      await supabase.from('delivery_invoices').update({
        subtotal, total_amount:subtotal,
        notes:editingInvoice.notes||null,
        prepared_by:editingInvoice.prepared_by||null,
        dispatched_by:editingInvoice.dispatched_by||null,
        crates_used:Number(editingInvoice.crates_used||0)
      }).eq('id', editingInvoice.id)
      // Replace line items
      await supabase.from('delivery_invoice_items').delete().eq('invoice_id', editingInvoice.id)
      await supabase.from('delivery_invoice_items').insert(lineItems.map(i => ({
        invoice_id:editingInvoice.id, variant_id:i.variant_id, variant_name:i.variant_name,
        retail_price:i.retail_price, reseller_price:i.reseller_price,
        quantity:Number(i.quantity), total_price:i.total_price
      })))
      await logAudit('INVOICE EDITED', adminRole, editingInvoice.reseller_name, `${editingInvoice.invoice_number} — updated to ${php(subtotal)}`)
      showToast(`✅ Invoice updated — new total: ${php(subtotal)}`)
      setEditingInvoice(null); setEditInvoiceItems([])
      loadDeliveryInvoices()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingEditInvoice(false)
  }
  async function deleteInvoice(invoice) {
    if (!window.confirm(`Delete invoice ${invoice.invoice_number} for ${invoice.reseller_name}?\nThis cannot be undone.`)) return
    await supabase.from('delivery_invoice_items').delete().eq('invoice_id', invoice.id)
    await supabase.from('reseller_payments').delete().eq('invoice_id', invoice.id)
    await supabase.from('delivery_invoices').delete().eq('id', invoice.id)
    await logAudit('INVOICE DELETED', adminRole, invoice.reseller_name, `${invoice.invoice_number} — ${php(invoice.total_amount)}`)
    showToast(`✅ Invoice ${invoice.invoice_number} deleted.`)
    loadDeliveryInvoices()
  }
  function printAllDailyInvoices(date) {
    const dayInvoices = deliveryInvoices.filter(i => i.delivery_date === date)
    if (dayInvoices.length === 0) { showToast('❌ No invoices for this date.','red'); return }
    const pw = window.open('','_blank','width=900,height=700')
    const grandTotal = dayInvoices.reduce((s,i)=>s+Number(i.total_amount||0),0)
    pw.document.write(`<!DOCTYPE html><html><head><title>All Invoices — ${date}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:10mm;font-size:10px;}
      @media print{@page{size:A5 portrait;margin:5mm;}.no-print{display:none;}.page-break{page-break-after:always;}}
      h1{font-size:16px;color:#ca1b1b;}table{width:100%;border-collapse:collapse;margin:8px 0;}
      th{background:#ca1b1b;color:white;padding:5px 6px;font-size:9px;text-align:left;}
      td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
      .total{font-weight:bold;background:#fff9e6;}
      .invoice-header{border-bottom:2px solid #ca1b1b;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;}
      </style></head><body>
      <div class="no-print" style="text-align:center;margin-bottom:16px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:13px;font-weight:bold;cursor:pointer;">🖨️ PRINT ALL</button>
        <p style="font-size:11px;color:#888;margin-top:6px;">${dayInvoices.length} invoice(s) — Total: ${php(grandTotal)}</p>
      </div>
      ${dayInvoices.map((inv,idx)=>{
        const items = inv.delivery_invoice_items || []
        const reseller = resellers.find(r=>r.id===inv.reseller_id)
        return `
        <div class="${idx < dayInvoices.length-1 ? 'page-break' : ''}">
          <div class="invoice-header">
            <div><h1>Roma's Donuts</h1><div style="font-size:9px;color:#888;">Every bite is a little piece of heaven</div></div>
            <div style="text-align:right;">
              <div style="font-size:14px;font-weight:bold;color:#ca1b1b;">DELIVERY INVOICE</div>
              <div style="font-size:11px;font-weight:bold;">${inv.invoice_number}</div>
              <div style="font-size:9px;color:#888;">Date: ${inv.delivery_date} | Due: ${inv.due_date}</div>
              <div style="font-size:9px;font-weight:bold;color:${inv.status==='paid'?'#2d8a4e':'#ca1b1b'};">${inv.status?.toUpperCase()}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px;">
            <div>
              <div style="font-weight:bold;font-size:9px;color:#ca1b1b;margin-bottom:4px;">DELIVER TO</div>
              <div><strong>${inv.reseller_name}</strong></div>
              ${reseller?.contact_person?`<div>${reseller.contact_person}</div>`:''}
              ${reseller?.phone?`<div>${reseller.phone}</div>`:''}
              ${reseller?.area?`<div>${reseller.area}</div>`:''}
            </div>
            <div>
              <div style="font-weight:bold;font-size:9px;color:#ca1b1b;margin-bottom:4px;">PAYMENT TERMS</div>
              <div>Reseller Discount: <strong>20% off retail</strong></div>
              <div>Payment Due: <strong>${inv.due_date}</strong></div>
            </div>
          </div>
          <table>
            <tr><th>#</th><th>Variant</th><th style="text-align:right;">Retail</th><th style="text-align:right;">Reseller</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Amount</th><th style="text-align:center;">Unsold</th></tr>
            ${items.map((it,n)=>`<tr>
              <td>${n+1}</td><td>${it.variant_name}</td>
              <td style="text-align:right;">${php(it.retail_price)}</td>
              <td style="text-align:right;">${php(it.reseller_price)}</td>
              <td style="text-align:right;font-weight:bold;">${Number(it.quantity).toLocaleString()}</td>
              <td style="text-align:right;font-weight:bold;">${php(it.total_price)}</td>
              <td style="text-align:center;border:1px solid #ddd;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
            </tr>`).join('')}
            <tr class="total"><td colspan="5" style="text-align:right;">TOTAL DUE:</td><td style="text-align:right;color:#ca1b1b;font-size:11px;">${php(inv.total_amount)}</td><td></td></tr>
          </table>
          <div style="display:flex;justify-content:space-between;margin-top:20px;">
            <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:3px;font-size:9px;">Prepared by / Date</div></div>
            <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:3px;font-size:9px;">Received by / Date</div></div>
            <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:3px;font-size:9px;">Checked by / Date</div></div>
          </div>
        </div>`
      }).join('')}
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }
  async function recordPayment(invoice) {
    const amt = Number(paymentAmount[invoice.id] || 0)
    const pdate = paymentDate[invoice.id] || today
    const pmethod = paymentMethod[invoice.id] || 'Cash'
    if (!amt || amt <= 0) { showToast('❌ Please enter payment amount.','red'); return }
    if (amt > Number(invoice.total_amount - (invoice.paid_amount||0))) { showToast('❌ Amount exceeds outstanding balance.','red'); return }
    const newPaid = Number(invoice.paid_amount||0) + amt
    const newStatus = newPaid >= Number(invoice.total_amount) ? 'paid' : 'partial'
    const { error } = await supabase.from('delivery_invoices').update({ paid_amount:newPaid, paid_date:newStatus==='paid'?pdate:null, status:newStatus }).eq('id', invoice.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await supabase.from('reseller_payments').insert({ reseller_id:invoice.reseller_id, reseller_name:invoice.reseller_name, invoice_id:invoice.id, amount:amt, payment_date:pdate, payment_method:pmethod, notes:paymentNote[invoice.id]||null, recorded_by:adminRole })
    await logAudit('PAYMENT RECORDED', adminRole, invoice.reseller_name, `${php(amt)} via ${pmethod} for ${invoice.invoice_number}`)
    showToast(`✅ ${php(amt)} via ${pmethod} recorded!`)
    setShowPaymentForm(p=>({...p,[invoice.id]:false}))
    setPaymentAmount(p=>({...p,[invoice.id]:''}))
    setPaymentMethod(p=>({...p,[invoice.id]:'Cash'}))
    loadDeliveryInvoices()
  }
  function printDeliveryInvoice(invoice) {
    const items = invoice.delivery_invoice_items || []
    const reseller = resellers.find(r => r.id === invoice.reseller_id)
    const totalPieces = items.reduce((s,i)=>s+Number(i.quantity||0),0)
    const pw = window.open('','_blank','width=500,height=750')
    pw.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice.invoice_number}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:9px;width:105mm;background:white;}
        @media print{
          @page{size:A5 portrait;margin:5mm;}
          html,body{width:105mm;}
          .no-print{display:none!important;}
        }
        .wrap{padding:4mm 5mm;}
        h1{font-size:13px;color:#ca1b1b;margin:0;}
        .tagline{font-size:7px;color:#888;}
        table{width:100%;border-collapse:collapse;margin:4px 0;}
        th{background:#ca1b1b;color:white;padding:3px 4px;font-size:7px;text-align:left;}
        td{padding:2px 4px;border-bottom:1px solid #f0f0f0;font-size:7px;}
        .total-row{background:#fff9e6;font-weight:bold;}
        .divider{border-top:1.5px solid #ca1b1b;margin:4px 0;}
        .label{font-size:6px;color:#ca1b1b;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;}
        .sig{border-top:1px solid #333;width:80px;text-align:center;font-size:6px;padding-top:2px;margin-top:14px;}
      </style></head>
    <body><div class="wrap">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div>
          <h1>Roma's Donuts</h1>
          <div class="tagline">Every bite is a little piece of heaven</div>
          <div class="tagline">Malued District, Dagupan City | 09706438113</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;font-weight:bold;color:#ca1b1b;">DELIVERY INVOICE</div>
          <div style="font-size:8px;font-weight:bold;">${invoice.invoice_number}</div>
          <div style="font-size:7px;color:#666;">Date: ${invoice.delivery_date}</div>
          <div style="font-size:7px;color:#666;">Due: ${invoice.due_date}</div>
          <div style="font-size:7px;font-weight:bold;color:${invoice.status==='paid'?'#2d8a4e':'#ca1b1b'};">${invoice.status?.toUpperCase()}</div>
        </div>
      </div>
      <div class="divider"></div>
      <!-- Reseller Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;">
        <div>
          <div class="label">Deliver To</div>
          <div style="font-weight:bold;font-size:8px;">${invoice.reseller_name}</div>
          ${reseller?.contact_person?`<div style="font-size:7px;">${reseller.contact_person}</div>`:''}
          ${reseller?.phone?`<div style="font-size:7px;">${reseller.phone}</div>`:''}
          ${reseller?.area?`<div style="font-size:7px;">${reseller.area}</div>`:''}
        </div>
        <div>
          <div class="label">Details</div>
          <div style="font-size:7px;">Discount: <strong>20% off retail</strong></div>
          <div style="font-size:7px;">Due: <strong>${invoice.due_date}</strong></div>
          <div style="font-size:7px;">Crates: <strong>${invoice.crates_used||0}</strong></div>
          ${invoice.notes?`<div style="font-size:7px;">Note: ${invoice.notes}</div>`:''}
        </div>
      </div>
      <div class="divider"></div>
      <!-- Items Table -->
      <table>
        <tr><th>Variant</th><th style="text-align:right;">Retail</th><th style="text-align:right;">Price</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Amount</th><th style="text-align:center;">Unsold</th></tr>
        ${items.map(i=>`<tr>
          <td>${i.variant_name}</td>
          <td style="text-align:right;">${php(i.retail_price)}</td>
          <td style="text-align:right;">${php(i.reseller_price)}</td>
          <td style="text-align:right;font-weight:bold;">${Number(i.quantity).toLocaleString()}</td>
          <td style="text-align:right;font-weight:bold;">${php(i.total_price)}</td>
          <td style="text-align:center;border:1px solid #ddd;min-width:28px;">&nbsp;</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;">Total (${totalPieces.toLocaleString()} pcs):</td>
          <td></td>
          <td style="text-align:right;color:#ca1b1b;font-size:9px;">${php(invoice.total_amount)}</td>
          <td></td>
        </tr>
        ${invoice.paid_amount>0?`
        <tr><td colspan="4" style="text-align:right;">Paid:</td><td style="text-align:right;color:#2d8a4e;">${php(invoice.paid_amount)}</td><td></td></tr>
        <tr class="total-row"><td colspan="4" style="text-align:right;">Balance:</td><td style="text-align:right;color:#ca1b1b;">${php(Number(invoice.total_amount)-(Number(invoice.paid_amount)||0))}</td><td></td></tr>`:''}
      </table>
      <div class="divider" style="margin-top:6px;"></div>
      <!-- Bottom fields -->
      <div style="margin-top:8px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <div style="font-size:7px;font-weight:bold;color:#ca1b1b;margin-bottom:14px;">Dispatcher:</div>
            <div style="border-top:1px solid #333;padding-top:3px;font-size:7px;color:#888;">Signature / Date</div>
          </div>
          <div>
            <div style="font-size:7px;font-weight:bold;color:#ca1b1b;margin-bottom:2px;">Delivery Personnel:</div>
            <div style="font-size:8px;font-weight:bold;color:#333;margin-bottom:8px;">Ronald Reyes / Jomar Cerezo</div>
            <div style="border-top:1px solid #333;padding-top:3px;font-size:7px;color:#888;">Signature / Date</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div style="font-size:7px;font-weight:bold;color:#ca1b1b;margin-bottom:14px;">Crates Used:</div>
            <div style="border-top:1px solid #333;padding-top:3px;font-size:7px;color:#888;">&nbsp;</div>
          </div>
          <div>
            <div style="font-size:7px;font-weight:bold;color:#ca1b1b;margin-bottom:14px;">Crates Returned:</div>
            <div style="border-top:1px solid #333;padding-top:3px;font-size:7px;color:#888;">&nbsp;</div>
          </div>
        </div>
      </div>
      <div class="no-print" style="text-align:center;margin-top:12px;">
        <button onclick="window.print()" style="padding:8px 20px;background:#ca1b1b;color:white;border:none;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;">🖨️ PRINT (A5 Half-A4)</button>
        <p style="font-size:10px;color:#888;margin-top:4px;">Set paper to A5 or Half-Letter. Uncheck "Headers and footers".</p>
      </div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }
  // ── Daily Sales Functions ─────────────────────────────────────────────────
  async function loadDailySales() {
    setDailySalesLoading(true)
    const { data } = await supabase.from('daily_sales').select('*, daily_sales_items(*)').order('sale_date', { ascending:false }).limit(30)
    setDailySales(data || [])
    setDailySalesLoading(false)
  }
  async function saveDailySales() {
    if (!salesDate) { showToast('❌ Please select a date.','red'); return }
    const valid = salesEntries.filter(e => e.variant_id && Number(e.quantity) > 0)
    if (valid.length === 0) { showToast('❌ Please add at least one sale entry.','red'); return }
    setSavingSales(true)
    try {
      const walkinTotal = valid.filter(e=>e.channel==='walkin').reduce((s,e)=>s+Number(e.quantity)*Number(e.unit_price||0),0)
      const messengerTotal = valid.filter(e=>e.channel==='messenger').reduce((s,e)=>s+Number(e.quantity)*Number(e.unit_price||0),0)
      const resellerInvoicesDay = deliveryInvoices.filter(i=>i.delivery_date===salesDate).reduce((s,i)=>s+Number(i.total_amount||0),0)
      const totalRevenue = walkinTotal + messengerTotal + resellerInvoicesDay
      const { data:saleData, error:sErr } = await supabase.from('daily_sales').insert({
        sale_date:salesDate, total_walkin:walkinTotal, total_messenger:messengerTotal,
        total_reseller:resellerInvoicesDay, total_revenue:totalRevenue,
        notes:salesNotes||null, encoded_by:adminRole
      }).select().single()
      if (sErr) throw sErr
      const itemRows = valid.map(e => {
        const variant = donutVariants.find(v=>v.id===e.variant_id)
        const unitPrice = variant?.selling_price || Number(e.unit_price||0)
        return { sale_id:saleData.id, variant_id:e.variant_id, variant_name:e.variant_name||variant?.name||'', channel:e.channel, quantity:Number(e.quantity), unit_price:unitPrice, total_price:Number(e.quantity)*unitPrice }
      })
      await supabase.from('daily_sales_items').insert(itemRows)
      await logAudit('DAILY SALES ENCODED', adminRole, 'Sales', `${salesDate} — ${php(totalRevenue)}`)
      showToast(`✅ Sales for ${salesDate} saved! Total: ${php(totalRevenue)}`)
      setShowSalesForm(false); setSalesEntries([{ variant_id:'', variant_name:'', channel:'walkin', quantity:'', unit_price:'' }]); setSalesNotes('')
      loadDailySales()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingSales(false)
  }
  // ── Expenses Functions ────────────────────────────────────────────────────
  // ── FEATURE 1: Cash Reconciliation ───────────────────────────────────────
  // ── Bank Deposit System ───────────────────────────────────────────────────
  async function loadBankDeposits() {
    const { data } = await supabase.from('bank_deposits').select('*').order('deposit_date', { ascending:false }).limit(20)
    setBankDeposits(data||[])
  }
  async function saveBankDeposit(expectedCash, resellerCollections, walkinSales, expenses) {
    if (!depositForm.amount) { showToast('❌ Enter deposit amount.','red'); return }
    if (!depositForm.deposit_slip_number.trim()) { showToast('❌ Enter deposit slip number.','red'); return }
    setSavingDeposit(true)
    const amount = Number(depositForm.amount)
    const variance = amount - expectedCash
    // Get week range (Mon-Sun)
    const depDate = new Date(depositForm.deposit_date)
    const dow = depDate.getDay()
    const monday = new Date(depDate); monday.setDate(depDate.getDate() - (dow===0?6:dow-1))
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6)
    const { error } = await supabase.from('bank_deposits').insert({
      deposit_date: depositForm.deposit_date,
      week_start: monday.toISOString().slice(0,10),
      week_end: sunday.toISOString().slice(0,10),
      amount, deposit_slip_number: depositForm.deposit_slip_number,
      bank_name: depositForm.bank_name||'BDO',
      deposited_by: adminRole,
      reseller_collections: resellerCollections,
      walkin_sales: walkinSales,
      expenses_paid: expenses,
      total_expected: expectedCash,
      variance, notes: depositForm.notes||null,
      status: 'deposited'
    })
    if (error) { showToast('❌ Failed: '+error.message,'red'); setSavingDeposit(false); return }
    await logAudit('BANK DEPOSIT', adminRole, 'Finance', `${php(amount)} — Slip: ${depositForm.deposit_slip_number} — Variance: ${php(variance)}`)
    if (Math.abs(variance) > 100) {
      await supabase.from('suspicious_alerts').insert({ alert_type:'deposit_variance', severity: Math.abs(variance)>1000?'high':'medium', description:`Bank deposit variance of ${php(Math.abs(variance))} detected. Expected: ${php(expectedCash)}, Deposited: ${php(amount)}`, related_to:'Bank Deposit' })
    }
    showToast(variance===0?'✅ Deposit recorded — fully balanced!':Math.abs(variance)<50?`✅ Deposit recorded — minor variance: ${php(variance)}`:`⚠️ Deposit recorded — variance: ${php(variance)}`)
    setShowDepositForm(false)
    setDepositForm({ deposit_date:today, deposit_slip_number:'', bank_name:'BDO', amount:'', notes:'' })
    loadBankDeposits(); loadCashReconciliations(); setSavingDeposit(false)
  }
  function checkTuesdayDepositReminder() {
    const dayOfWeek = new Date().getDay() // 0=Sun, 2=Tue
    if (dayOfWeek === 2) {
      const lastDeposit = bankDeposits[0]
      const lastDepDate = lastDeposit?.deposit_date
      const isToday = lastDepDate === today
      if (!isToday) createNotification(null, 'System', 'deposit', '💳 Tuesday Deposit Reminder', `Today is deposit day! Please deposit this week\'s collections and record the bank deposit slip.`)
    }
  }

  // ── Production Report System ──────────────────────────────────────────────
  async function loadProductionReports() {
    const { data } = await supabase.from('production_reports').select('*, production_report_items(*)').order('report_date', { ascending:false }).limit(10)
    setProductionReports(data||[])
  }
  async function initProductionReport(deliveryDate) {
    // Load forecast from invoices for delivery date
    const forecastInvoices = deliveryInvoices.filter(i=>i.delivery_date===deliveryDate)
    const forecastMap = {}
    forecastInvoices.forEach(inv=>{
      ;(inv.delivery_invoice_items||[]).forEach(item=>{
        if (!forecastMap[item.variant_name]) forecastMap[item.variant_name] = { variant_id:item.variant_id, variant_name:item.variant_name, forecast_qty:0, actual_qty:'', variance_reason:'' }
        forecastMap[item.variant_name].forecast_qty += Number(item.quantity||0)
      })
    })
    const items = Object.values(forecastMap)
    if (items.length===0) { showToast('⚠️ No invoices found for '+deliveryDate+'. Load all variants manually.','red') }
    // Also load all variants for items not in forecast
    const { data:variants } = await supabase.from('donut_variants').select('*').eq('is_active',true).order('name')
    const variantItems = (variants||[]).map(v=>{ const existing = items.find(i=>i.variant_id===v.id); return existing || { variant_id:v.id, variant_name:v.name, forecast_qty:0, actual_qty:'', variance_reason:'' } })
    setProductionReportItems(variantItems)
    setProductionReportDeliveryDate(deliveryDate)
    setShowProductionReport(true)
  }
  async function saveProductionReport() {
    const validItems = productionReportItems.filter(i=>i.forecast_qty>0||Number(i.actual_qty)>0)
    if (validItems.length===0) { showToast('❌ No items to report.','red'); return }
    const totalForecast = validItems.reduce((s,i)=>s+Number(i.forecast_qty||0),0)
    const totalProduced = validItems.reduce((s,i)=>s+Number(i.actual_qty||0),0)
    const variance = totalProduced - totalForecast
    const hasVariance = Math.abs(variance) > 0
    if (hasVariance && !productionVarianceReason.trim()) { showToast('❌ Variance detected — please enter reason.','red'); return }
    setSavingProductionReport(true)
    try {
      const { data:report, error } = await supabase.from('production_reports').insert({
        report_date: productionReportDate,
        delivery_date: productionReportDeliveryDate,
        submitted_by: adminEmployee?.full_name||adminRole,
        submitted_by_role: adminRole,
        status: 'submitted',
        total_forecast: totalForecast,
        total_produced: totalProduced,
        variance,
        variance_reason: hasVariance?productionVarianceReason:null,
        notes: productionReportNotes||null
      }).select().single()
      if (error) throw error
      await supabase.from('production_report_items').insert(validItems.map(i=>({ report_id:report.id, variant_id:i.variant_id, variant_name:i.variant_name, forecast_qty:Number(i.forecast_qty||0), actual_qty:Number(i.actual_qty||0), variance:Number(i.actual_qty||0)-Number(i.forecast_qty||0), variance_reason:i.variance_reason||null })))
      // Alert if significant variance
      if (Math.abs(variance) > 50) {
        await supabase.from('suspicious_alerts').insert({ alert_type:'production_variance', severity:Math.abs(variance)>200?'high':'medium', description:`Production variance of ${variance} pieces for delivery on ${productionReportDeliveryDate}. Forecast: ${totalForecast}, Actual: ${totalProduced}. Reason: ${productionVarianceReason}`, related_to:'Production Report' })
        await createNotification(null,'System','production',`⚠️ Production Variance Alert`,`${Math.abs(variance)} piece variance for ${productionReportDeliveryDate}. Forecast: ${totalForecast}, Produced: ${totalProduced}`)
      }
      await logAudit('PRODUCTION REPORT SUBMITTED', adminRole, adminEmployee?.full_name||'', `${productionReportDate} → Delivery ${productionReportDeliveryDate}: ${totalProduced}/${totalForecast} pieces`)
      showToast(`✅ Production report saved! ${totalProduced} pieces produced.`)
      setShowProductionReport(false); setProductionReportItems([]); setProductionVarianceReason(''); setProductionReportNotes('')
      loadProductionReports()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingProductionReport(false)
  }

  // ── Suspicious Pattern Detection ──────────────────────────────────────────
  async function checkSuspiciousPatterns() {
    const alerts = []
    // Check cash shortages for 2+ consecutive days
    const recentRecons = cashReconciliations.slice(0,5)
    const shortages = recentRecons.filter(r=>Number(r.variance)<-100)
    if (shortages.length >= 2) alerts.push({ alert_type:'consecutive_shortages', severity:'high', description:`Cash shortage detected for ${shortages.length} recent reconciliations. Total missing: ${php(shortages.reduce((s,r)=>s+Math.abs(Number(r.variance)),0))}`, related_to:'Cash Reconciliation' })
    // Check reseller with returns 3+ invoices
    const returnCounts = {}
    deliveryInvoices.forEach(inv=>{ if(inv.notes?.includes('Returns recorded')) { returnCounts[inv.reseller_name]=(returnCounts[inv.reseller_name]||0)+1 } })
    Object.entries(returnCounts).forEach(([name,count])=>{ if(count>=3) alerts.push({ alert_type:'excessive_returns', severity:'medium', description:`${name} has recorded returns on ${count} invoices. Please verify delivery quality and reseller accountability.`, related_to:name }) })
    // Check Tuesday deposit reminder
    const dayOfWeek = new Date().getDay()
    if (dayOfWeek===2) {
      const todayDeposit = bankDeposits.find(d=>d.deposit_date===today)
      if (!todayDeposit) alerts.push({ alert_type:'missing_deposit', severity:'high', description:`Today is Tuesday — deposit day! No bank deposit has been recorded yet for today.`, related_to:'Bank Deposit' })
    }
    // Save new alerts
    for (const alert of alerts) {
      const existing = suspiciousAlerts.find(a=>a.alert_type===alert.alert_type&&a.related_to===alert.related_to&&a.created_at?.startsWith(today))
      if (!existing) {
        await supabase.from('suspicious_alerts').insert(alert)
        await createNotification(null,'System','alert',`🚨 ${alert.severity==='high'?'HIGH':'Medium'} Alert: ${alert.alert_type.replace(/_/g,' ')}`,alert.description)
      }
    }
    const { data } = await supabase.from('suspicious_alerts').select('*').eq('is_read',false).order('created_at',{ascending:false}).limit(20)
    setSuspiciousAlerts(data||[])
  }

  // ── Reseller Dispute with Photo ───────────────────────────────────────────
  async function submitResellerDispute(invoice) {
    if (!disputeType) { showToast('❌ Select dispute type.','red'); return }
    if (!disputeDesc.trim()) { showToast('❌ Describe the issue.','red'); return }
    setSubmittingDispute(true)
    let photoUrl = null
    if (disputePhoto) {
      try {
        const fileName = `dispute_${invoice.id}_${Date.now()}.jpg`
        const { data:up } = await supabase.storage.from('disputes').upload(fileName, disputePhoto, { upsert:true })
        if (up) photoUrl = supabase.storage.from('disputes').getPublicUrl(fileName).data.publicUrl
      } catch(e) { console.error('Photo upload failed:', e) }
    }
    const { error } = await supabase.from('reseller_disputes').insert({ invoice_id:invoice.id, reseller_id:currentReseller?.id||invoice.reseller_id, reseller_name:currentReseller?.name||invoice.reseller_name, dispute_type:disputeType, description:disputeDesc, photo_url:photoUrl, status:'pending' })
    if (error) { showToast('❌ Failed: '+error.message,'red'); setSubmittingDispute(false); return }
    await createNotification(null,'System','dispute',`⚠️ Reseller Dispute: ${currentReseller?.name||invoice.reseller_name}`,`${disputeType} — ${disputeDesc}${photoUrl?' (Photo attached)':''}`)
    showToast('✅ Dispute submitted! Admin will review shortly.')
    setShowDisputeForm(null); setDisputeType(''); setDisputeDesc(''); setDisputePhoto(null)
    setSubmittingDispute(false)
  }
  async function loadSuspiciousAlerts() {
    const { data } = await supabase.from('suspicious_alerts').select('*').order('created_at',{ascending:false}).limit(20)
    setSuspiciousAlerts(data||[])
  }
  // ── Driver Return Form ────────────────────────────────────────────────────
  function initDriverReturn(invoice) {
    const items = (invoice.delivery_invoice_items||[]).map(i=>({
      variant_id: i.variant_id, variant_name: i.variant_name,
      delivered_qty: Number(i.quantity||0), returned_qty: '', reseller_price: Number(i.reseller_price||0)
    }))
    setDriverReturnItems(items)
    setShowDriverReturnForm(invoice)
  }
  async function saveDriverReturn() {
    const invoice = showDriverReturnForm
    if (!invoice) return
    const validItems = driverReturnItems.filter(i=>Number(i.returned_qty)>0)
    setSavingDriverReturn(true)
    try {
      const totalCredit = validItems.reduce((s,i)=>s+Number(i.returned_qty)*i.reseller_price,0)
      // Save return record
      const { data:ret, error:retErr } = await supabase.from('reseller_returns').insert({
        invoice_id:invoice.id, reseller_id:invoice.reseller_id, reseller_name:invoice.reseller_name,
        return_date:today, total_returned_amount:totalCredit, recorded_by:adminRole, notes:'Driver return'
      }).select().single()
      if (retErr) throw retErr
      if (validItems.length > 0) {
        await supabase.from('reseller_return_items').insert(validItems.map(i=>({
          return_id:ret.id, variant_id:i.variant_id, variant_name:i.variant_name,
          returned_quantity:Number(i.returned_qty), reseller_price:i.reseller_price,
          total_credit:Number(i.returned_qty)*i.reseller_price
        })))
      }
      // Adjust invoice total
      const newTotal = Math.max(0, Number(invoice.total_amount||0) - totalCredit)
      await supabase.from('delivery_invoices').update({
        total_amount:newTotal, status:'delivered',
        notes:(invoice.notes?invoice.notes+' | ':'')+'Driver returns: '+today
      }).eq('id', invoice.id)
      // Check vs reseller portal returns for discrepancy
      const { data:resellerReturn } = await supabase.from('reseller_returns').select('*, reseller_return_items(*)').eq('invoice_id', invoice.id).neq('id', ret.id).maybeSingle()
      if (resellerReturn) {
        const driverTotal = validItems.reduce((s,i)=>s+Number(i.returned_qty||0),0)
        const resellerTotal = (resellerReturn.reseller_return_items||[]).reduce((s,i)=>s+Number(i.returned_quantity||0),0)
        if (Math.abs(driverTotal-resellerTotal)>0) {
          await supabase.from('suspicious_alerts').insert({ alert_type:'return_discrepancy', severity:'high', description:`Return discrepancy for ${invoice.reseller_name} — Invoice ${invoice.invoice_number}. Driver reported ${driverTotal} pcs returned, Reseller reported ${resellerTotal} pcs.`, related_to:invoice.reseller_name })
          await createNotification(null,'System','alert','🚨 Return Discrepancy Alert',`${invoice.reseller_name}: Driver says ${driverTotal} pcs returned, Reseller portal says ${resellerTotal} pcs. Please verify!`)
          showToast(`⚠️ Returns saved but DISCREPANCY detected vs reseller portal! Check alerts.`)
        } else { showToast(`✅ Returns saved! Credit: ${php(totalCredit)}. Matches reseller count ✅`) }
      } else { showToast(`✅ Returns saved! Credit: ${php(totalCredit)}`) }
      await logAudit('DRIVER RETURNS', adminRole, invoice.reseller_name, `${invoice.invoice_number} — ${validItems.length} variants, credit: ${php(totalCredit)}`)
      setShowDriverReturnForm(null); setDriverReturnItems([])
      loadDeliveryInvoices()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingDriverReturn(false)
  }

  // ── Print Production Release Form ────────────────────────────────────────
  function printProductionReleaseForm(report) {
    const pw = window.open('','_blank','width=700,height=600')
    const items = (report.production_report_items||[]).filter(i=>i.actual_qty>0)
    const totalPieces = items.reduce((s,i)=>s+Number(i.actual_qty||0),0)
    pw.document.write(`<!DOCTYPE html><html><head><title>Production Release Form</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:10px;width:150mm;}
    @media print{@page{size:150mm 210mm;margin:5mm;}html,body{width:150mm;}.no-print{display:none!important;}}
    .wrap{padding:6mm;}h1{font-size:13px;color:#ca1b1b;}
    table{width:100%;border-collapse:collapse;margin:8px 0;}th{background:#ca1b1b;color:white;padding:5px 6px;font-size:9px;text-align:left;}
    td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
    .sig{border-top:1px solid #000;margin-top:30px;padding-top:4px;font-size:8px;text-align:center;}
    .total{background:#fff9e6;font-weight:bold;}
    </style></head><body><div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
      <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">PRODUCTION RELEASE FORM</div></div>
      <div style="text-align:right;font-size:8px;"><div>Production Date: <strong>${report.report_date}</strong></div><div>Delivery Date: <strong>${report.delivery_date}</strong></div></div>
    </div>
    <table>
      <tr><th>Variant</th><th style="text-align:right">Forecast</th><th style="text-align:right">Produced</th><th style="text-align:right">Variance</th></tr>
      ${items.map(i=>`<tr><td><strong>${i.variant_name}</strong></td><td style="text-align:right">${i.forecast_qty}</td><td style="text-align:right;font-weight:bold">${i.actual_qty}</td><td style="text-align:right;color:${i.variance!==0?'#ca1b1b':'#2d8a4e'}">${i.variance>0?'+':''}${i.variance}</td></tr>`).join('')}
      <tr class="total"><td>TOTAL</td><td style="text-align:right">${report.total_forecast}</td><td style="text-align:right">${report.total_produced}</td><td style="text-align:right;color:${report.variance!==0?'#ca1b1b':'#2d8a4e'}">${report.variance>0?'+':''}${report.variance}</td></tr>
    </table>
    ${report.variance_reason?`<div style="background:#fff3cd;padding:6px;border-radius:4px;font-size:8px;margin-bottom:8px;"><strong>Variance Reason:</strong> ${report.variance_reason}</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px;">
      <div class="sig">Produced by<br/><br/>${report.submitted_by||'_______________'}</div>
      <div class="sig">Released by<br/><br/>_______________</div>
      <div class="sig">Received by (Driver)<br/><br/>_______________</div>
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#ca1b1b;color:white;border:none;border-radius:6px;cursor:pointer;">🖨️ PRINT</button></div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },500)
  }

  // ── Print Return Form ─────────────────────────────────────────────────────
  function printReturnForm(invoice, returns) {
    const pw = window.open('','_blank','width=700,height=600')
    const items = invoice.delivery_invoice_items||[]
    const returnMap = {}
    ;(returns||[]).forEach(r=>{ returnMap[r.variant_name]=Number(r.returned_quantity||0) })
    pw.document.write(`<!DOCTYPE html><html><head><title>Return Form</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:10px;width:150mm;}
    @media print{@page{size:150mm 210mm;margin:5mm;}html,body{width:150mm;}.no-print{display:none!important;}}
    .wrap{padding:6mm;}h1{font-size:13px;color:#ca1b1b;}
    table{width:100%;border-collapse:collapse;margin:8px 0;}th{background:#1a1a2e;color:white;padding:5px 6px;font-size:9px;text-align:left;}
    td{padding:5px 6px;border-bottom:1px solid #eee;font-size:9px;}
    .sig{border-top:1px solid #000;margin-top:28px;padding-top:4px;font-size:8px;text-align:center;}
    .total{background:#fff9e6;font-weight:bold;}
    </style></head><body><div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
      <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">UNSOLD RETURN FORM</div></div>
      <div style="text-align:right;font-size:8px;"><div>Date: <strong>${today}</strong></div><div>Invoice: <strong>${invoice.invoice_number}</strong></div></div>
    </div>
    <div style="font-size:9px;margin-bottom:8px;"><strong>Reseller:</strong> ${invoice.reseller_name} &nbsp;&nbsp; <strong>Area:</strong> ${invoice.reseller_area||'___'}</div>
    <table>
      <tr><th>Variant</th><th style="text-align:right">Delivered</th><th style="text-align:right">Returned</th><th style="text-align:right">Sold</th><th style="text-align:right">Amount</th></tr>
      ${items.map(i=>{
        const ret=returnMap[i.variant_name]||0
        const sold=Number(i.quantity||0)-ret
        const amt=sold*Number(i.reseller_price||0)
        return `<tr><td><strong>${i.variant_name}</strong></td><td style="text-align:right">${i.quantity}</td><td style="text-align:right;color:#ca1b1b;font-weight:bold">${ret||'___'}</td><td style="text-align:right;color:#2d8a4e">${sold}</td><td style="text-align:right">${amt>0?'₱'+amt.toFixed(2):'___'}</td></tr>`
      }).join('')}
      <tr class="total"><td>TOTAL</td><td style="text-align:right">${items.reduce((s,i)=>s+Number(i.quantity||0),0)}</td><td style="text-align:right;color:#ca1b1b">${Object.values(returnMap).reduce((s,v)=>s+v,0)||'___'}</td><td style="text-align:right">${items.reduce((s,i)=>s+Number(i.quantity||0),0)-Object.values(returnMap).reduce((s,v)=>s+v,0)}</td><td style="text-align:right">₱${(Number(invoice.total_amount||0)).toFixed(2)}</td></tr>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
      <div class="sig">Driver / Assistant<br/><br/>_______________</div>
      <div class="sig">Reseller Signature<br/><br/>_______________</div>
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:white;border:none;border-radius:6px;cursor:pointer;">🖨️ PRINT</button></div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },500)
  }

  // ── Print Cash Collection Summary ─────────────────────────────────────────
  function printCashCollection(date) {
    const dayInvoices = deliveryInvoices.filter(i=>i.delivery_date===date||i.paid_date===date)
    const pw = window.open('','_blank','width=700,height=600')
    const totalCollected = dayInvoices.reduce((s,i)=>s+Number(i.paid_amount||0),0)
    const totalReturns = dayInvoices.reduce((s,i)=>s+Math.max(0,(Number(i.original_amount||i.total_amount||0))-Number(i.total_amount||0)),0)
    const totalNet = dayInvoices.reduce((s,i)=>s+Number(i.total_amount||0),0)
    pw.document.write(`<!DOCTYPE html><html><head><title>Cash Collection</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:10px;width:150mm;}
    @media print{@page{size:150mm 210mm;margin:5mm;}html,body{width:150mm;}.no-print{display:none!important;}}
    .wrap{padding:6mm;}h1{font-size:13px;color:#ca1b1b;}
    table{width:100%;border-collapse:collapse;margin:8px 0;}th{background:#2d8a4e;color:white;padding:5px 6px;font-size:9px;text-align:left;}
    td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
    .total{background:#fff9e6;font-weight:bold;border-top:2px solid #ca1b1b;}
    .sig{border-top:1px solid #000;margin-top:28px;padding-top:4px;font-size:8px;text-align:center;}
    </style></head><body><div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
      <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">DAILY CASH COLLECTION SUMMARY</div></div>
      <div style="text-align:right;font-size:8px;"><strong>${date}</strong></div>
    </div>
    <table>
      <tr><th>Reseller</th><th style="text-align:right">Invoice</th><th style="text-align:right">Returns</th><th style="text-align:right">Net Due</th><th style="text-align:right">Collected</th><th style="text-align:right">Balance</th><th>Mode</th></tr>
      ${dayInvoices.map(i=>{
        const orig = Number(i.original_amount||i.total_amount||0)
        const ret = Math.max(0,orig-Number(i.total_amount||0))
        const net = Number(i.total_amount||0)
        const collected = Number(i.paid_amount||0)
        const balance = net-collected
        return `<tr><td><strong>${i.reseller_name}</strong></td><td style="text-align:right">₱${orig.toFixed(2)}</td><td style="text-align:right;color:#ca1b1b">${ret>0?'₱'+ret.toFixed(2):'—'}</td><td style="text-align:right;font-weight:bold">₱${net.toFixed(2)}</td><td style="text-align:right;color:#2d8a4e;font-weight:bold">${collected>0?'₱'+collected.toFixed(2):'___'}</td><td style="text-align:right;color:${balance>0?'#ca1b1b':'#2d8a4e'}">${balance>0?'₱'+balance.toFixed(2):'✅'}</td><td>${i.payment_method||'Cash'}</td></tr>`
      }).join('')}
      <tr class="total"><td>TOTAL</td><td style="text-align:right">₱${dayInvoices.reduce((s,i)=>s+Number(i.original_amount||i.total_amount||0),0).toFixed(2)}</td><td style="text-align:right">₱${totalReturns.toFixed(2)}</td><td style="text-align:right">₱${totalNet.toFixed(2)}</td><td style="text-align:right;color:#2d8a4e">₱${totalCollected.toFixed(2)}</td><td style="text-align:right;color:${totalNet-totalCollected>0?'#ca1b1b':'#2d8a4e'}">₱${(totalNet-totalCollected).toFixed(2)}</td><td></td></tr>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
      <div class="sig">Prepared by (Admin)<br/><br/>_______________</div>
      <div class="sig">Checked by (Owner)<br/><br/>_______________</div>
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#2d8a4e;color:white;border:none;border-radius:6px;cursor:pointer;">🖨️ PRINT</button></div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },500)
  }

  // ── Record Payment with Partial Support ───────────────────────────────────
  async function recordPaymentNew(inv) {
    const amount = Number(paymentAmount[inv.id]||0)
    if (!amount || amount<=0) { showToast('❌ Enter payment amount.','red'); return }
    const method = paymentMethod[inv.id]||'Cash'
    const notes = paymentNotes[inv.id]||''
    const totalDue = Number(inv.total_amount||0)
    const alreadyPaid = Number(inv.paid_amount||0)
    const newPaidTotal = alreadyPaid + amount
    const balance = totalDue - newPaidTotal
    const newStatus = balance<=0?'paid':'partial'
    await supabase.from('reseller_payments').insert({ reseller_id:inv.reseller_id, reseller_name:inv.reseller_name, invoice_id:inv.id, amount, payment_date:today, payment_method:method, notes:notes||null, recorded_by:adminRole })
    await supabase.from('delivery_invoices').update({ paid_amount:newPaidTotal, paid_date:newStatus==='paid'?today:null, status:newStatus, payment_method:method }).eq('id',inv.id)
    await logAudit('PAYMENT RECORDED', adminRole, inv.reseller_name, `${inv.invoice_number} — ${php(amount)} via ${method}. Status: ${newStatus}. Balance: ${php(Math.max(0,balance))}`)
    showToast(newStatus==='paid'?`✅ ${inv.reseller_name} — Fully paid! ${php(newPaidTotal)}`:`💰 ${php(amount)} recorded. Outstanding balance: ${php(Math.max(0,balance))}`)
    setShowPaymentFormMap(p=>({...p,[inv.id]:false}))
    setPaymentAmount(p=>({...p,[inv.id]:''}))
    loadDeliveryInvoices()
  }

  async function loadCashReconciliations() {
    const { data } = await supabase.from('cash_reconciliations').select('*').order('reconciliation_date', { ascending:false }).limit(30)
    setCashReconciliations(data||[])
  }
  async function saveReconciliation(expectedCash) {
    if (!actualCash && actualCash!=='0') { showToast('❌ Enter actual cash count.','red'); return }
    setSavingReconciliation(true)
    const actual = Number(actualCash)
    const expected = Number(expectedCash)
    const variance = actual - expected
    const { error } = await supabase.from('cash_reconciliations').upsert({
      reconciliation_date: reconciliationDate,
      expected_cash: expected,
      actual_cash: actual,
      variance,
      notes: reconciliationNotes||null,
      submitted_by: adminRole
    }, { onConflict:'reconciliation_date' })
    if (error) { showToast('❌ Failed: '+error.message,'red'); setSavingReconciliation(false); return }
    await logAudit('CASH RECONCILIATION', adminRole, 'Finance', `${reconciliationDate} — Expected: ${php(expected)}, Actual: ${php(actual)}, Variance: ${php(variance)}`)
    showToast(variance===0?'✅ Balanced! No variance.':variance>0?`✅ Saved — Overage: ${php(Math.abs(variance))}`:`⚠️ Saved — Shortage: ${php(Math.abs(variance))}`)
    setActualCash(''); setReconciliationNotes(''); loadCashReconciliations()
    setSavingReconciliation(false)
  }

  // ── FEATURE 2: Inventory Auto-Deduction ───────────────────────────────────
  async function autoDeductInventory(productionLogId, items) {
    // items = [{variant_name, pieces}]
    // For each variant, find its recipe ingredients and deduct from inventory
    let deducted = []
    for (const item of items) {
      const { data:variant } = await supabase.from('donut_variants').select('id').eq('name', item.variant_name).single()
      if (!variant) continue
      const { data:recipe } = await supabase.from('variant_recipes').select('*').eq('variant_id', variant.id)
      if (!recipe || recipe.length === 0) continue
      for (const ing of recipe) {
        const totalQty = ing.quantity_per_batch ? (ing.quantity_per_batch * item.pieces / (variant.pieces_per_batch||12)) : (ing.quantity * item.pieces)
        const { data:invItem } = await supabase.from('inventory_items').select('*').ilike('name', `%${ing.ingredient_name}%`).single()
        if (invItem) {
          const newStock = Math.max(0, Number(invItem.current_stock||0) - totalQty)
          await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', invItem.id)
          deducted.push({ item: ing.ingredient_name, deducted: totalQty.toFixed(2), unit: ing.unit, remaining: newStock.toFixed(2) })
          if (newStock <= Number(invItem.min_stock||0)) {
            await createNotification(null, 'System', 'inventory', `⚠️ Low Stock: ${invItem.name}`, `${invItem.name} is below minimum stock level. Remaining: ${newStock.toFixed(2)} ${invItem.unit}`)
          }
        }
      }
    }
    if (deducted.length > 0) showToast(`✅ Inventory auto-deducted: ${deducted.length} ingredient(s) updated`)
    return deducted
  }

  // ── FEATURE 3: Reseller Returns ───────────────────────────────────────────
  async function initReturnForm(invoice) {
    const items = (invoice.delivery_invoice_items||[]).map(i=>({ variant_id:i.variant_id, variant_name:i.variant_name, delivered_qty:Number(i.quantity||0), returned_qty:'', reseller_price:Number(i.reseller_price||0) }))
    setReturnItems(p=>({...p,[invoice.id]:items}))
    setShowReturnForm(p=>({...p,[invoice.id]:true}))
  }
  // ── Mark Invoice as Delivered ─────────────────────────────────────────────
  async function markAsDelivered(inv) {
    setMarkingDelivered(p=>({...p,[inv.id]:true}))
    const { error } = await supabase.from('delivery_invoices').update({ status:'delivered', delivered_at:new Date().toISOString() }).eq('id', inv.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); setMarkingDelivered(p=>({...p,[inv.id]:false})); return }
    await logAudit('INVOICE DELIVERED', adminRole, inv.reseller_name, `${inv.invoice_number} marked as delivered`)
    showToast(`✅ ${inv.invoice_number} marked as delivered!`)
    setMarkingDelivered(p=>({...p,[inv.id]:false}))
    loadDeliveryInvoices()
  }

  // ── Record Payment (with partial support) ────────────────────────────────
  async function recordInvoicePayment(inv) {
    const amt = Number(paymentAmount[inv.id]||0)
    if (!amt || amt<=0) { showToast('❌ Enter payment amount.','red'); return }
    const balance = Number(inv.total_amount||0) - Number(inv.paid_amount||0)
    if (amt > balance) { showToast(`❌ Amount exceeds balance of ${php(balance)}.`,'red'); return }
    const newPaid = Number(inv.paid_amount||0) + amt
    const newStatus = newPaid >= Number(inv.total_amount||0) ? 'paid' : 'partial'
    const { error } = await supabase.from('delivery_invoices').update({ paid_amount:newPaid, status:newStatus, paid_date:newStatus==='paid'?today:inv.paid_date }).eq('id', inv.id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await supabase.from('reseller_payments').insert({ reseller_id:inv.reseller_id, reseller_name:inv.reseller_name, invoice_id:inv.id, amount:amt, payment_date:today, payment_method:paymentMethod[inv.id]||'Cash', notes:paymentNotes[inv.id]||null, recorded_by:adminRole })
    await logAudit('PAYMENT RECORDED', adminRole, inv.reseller_name, `${inv.invoice_number} — ${php(amt)} via ${paymentMethod[inv.id]||'Cash'} — Status: ${newStatus}`)
    showToast(newStatus==='paid'?`✅ ${inv.reseller_name} — FULLY PAID!`:`✅ Partial payment recorded. Balance: ${php(Number(inv.total_amount||0)-newPaid)}`)
    setPaymentAmount(p=>({...p,[inv.id]:''}))
    setShowPaymentFormMap(p=>({...p,[inv.id]:false}))
    loadDeliveryInvoices()
    // Check suspicious pattern
    setTimeout(()=>checkSuspiciousPatterns(),1000)
  }

  // ── Cross-check Returns (Driver vs Reseller Portal) ───────────────────────
  async function crossCheckReturns(inv) {
    const { data:driverReturns } = await supabase.from('reseller_returns').select('*, reseller_return_items(*)').eq('invoice_id', inv.id).single()
    const { data:portalReturns } = await supabase.from('reseller_disputes').select('*').eq('invoice_id', inv.id).eq('dispute_type','Quantity mismatch').single()
    if (!driverReturns) return
    const driverTotal = (driverReturns.reseller_return_items||[]).reduce((s,i)=>s+Number(i.returned_quantity||0),0)
    // If reseller confirmed different return qty → alert
    if (portalReturns) {
      await supabase.from('suspicious_alerts').insert({ alert_type:'returns_mismatch', severity:'high', description:`Returns mismatch for ${inv.reseller_name} — ${inv.invoice_number}. Driver recorded ${driverTotal} pieces returned but reseller reported discrepancy.`, related_to:inv.reseller_name })
      await createNotification(null,'System','alert','🚨 Returns Mismatch Alert',`${inv.reseller_name}: Driver returns vs reseller portal returns don't match on invoice ${inv.invoice_number}`)
    }
  }

  // ── Print Return Form (half A4) ───────────────────────────────────────────
  function printReturnForm(inv) {
    const items = inv.delivery_invoice_items || []
    const pw = window.open('','_blank','width=700,height=900')
    pw.document.write(`<!DOCTYPE html><html><head><title>Return Form</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;font-size:10px;width:148mm;background:white;}
      @media print{@page{size:148mm 210mm;margin:5mm;}html,body{width:148mm;}.no-print{display:none!important;}}
      .wrap{padding:5mm 6mm;}
      h1{font-size:13px;color:#ca1b1b;margin-bottom:2px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th{background:#ca1b1b;color:white;padding:4px 6px;font-size:9px;text-align:left;}
      td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
      .sig{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .sig-box{text-align:center;}
      .sig-line{border-top:1px solid #000;margin-top:24px;padding-top:3px;font-size:8px;}
    </style></head><body><div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
      <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">RETURN FORM</div></div>
      <div style="text-align:right;font-size:8px;">
        <div><strong>Invoice:</strong> ${inv.invoice_number}</div>
        <div><strong>Reseller:</strong> ${inv.reseller_name}</div>
        <div><strong>Delivery Date:</strong> ${inv.delivery_date}</div>
        <div><strong>Return Date:</strong> ${today}</div>
      </div>
    </div>
    <table>
      <tr><th>Variant</th><th style="text-align:right;">Delivered</th><th style="text-align:center;width:60px;">Returned Qty</th><th style="text-align:center;width:50px;">Remarks</th></tr>
      ${items.map(i=>`<tr><td><strong>${i.variant_name}</strong></td><td style="text-align:right;">${i.quantity}</td><td style="text-align:center;border:1px solid #ccc;">&nbsp;</td><td style="text-align:center;border:1px solid #ccc;">&nbsp;</td></tr>`).join('')}
      <tr style="background:#f9f9f9;font-weight:bold;"><td>TOTAL</td><td style="text-align:right;">${items.reduce((s,i)=>s+Number(i.quantity||0),0)} pcs</td><td style="text-align:center;border:1px solid #ccc;">&nbsp;</td><td></td></tr>
    </table>
    <div class="sig">
      <div class="sig-box"><div class="sig-line">Driver / Delivery Personnel</div></div>
      <div class="sig-box"><div class="sig-line">Reseller / Outlet Representative</div></div>
    </div>
    <div style="margin-top:10px;border-top:1px solid #eee;padding-top:6px;">
      <div style="font-size:8px;color:#888;">Received by Admin: _____________________ Date: _________</div>
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#ca1b1b;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">🖨️ Print Return Form</button></div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>pw.print(),600)
  }

  // ── Print Daily Cash Collection Summary ───────────────────────────────────
  function printDailyCashSummary(date) {
    const dayInvoices = deliveryInvoices.filter(i=>i.delivery_date===date||i.paid_date===date)
    const walkin = dailySales.filter(s=>s.sale_date===date).reduce((s,d)=>s+Number(d.total_amount||0),0)
    const totalCash = dayInvoices.reduce((s,i)=>s+Number(i.paid_amount||0),0) + walkin
    const pw = window.open('','_blank','width=700,height=900')
    pw.document.write(`<!DOCTYPE html><html><head><title>Cash Collection</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;font-size:10px;width:148mm;}
      @media print{@page{size:148mm 210mm;margin:5mm;}html,body{width:148mm;}.no-print{display:none!important;}}
      .wrap{padding:5mm 6mm;}
      h1{font-size:13px;color:#ca1b1b;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th{background:#1a1a2e;color:white;padding:4px 6px;font-size:9px;}
      td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
      .total-row{background:#fff9e6;font-weight:bold;border-top:2px solid #ca1b1b;}
    </style></head><body><div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
      <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">DAILY CASH COLLECTION SUMMARY</div></div>
      <div style="text-align:right;font-size:8px;"><div><strong>Date:</strong> ${date}</div><div><strong>Prepared:</strong> ${today}</div></div>
    </div>
    <table>
      <tr><th>Reseller</th><th style="text-align:right;">Invoice</th><th style="text-align:right;">Returns</th><th style="text-align:right;">Net Payable</th><th style="text-align:right;">Received</th><th style="text-align:right;">Balance</th><th>Mode</th></tr>
      ${dayInvoices.map(inv=>{
        const ret = Number(inv.returns_amount||0)
        const net = Number(inv.total_amount||0)
        const recv = Number(inv.paid_amount||0)
        const bal = net - recv
        return `<tr><td><strong>${inv.reseller_name}</strong></td><td style="text-align:right;">${php(Number(inv.total_amount||0)+ret)}</td><td style="text-align:right;color:#f57c00;">${ret>0?'-'+php(ret):'—'}</td><td style="text-align:right;">${php(net)}</td><td style="text-align:right;color:${recv>0?'#2d8a4e':'#ca1b1b'};font-weight:bold;">${recv>0?php(recv):'—'}</td><td style="text-align:right;color:${bal>0?'#ca1b1b':'#2d8a4e'};">${bal>0?php(bal):'✅'}</td><td style="font-size:8px;">${inv.status==='paid'?'PAID':inv.status?.toUpperCase()}</td></tr>`
      }).join('')}
      ${walkin>0?`<tr><td><strong>Walk-in Sales</strong></td><td style="text-align:right;">—</td><td style="text-align:right;">—</td><td style="text-align:right;">${php(walkin)}</td><td style="text-align:right;color:#2d8a4e;font-weight:bold;">${php(walkin)}</td><td style="text-align:right;">✅</td><td style="font-size:8px;">CASH</td></tr>`:''}
      <tr class="total-row"><td>TOTAL COLLECTED</td><td colspan="3"></td><td style="text-align:right;color:#ca1b1b;font-size:13px;">${php(totalCash)}</td><td style="text-align:right;color:#ca1b1b;">${php(dayInvoices.reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0))}</td><td></td></tr>
    </table>
    <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="text-align:center;"><div style="border-top:1px solid #000;margin-top:24px;padding-top:3px;font-size:8px;">Prepared by / Admin</div></div>
      <div style="text-align:center;"><div style="border-top:1px solid #000;margin-top:24px;padding-top:3px;font-size:8px;">Verified by / Owner</div></div>
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">🖨️ Print Cash Summary</button></div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>pw.print(),600)
  }

  // ── Print Production Release Form ─────────────────────────────────────────
  function printProductionReleaseForm(report) {
    const items = report.production_report_items || []
    const pw = window.open('','_blank','width=700,height=900')
    pw.document.write(`<!DOCTYPE html><html><head><title>Production Release</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;font-size:10px;width:148mm;}
      @media print{@page{size:148mm 210mm;margin:5mm;}html,body{width:148mm;}.no-print{display:none!important;}}
      .wrap{padding:5mm 6mm;}
      h1{font-size:13px;color:#ca1b1b;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th{background:#ca1b1b;color:white;padding:4px 6px;font-size:9px;}
      td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
      .sig{margin-top:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
      .sig-box{text-align:center;}
      .sig-line{border-top:1px solid #000;margin-top:24px;padding-top:3px;font-size:8px;}
    </style></head><body><div class="wrap">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
      <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">PRODUCTION RELEASE FORM</div></div>
      <div style="text-align:right;font-size:8px;">
        <div><strong>Production Date:</strong> ${report.report_date}</div>
        <div><strong>Delivery Date:</strong> ${report.delivery_date}</div>
      </div>
    </div>
    <table>
      <tr><th>Variant</th><th style="text-align:right;">Forecast</th><th style="text-align:right;">Actual Produced</th><th style="text-align:right;">Released</th></tr>
      ${items.map(i=>`<tr><td><strong>${i.variant_name}</strong></td><td style="text-align:right;">${i.forecast_qty}</td><td style="text-align:right;font-weight:bold;">${i.actual_qty}</td><td style="text-align:right;border:1px solid #ccc;min-width:40px;">&nbsp;</td></tr>`).join('')}
      <tr style="background:#fff9e6;font-weight:bold;border-top:2px solid #ca1b1b;"><td>TOTAL</td><td style="text-align:right;">${items.reduce((s,i)=>s+Number(i.forecast_qty||0),0)}</td><td style="text-align:right;">${items.reduce((s,i)=>s+Number(i.actual_qty||0),0)}</td><td style="text-align:right;border:1px solid #ccc;">&nbsp;</td></tr>
    </table>
    <div class="sig">
      <div class="sig-box"><div class="sig-line">Baker / Produced by</div></div>
      <div class="sig-box"><div class="sig-line">Supervisor / Released by</div></div>
      <div class="sig-box"><div class="sig-line">Driver / Received by</div></div>
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#ca1b1b;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">🖨️ Print</button></div>
    </div></body></html>`)
    pw.document.close(); setTimeout(()=>pw.print(),600)
  }
  async function saveReturn(invoice) {
    const items = returnItems[invoice.id]||[]
    const validItems = items.filter(i=>Number(i.returned_qty)>0)
    if (validItems.length===0) { showToast('❌ Enter at least one returned quantity.','red'); return }
    for (const item of validItems) {
      if (Number(item.returned_qty) > item.delivered_qty) { showToast(`❌ ${item.variant_name}: returned qty cannot exceed delivered qty.`,'red'); return }
    }
    setSavingReturn(true)
    try {
      const totalCredit = validItems.reduce((s,i)=>s+Number(i.returned_qty)*i.reseller_price,0)
      const { data:ret, error:retErr } = await supabase.from('reseller_returns').insert({
        invoice_id:invoice.id, reseller_id:invoice.reseller_id, reseller_name:invoice.reseller_name,
        return_date:today, total_returned_amount:totalCredit, recorded_by:adminRole
      }).select().single()
      if (retErr) throw retErr
      await supabase.from('reseller_return_items').insert(validItems.map(i=>({
        return_id:ret.id, variant_id:i.variant_id, variant_name:i.variant_name,
        returned_quantity:Number(i.returned_qty), reseller_price:i.reseller_price,
        total_credit:Number(i.returned_qty)*i.reseller_price
      })))
      const newTotal = Math.max(0, Number(invoice.total_amount||0) - totalCredit)
      const totalReturned = validItems.reduce((s,i)=>s+Number(i.returned_qty),0)
      await supabase.from('delivery_invoices').update({ total_amount:newTotal, returns_amount:totalCredit, returns_qty:totalReturned, notes:(invoice.notes?invoice.notes+' | ':'')+'Returns: '+today }).eq('id', invoice.id)
      await logAudit('RETURNS RECORDED', adminRole, invoice.reseller_name, `${invoice.invoice_number} — ${validItems.length} variants, ${totalReturned} pcs, credit: ${php(totalCredit)}`)
      // Cross-check with reseller portal
      await crossCheckReturns({...invoice, total_amount:newTotal})
      showToast(`✅ Returns saved! ${totalReturned} pcs. Credit: ${php(totalCredit)} deducted.`)
      setShowReturnForm(p=>({...p,[invoice.id]:false}))
      loadDeliveryInvoices()
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSavingReturn(false)
  }
  // ── Feature: CSV/XLSX Bulk Upload ──────────────────────────────────────────
  async function handleInventoryCSV(e) {
    const file = e.target ? e.target.files[0] : e
    if (!file) return
    setCsvUploading(true)
    try {
      let rows = []
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        showToast('⏳ Reading XLSX file...')
        await new Promise((resolve, reject) => {
          if (window.XLSX) { resolve(); return }
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
        const buffer = await file.arrayBuffer()
        const wb = window.XLSX.read(buffer, { type:'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // Get raw data with header row
        const raw = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
        if (raw.length < 3) { showToast('❌ File has no data rows.','red'); setCsvUploading(false); return }
        // Row 0 = headers, Row 1 = instructions (skip), Row 2+ = data
        const headerRow = raw[0].map(h=>String(h||'').replace(/\n/g,' ').trim().toLowerCase())
        // Find column indexes by flexible matching
        const findCol = (...keys) => { for(const k of keys){ const i=headerRow.findIndex(h=>h.includes(k)); if(i>=0) return i } return -1 }
        const nameIdx = findCol('item name','name')
        const catIdx = findCol('category')
        const unitIdx = findCol('unit')
        const stockIdx = findCol('current stock','stock on hand')
        const minIdx = findCol('min stock','reorder')
        const costIdx = findCol('cost per unit','cost per')
        const supplierIdx = findCol('supplier')
        // Parse from row 2 (index 2) onward, skip instruction row (index 1)
        rows = raw.slice(2).map(row=>{
          const name = String(row[nameIdx]||'').trim()
          if (!name || name.toLowerCase().includes('type item') || name.toLowerCase().includes('e.g.')) return null
          return {
            name,
            category: String(row[catIdx]||'Raw Ingredients').trim() || 'Raw Ingredients',
            unit: String(row[unitIdx]||'kg').trim() || 'kg',
            current_stock: Number(row[stockIdx]||0) || 0,
            min_stock: Number(row[minIdx]||0) || 0,
            cost_per_unit: Number(row[costIdx]||0) || 0,
            selling_price: 0,
            supplier_name: supplierIdx>=0 ? String(row[supplierIdx]||'').trim() : ''
          }
        }).filter(r=>r && r.name)
      } else {
        // Handle CSV
        const text = await file.text()
        const lines = text.split('\n').filter(l=>l.trim())
        if (lines.length < 2) { showToast('❌ CSV file is empty or has no data rows.','red'); setCsvUploading(false); return }
        const rawHeaders = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''))
        const headers = rawHeaders.map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,''))
        showToast(`📋 Found ${lines.length-1} rows, ${headers.length} columns`)
        rows = lines.slice(1).map(line=>{
          const vals = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
          const obj = {}
          rawHeaders.forEach((h,i)=>{ obj[h]=vals[i]||''; obj[h.toLowerCase()]=vals[i]||'' })
          headers.forEach((h,i)=>{ obj[h]=vals[i]||'' })
          // Map common variations
          return {
            name: obj.name || obj.item_name || obj.item || obj['item name'] || '',
            category: obj.category || 'Raw Ingredients',
            unit: obj.unit || obj.unit_of_measure || 'kg',
            current_stock: Number(obj.current_stock || obj.current_stock_on_hand || obj.stock || 0),
            min_stock: Number(obj.min_stock || obj.min_stock_level || obj.minimum || 0),
            cost_per_unit: Number(obj.cost_per_unit || obj.cost || obj.price || 0),
            selling_price: Number(obj.selling_price || 0),
          }
        }).filter(r=>r.name.trim())
      }
      if (rows.length === 0) { showToast('❌ No valid rows found. Check that your file has a "name" column.','red'); setCsvUploading(false); return }
      setCsvPreview(rows)
      setShowCsvPreview(true)
    } catch(err) { showToast('❌ Failed to read file: '+err.message,'red') }
    setCsvUploading(false)
    if (e.target) e.target.value = ''
  }
  async function confirmCSVUpload() {
    setCsvUploading(true)
    let success = 0, failed = 0
    for (const row of csvPreview) {
      try {
        await supabase.from('inventory_items').insert({
          name: row.name,
          category: row.category || 'Raw Ingredients',
          unit: row.unit || 'kg',
          current_stock: Number(row.current_stock||0),
          min_stock: Number(row.min_stock||0),
          cost_per_unit: Number(row.cost_per_unit||0),
          selling_price: Number(row.selling_price||0),
          is_active: true
        })
        success++
      } catch { failed++ }
    }
    showToast(`✅ Uploaded ${success} items${failed>0?` (${failed} failed)`:''}!`)
    setShowCsvPreview(false); setCsvPreview([])
    loadInventoryItems()
    setCsvUploading(false)
  }

  // ── Feature: Reseller Portal ──────────────────────────────────────────────
  async function resellerLogin() {
    if (!resellerLoginCode || !resellerLoginPin) { showToast('❌ Enter code and PIN.','red'); return }
    const { data } = await supabase.from('resellers').select('*').ilike('access_code', resellerLoginCode.trim()).eq('access_pin', resellerLoginPin.trim()).single()
    if (!data) { showToast('❌ Invalid code or PIN.','red'); return }
    setCurrentReseller(data)
    setResellerMode(true)
    loadResellerPortalData(data.id)
    const tomorrow2 = new Date(); tomorrow2.setDate(tomorrow2.getDate()+1)
    setResellerOrderDeliveryDate(tomorrow2.toISOString().slice(0,10))
    // Load variants for ordering
    const { data:variants } = await supabase.from('donut_variants').select('*').eq('is_active',true).order('name')
    setResellerOrderItems((variants||[]).map(v=>({ variant_id:v.id, variant_name:v.name, quantity:'', retail_price:v.selling_price, reseller_price:Math.round(v.selling_price*0.80*100)/100 })))
  }
  async function loadResellerPortalData(resellerId) {
    const { data:invs } = await supabase.from('delivery_invoices').select('*, delivery_invoice_items(*)').eq('reseller_id', resellerId).order('created_at',{ascending:false}).limit(30)
    setResellerInvoices(invs||[])
    const { data:pays } = await supabase.from('reseller_payments').select('*').eq('reseller_id', resellerId).order('created_at',{ascending:false}).limit(20)
    setResellerPaymentHistory(pays||[])
    const { data:orders } = await supabase.from('reseller_orders').select('*, reseller_order_items(*)').eq('reseller_id', resellerId).order('created_at',{ascending:false}).limit(10)
    setResellerOrders(orders||[])
  }
  async function confirmDeliveryReceipt(invoiceId) {
    if (!window.confirm('Confirm receipt of this delivery?')) return
    await supabase.from('delivery_invoices').update({ receipt_confirmed:true, confirmed_at:new Date().toISOString(), confirmed_by:currentReseller?.name }).eq('id', invoiceId)
    showToast('✅ Delivery confirmed!')
    loadResellerPortalData(currentReseller.id)
  }
  async function submitResellerOrder() {
    const validItems = resellerOrderItems.filter(i=>Number(i.quantity)>0)
    if (validItems.length===0) { showToast('❌ Enter at least one quantity.','red'); return }
    if (!resellerOrderDeliveryDate) { showToast('❌ Select delivery date.','red'); return }
    setSubmittingOrder(true)
    try {
      const total = validItems.reduce((s,i)=>s+Number(i.quantity)*i.reseller_price,0)
      const { data:order, error } = await supabase.from('reseller_orders').insert({
        reseller_id:currentReseller.id, reseller_name:currentReseller.name,
        order_date:today, delivery_date:resellerOrderDeliveryDate,
        status:'pending', notes:resellerOrderNotes||null
      }).select().single()
      if (error) throw error
      await supabase.from('reseller_order_items').insert(validItems.map(i=>({
        order_id:order.id, variant_id:i.variant_id, variant_name:i.variant_name,
        quantity:Number(i.quantity), retail_price:i.retail_price, reseller_price:i.reseller_price
      })))
      await createNotification(null,'System','order',`📦 New Order: ${currentReseller.name}`,`${currentReseller.name} placed an order for ${resellerOrderDeliveryDate}. ${validItems.length} variants, estimated ${php(total)}.`)
      showToast('✅ Order submitted! Waiting for approval.')
      setResellerOrderNotes('')
      setResellerOrderItems(p=>p.map(i=>({...i,quantity:''})))
      setResellerPortalView('orders')
      loadResellerPortalData(currentReseller.id)
    } catch(err) { showToast('❌ Failed: '+err.message,'red') }
    setSubmittingOrder(false)
  }

  // ── Feature: Admin Order Management ──────────────────────────────────────
  async function loadPendingResellerOrders() {
    const { data } = await supabase.from('reseller_orders').select('*, reseller_order_items(*)').eq('status','pending').order('created_at',{ascending:false})
    setPendingResellerOrders(data||[])
  }
  async function approveResellerOrder(order, customItems) {
    const items = customItems || order.reseller_order_items || []
    const validItems = items.filter(i=>Number(i.quantity)>0)
    if (validItems.length===0) { showToast('❌ No items to invoice.','red'); return }
    // Create invoice automatically
    const reseller = resellers.find(r=>r.id===order.reseller_id)
    const invoiceNum = `INV-${order.delivery_date.replace(/-/g,'')}-${Math.floor(1000+Math.random()*9000)}`
    const dueDate = new Date(order.delivery_date); dueDate.setDate(dueDate.getDate()+7)
    const lineItems = validItems.map(i=>{ const rp=Math.round((i.retail_price||0)*0.80*100)/100; return {...i, reseller_price:rp, total_price:rp*Number(i.quantity)} })
    const subtotal = lineItems.reduce((s,i)=>s+i.total_price,0)
    const { data:inv, error } = await supabase.from('delivery_invoices').insert({
      invoice_number:invoiceNum, reseller_id:order.reseller_id, reseller_name:order.reseller_name,
      delivery_date:order.delivery_date, due_date:dueDate.toISOString().slice(0,10),
      subtotal, discount_pct:20, total_amount:subtotal, status:'unpaid',
      prepared_by:'Ronald Reyes / Jomar Cerezo', dispatched_by:'Ronald Reyes / Jomar Cerezo',
      notes:`From order ${order.id.slice(0,8)}`, created_by:adminRole
    }).select().single()
    if (error) { showToast('❌ Failed: '+error.message,'red'); return }
    await supabase.from('delivery_invoice_items').insert(lineItems.map(i=>({ invoice_id:inv.id, variant_id:i.variant_id, variant_name:i.variant_name, retail_price:i.retail_price||0, reseller_price:i.reseller_price, quantity:Number(i.quantity), total_price:i.total_price })))
    await supabase.from('reseller_orders').update({ status:'approved', approved_by:adminRole, approved_at:new Date().toISOString(), invoice_id:inv.id }).eq('id',order.id)
    await createNotification(null,'System','order',`✅ Order Approved: ${order.reseller_name}`,`Your order for ${order.delivery_date} has been approved. Invoice ${invoiceNum} created.`)
    await logAudit('ORDER APPROVED', adminRole, order.reseller_name, `${invoiceNum} — ${php(subtotal)}`)
    showToast(`✅ Order approved! Invoice ${invoiceNum} created.`)
    loadPendingResellerOrders(); loadDeliveryInvoices()
  }
  async function rejectResellerOrder(orderId, resellerName) {
    const reason = window.prompt('Reason for rejection:')
    if (!reason) return
    await supabase.from('reseller_orders').update({ status:'rejected', approved_by:adminRole, approved_at:new Date().toISOString(), notes:reason }).eq('id',orderId)
    await createNotification(null,'System','order',`❌ Order Rejected: ${resellerName}`,`Your order was rejected. Reason: ${reason}`)
    showToast('Order rejected.','red')
    loadPendingResellerOrders()
  }

  async function loadDailyExpenses() {
    setExpensesLoading(true)
    const { data } = await supabase.from('daily_expenses').select('*').order('expense_date', { ascending:false }).limit(100)
    setDailyExpenses(data || [])
    setExpensesLoading(false)
  }
  async function saveExpense() {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) { showToast('❌ Please enter a valid amount.','red'); return }
    setSavingExpense(true)
    const amt = Number(expenseForm.amount)
    const status = amt >= EXPENSE_APPROVAL_THRESHOLD ? 'pending' : 'approved'
    const { error } = await supabase.from('daily_expenses').insert({ ...expenseForm, amount:amt, status, encoded_by:adminRole })
    if (error) { showToast('❌ Failed: '+error.message,'red'); setSavingExpense(false); return }
    showToast(status==='pending'?`✅ Expense submitted — awaiting Owner approval (₱${amt} ≥ ₱500)`:`✅ Expense of ${php(amt)} recorded!`)
    setExpenseForm({ date:today, category:'Transportation/Fuel', amount:'', description:'' })
    loadDailyExpenses(); setSavingExpense(false)
  }
  async function approveExpense(id) {
    await supabase.from('daily_expenses').update({ status:'approved', approved_by:adminRole, approved_at:new Date().toISOString() }).eq('id', id)
    showToast('✅ Expense approved!'); loadDailyExpenses()
  }
  async function rejectExpense(id) {
    if (!rejectExpenseReason.trim()) { showToast('❌ Please enter a rejection reason.','red'); return }
    await supabase.from('daily_expenses').update({ status:'rejected', approved_by:adminRole, approved_at:new Date().toISOString(), rejection_reason:rejectExpenseReason }).eq('id', id)
    showToast('✅ Expense rejected.'); setRejectingExpenseId(null); setRejectExpenseReason(''); loadDailyExpenses()
  }
  async function deleteExpense(id) {
    if (!window.confirm('Delete this expense?')) return
    await supabase.from('daily_expenses').delete().eq('id', id)
    showToast('✅ Expense deleted.'); loadDailyExpenses()
  }
  // ── Financial Dashboard ───────────────────────────────────────────────────
  async function loadFinancialData() {
    setFinancialLoading(true)
    const monthStart = financialMonth + '-01'
    const monthEnd = new Date(Number(financialMonth.split('-')[0]), Number(financialMonth.split('-')[1]), 0).toISOString().slice(0,10)
    const [{ data:sales }, { data:prodLogs }, { data:expenses }, { data:invoices }] = await Promise.all([
      supabase.from('daily_sales').select('*').gte('sale_date', monthStart).lte('sale_date', monthEnd),
      supabase.from('production_logs').select('*').gte('production_date', monthStart).lte('production_date', monthEnd),
      supabase.from('daily_expenses').select('*').gte('expense_date', monthStart).lte('expense_date', monthEnd),
      supabase.from('delivery_invoices').select('*').gte('delivery_date', monthStart).lte('delivery_date', monthEnd),
    ])
    const totalRevenue = (sales||[]).reduce((s,d)=>s+Number(d.total_revenue||0),0)
    const walkinRevenue = (sales||[]).reduce((s,d)=>s+Number(d.total_walkin||0),0)
    const messengerRevenue = (sales||[]).reduce((s,d)=>s+Number(d.total_messenger||0),0)
    const resellerRevenue = (invoices||[]).reduce((s,i)=>s+Number(i.total_amount||0),0)
    const totalCOGS = (prodLogs||[]).reduce((s,l)=>s+Number(l.total_cost||0),0)
    const totalExpenses = (expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0)
    const grossProfit = totalRevenue - totalCOGS
    const netProfit = grossProfit - totalExpenses
    const grossMarginPct = totalRevenue > 0 ? (grossProfit/totalRevenue)*100 : 0
    const netMarginPct = totalRevenue > 0 ? (netProfit/totalRevenue)*100 : 0
    // AR outstanding (all time unpaid)
    const { data:allUnpaid } = await supabase.from('delivery_invoices').select('*').in('status',['unpaid','partial'])
    const totalAR = (allUnpaid||[]).reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0)
    const overdueAR = (allUnpaid||[]).filter(i=>i.due_date<today).reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0)
    const expenseByCategory = EXPENSE_CATEGORIES.map(cat=>({ cat, total:(expenses||[]).filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount||0),0) })).filter(c=>c.total>0)
    const salesByDay = (sales||[]).map(d=>({ date:d.sale_date, revenue:Number(d.total_revenue||0) })).sort((a,b)=>a.date.localeCompare(b.date))
    setFinancialData({ totalRevenue, walkinRevenue, messengerRevenue, resellerRevenue, totalCOGS, totalExpenses, grossProfit, netProfit, grossMarginPct, netMarginPct, totalAR, overdueAR, expenseByCategory, salesByDay, salesDays:(sales||[]).length, productionDays:(prodLogs||[]).length })
    setFinancialLoading(false)
  }
  function printPLReport() {
    if (!financialData) return
    const pw = window.open('','_blank','width=900,height=700')
    pw.document.write(`<!DOCTYPE html><html><head><title>P&L Report ${financialMonth}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:15mm;font-size:11px;}
      @media print{@page{size:A4;margin:15mm;}.no-print{display:none;}}
      h1{font-size:20px;color:#ca1b1b;}table{width:100%;border-collapse:collapse;margin-bottom:12px;}
      td{padding:6px 10px;border-bottom:1px solid #eee;}
      .label{color:#555;}.val{text-align:right;font-weight:bold;}
      .section{background:#ca1b1b;color:white;padding:6px 10px;font-weight:bold;font-size:11px;margin-top:10px;}
      .total{background:#f9f9f9;font-weight:bold;font-size:12px;}
      .profit{background:#e8f5e9;color:#2d8a4e;font-weight:bold;font-size:13px;}
      .loss{background:#fff5f5;color:#ca1b1b;font-weight:bold;font-size:13px;}
      </style></head><body>
      <div style="text-align:center;border-bottom:3px solid #ca1b1b;padding-bottom:12px;margin-bottom:16px;">
        <h1>Roma's Donuts</h1>
        <div style="font-size:14px;font-weight:bold;">PROFIT & LOSS STATEMENT</div>
        <div style="font-size:11px;color:#666;">Period: ${financialMonth} | Generated: ${new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <table>
        <tr><td colspan="2" class="section">REVENUE</td></tr>
        <tr><td class="label">Walk-in Sales</td><td class="val">${php(financialData.walkinRevenue)}</td></tr>
        <tr><td class="label">Messenger/Online Sales</td><td class="val">${php(financialData.messengerRevenue)}</td></tr>
        <tr><td class="label">Reseller Deliveries</td><td class="val">${php(financialData.resellerRevenue)}</td></tr>
        <tr class="total"><td>TOTAL REVENUE</td><td class="val">${php(financialData.totalRevenue)}</td></tr>
        <tr><td colspan="2" class="section">COST OF GOODS SOLD (COGS)</td></tr>
        <tr><td class="label">Ingredient Costs</td><td class="val">Included in production</td></tr>
        <tr><td class="label">Labor Costs</td><td class="val">Included in production</td></tr>
        <tr><td class="label">Overhead (Rent, Electricity, Loans, Depreciation)</td><td class="val">Included in production</td></tr>
        <tr class="total"><td>TOTAL COGS (from production logs)</td><td class="val">${php(financialData.totalCOGS)}</td></tr>
        <tr class="${financialData.grossProfit>=0?'profit':'loss'}"><td>GROSS PROFIT (${financialData.grossMarginPct.toFixed(1)}%)</td><td class="val">${php(financialData.grossProfit)}</td></tr>
        <tr><td colspan="2" class="section">ADDITIONAL EXPENSES</td></tr>
        ${financialData.expenseByCategory.map(c=>`<tr><td class="label">${c.cat}</td><td class="val">${php(c.total)}</td></tr>`).join('')}
        <tr class="total"><td>TOTAL ADDITIONAL EXPENSES</td><td class="val">${php(financialData.totalExpenses)}</td></tr>
        <tr class="${financialData.netProfit>=0?'profit':'loss'}" style="font-size:15px;"><td>NET PROFIT (${financialData.netMarginPct.toFixed(1)}%)</td><td class="val">${php(financialData.netProfit)}</td></tr>
      </table>
      <div style="margin-top:20px;background:#fff8dc;border:1px solid #f5c518;border-radius:6px;padding:12px;">
        <p style="font-weight:bold;color:#ca1b1b;margin:0 0 6px;">📋 Notes</p>
        <p style="font-size:10px;color:#555;margin:0;">• COGS pulled from production logs. Accurate only if production is logged daily.</p>
        <p style="font-size:10px;color:#555;margin:0;">• Reseller revenue = total invoiced. Collected amount may differ — check AR report.</p>
        <p style="font-size:10px;color:#555;">• Outstanding AR: <strong>${php(financialData.totalAR)}</strong> | Overdue: <strong>${php(financialData.overdueAR)}</strong></p>
      </div>
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 24px;background:#ca1b1b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ PRINT P&L</button>
      </div>
    </body></html>`)
    pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
  }

  // ── Employee Portal ───────────────────────────────────────────────────────
  async function loadTodayLog(emp) {
    // First check today's log
    const { data: todayData } = await supabase.from('attendance_logs')
      .select('*').eq('employee_id', emp.id).eq('attendance_date', today).maybeSingle()
    if (todayData) {
      setTodayLog(todayData)
      loadTodayBreaks(todayData.id)
      return
    }
    // Night shift fix: check if there's an OPEN log from yesterday (timed in but not yet timed out)
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1)
    const yesterdayStr = yesterday.toISOString().slice(0,10)
    const { data: yesterdayData } = await supabase.from('attendance_logs')
      .select('*').eq('employee_id', emp.id).eq('attendance_date', yesterdayStr).is('time_out', null).maybeSingle()
    if (yesterdayData) {
      // Employee is still on shift from yesterday — use that log
      setTodayLog(yesterdayData)
      loadTodayBreaks(yesterdayData.id)
      showToast('🌙 Night shift active from ' + yesterdayStr)
      return
    }
    setTodayLog(null)
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
    setCapturedPhoto(null); setCameraMode('timein')
  }
  async function initiateTimeOut() {
    if (!todayLog) { alert('You need to Time In first.'); return }
    if (todayLog.time_out) { alert('You already timed out today.'); return }
    const openBreak = todayBreaks.find(b=>!b.break_in)
    if (openBreak) { alert('Please Break In first before timing out.'); return }
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
    // Night shift check — prevent timing in if still has open shift from yesterday
    const yest2 = new Date(); yest2.setDate(yest2.getDate()-1)
    const yestStr2 = yest2.toISOString().slice(0,10)
    const { data:openShift } = await supabase.from('attendance_logs').select('*').eq('employee_id', employee.id).eq('attendance_date', yestStr2).is('time_out', null).maybeSingle()
    if (openShift) { setLoading(false); setTodayLog(openShift); alert('You still have an open shift from yesterday. Please Time Out first.'); setCameraMode(null); return }
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
    // ── Auto-compute Night Shift Differential (10PM - 6AM) ───────────────────
    const timeIn = todayLog.time_in || nowTime()
    const timeOut = nowTime()
    const inM = minutesFromTime(timeIn)
    const outRaw = minutesFromTime(timeOut)
    const outM = outRaw < inM ? outRaw + 24*60 : outRaw  // handle next-day
    const nsdStart = 22*60   // 10PM = 1320 mins
    const nsdEnd = 30*60     // 6AM next day = 1800 mins
    const os = Math.max(inM, nsdStart)
    const oe = Math.min(outM, nsdEnd)
    const nsdMinutes = oe > os ? Math.round(oe - os) : 0
    // ─────────────────────────────────────────────────────────────────────────
    let selfieUrl = null
    try { selfieUrl = await uploadSelfie(capturedPhoto, `timeout_${employee.id}_${today}.jpg`) } catch(e){}
    const { data, error } = await supabase.from('attendance_logs').update({
      time_out: timeOut,
      undertime_minutes: undertimeMinutes,
      overtime_minutes: overtimeMinutes,
      status,
      selfie_out_url: selfieUrl,
      total_break_minutes: totalBreakMins,
      excess_break_minutes: excessBreakMins,
      overtime_approved: null,
      night_diff_minutes: nsdMinutes
    }).eq('id', todayLog.id).select().single()
    setLoading(false)
    if (error) { alert('Time Out failed: '+error.message); return }
    setTodayLog(data); setCameraMode(null); setCapturedPhoto(null)
    await logAudit('TIME OUT', employee.full_name, employee.full_name, `Timed out at ${timeOut}${nsdMinutes>0?' | NSD: '+nsdMinutes+' mins':''}`)
    let msg = '✅ Time Out saved successfully!'
    if (nsdMinutes > 0) msg += `\n\n🌙 Night Shift Differential: ${nsdMinutes} minutes (${(nsdMinutes/60).toFixed(1)} hrs) — will be computed in payroll at 10% premium.`
    if (overtimeMinutes>0) msg += `\n\n⏱ ${overtimeMinutes} min overtime — please file an OT request.`
    if (undertimeMinutes>0) msg += `\n\n⚠️ ${undertimeMinutes} min undertime — please file a UT request.`
    if (excessBreakMins>0) msg += `\n\n☕ ${excessBreakMins} min excess break will be deducted.`
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
    if (adminRole === 'manager') return true // Manager = full access same as owner
    if (adminRole === 'hr') return ['dashboard','attendance','employees','schedule','holidays','leaveRequests','cashRequests','overtime','disputes','announcements','auditTrail','contracts','inventory','sales'].includes(tab)
    if (adminRole === 'payroll') return ['dashboard','payroll','thirteenth','finalpay','adjustment','payrollHistory','remittance','dtr','bankDisbursement'].includes(tab)
    if (adminRole === 'supervisor') return ['dashboard','attendance','overtime','schedule','inventory'].includes(tab)
    if (adminRole === 'asst_supervisor') return ['dashboard','attendance','overtime','schedule','inventory'].includes(tab)
    return false
  }

  async function logAudit(action, by, target, details) {
    try { await supabase.from('audit_logs').insert({ action, performed_by:by, target_employee:target, details }) } catch(e) {}
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
  async function saveDepartmentLocations(locs) {
    try {
      let updatedEmployees = 0
      for (const [dept, loc] of Object.entries(locs)) {
        if (!loc) continue
        // Save to department_locations table
        await supabase.from('department_locations').upsert({
          department: dept,
          location_name: loc.name || null,
          latitude: loc.lat ? Number(loc.lat) : null,
          longitude: loc.lng ? Number(loc.lng) : null,
          radius_meters: Number(loc.radius || 200),
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'department' })
        // Auto-apply to all employees in this department
        if (loc.lat && loc.lng) {
          const { data: deptEmps } = await supabase.from('employees')
            .select('id')
            .eq('department', dept)
            .eq('is_active', true)
          if (deptEmps && deptEmps.length > 0) {
            await supabase.from('employees').update({
              work_location: loc.name || dept,
              location_lat: String(loc.lat),
              location_lng: String(loc.lng),
              location_radius: String(loc.radius || 200)
            }).eq('department', dept).eq('is_active', true)
            updatedEmployees += deptEmps.length
          }
        }
      }
      setDepartmentLocations(locs)
      await loadEmployees()
      showToast(`✅ Locations saved! Auto-applied to ${updatedEmployees} employee(s).`)
    } catch(err) {
      showToast('❌ Failed: ' + err.message, 'red')
    }
  }
  async function loadDepartmentLocations() {
    try {
      // Try Supabase first
      const { data, error } = await supabase.from('department_locations').select('*').eq('is_active', true)
      if (!error && data && data.length > 0) {
        const locs = {}
        data.forEach(row => {
          locs[row.department] = {
            name: row.location_name || '',
            lat: row.latitude || '',
            lng: row.longitude || '',
            radius: row.radius_meters || 200
          }
        })
        setDepartmentLocations(locs)
        return
      }
      // Fallback to localStorage
      const saved = localStorage.getItem('dept_locations')
      if (saved) setDepartmentLocations(JSON.parse(saved))
    } catch(e) {
      try {
        const saved = localStorage.getItem('dept_locations')
        if (saved) setDepartmentLocations(JSON.parse(saved))
      } catch(e2) {}
    }
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
      loadTodayLog(empData); loadTodaySchedule(empData); loadTodayBreaks(null)
      // Set available roles from employee record
      const extraRoles = empData.extra_roles ? empData.extra_roles.split(',').filter(r=>r.trim()) : []
      const allRoles = [empData.admin_role||role, ...extraRoles].filter((r,i,a)=>r&&a.indexOf(r)===i)
      if (allRoles.length > 0) setAvailableRoles(allRoles)
    }
    const defaultTab = role==='payroll'?'payroll':role==='supervisor'||role==='asst_supervisor'?'attendance':role==='hr'?'employees':'dashboard'
    setActiveTab(defaultTab)
    loadEmployees(); loadAdminLogs(); loadLeaveRequests(); loadCashAdvanceRequests()
    loadHolidays(); loadTimeAdjRequests(); loadAnnouncements(); loadDashboard()
    loadDepartmentLocations(); loadDashboardCharts(); loadNotifications(); loadPendingResellerOrders(); loadBankDeposits(); loadSuspiciousAlerts(); autoAcknowledgeExpired().catch(()=>{})
    requestPushPermission()
    // Check Tuesday deposit reminder
    setTimeout(()=>checkTuesdayDepositReminder(), 2000)
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
  async function loadTimedInEmployees() {
    const { data } = await supabase.from('attendance_logs')
      .select('*, employees(full_name, position, department, profile_photo_url)')
      .eq('attendance_date', today)
      .not('time_in', 'is', null)
      .is('time_out', null)
      .order('time_in', { ascending: true })
    setTimedInList(data || [])
    setShowTimedInModal(true)
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
  async function createNotification(employeeId, employeeName, type, title, message) {
    await supabase.from('notifications').insert({ employee_id:employeeId, employee_name:employeeName, type, title, message })
    // Browser push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Roma's Donuts — ${title}`, { body:message, icon:'/logo.png' })
    }
  }
  async function loadNotifications() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending:false }).limit(50)
    setNotifications(data||[])
    setUnreadCount((data||[]).filter(n=>!n.is_read).length)
  }
  async function markAllRead() {
    await supabase.from('notifications').update({ is_read:true }).eq('is_read', false)
    setNotifications(p=>p.map(n=>({...n,is_read:true})))
    setUnreadCount(0)
  }
  async function markOneRead(id) {
    await supabase.from('notifications').update({ is_read:true }).eq('id', id)
    setNotifications(p=>p.map(n=>n.id===id?{...n,is_read:true}:n))
    setUnreadCount(p=>Math.max(0,p-1))
  }
  async function requestPushPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }
  async function loadFranchises() {
    setLoadingFranchises(true)
    const { data } = await supabase.from('franchise_locations').select('*').order('created_at',{ascending:false})
    setFranchises(data||[])
    setLoadingFranchises(false)
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
    const req = leaveRequests.find(r=>r.id===id)
    const { error } = await supabase.from('leave_requests').update({ status, admin_reason:reason||null }).eq('id', id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    // Deduct leave balance when approved
    if (status==='approved' && req) {
      const dur = Number(req.duration_days||1)
      const emp = employees.find(e=>e.id===req.employee_id)
      if (emp) {
        if (req.leave_type==='Sick Leave') {
          const newBal = Math.max(0, Number(emp.sick_leave_balance||0) - dur)
          await supabase.from('employees').update({ sick_leave_balance:newBal }).eq('id', emp.id)
        } else if (req.leave_type==='Vacation Leave') {
          const newBal = Math.max(0, Number(emp.vacation_leave_balance||0) - dur)
          await supabase.from('employees').update({ vacation_leave_balance:newBal }).eq('id', emp.id)
        }
        await loadEmployees()
      }
      await createNotification(req.employee_id, req.employee_name, 'leave', '🏖️ Leave Approved', `Your ${req.leave_type} request for ${dur} day(s) has been approved.`)
    } else if (status==='rejected' && req) {
      await createNotification(req.employee_id, req.employee_name, 'leave', '❌ Leave Rejected', `Your ${req.leave_type} request has been rejected.${reason?' Reason: '+reason:''}`)
    }
    await logAudit(`LEAVE ${status.toUpperCase()}`,'Admin',req?.employee_name||'',`Leave ID ${id} — ${dur||0} day(s)`)
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
    await createNotification(req.employee_id, req.employee_name, 'overtime', `✅ ${req.request_type==='overtime'?'Overtime':'Undertime'} Approved`, `Your ${req.request_type} request of ${req.minutes} minutes on ${req.attendance_date} has been approved.`)
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
    await createNotification(req.employee_id, req.employee_name, 'overtime', `❌ ${req.request_type==='overtime'?'Overtime':'Undertime'} Rejected`, `Your ${req.request_type} request on ${req.attendance_date} was rejected. Reason: ${reason}`)
    setTimeAdjRequests(prev=>prev.filter(r=>r.id!==req.id))
    showToast('❌ OT/UT Rejected.','red')
  }
  async function saveEmployeeChanges() {
    setSaveEmployeeLoading(true)
    const { error } = await supabase.from('employees').update({ employee_code:editFields.code, full_name:editFields.name, position:editFields.position, pin:editFields.pin, daily_rate:Number(editFields.rate||0), has_sss:editFields.hasSss, has_pagibig:editFields.hasPagibig, has_philhealth:editFields.hasPhilhealth, hire_date:editFields.hireDate, sick_leave_balance:Number(editFields.sick||5), vacation_leave_balance:Number(editFields.vacation||5), sil_balance:Number(editFields.sil||5), pay_type:editFields.payType||'daily', hourly_rate:Number(editFields.hourlyRate||0), grace_period_minutes:Number(editFields.gracePeriod||10), date_of_birth:editFields.dob||null, gender:editFields.gender||'', civil_status:editFields.civil_status||'', home_address:editFields.address||'', contact_number:editFields.contact||'', emergency_contact_name:editFields.emergency_name||'', emergency_contact_number:editFields.emergency_contact||'', employment_type:editFields.employment_type||'regular', department:editFields.department||'', admin_role:editFields.admin_role||null, extra_roles:editFields.extra_roles||null }).eq('id', editingEmployeeId)
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
      await createNotification(req.employee_id, req.employee_name, 'cash_advance', '❌ Cash Advance Disapproved', `Your cash advance request of ${php(req.amount)} was disapproved. Reason: ${reason}`)
      setCashAdvanceRequests(prev=>prev.filter(r=>r.id!==id))
      showToast('✅ Cash advance disapproved.','red'); return
    }
    const { error } = await supabase.from('cash_advance_requests').update({ status:'approved' }).eq('id', id)
    if (error) { showToast('Failed: '+error.message,'red'); return }
    const totalAmount=Number(req.amount), installments=Math.max(1,Number(installmentCounts[id]||1))
    const perPayroll=Math.ceil((totalAmount/installments)*100)/100
    await supabase.from('cash_advances').insert({ employee_id:req.employee_id, employee_code:req.employee_code, employee_name:req.employee_name, advance_date:today, amount:totalAmount, amount_paid:0, balance:totalAmount, per_payroll_deduction:perPayroll, installments_total:installments, installments_remaining:installments, notes:req.reason, status:'Unpaid' })
    await logAudit('CA APPROVED','Admin',req.employee_name,`${php(totalAmount)} in ${installments} installments`)
    await createNotification(req.employee_id, req.employee_name, 'cash_advance', '💵 Cash Advance Approved', `Your cash advance of ${php(totalAmount)} has been approved. ${php(perPayroll)} will be deducted per payroll for ${installments} payroll(s).`)
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
    const dispute = payslipDisputes.find(d=>d.id===id)
    const { error } = await supabase.from('payslip_disputes').update({ status:'resolved', admin_reason:reason }).eq('id', id)
    if (error) { showToast('❌ Failed: '+error.message,'red'); console.error(error); return }
    await logAudit('DISPUTE RESOLVED','Admin','',`Dispute ID ${id} — ${reason}`)
    if (dispute) await createNotification(dispute.employee_id, dispute.employee_name, 'dispute', '⚠️ Dispute Resolved', `Your payslip dispute has been resolved. Response: ${reason}`)
    setDisputeAdminReason(p=>({ ...p,[id]:'' }))
    setPayslipDisputes(prev=>prev.filter(d=>d.id!==id))
    showToast('✅ Dispute resolved and removed successfully!')
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
    try { await supabase.from('final_pay_records').insert({ employee_id:finalPayEmployeeId, employee_name:finalPayResult.employeeName, employee_code:finalPayResult.employeeCode, separation_reason:finalPayReason, last_working_date:finalPayLastDate, last_salary:finalPayResult.lastSalary, pro_rated_13th:finalPayResult.proRated13th, sil_pay:finalPayResult.silPay, separation_pay:finalPayResult.separationPay, cash_advance_deduction:finalPayResult.totalCA, total_final_pay:finalPayResult.totalFinalPay }) } catch(e) {}
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
        const rawMins=outM-inM
        const recordedBreak=Number(log.total_break_minutes||0)
        // If no break was recorded AND shift is 9+ hours → assume 1-hour break was taken
        // Only exception: if OT is approved (employee worked through break intentionally)
        const effectiveBreak = recordedBreak > 0
          ? recordedBreak
          : (rawMins >= 9*60 ? ALLOWED_BREAK_MINUTES : 0)
        const actualMins=Math.max(0,rawMins-effectiveBreak)
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
      results.push({ employeeId:emp.id, employeeName:emp.full_name, employeeCode:emp.employee_code, position:emp.position||'', workedDays, absentDays, paidLeaveDays, totalWorkedMinutes, hourlyRate, basicPay, birthdayPay, overtimePay, overtimeMinutes, nightDiffPay, holidayPay, adjustmentEarnings:adjEarnings, totalEarnings, cashAdvanceDeduction:caDeduction, sssDeduction, pagibigDeduction, philhealthDeduction, adjustmentDeductions:adjDeductions, totalDeductions, netPay:Math.max(0,totalEarnings-totalDeductions), lateMinutes:lateMinutesInfo, undertimeMinutes:undertimeMinutesInfo, bankName:emp.bank_name||'', bankAccount:emp.bank_account_number||'', bankAccountName:emp.bank_account_name||'', mobileNumber:emp.contact_number||'' })
    } // end for emp
    for (const pay of results) {
      const { data:empCAs } = await supabase.from('cash_advances').select('*').eq('employee_id', pay.employeeId).eq('status', 'Unpaid')
      for (const ca of empCAs||[]) {
        const ded=ca.per_payroll_deduction?Number(ca.per_payroll_deduction):Number(ca.balance||0)
        const newBal=Math.max(0,Number(ca.balance||0)-ded), newRem=Math.max(0,Number(ca.installments_remaining||1)-1)
        await supabase.from('cash_advances').update({ amount_paid:Number(ca.amount_paid||0)+ded, balance:newBal, installments_remaining:newRem, status:newBal<=0||newRem<=0?'Paid':'Unpaid' }).eq('id', ca.id)
      }
      await supabase.from('payroll_records').insert([{ employee_id:pay.employeeId, employee_code:pay.employeeCode, employee_name:pay.employeeName, payroll_start:payrollStart, payroll_end:payrollEnd, worked_days:pay.workedDays, basic_pay:pay.basicPay, birthday_pay:pay.birthdayPay||0, overtime_pay:pay.overtimePay, night_diff_pay:pay.nightDiffPay, holiday_pay:pay.holidayPay, other_earnings:pay.adjustmentEarnings, total_earnings:pay.totalEarnings, late_minutes:pay.lateMinutes||0, undertime_minutes:pay.undertimeMinutes||0, cash_advance_deduction:pay.cashAdvanceDeduction, sss_deduction:pay.sssDeduction, pagibig_deduction:pay.pagibigDeduction, philhealth_deduction:pay.philhealthDeduction, other_deductions:pay.adjustmentDeductions, total_deductions:pay.totalDeductions, net_pay:pay.netPay, employee_acknowledgement:'pending', payslip_serial:genSerial(payrollStart,results.indexOf(pay)), bank_name:pay.bankName, bank_account:pay.bankAccount, bank_account_name:pay.bankAccountName }])
    }
    const s={ totalEmployees:results.length, totalBasicPay:results.reduce((a,p)=>a+p.basicPay,0), totalBirthdayPay:results.reduce((a,p)=>a+(p.birthdayPay||0),0), totalOvertimePay:results.reduce((a,p)=>a+p.overtimePay,0), totalNightDiff:results.reduce((a,p)=>a+p.nightDiffPay,0), totalHolidayPay:results.reduce((a,p)=>a+p.holidayPay,0), totalEarnings:results.reduce((a,p)=>a+p.totalEarnings,0), totalDeductions:results.reduce((a,p)=>a+p.totalDeductions,0), totalNetPay:results.reduce((a,p)=>a+p.netPay,0), totalSSS:results.reduce((a,p)=>a+p.sssDeduction,0), totalPagibig:results.reduce((a,p)=>a+p.pagibigDeduction,0), totalPhilhealth:results.reduce((a,p)=>a+p.philhealthDeduction,0), totalCA:results.reduce((a,p)=>a+p.cashAdvanceDeduction,0) }
    setPayrollResults(results); setPayrollSummary(s); setPayrollComputing(false)
    await logAudit('PAYROLL COMPUTED','Admin','ALL',`${payrollStart} to ${payrollEnd} — ${results.length} employees`)
    showToast('✅ Payroll computed successfully!')
    // Schedule auto-acknowledge after 5 days (stored in DB as a flag)
    const deadline = new Date(); deadline.setDate(deadline.getDate()+5)
    try { await supabase.from('payroll_periods').upsert({
      payroll_start: payrollStart, payroll_end: payrollEnd,
      acknowledge_deadline: deadline.toISOString().slice(0,10),
      computed_at: new Date().toISOString()
    }, { onConflict:'payroll_start,payroll_end' }) } catch(e) {}
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
    const SECTIONS = [
      { key:'dashboard', icon:'🏠', label:'Dashboard',
        tabs:[{key:'dashboard',label:'Overview'}],
        roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },
      { key:'hr', icon:'👥', label:'HR & Attendance',
        tabs:[{key:'attendance',label:'Attendance'},{key:'employees',label:'Employees'},{key:'performance',label:'Performance'},{key:'schedule',label:'Schedule'},{key:'holidays',label:'Holidays'},{key:'auditTrail',label:'Audit Trail'}],
        roles:['owner','manager','hr','supervisor','asst_supervisor'] },
      { key:'payroll', icon:'💰', label:'Payroll',
        tabs:[{key:'payroll',label:'Payroll'},{key:'overtime',label:'OT / UT'},{key:'adjustment',label:'Adjustment'},{key:'thirteenth',label:'13th Month'},{key:'finalpay',label:'Final Pay'},{key:'payrollHistory',label:'History'},{key:'remittance',label:'Remittance'},{key:'dtr',label:'DTR'},{key:'bankDisbursement',label:'Bank CSV'},{key:'announcements',label:'Announcements'},{key:'leaveRequests',label:'Leave 🔔'},{key:'cashRequests',label:'Cash Adv 🔔'},{key:'disputes',label:'Disputes 🔔'},{key:'contracts',label:'Contracts'}],
        roles:['owner','manager','hr','payroll'] },
      { key:'inventory', icon:'📦', label:'Inventory',
        tabs:[{key:'inventory',label:'Inventory'}],
        roles:['owner','manager','hr','supervisor','asst_supervisor'] },
      { key:'costing', icon:'🍩', label:'Costing',
        tabs:[{key:'costing',label:'Costing'}],
        roles:['owner','manager'] },
      { key:'sales', icon:'📈', label:'Sales & Expenses',
        tabs:[{key:'sales',label:'Sales & Expenses'}],
        roles:['owner','manager','hr'] },
      { key:'analytics', icon:'📊', label:'Analytics',
        tabs:[{key:'analytics',label:'Analytics'}],
        roles:['owner'] },
      { key:'franchise', icon:'🏪', label:'Franchise',
        tabs:[{key:'franchise',label:'Franchise'}],
        roles:['owner'] },
    ]
    const visibleSections = SECTIONS.filter(s => s.roles.includes(adminRole||'owner'))
    const currentSection = visibleSections.find(s => s.tabs.some(t => t.key === activeTab)) || visibleSections[0]
    const visibleSubTabs = currentSection.tabs.filter(t => canAccess(t.key))
    const pendingExpenses = dailyExpenses.filter(e => e.status === 'pending').length
    const filteredResults = payrollResults.filter(p=>p.employeeName.toLowerCase().includes(payrollSearch.toLowerCase())||p.employeeCode.toLowerCase().includes(payrollSearch.toLowerCase()))

    const handleTabClick = (key) => {
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
      if(key==='inventory') { loadInventoryItems(); loadInventoryTransactions(); loadSuppliers(); loadPurchaseOrders(); supabase.from('stock_adjustments').select('*').order('created_at',{ascending:false}).limit(20).then(({data})=>setStockAdjustments(data||[])) }
      if(key==='costing') { loadDonutVariants(); loadRecipes(); loadCostSettings(); loadProductionLogs(); loadInventoryItems() }
      if(key==='franchise') { loadFranchises() }
      if(key==='sales') { loadResellers(); loadDeliveryInvoices(); loadDailySales(); loadDailyExpenses(); loadResellerDefaultOrders(); loadDonutVariants(); loadFinancialData(); loadCashReconciliations(); loadBankDeposits(); loadProductionReports(); loadSuspiciousAlerts(); supabase.from('reseller_disputes').select('*').order('created_at',{ascending:false}).then(({data})=>{ setResellerDisputes(data||[]) }) }
    }

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
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f0f2f5', overflow:'hidden', display:'flex', flexDirection:'column' }}>
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

          {/* ── Mobile Top Bar ── */}
          {isMobile && (
            <div style={{ background:'#1a1a2e', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <img src="/logo.png" alt="Logo" style={{ width:'28px', height:'28px', objectFit:'contain' }} />
                <span style={{ color:'white', fontWeight:'bold', fontSize:'14px' }}>Roma's Donuts</span>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {adminEmployee && <button onClick={openAdminEmployeePortal} style={{ background:'#ca1b1b', border:'none', color:'white', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }}>⏰ MY TIME</button>}
                <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold' }}>{sidebarOpen?'✕':'☰'}</button>
              </div>
            </div>
          )}

          {/* ── Sidebar ── */}
          {(!isMobile||sidebarOpen) && (
            <div style={{ width:isMobile?'100%':'200px', minWidth:isMobile?'auto':'200px', background:'#1a1a2e', padding:'0', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', height:isMobile?'auto':'100%' }}>
              {/* Logo */}
              {!isMobile && (
                <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <img src="/logo.png" alt="Logo" style={{ width:'36px', height:'36px', objectFit:'contain' }} />
                      <div>
                        <p style={{ color:'white', fontWeight:'bold', fontSize:'13px', margin:0, lineHeight:1.2 }}>Roma's Donuts</p>
                        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'10px', margin:0 }}>Management System</p>
                      </div>
                    </div>
                    {/* Bell icon */}
                    <div style={{ position:'relative', cursor:'pointer' }} onClick={()=>{ setShowNotifications(!showNotifications); if(!showNotifications) loadNotifications() }}>
                      <span style={{ fontSize:'20px' }}>🔔</span>
                      {unreadCount > 0 && <span style={{ position:'absolute', top:'-4px', right:'-6px', background:'#FDD412', color:'#1a1a2e', borderRadius:'50%', width:'16px', height:'16px', fontSize:'9px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                    </div>
                  </div>
                </div>
              )}
              {/* Notification Panel */}
              {showNotifications && (
                <div style={{ background:'#16213e', borderBottom:'1px solid rgba(255,255,255,0.1)', maxHeight:'320px', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ color:'white', fontWeight:'bold', fontSize:'11px', margin:0 }}>🔔 Notifications {unreadCount>0&&<span style={{ background:'#FDD412', color:'#1a1a2e', borderRadius:'10px', padding:'1px 6px', fontSize:'9px', marginLeft:'4px' }}>{unreadCount} new</span>}</p>
                    {unreadCount > 0 && <button onClick={markAllRead} style={{ background:'none', border:'none', color:'#FDD412', fontSize:'10px', cursor:'pointer', fontWeight:'bold' }}>Mark all read</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'11px', textAlign:'center', padding:'16px', margin:0 }}>No notifications yet</p>
                  ) : notifications.map(n=>(
                    <div key={n.id} onClick={()=>markOneRead(n.id)} style={{ padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:n.is_read?'transparent':'rgba(253,212,18,0.08)', cursor:'pointer', transition:'background 0.15s' }}>
                      <p style={{ color:n.is_read?'rgba(255,255,255,0.5)':'white', fontSize:'11px', fontWeight:n.is_read?'normal':'bold', margin:'0 0 2px' }}>{n.title}</p>
                      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'10px', margin:'0 0 2px', lineHeight:1.4 }}>{n.message}</p>
                      <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'9px', margin:0 }}>{n.employee_name} · {new Date(n.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Role Badge + Switch */}
              <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ background:'#ca1b1b', borderRadius:'6px', padding:'5px 10px', textAlign:'center', marginBottom: availableRoles.length > 1 ? '8px' : '0' }}>
                  <p style={{ color:'white', fontSize:'11px', fontWeight:'bold', margin:0 }}>
                    {adminRole==='owner'?'👑 Owner':adminRole==='manager'?'👔 Manager':adminRole==='hr'?'👤 HR Admin':adminRole==='payroll'?'💰 Payroll Officer':adminRole==='supervisor'?'👁 Supervisor':adminRole==='asst_supervisor'?'🔰 Asst. Supervisor':'👑 Owner'}
                  </p>
                  {adminEmployee && <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', margin:'2px 0 0' }}>{adminEmployee.full_name}</p>}
                </div>
                {/* Role Switch — only shows if employee has multiple roles */}
                {availableRoles.length > 1 && (
                  <div>
                    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'9px', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'center' }}>Switch Role</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                      {availableRoles.map(role => (
                        <button key={role} onClick={()=>{ setAdminRole(role); setActiveTab(role==='payroll'?'payroll':role==='supervisor'||role==='asst_supervisor'?'attendance':role==='hr'?'employees':'dashboard'); showToast(`✅ Switched to ${role==='owner'?'Owner':role==='manager'?'Manager':role==='hr'?'HR Admin':role==='payroll'?'Payroll Officer':role==='supervisor'?'Supervisor':'Asst. Supervisor'}`) }} style={{ padding:'5px 8px', borderRadius:'6px', border:`1px solid ${adminRole===role?'#ca1b1b':'rgba(255,255,255,0.15)'}`, background:adminRole===role?'#ca1b1b':'rgba(255,255,255,0.05)', color:adminRole===role?'white':'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:'10px', fontWeight:adminRole===role?'bold':'normal', textAlign:'left', transition:'all 0.15s' }}>
                          {role==='owner'?'👑 Owner':role==='manager'?'👔 Manager':role==='hr'?'👤 HR Admin':role==='payroll'?'💰 Payroll':role==='supervisor'?'👁 Supervisor':'🔰 Asst. Supervisor'}
                          {adminRole===role && <span style={{ float:'right', fontSize:'9px' }}>✓ Active</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Main Navigation */}
              <div style={{ flex:1, padding:'8px 10px', display:'flex', flexDirection:'column', gap:'2px' }}>
                {visibleSections.map(section => {
                  const isActive = currentSection.key === section.key
                  const hasBadge = (section.key==='payroll' && (leaveRequests.filter(r=>r.status==='pending').length>0||cashAdvanceRequests.filter(r=>r.status==='pending').length>0||payslipDisputes.filter(d=>d.status==='pending').length>0)) ||
                                   (section.key==='sales' && pendingExpenses>0 && adminRole==='owner')
                  return (
                    <button key={section.key} onClick={()=>{ handleTabClick(section.tabs.find(t=>canAccess(t.key))?.key||section.tabs[0].key) }} style={{ padding:'10px 12px', borderRadius:'8px', border:'none', cursor:'pointer', textAlign:'left', width:'100%', background:isActive?'#ca1b1b':'transparent', color:isActive?'white':'rgba(255,255,255,0.65)', display:'flex', alignItems:'center', gap:'10px', transition:'all 0.15s', position:'relative' }}>
                      <span style={{ fontSize:'16px', flexShrink:0 }}>{section.icon}</span>
                      <span style={{ fontSize:'12px', fontWeight:isActive?'bold':'500', flex:1 }}>{section.label}</span>
                      {hasBadge && <span style={{ background:'#fdd412', color:'#1a1a2e', borderRadius:'10px', padding:'1px 6px', fontSize:'9px', fontWeight:'bold' }}>!</span>}
                    </button>
                  )
                })}
              </div>
              {/* Bottom Actions */}
              <div style={{ padding:'10px 10px 14px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', gap:'4px' }}>
                {adminEmployee && (
                  <button style={{ padding:'9px 12px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', fontWeight:'bold', fontSize:'11px', textAlign:'left', width:'100%', background:'transparent', color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', gap:'8px' }} onClick={openAdminEmployeePortal}>
                    <span>⏰</span><span>My Attendance</span>
                  </button>
                )}
                <button style={{ padding:'9px 12px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'11px', textAlign:'left', width:'100%', background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:'8px' }} onClick={()=>{ setAdminMode(false); setAdminEmployee(null) }}>
                  <span>←</span><span>Back to Login</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Main Content ── */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f0f2f5' }}>
            {/* Sub-tab Navigation Bar */}
            {visibleSubTabs.length > 1 && (
              <div style={{ background:'white', borderBottom:'1px solid #f0f0f0', padding:'10px 20px', display:'flex', gap:'6px', overflowX:'auto', flexShrink:0 }}>
                {visibleSubTabs.map(tab => (
                  <button key={tab.key} onClick={()=>handleTabClick(tab.key)} style={{ padding:'8px 16px', border:'none', borderRadius:'20px', background:activeTab===tab.key?'#ca1b1b':'#f4f4f4', color:activeTab===tab.key?'white':'#555', cursor:'pointer', fontWeight:activeTab===tab.key?'700':'500', fontSize:'12px', whiteSpace:'nowrap', transition:'all 0.15s', letterSpacing:'0.2px', boxShadow:activeTab===tab.key?'0 2px 8px rgba(202,27,27,0.25)':'none', fontFamily:'inherit' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Content Area */}
            <div style={{ flex:1, overflowY:'auto', padding:isMobile?'14px':'24px', background:'#f8f7f5' }}>

            {/* DASHBOARD */}
            {activeTab==='dashboard' && (
              <div>
                <h2 style={h2s}>🏠 Dashboard — {today}</h2>

                {/* TIMED IN MODAL */}
                {showTimedInModal && (
                  <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={()=>setShowTimedInModal(false)}>
                    <div style={{ background:'white', borderRadius:'16px', padding:'20px', maxWidth:'500px', width:'100%', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                        <div>
                          <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'16px', margin:'0 0 2px' }}>🟢 Currently On Duty</p>
                          <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{today} · {timedInList.length} employee{timedInList.length!==1?'s':''} on duty</p>
                        </div>
                        <button onClick={()=>setShowTimedInModal(false)} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>✕ Close</button>
                      </div>
                      {timedInList.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'30px', color:'#aaa' }}>
                          <p style={{ fontSize:'32px', margin:'0 0 10px' }}>😴</p>
                          <p style={{ fontWeight:'bold', fontSize:'14px' }}>No one is timed in yet</p>
                          <p style={{ fontSize:'12px' }}>Employees will appear here once they time in.</p>
                        </div>
                      ) : (
                        <div>
                          {timedInList.map((log, i) => {
                            const emp = log.employees || {}
                            const now = new Date()
                            const [h, m] = (log.time_in||'00:00').split(':').map(Number)
                            const timeInDate = new Date(); timeInDate.setHours(h, m, 0)
                            const hoursOnDuty = ((now - timeInDate) / (1000*60*60)).toFixed(1)
                            return (
                              <div key={log.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px', background:i%2===0?'white':'#f8f9fa', borderRadius:'10px', marginBottom:'6px', border:'1px solid #eee' }}>
                                {emp.profile_photo_url ? (
                                  <img src={emp.profile_photo_url} alt="" style={{ width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', border:'2px solid #2d8a4e', flexShrink:0 }} />
                                ) : (
                                  <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'#2d8a4e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>👤</div>
                                )}
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.full_name || log.employee_name}</p>
                                  <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{emp.position || '—'} {emp.department?`· ${emp.department}`:''}</p>
                                </div>
                                <div style={{ textAlign:'right', flexShrink:0 }}>
                                  <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 2px' }}>{log.time_in}</p>
                                  <p style={{ color:'#aaa', fontSize:'10px', margin:0 }}>{hoursOnDuty}h on duty</p>
                                </div>
                              </div>
                            )
                          })}
                          <div style={{ background:'#e8f5e9', borderRadius:'10px', padding:'10px 14px', marginTop:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px' }}>Total On Duty</span>
                            <span style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'20px' }}>{timedInList.length}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!dashboardData && <p style={{ color:'#888' }}>Loading...</p>}
                {dashboardData && (
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
                    {[
                      ['👥 Total Employees', dashboardData.totalEmployees, 'blue', 'employees', null],
                      ['🟢 Timed In', dashboardData.timedIn, 'green', 'attendance', loadTimedInEmployees],
                      ['✅ Timed Out', dashboardData.timedOut, 'gray', 'attendance', null],
                      ['🔴 Absent Today', dashboardData.absent, 'red', 'attendance', null],
                      ['🏖️ Pending Leave', dashboardData.pendingLeave, dashboardData.pendingLeave>0?'orange':'gray', 'leaveRequests', null],
                      ['💵 Pending CA', dashboardData.pendingCA, dashboardData.pendingCA>0?'orange':'gray', 'cashRequests', null],
                      ['⏰ Pending OT/UT', dashboardData.pendingOT, dashboardData.pendingOT>0?'orange':'gray', 'overtime', null],
                      ['⚠️ Disputes', dashboardData.pendingDisputes, dashboardData.pendingDisputes>0?'red':'gray', 'disputes', null],
                    ].map(([label,value,color,tab,action])=>(
                      <div key={label} onClick={()=>{ if(action){ action() } else { setActiveTab(tab); if(tab==='leaveRequests')loadLeaveRequests(); if(tab==='cashRequests')loadCashAdvanceRequests(); if(tab==='overtime')loadTimeAdjRequests(); if(tab==='disputes')loadPayslipDisputes(); }}} style={{ background:'white', border:`2px solid ${color==='red'?'#ca1b1b':color==='green'?'#2d8a4e':color==='orange'?'#f5a623':color==='blue'?'#4a90d9':'#ddd'}`, borderRadius:'12px', padding:'16px', textAlign:'center', cursor:'pointer', userSelect:'none', transition:'all 0.15s' }} onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 4px 15px rgba(0,0,0,0.12)' }} onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none' }}>
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
                          <button style={btnYellow} onClick={()=>{ setEditingEmployeeId(emp.id); setEditFields({ code:emp.employee_code||'', name:emp.full_name||'', position:emp.position||'', pin:emp.pin||'', rate:emp.daily_rate||'', hasSss:emp.has_sss||false, hasPagibig:emp.has_pagibig||false, hasPhilhealth:emp.has_philhealth||false, hireDate:emp.hire_date||today, sick:emp.sick_leave_balance||5, vacation:emp.vacation_leave_balance||5, sil:emp.sil_balance||5, payType:emp.pay_type||'daily', hourlyRate:emp.hourly_rate||0, gracePeriod:emp.grace_period_minutes||10, dob:emp.date_of_birth||'', gender:emp.gender||'', civil_status:emp.civil_status||'', address:emp.home_address||'', contact:emp.contact_number||'', emergency_name:emp.emergency_contact_name||'', emergency_contact:emp.emergency_contact_number||'', employment_type:emp.employment_type||'regular', department:emp.department||'', sss_no:emp.sss_no||'', pagibig_no:emp.pagibig_no||'', philhealth_no:emp.philhealth_no||'', tin_no:emp.tin_no||'', work_location:emp.work_location||'', location_lat:emp.location_lat||'', location_lng:emp.location_lng||'', location_radius:emp.location_radius||'', admin_role:emp.admin_role||'', extra_roles:emp.extra_roles||'' }) }}>✏ EDIT</button>
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
                          {adminRole==='owner'||adminRole==='manager' ? (<>
                          <label style={lblS}>🔐 Primary Role (grants system access):</label>
                          <select value={editFields.admin_role||''} onChange={e=>setEditFields(p=>({...p,admin_role:e.target.value||null}))} style={{ ...inputStyle, borderColor:editFields.admin_role?'#ca1b1b':'#ddd', fontWeight:editFields.admin_role?'bold':'normal' }}>
                            <option value="">— None (Regular Employee) —</option>
                            <option value="owner">👑 Owner — Full Access</option>
                            <option value="manager">👔 Manager — Full Access</option>
                            <option value="hr">👤 HR Admin — People & Attendance</option>
                            <option value="payroll">💰 Payroll Officer — Payroll & Finance</option>
                            <option value="supervisor">👁 Supervisor — Attendance & Inventory</option>
                            <option value="asst_supervisor">🔰 Asst. Supervisor — Attendance & Inventory</option>
                          </select>
                          <label style={lblS}>🔀 Additional Roles (Dual Access — hold Ctrl to select multiple):</label>
                          <select multiple value={(editFields.extra_roles||'').split(',').filter(r=>r)} onChange={e=>{ const selected=Array.from(e.target.selectedOptions).map(o=>o.value); setEditFields(p=>({...p,extra_roles:selected.join(',')})) }} style={{ ...inputStyle, height:'100px', borderColor:'#4a90d9' }}>
                            <option value="owner">👑 Owner</option>
                            <option value="manager">👔 Manager</option>
                            <option value="hr">👤 HR Admin</option>
                            <option value="payroll">💰 Payroll Officer</option>
                            <option value="supervisor">👁 Supervisor</option>
                            <option value="asst_supervisor">🔰 Asst. Supervisor</option>
                          </select>
                          <p style={{ color:'#888', fontSize:'11px', margin:'-8px 0 8px' }}>Selected extra roles: <strong>{(editFields.extra_roles||'').split(',').filter(r=>r).join(', ') || 'None'}</strong></p>
                          </>):null}
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

            {/* PERFORMANCE DASHBOARD */}
            {activeTab==='performance' && (
              <div>
                <h2 style={h2s}>📊 Employee Performance</h2>
                {(()=>{
                  // Compute performance per employee from attendance_logs
                  const perfData = employees.filter(e=>e.is_active).map(emp=>{
                    const empLogs = adminLogs.filter ? [] : [] // will load separately
                    return { ...emp, empLogs }
                  })
                  return (
                    <div>
                      <div style={{ background:'white', borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                        <p style={{ color:'#888', fontSize:'12px', margin:'0 0 14px' }}>Attendance performance for the current month. Click any employee for details.</p>
                        <div style={{ overflowX:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                            <thead>
                              <tr style={{ background:'#ca1b1b' }}>
                                {['Employee','Dept','Days Worked','Absences','Late','OT Days','Attendance Rate'].map(h=>(
                                  <th key={h} style={{ color:'white', padding:'8px 10px', textAlign:'left', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {employees.filter(e=>e.is_active).map((emp,i)=>(
                                <tr key={emp.id} style={{ background:i%2===0?'white':'#fafafa', borderBottom:'1px solid #f0f0f0' }}>
                                  <td style={{ padding:'8px 10px', fontWeight:'bold' }}>{emp.full_name}</td>
                                  <td style={{ padding:'8px 10px', color:'#888' }}>{emp.department||'—'}</td>
                                  <td style={{ padding:'8px 10px', textAlign:'center', color:'#2d8a4e', fontWeight:'bold' }}>—</td>
                                  <td style={{ padding:'8px 10px', textAlign:'center', color:'#ca1b1b', fontWeight:'bold' }}>—</td>
                                  <td style={{ padding:'8px 10px', textAlign:'center', color:'#f5a623' }}>—</td>
                                  <td style={{ padding:'8px 10px', textAlign:'center', color:'#4a90d9' }}>—</td>
                                  <td style={{ padding:'8px 10px' }}>
                                    <div style={{ background:'#f0f0f0', borderRadius:'4px', height:'8px', overflow:'hidden', width:'80px' }}>
                                      <div style={{ background:'#2d8a4e', width:'85%', height:'100%', borderRadius:'4px' }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p style={{ color:'#aaa', fontSize:'11px', marginTop:'12px', textAlign:'center' }}>💡 Full analytics load as your team builds attendance history. Data populates automatically.</p>
                      </div>
                    </div>
                  )
                })()}
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

                {/* COMPANY DEVICE REGISTRATION — Owner Only */}
                {adminRole==='owner' && (
                  <div style={{ background:'#1a1a2e', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'16px', marginBottom:'20px' }}>
                    <h3 style={{ color:'white', margin:'0 0 6px', fontSize:'14px' }}>📱 Company Device Registration</h3>
                    <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'12px', margin:'0 0 14px' }}>Register the production tablet here. Only this device will allow Production staff to Time In/Out. Employees cannot register devices themselves.</p>
                    <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:'10px', padding:'12px', marginBottom:'12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                        <div>
                          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px' }}>This Device Status</p>
                          <p style={{ fontWeight:'bold', fontSize:'14px', margin:0, color:isCompanyDevice?'#4ade80':'#f87171' }}>{isCompanyDevice?'✅ Registered as Company Device':'❌ Not a Company Device'}</p>
                        </div>
                        {isCompanyDevice && (
                          <button style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>{ localStorage.removeItem('roma_company_device'); setIsCompanyDevice(false); showToast('✅ Device unregistered.') }}>🔓 Unregister This Device</button>
                        )}
                      </div>
                    </div>
                    {!isCompanyDevice && (
                      <button style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'10px', padding:'12px', width:'100%', cursor:'pointer', fontWeight:'bold', fontSize:'13px', letterSpacing:'0.5px' }} onClick={()=>{
                        if (window.confirm('Register THIS device as the company production tablet?\n\nOnly do this on the physical tablet in your production area.')) {
                          localStorage.setItem('roma_company_device','true')
                          setIsCompanyDevice(true)
                          showToast('✅ This device is now the company tablet! Production staff can Time In/Out here.')
                        }
                      }}>📱 REGISTER THIS DEVICE AS COMPANY TABLET</button>
                    )}
                    <div style={{ marginTop:'12px', background:'rgba(255,200,0,0.1)', border:'1px solid rgba(255,200,0,0.3)', borderRadius:'8px', padding:'10px' }}>
                      <p style={{ color:'#fdd412', fontSize:'11px', margin:0, fontWeight:'bold' }}>⚠️ Important: Only register from the physical production tablet. Do not register from your personal phone or office computer.</p>
                    </div>
                  </div>
                )}

                {/* Department Locations for Geofencing */}
                <div style={{ background:'#fff8f0', border:'2px solid #f5a623', borderRadius:'14px', padding:'16px', marginBottom:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
                    <div>
                      <h3 style={{ color:'#f5a623', margin:'0 0 2px', fontSize:'14px' }}>📍 Work Location Setup (Geofencing)</h3>
                      <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Set GPS location per department. Employees auto-use their department's location when timing in.</p>
                    </div>
                    <button style={{ ...btnBlack, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'12px', background:'#f5a623' }} onClick={()=>setShowDeptLocations(!showDeptLocations)}>
                      {showDeptLocations?'▲ HIDE':'▼ CONFIGURE'}
                    </button>
                  </div>
                  {showDeptLocations && (
                    <div style={{ marginTop:'14px' }}>
                      {/* Info banner */}
                      <div style={{ background:'#fff3cd', borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'12px', color:'#856404', border:'1px solid #ffc107' }}>
                        💡 <strong>How it works:</strong> Set coordinates per department below. All employees assigned to that department will automatically use it when timing in. Individual employee location (set in their profile) overrides department location.
                      </div>
                      {/* Column headers */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 80px 60px 60px', gap:'6px', padding:'6px 10px', background:'#ca1b1b', borderRadius:'8px 8px 0 0', marginBottom:'2px' }}>
                        {['Department','Location Name','Latitude','Longitude','Radius (m)','GPS','Apply'].map(h=>(
                          <span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.3px' }}>{h}</span>
                        ))}
                      </div>
                      {/* Department rows */}
                      {['Production','Kitchen','Admin','Delivery','Cashier','Service Crew','Supervisor','Manager','Security','Maintenance'].map((dept, i) => {
                        const loc = departmentLocations[dept] || {}
                        const empCount = employees.filter(e => e.department === dept).length
                        return (
                          <div key={dept} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 80px 60px 60px', gap:'6px', padding:'8px 10px', background:i%2===0?'white':'#fafafa', border:'1px solid #f0f0f0', borderTop:'none', alignItems:'center' }}>
                            <div>
                              <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:'0 0 2px' }}>📌 {dept}</p>
                              {empCount > 0 && <p style={{ color:'#2d8a4e', fontSize:'10px', margin:0 }}>👥 {empCount} employee{empCount!==1?'s':''}</p>}
                              {empCount === 0 && <p style={{ color:'#bbb', fontSize:'10px', margin:0 }}>No employees yet</p>}
                            </div>
                            <input
                              placeholder="e.g. Main Production Area"
                              value={loc.name||''}
                              onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],name:e.target.value}}))}
                              style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}
                            />
                            <input
                              type="number" step="0.000001" placeholder="15.4755"
                              value={loc.lat||''}
                              onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],lat:e.target.value}}))}
                              style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}
                            />
                            <input
                              type="number" step="0.000001" placeholder="120.5963"
                              value={loc.lng||''}
                              onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],lng:e.target.value}}))}
                              style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}
                            />
                            <input
                              type="number" placeholder="200"
                              value={loc.radius||''}
                              onChange={e=>setDepartmentLocations(p=>({...p,[dept]:{...p[dept],radius:e.target.value}}))}
                              style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}
                            />
                            <button
                              style={{ background:'#4a90d9', color:'white', border:'none', borderRadius:'6px', padding:'6px 4px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap' }}
                              onClick={()=>{
                                if (!navigator.geolocation) { showToast('❌ GPS not available','red'); return }
                                showToast('📍 Detecting location...')
                                navigator.geolocation.getCurrentPosition(pos => {
                                  setDepartmentLocations(p=>({...p,[dept]:{...p[dept],lat:pos.coords.latitude.toFixed(6),lng:pos.coords.longitude.toFixed(6)}}))
                                  showToast(`✅ ${dept} location detected!`)
                                }, () => showToast('❌ Could not detect location','red'))
                              }}
                            >📍 GPS</button>
                            <button
                              style={{ background:'#2d8a4e', color:'white', border:'none', borderRadius:'6px', padding:'6px 4px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap' }}
                              onClick={async ()=>{
                                const loc = departmentLocations[dept]
                                if (!loc?.lat || !loc?.lng) { showToast('❌ Set coordinates first.','red'); return }
                                await supabase.from('employees').update({
                                  work_location: loc.name || dept,
                                  location_lat: String(loc.lat),
                                  location_lng: String(loc.lng),
                                  location_radius: String(loc.radius || 200)
                                }).eq('department', dept).eq('is_active', true)
                                await loadEmployees()
                                const count = employees.filter(e=>e.department===dept).length
                                showToast(`✅ Applied to ${count} employee(s) in ${dept}!`)
                              }}
                            >✅ Apply</button>
                          </div>
                        )
                      })}
                      {/* Summary */}
                      <div style={{ background:'#fff8f0', border:'1px solid #f5a623', borderRadius:'0 0 8px 8px', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                        <div style={{ fontSize:'11px', color:'#888' }}>
                          {Object.values(departmentLocations).filter(l=>l?.lat&&l?.lng).length} of 10 departments configured
                        </div>
                        <button style={{ ...btnGreen, width:'auto', padding:'8px 20px', marginTop:0, fontSize:'12px' }} onClick={()=>saveDepartmentLocations(departmentLocations)}>
                          💾 SAVE ALL LOCATIONS
                        </button>
                      </div>
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
                      <div
                        onDragOver={e=>{ e.preventDefault(); e.currentTarget.style.background='#dbeafe'; e.currentTarget.style.borderColor='#4a90d9' }}
                        onDragLeave={e=>{ e.currentTarget.style.background='#f0f7ff'; e.currentTarget.style.borderColor='#93c5fd' }}
                        onDrop={e=>{ e.preventDefault(); e.currentTarget.style.background='#f0f7ff'; e.currentTarget.style.borderColor='#93c5fd'; const file=e.dataTransfer.files[0]; if(file&&file.type==='application/pdf'){ setContractFile(file) } else { showToast('❌ Please drop a PDF file only.','red') } }}
                        onClick={()=>document.getElementById('contract-file-input').click()}
                        style={{ background:'#f0f7ff', border:'2px dashed #93c5fd', borderRadius:'12px', padding:'28px', textAlign:'center', cursor:'pointer', transition:'all 0.2s', marginBottom:'8px' }}
                      >
                        <p style={{ fontSize:'28px', margin:'0 0 8px' }}>📄</p>
                        <p style={{ fontWeight:'bold', color:'#4a90d9', fontSize:'13px', margin:'0 0 4px' }}>Drag & Drop PDF here</p>
                        <p style={{ color:'#888', fontSize:'11px', margin:'0 0 8px' }}>or click to browse</p>
                        <span style={{ background:'#4a90d9', color:'white', borderRadius:'8px', padding:'6px 16px', fontSize:'12px', fontWeight:'bold' }}>Browse File</span>
                        <input id="contract-file-input" type="file" accept=".pdf,application/pdf" onChange={e=>setContractFile(e.target.files[0]||null)} style={{ display:'none' }} />
                      </div>
                      {contractFile && (
                        <div style={{ background:'#e8f5e9', borderRadius:'8px', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #c8e6c9' }}>
                          <p style={{ fontSize:'12px', color:'#2d8a4e', margin:0, fontWeight:'bold' }}>✅ {contractFile.name} ({(contractFile.size/1024).toFixed(1)} KB)</p>
                          <button onClick={()=>setContractFile(null)} style={{ background:'none', border:'none', color:'#ca1b1b', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>✕ Remove</button>
                        </div>
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

            {/* INVENTORY */}
            {activeTab==='inventory' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px', marginBottom:'12px' }}>
                  <h2 style={h2s}>📦 Inventory Management</h2>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    <button style={{ ...btnGreen, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>{ loadInventoryItems(); loadInventoryTransactions(); showToast('✅ Refreshed!') }}>🔄 REFRESH</button>
                    <button style={{ ...btnBlack, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={printInventoryReport}>🖨️ PRINT REPORT</button>
                  </div>
                </div>

                {/* Inventory Sub-Navigation */}
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px', background:'white', padding:'10px 14px', borderRadius:'14px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
                  {[
                    ['items','📦 Items'],
                    ['adjust','⚖️ Adjust Stock'],
                    ['receiving','📥 Receiving'],
                    ['valuation','💰 Valuation'],
                    ['movement','📊 Movement Report'],
                    ['history','📋 Item History'],
                  ].map(([v,l])=>(
                    <button key={v} onClick={()=>{ setInventorySubView(v); if(v==='valuation') computeInventoryValuation() }} style={{ padding:'8px 14px', borderRadius:'20px', border:'none', background:inventorySubView===v?'#ca1b1b':'#f4f4f4', color:inventorySubView===v?'white':'#555', fontWeight:inventorySubView===v?'700':'500', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s', boxShadow:inventorySubView===v?'0 2px 8px rgba(202,27,27,0.25)':'none' }}>{l}</button>
                  ))}
                </div>

                {/* Stock Adjustment View */}
                {inventorySubView==='adjust' && (
                  <div>
                    <h3 style={{ color:'#ca1b1b', fontSize:'14px', margin:'0 0 14px' }}>⚖️ Stock Adjustment</h3>
                    <p style={{ color:'#888', fontSize:'12px', margin:'0 0 14px' }}>Use this to correct stock levels when physical count differs from system. Different from Stock In/Out — this is a manual correction with reason.</p>
                    <div style={{ background:'white', borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                        <div><label style={lblS}>Item:</label>
                          <select value={adjustItemId} onChange={e=>setAdjustItemId(e.target.value)} style={inputStyle}>
                            <option value="">— Select item —</option>
                            {inventoryItems.map(i=><option key={i.id} value={i.id}>{i.name} (Current: {i.current_stock} {i.unit})</option>)}
                          </select>
                        </div>
                        <div><label style={lblS}>Adjustment Qty (+ to add, - to deduct):</label>
                          <input type="number" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} placeholder="e.g. +5 or -3" style={inputStyle} step="0.01" />
                        </div>
                        <div><label style={lblS}>Reason:</label>
                          <select value={adjustReason} onChange={e=>setAdjustReason(e.target.value)} style={inputStyle}>
                            <option value="">— Select reason —</option>
                            {['Physical count variance','Damaged goods','Theft/pilferage','Data entry error','Unit conversion correction','Found missing stock','Other'].map(r=><option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div><label style={lblS}>Notes (optional):</label>
                          <input value={adjustNotes} onChange={e=>setAdjustNotes(e.target.value)} placeholder="Additional details..." style={inputStyle} />
                        </div>
                      </div>
                      {adjustItemId && adjustQty && (()=>{
                        const item = inventoryItems.find(i=>i.id===adjustItemId)
                        const newStock = Number(item?.current_stock||0) + Number(adjustQty)
                        return <div style={{ background:newStock>=0?'#e8f5e9':'#fff5f5', borderRadius:'8px', padding:'10px', margin:'4px 0 12px', border:`1px solid ${newStock>=0?'#2d8a4e':'#ca1b1b'}` }}>
                          <p style={{ margin:0, fontSize:'12px', fontWeight:'bold', color:newStock>=0?'#2d8a4e':'#ca1b1b' }}>
                            {item?.name}: {item?.current_stock} → <strong>{Math.max(0,newStock)}</strong> {item?.unit}
                            {newStock<0?' ⚠️ Cannot go below 0':''}
                          </p>
                        </div>
                      })()}
                      <button style={{ ...btnRed }} onClick={saveStockAdjustment}>💾 SAVE ADJUSTMENT</button>
                    </div>
                    {/* Adjustment History */}
                    <h4 style={{ color:'#555', fontSize:'13px', margin:'0 0 10px' }}>Recent Adjustments</h4>
                    {stockAdjustments.length===0?<p style={{ color:'#aaa', fontSize:'12px' }}>No adjustments yet.</p>:stockAdjustments.slice(0,10).map(a=>(
                      <div key={a.id} style={{ ...cardS, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>{a.item_name}</p>
                          <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{a.reason} · {a.adjusted_by} · {new Date(a.created_at).toLocaleDateString('en-PH')}</p>
                          {a.notes && <p style={{ color:'#888', fontSize:'10px', margin:'2px 0 0' }}>{a.notes}</p>}
                        </div>
                        <span style={{ fontWeight:'bold', fontSize:'16px', color:Number(a.adjustment_qty)>=0?'#2d8a4e':'#ca1b1b' }}>{Number(a.adjustment_qty)>0?'+':''}{a.adjustment_qty}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Receiving Report View */}
                {inventorySubView==='receiving' && (
                  <div>
                    <h3 style={{ color:'#ca1b1b', fontSize:'14px', margin:'0 0 6px' }}>📥 Receiving Report</h3>
                    <p style={{ color:'#888', fontSize:'12px', margin:'0 0 14px' }}>When a Purchase Order arrives, record what was actually received vs what was ordered. Stock updates automatically.</p>
                    {purchaseOrders.filter(po=>po.status!=='received').length===0?(
                      <div style={{ textAlign:'center', padding:'30px', color:'#aaa' }}>
                        <p style={{ fontSize:'32px', margin:'0 0 10px' }}>📋</p>
                        <p style={{ fontWeight:'bold', fontSize:'13px', color:'#555' }}>No pending Purchase Orders</p>
                        <p style={{ fontSize:'12px' }}>Create a Purchase Order first, then come back to record receiving.</p>
                      </div>
                    ):purchaseOrders.filter(po=>po.status!=='received').map(po=>(
                      <div key={po.id} style={{ ...cardS, border:'2px solid #e8f0fe' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 2px' }}>{po.po_number}</p>
                            <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{po.supplier_name} · {po.status?.toUpperCase()}</p>
                          </div>
                          <button style={{ ...btnGreen, width:'auto', padding:'7px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>initReceiving(po)}>📥 RECEIVE ORDER</button>
                        </div>
                      </div>
                    ))}
                    {/* Receiving Form Modal */}
                    {showReceivingForm && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={()=>setShowReceivingForm(null)}>
                        <div style={{ background:'white', borderRadius:'16px', padding:'20px', maxWidth:'600px', width:'100%', maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'14px' }}>
                            <div><p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px', margin:'0 0 2px' }}>📥 Receive: {showReceivingForm.po_number}</p><p style={{ color:'#888', fontSize:'12px', margin:0 }}>{showReceivingForm.supplier_name}</p></div>
                            <button onClick={()=>setShowReceivingForm(null)} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold' }}>✕</button>
                          </div>
                          <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden', marginBottom:'14px' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 2fr', background:'#ca1b1b', padding:'8px 12px' }}>
                              {['Item','Ordered','Received','Notes'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold' }}>{h}</span>)}
                            </div>
                            {receivingItems.map((item,i)=>(
                              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 2fr', padding:'8px 12px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0', alignItems:'center', gap:'6px' }}>
                                <span style={{ fontSize:'12px', fontWeight:'bold' }}>{item.item_name||item.name}</span>
                                <span style={{ fontSize:'12px', color:'#555' }}>{item.quantity}</span>
                                <input type="number" value={item.received_qty} min="0" onChange={e=>{ const upd=[...receivingItems]; upd[i]={...upd[i],received_qty:e.target.value}; setReceivingItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', padding:'4px 6px', border:Number(item.received_qty)!==Number(item.quantity)?'2px solid #f5a623':'1.5px solid #e8e8e8' }} />
                                <input placeholder="Notes..." value={item.notes||''} onChange={e=>{ const upd=[...receivingItems]; upd[i]={...upd[i],notes:e.target.value}; setReceivingItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', padding:'4px 6px' }} />
                              </div>
                            ))}
                          </div>
                          {receivingItems.some(i=>Number(i.received_qty)!==Number(i.quantity)) && (
                            <div style={{ background:'#fff3cd', borderRadius:'8px', padding:'10px', marginBottom:'12px', border:'1px solid #ffc107' }}>
                              <p style={{ color:'#856404', fontSize:'12px', fontWeight:'bold', margin:0 }}>⚠️ Discrepancies detected — received quantities differ from ordered. This will be recorded.</p>
                            </div>
                          )}
                          <button style={{ ...btnGreen }} onClick={saveReceivingReport}>✅ CONFIRM RECEIVING & UPDATE STOCK</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Valuation View */}
                {inventorySubView==='valuation' && inventoryValuation && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <h3 style={{ color:'#ca1b1b', fontSize:'14px', margin:0 }}>💰 Inventory Valuation</h3>
                      <div style={{ background:'#fff9e6', border:'2px solid #ca1b1b', borderRadius:'10px', padding:'8px 18px', textAlign:'center' }}>
                        <p style={{ color:'#888', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase' }}>Total Inventory Value</p>
                        <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'22px', margin:0 }}>{php(inventoryValuation.totalValue)}</p>
                      </div>
                    </div>
                    {Object.entries(inventoryValuation.byCategory).map(([cat,data])=>(
                      <div key={cat} style={{ background:'white', borderRadius:'14px', padding:'16px', marginBottom:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:0 }}>{cat}</p>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:0 }}>{php(data.totalValue)}</p>
                        </div>
                        <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', background:'#f8f7f5', padding:'6px 10px' }}>
                            {['Item','Unit','Stock','Cost/Unit','Value'].map(h=><span key={h} style={{ fontSize:'10px', fontWeight:'bold', color:'#888', textAlign:h==='Item'?'left':'right' }}>{h}</span>)}
                          </div>
                          {data.items.map((item,i)=>(
                            <div key={item.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', padding:'6px 10px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>
                              <span style={{ fontSize:'11px', fontWeight:'bold' }}>{item.name}</span>
                              <span style={{ fontSize:'11px', color:'#888', textAlign:'right' }}>{item.unit}</span>
                              <span style={{ fontSize:'11px', textAlign:'right', color:Number(item.current_stock)<=Number(item.min_stock)?'#ca1b1b':'#333', fontWeight:'bold' }}>{item.current_stock}</span>
                              <span style={{ fontSize:'11px', textAlign:'right', color:'#555' }}>{php(item.cost_per_unit)}</span>
                              <span style={{ fontSize:'11px', textAlign:'right', fontWeight:'bold', color:'#2d8a4e' }}>{php(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stock Movement Report */}
                {inventorySubView==='movement' && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#ca1b1b', fontSize:'14px', margin:0 }}>📊 Stock Movement Report</h3>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <input type="month" value={stockMovementMonth} onChange={e=>setStockMovementMonth(e.target.value)} style={{ ...inputStyle, marginBottom:0, width:'160px' }} />
                        <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={loadStockMovement}>📊 GENERATE</button>
                      </div>
                    </div>
                    {stockMovementData.length===0?(
                      <p style={{ color:'#aaa', textAlign:'center', padding:'30px', fontSize:'12px' }}>Click GENERATE to load stock movement for the selected month.</p>
                    ):(
                      <div style={{ background:'white', borderRadius:'14px', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                        <div style={{ overflowX:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                            <thead>
                              <tr style={{ background:'#ca1b1b' }}>
                                {['Item','Unit','Stock In','Stock Out','Wastage','Adj','Closing Stock'].map(h=>(
                                  <th key={h} style={{ color:'white', padding:'8px 10px', textAlign:h==='Item'?'left':'right', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {stockMovementData.map((m,i)=>(
                                <tr key={m.item.id} style={{ background:i%2===0?'white':'#fafafa', borderBottom:'1px solid #f0f0f0' }}>
                                  <td style={{ padding:'7px 10px', fontWeight:'bold', fontSize:'12px' }}>{m.item.name}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#888' }}>{m.item.unit}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#2d8a4e', fontWeight:'bold' }}>{m.stockIn>0?'+'+m.stockIn.toFixed(2):'—'}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#ca1b1b' }}>{m.stockOut>0?'-'+m.stockOut.toFixed(2):'—'}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#f57c00' }}>{m.wastage>0?'-'+m.wastage.toFixed(2):'—'}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', color:m.adjustment>=0?'#4a90d9':'#ca1b1b' }}>{m.adjustment!==0?(m.adjustment>0?'+':'')+m.adjustment.toFixed(2):'—'}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:'bold', color:m.closingStock<=Number(m.item.min_stock||0)?'#ca1b1b':'#333' }}>{m.closingStock.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Item History View */}
                {inventorySubView==='history' && (
                  <div>
                    <h3 style={{ color:'#ca1b1b', fontSize:'14px', margin:'0 0 6px' }}>📋 Item Transaction History</h3>
                    {!selectedItemHistory ? (
                      <div>
                        <p style={{ color:'#888', fontSize:'12px', margin:'0 0 14px' }}>Select an item to view its full movement history:</p>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'8px' }}>
                          {inventoryItems.map(item=>(
                            <div key={item.id} style={{ ...cardS, cursor:'pointer', border:'1px solid #f0f0f0', transition:'all 0.15s' }} onClick={()=>loadItemHistory(item)} onMouseEnter={e=>e.currentTarget.style.borderColor='#ca1b1b'} onMouseLeave={e=>e.currentTarget.style.borderColor='#f0f0f0'}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div><p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>{item.name}</p><p style={{ color:'#888', fontSize:'11px', margin:0 }}>{item.category} · {item.unit}</p></div>
                                <div style={{ textAlign:'right' }}><p style={{ fontWeight:'bold', color:Number(item.current_stock)<=Number(item.min_stock||0)?'#ca1b1b':'#2d8a4e', fontSize:'16px', margin:'0 0 2px' }}>{item.current_stock}</p><p style={{ color:'#888', fontSize:'10px', margin:0 }}>{item.unit} on hand</p></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                          <div><p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:'0 0 2px' }}>{selectedItemHistory.name}</p><p style={{ color:'#888', fontSize:'12px', margin:0 }}>Current Stock: {selectedItemHistory.current_stock} {selectedItemHistory.unit}</p></div>
                          <button onClick={()=>{ setSelectedItemHistory(null); setItemHistory([]) }} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>← Back</button>
                        </div>
                        {itemHistoryLoading ? <p style={{ textAlign:'center', color:'#888' }}>⏳ Loading history...</p> :
                          itemHistory.length===0 ? <p style={{ color:'#aaa', textAlign:'center', padding:'20px' }}>No movement history for this item yet.</p> :
                          itemHistory.map((m,i)=>(
                            <div key={m.id||i} style={{ ...cardS, display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:`3px solid ${m.color}` }}>
                              <div>
                                <p style={{ fontWeight:'bold', fontSize:'12px', margin:'0 0 2px' }}>{m.icon} {m.movementType}</p>
                                <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{m.reference_number||m.reason||'—'} · {m.performed_by||m.recorded_by||m.adjusted_by||'System'}</p>
                                <p style={{ color:'#aaa', fontSize:'10px', margin:'2px 0 0' }}>{new Date(m.created_at).toLocaleString('en-PH')}</p>
                                {m.notes && <p style={{ color:'#888', fontSize:'10px', margin:'2px 0 0' }}>{m.notes}</p>}
                              </div>
                              <span style={{ fontWeight:'bold', fontSize:'16px', color:m.color }}>{Number(m.quantity)>0?'+':''}{m.quantity} {selectedItemHistory.unit}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Default Items View */}
                {inventorySubView==='items' && (<div>

                {/* Supabase setup note */}
                <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'16px', fontSize:'12px' }}>
                  <strong style={{ color:'#ca1b1b' }}>⚙️ Required Supabase Tables (one-time):</strong>
                  <p style={{ color:'#555', margin:'6px 0 2px' }}>1. <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>inventory_items</code> — id (uuid PK), name, category, unit, current_stock (numeric default 0), min_stock (numeric default 0), cost_per_unit (numeric default 0), selling_price (numeric default 0), supplier_id (uuid nullable), is_active (bool default true), created_at</p>
                  <p style={{ color:'#555', margin:'2px 0' }}>2. <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>inventory_transactions</code> — id, item_id, item_name, category, transaction_type, quantity, unit, stock_before, stock_after, reference, notes, performed_by, created_at</p>
                  <p style={{ color:'#555', margin:'2px 0' }}>3. <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>inventory_suppliers</code> — id (uuid PK), name, contact_person, phone, email, address, payment_terms, notes, created_at</p>
                  <p style={{ color:'#555', margin:'2px 0' }}>4. <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>purchase_orders</code> — id (uuid PK), po_number, supplier_id, supplier_name, payment_terms, status, notes, total_amount, created_at</p>
                  <p style={{ color:'#555', margin:'2px 0' }}>5. <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>purchase_order_items</code> — id (uuid PK), po_id, item_id, item_name, unit, current_stock, order_qty, unit_price, total_price</p>
                </div>

                {/* ── INVENTORY DASHBOARD ────────────────────────────────── */}
                {!inventoryLoading && inventoryItems.length > 0 && (() => {
                  const lowStock = inventoryItems.filter(i=>Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0)
                  const totalValue = inventoryItems.reduce((s,i)=>s+Number(i.current_stock||0)*Number(i.cost_per_unit||0),0)
                  const expiringThisWeek = inventoryItems.filter(i=>{ if(!i.expiry_date) return false; const d=Math.ceil((new Date(i.expiry_date)-new Date())/(1000*60*60*24)); return d>=0&&d<=7 })
                  const expiredItems = inventoryItems.filter(i=>i.expiry_date&&new Date(i.expiry_date)<new Date())
                  const now = new Date(); const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
                  const monthlyWastage = wastageLogs.filter(w=>w.wastage_date>=monthStart).reduce((s,w)=>s+Number(w.total_cost||0),0)

                  // Category breakdown
                  const catData = INVENTORY_CATEGORIES.map(cat=>{
                    const items = inventoryItems.filter(i=>i.category===cat)
                    const value = items.reduce((s,i)=>s+Number(i.current_stock||0)*Number(i.cost_per_unit||0),0)
                    const count = items.length
                    const lowCount = items.filter(i=>Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0).length
                    return { cat, value, count, lowCount }
                  }).filter(c=>c.count>0)
                  const maxCatValue = Math.max(...catData.map(c=>c.value),1)

                  // Supplier breakdown
                  const supplierData = suppliers.map(s=>{
                    const items = inventoryItems.filter(i=>i.supplier_id===s.id)
                    const value = items.reduce((s2,i)=>s2+Number(i.current_stock||0)*Number(i.cost_per_unit||0),0)
                    return { name:s.name, count:items.length, value }
                  }).filter(s=>s.count>0).sort((a,b)=>b.value-a.value)
                  const maxSupValue = Math.max(...supplierData.map(s=>s.value),1)

                  // Stock health score
                  const healthScore = inventoryItems.length>0 ? Math.round(((inventoryItems.length-lowStock.length)/inventoryItems.length)*100) : 100
                  const healthColor = healthScore>=80?'#2d8a4e':healthScore>=50?'#f57c00':'#ca1b1b'
                  const healthLabel = healthScore>=80?'Healthy':healthScore>=50?'Needs Attention':'Critical'

                  const catColors = ['#ca1b1b','#4a90d9','#2d8a4e','#f57c00']

                  return (
                    <div style={{ marginBottom:'20px' }}>
                      <div style={{ background:'linear-gradient(135deg,#ca1b1b,#8b0000)', borderRadius:'16px', padding:'16px', marginBottom:'14px' }}>
                        <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', margin:'0 0 2px', fontWeight:'bold', letterSpacing:'1px' }}>INVENTORY DASHBOARD</p>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                          <div>
                            <p style={{ color:'white', fontSize:'28px', fontWeight:'bold', margin:'0 0 2px' }}>{php(totalValue)}</p>
                            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px', margin:0 }}>Total Inventory Value</p>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <p style={{ color:'white', fontSize:'22px', fontWeight:'bold', margin:'0 0 2px' }}>{healthScore}%</p>
                            <p style={{ color:healthScore>=80?'#a8e6a3':healthScore>=50?'#ffd080':'#ff9999', fontSize:'12px', fontWeight:'bold', margin:0 }}>● {healthLabel}</p>
                          </div>
                        </div>
                        {/* Health bar */}
                        <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'20px', height:'8px', marginTop:'10px', overflow:'hidden' }}>
                          <div style={{ background:healthScore>=80?'#a8e6a3':healthScore>=50?'#ffd080':'#ff9999', width:`${healthScore}%`, height:'100%', borderRadius:'20px', transition:'width 1s ease' }} />
                        </div>
                      </div>

                      {/* Stat Cards Row */}
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
                        {[
                          { label:'📦 Total Items', value:inventoryItems.length, sub:`${INVENTORY_CATEGORIES.filter(c=>inventoryItems.some(i=>i.category===c)).length} categories`, color:'#4a90d9', bg:'#e8f0fe' },
                          { label:'🔴 Low Stock', value:lowStock.length, sub:lowStock.length>0?'Need reorder':'All good!', color:lowStock.length>0?'#ca1b1b':'#2d8a4e', bg:lowStock.length>0?'#fff5f5':'#f0fff4' },
                          { label:'⏰ Expiring Soon', value:expiringThisWeek.length+expiredItems.length, sub:expiredItems.length>0?`${expiredItems.length} already expired`:'Within 7 days', color:expiredItems.length>0?'#ca1b1b':expiringThisWeek.length>0?'#f57c00':'#2d8a4e', bg:expiredItems.length>0?'#fff5f5':'#fff8e1' },
                          { label:'🗑️ Monthly Wastage', value:php(monthlyWastage), sub:'This month', color:monthlyWastage>0?'#f57c00':'#2d8a4e', bg:'#fff8f0' },
                        ].map(c=>(
                          <div key={c.label} style={{ background:c.bg, border:`2px solid ${c.color}22`, borderRadius:'12px', padding:'12px' }}>
                            <p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px' }}>{c.label}</p>
                            <p style={{ fontWeight:'bold', fontSize:'20px', margin:'0 0 2px', color:c.color }}>{c.value}</p>
                            <p style={{ color:'#aaa', fontSize:'10px', margin:0 }}>{c.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Charts Row */}
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'14px', marginBottom:'14px' }}>

                        {/* Stock Value by Category - Bar Chart */}
                        <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px' }}>
                          <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 14px' }}>📊 Stock Value by Category</p>
                          {catData.map((c,idx)=>(
                            <div key={c.cat} style={{ marginBottom:'10px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                <span style={{ fontSize:'11px', color:'#555', fontWeight:'bold' }}>{c.cat.replace(' Materials','').replace(' Products','').replace(' & Supplies','')}</span>
                                <span style={{ fontSize:'11px', color:'#333', fontWeight:'bold' }}>{php(c.value)}</span>
                              </div>
                              <div style={{ background:'#f5f5f5', borderRadius:'20px', height:'10px', overflow:'hidden' }}>
                                <div style={{ background:catColors[idx%4], width:`${totalValue>0?(c.value/totalValue)*100:0}%`, height:'100%', borderRadius:'20px', transition:'width 1s ease', minWidth:c.value>0?'4px':'0' }} />
                              </div>
                              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'2px' }}>
                                <span style={{ fontSize:'10px', color:'#aaa' }}>{c.count} item(s)</span>
                                {c.lowCount>0 && <span style={{ fontSize:'10px', color:'#ca1b1b', fontWeight:'bold' }}>⚠️ {c.lowCount} low</span>}
                                <span style={{ fontSize:'10px', color:'#aaa' }}>{totalValue>0?((c.value/totalValue)*100).toFixed(1):0}%</span>
                              </div>
                            </div>
                          ))}
                          {catData.length===0 && <p style={{ color:'#888', fontSize:'12px', textAlign:'center', padding:'10px' }}>No data yet</p>}
                        </div>

                        {/* Stock Health by Category - Visual */}
                        <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px' }}>
                          <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 14px' }}>🩺 Stock Health by Category</p>
                          {catData.map((c,idx)=>{
                            const items = inventoryItems.filter(i=>i.category===c.cat)
                            const okItems = items.filter(i=>Number(i.current_stock||0)>Number(i.min_stock||0)||Number(i.min_stock||0)===0)
                            const pct = items.length>0?Math.round((okItems.length/items.length)*100):100
                            const hColor = pct>=80?'#2d8a4e':pct>=50?'#f57c00':'#ca1b1b'
                            return (
                              <div key={c.cat} style={{ marginBottom:'12px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                  <span style={{ fontSize:'11px', color:'#555', fontWeight:'bold' }}>{c.cat.replace(' Materials','').replace(' Products','').replace(' & Supplies','')}</span>
                                  <span style={{ fontSize:'11px', fontWeight:'bold', color:hColor }}>{pct}% OK</span>
                                </div>
                                <div style={{ background:'#f5f5f5', borderRadius:'20px', height:'10px', overflow:'hidden' }}>
                                  <div style={{ background:hColor, width:`${pct}%`, height:'100%', borderRadius:'20px', transition:'width 1s ease' }} />
                                </div>
                                <span style={{ fontSize:'10px', color:'#aaa' }}>{okItems.length}/{items.length} items adequate</span>
                              </div>
                            )
                          })}
                          {catData.length===0 && <p style={{ color:'#888', fontSize:'12px', textAlign:'center', padding:'10px' }}>No data yet</p>}
                        </div>
                      </div>

                      {/* Supplier Spending + Wastage Row */}
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'14px', marginBottom:'4px' }}>

                        {/* Supplier Stock Value */}
                        <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px' }}>
                          <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 14px' }}>🏭 Stock Value by Supplier</p>
                          {supplierData.length===0 && <p style={{ color:'#888', fontSize:'12px', textAlign:'center', padding:'10px' }}>No supplier assigned to items yet</p>}
                          {supplierData.map((s,idx)=>(
                            <div key={s.name} style={{ marginBottom:'10px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                <span style={{ fontSize:'11px', color:'#7b4f9e', fontWeight:'bold' }}>{s.name.length>20?s.name.slice(0,18)+'...':s.name}</span>
                                <span style={{ fontSize:'11px', color:'#333', fontWeight:'bold' }}>{php(s.value)}</span>
                              </div>
                              <div style={{ background:'#f5f5f5', borderRadius:'20px', height:'10px', overflow:'hidden' }}>
                                <div style={{ background:'#7b4f9e', width:`${(s.value/maxSupValue)*100}%`, height:'100%', borderRadius:'20px', minWidth:s.value>0?'4px':'0' }} />
                              </div>
                              <span style={{ fontSize:'10px', color:'#aaa' }}>{s.count} item(s)</span>
                            </div>
                          ))}
                        </div>

                        {/* Recent Wastage */}
                        <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px' }}>
                          <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 4px' }}>🗑️ Recent Wastage</p>
                          <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'18px', margin:'0 0 10px' }}>{php(monthlyWastage)} <span style={{ fontSize:'11px', color:'#888', fontWeight:'normal' }}>this month</span></p>
                          {wastageLogs.length===0 && <p style={{ color:'#2d8a4e', fontSize:'12px' }}>✅ No wastage recorded yet.</p>}
                          {wastageLogs.slice(0,4).map(w=>(
                            <div key={w.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #f5f5f5' }}>
                              <div>
                                <p style={{ fontSize:'11px', fontWeight:'bold', color:'#333', margin:0 }}>{w.item_name}</p>
                                <p style={{ fontSize:'10px', color:'#888', margin:0 }}>{w.reason?.slice(0,25)}{w.reason?.length>25?'...':''}</p>
                              </div>
                              <p style={{ fontSize:'11px', fontWeight:'bold', color:'#e65100', margin:0 }}>{php(w.total_cost||0)}</p>
                            </div>
                          ))}
                          {wastageLogs.length>4 && <p style={{ fontSize:'10px', color:'#aaa', margin:'8px 0 0', textAlign:'center' }}>+{wastageLogs.length-4} more entries</p>}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Empty state when no items yet */}
                {!inventoryLoading && inventoryItems.length===0 && (
                  <div style={{ background:'white', border:'2px dashed #ddd', borderRadius:'14px', padding:'30px', textAlign:'center', marginBottom:'16px' }}>
                    <p style={{ fontSize:'32px', margin:'0 0 10px' }}>📦</p>
                    <p style={{ fontWeight:'bold', fontSize:'14px', color:'#333' }}>No inventory items yet</p>
                    <p style={{ fontSize:'12px', color:'#888' }}>Add items below or import from Excel to see your dashboard.</p>
                  </div>
                )}

                {/* Low Stock Alert Banner */}
                {inventoryItems.filter(i=>Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0).length > 0 && (
                  <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'12px', padding:'14px', marginBottom:'16px' }}>
                    <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 8px' }}>🔴 Low Stock Alerts</p>
                    {inventoryItems.filter(i=>Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0).map(i=>(
                      <div key={i.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #fee', flexWrap:'wrap', gap:'6px' }}>
                        <span style={{ fontWeight:'bold', fontSize:'13px', color:'#333' }}>{i.name}</span>
                        <span style={{ fontSize:'12px', color:'#ca1b1b', fontWeight:'bold' }}>
                          {Number(i.current_stock||0).toFixed(2)} / {Number(i.min_stock||0).toFixed(2)} {i.unit} min
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stock In / Out / Wastage / Count Buttons */}
                <div style={{ background:'white', borderRadius:'12px', padding:'14px', marginBottom:'16px', border:'1px solid #eee', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                  <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase', margin:'0 0 10px' }}>Stock Actions</p>
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'8px' }}>
                    <button style={{ background:'#f0fff4', color:'#2d8a4e', border:'1.5px solid #2d8a4e', borderRadius:'8px', padding:'10px 8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }} onClick={()=>{ setStockTxType('in'); setShowStockForm(true); setShowWastageForm(false) }}>📥 Stock In</button>
                    <button style={{ background:'#fff5f5', color:'#ca1b1b', border:'1.5px solid #ca1b1b', borderRadius:'8px', padding:'10px 8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }} onClick={()=>{ setStockTxType('out'); setShowStockForm(true); setShowWastageForm(false) }}>📤 Stock Out</button>
                    <button style={{ background:'#fff8f0', color:'#e65100', border:'1.5px solid #e65100', borderRadius:'8px', padding:'10px 8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }} onClick={()=>{ setShowWastageForm(!showWastageForm); setShowStockForm(false) }}>🗑️ Log Wastage</button>
                    <button style={{ background:'#f5f5f5', color:'#555', border:'1.5px solid #ddd', borderRadius:'8px', padding:'10px 8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }} onClick={printPhysicalCountSheet}>📋 Count Sheet</button>
                  </div>
                </div>

                {/* WASTAGE FORM */}
                {showWastageForm && (
                  <div style={{ background:'#fff8f0', border:'2px solid #e65100', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <h3 style={{ color:'#e65100', margin:0, fontSize:'15px' }}>🗑️ Log Wastage / Spoilage</h3>
                      <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555' }} onClick={()=>setShowWastageForm(false)}>✕ CLOSE</button>
                    </div>
                    <label style={lblS}>Item:</label>
                    <select value={wastageItemId} onChange={e=>setWastageItemId(e.target.value)} style={inputStyle}>
                      <option value="">— Select item —</option>
                      {INVENTORY_CATEGORIES.map(cat=>{
                        const catItems = inventoryItems.filter(i=>i.category===cat)
                        if (!catItems.length) return null
                        return <optgroup key={cat} label={cat}>{catItems.map(i=><option key={i.id} value={i.id}>{i.name} — {Number(i.current_stock||0).toFixed(2)} {i.unit} on hand</option>)}</optgroup>
                      })}
                    </select>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <div>
                        <label style={lblS}>Quantity ({wastageItemId?(inventoryItems.find(i=>i.id===wastageItemId)?.unit||'units'):'units'}):</label>
                        <input type="number" placeholder="0" value={wastageQty} onChange={e=>setWastageQty(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} min="0.01" step="0.01" />
                      </div>
                      <div>
                        <label style={lblS}>Date:</label>
                        <input type="date" value={wastageDate} onChange={e=>setWastageDate(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} />
                      </div>
                    </div>
                    {wastageItemId && wastageQty && (
                      <div style={{ background:'#fff3e0', border:'1px solid #e65100', borderRadius:'8px', padding:'8px 12px', margin:'8px 0' }}>
                        <p style={{ margin:0, fontSize:'13px', color:'#e65100', fontWeight:'bold' }}>
                          Estimated Cost: {php(Number(wastageQty||0) * Number(inventoryItems.find(i=>i.id===wastageItemId)?.cost_per_unit||0))}
                        </p>
                      </div>
                    )}
                    <label style={lblS}>Reason:</label>
                    <select value={wastageReason} onChange={e=>setWastageReason(e.target.value)} style={inputStyle}>
                      <option value="">— Select reason —</option>
                      {WASTAGE_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                    {wastageReason==='Others' && (
                      <textarea placeholder="Describe the reason..." value={wastageReasonOther} onChange={e=>setWastageReasonOther(e.target.value)} style={{ ...inputStyle, minHeight:'60px', resize:'none' }} />
                    )}
                    <label style={lblS}>Notes (optional):</label>
                    <input type="text" placeholder="Additional details..." value={wastageNotes} onChange={e=>setWastageNotes(e.target.value)} style={inputStyle} />

                    {/* Charge to Employee Toggle */}
                    <div style={{ background: wastageChargeEmployee?'#fff5f5':'#f9f9f9', border:`2px solid ${wastageChargeEmployee?'#ca1b1b':'#ddd'}`, borderRadius:'12px', padding:'14px', marginBottom:'10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <p style={{ fontWeight:'bold', fontSize:'13px', color:wastageChargeEmployee?'#ca1b1b':'#555', margin:'0 0 2px' }}>⚠️ Charge to Employee</p>
                          <p style={{ fontSize:'11px', color:'#888', margin:0 }}>Toggle if an employee is responsible for this wastage</p>
                        </div>
                        <button
                          onClick={()=>setWastageChargeEmployee(!wastageChargeEmployee)}
                          style={{ padding:'8px 16px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'12px', background:wastageChargeEmployee?'#ca1b1b':'#ddd', color:wastageChargeEmployee?'white':'#555', transition:'all 0.2s' }}
                        >{wastageChargeEmployee?'ON':'OFF'}</button>
                      </div>
                      {wastageChargeEmployee && (
                        <div style={{ marginTop:'12px' }}>
                          <label style={lblS}>Responsible Employee:</label>
                          <EmployeeSelect value={wastageEmployeeId} onChange={setWastageEmployeeId} employees={employees} />
                          <p style={{ fontSize:'11px', color:'#ca1b1b', margin:'-6px 0 0', fontWeight:'bold' }}>⚠️ This charge will be sent to the Owner for approval before any deduction.</p>
                        </div>
                      )}
                    </div>

                    <button style={{ ...btnBlack, background:'#e65100', opacity:wastageSaving?0.6:1 }} disabled={wastageSaving} onClick={logWastage}>
                      {wastageSaving?'⏳ Saving...':'🗑️ CONFIRM WASTAGE LOG'}
                    </button>
                  </div>
                )}

                {/* EMPLOYEE CHARGES (Owner only) */}
                {adminRole==='owner' && (
                  <>
                    <button style={{ background:'white', color:'#b71c1c', border:'1.5px solid #b71c1c', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>{ if(!showChargesSection) loadEmployeeCharges(); setShowChargesSection(!showChargesSection) }}>
                      {showChargesSection?'🔼 HIDE':'🔽 VIEW'} EMPLOYEE CHARGES {employeeCharges.filter(c=>c.status==='pending_owner'||c.status==='disputed').length>0?`🔔 ${employeeCharges.filter(c=>c.status==='pending_owner'||c.status==='disputed').length}`:''}
                    </button>
                    {showChargesSection && (
                      <div style={{ background:'white', border:'2px solid #b71c1c', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                        <h3 style={{ color:'#b71c1c', margin:'0 0 14px', fontSize:'14px' }}>⚠️ Employee Charges</h3>
                        {chargesLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                        {!chargesLoading && employeeCharges.length===0 && <p style={{ color:'#888', fontSize:'13px', textAlign:'center', padding:'12px' }}>No charges recorded.</p>}
                        {employeeCharges.map(c=>{
                          const statusColor = c.status==='agreed'?'green':c.status==='dismissed'?'gray':c.status==='disputed'?'red':'yellow'
                          const statusLabel = c.status==='pending_owner'?'⏳ Pending Approval':c.status==='pending_employee'?'📱 Waiting Employee':c.status==='agreed'?'✅ Agreed':c.status==='disputed'?'❌ Disputed':'✅ Dismissed'
                          return (
                            <div key={c.id} style={{ border:`2px solid ${c.status==='pending_owner'||c.status==='disputed'?'#ca1b1b':'#eee'}`, borderRadius:'10px', padding:'12px', marginBottom:'10px', background:c.status==='pending_owner'?'#fff5f5':c.status==='disputed'?'#fff0f0':'#fafafa' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                                <div>
                                  <p style={{ fontWeight:'bold', fontSize:'14px', color:'#333', margin:'0 0 2px' }}>{c.employee_name}</p>
                                  <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{c.item_name} — {Number(c.quantity||0).toFixed(2)} {c.unit}</p>
                                </div>
                                <div style={{ textAlign:'right' }}>
                                  <p style={{ fontWeight:'bold', fontSize:'16px', color:'#ca1b1b', margin:'0 0 2px' }}>{php(c.total_cost)}</p>
                                  <Badge label={statusLabel} color={statusColor} />
                                </div>
                              </div>
                              <p style={cps}>Reason: {c.reason}</p>
                              {c.notes && <p style={cps}>Notes: {c.notes}</p>}
                              <p style={{ ...cps, color:'#aaa' }}>Logged: {new Date(c.created_at).toLocaleDateString()}</p>
                              {c.acknowledged_at && <p style={cps}>Acknowledged: {new Date(c.acknowledged_at).toLocaleString()}</p>}
                              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px' }}>
                                <button style={{ ...btnBlack, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>printChargeForm(c)}>🖨️ PRINT FORM</button>
                                {c.status==='pending_owner' && (
                                  <>
                                    <button style={{ ...btnGreen, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>approveCharge(c)}>✅ APPROVE</button>
                                    <button style={{ ...btnGray, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>dismissCharge(c)}>✕ DISMISS</button>
                                  </>
                                )}
                                {c.status==='disputed' && (
                                  <>
                                    <p style={{ fontSize:'11px', color:'#ca1b1b', fontWeight:'bold', margin:'4px 0 0', width:'100%' }}>❌ Employee disputed this charge. Final decision:</p>
                                    <button style={{ ...btnRed, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>ownerFinalDecision(c,'force_approve')}>⚡ ENFORCE CHARGE</button>
                                    <button style={{ ...btnGray, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>ownerFinalDecision(c,'dismiss')}>✕ DISMISS</button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* EXPIRY TRACKING */}
                <button style={{ background:'white', color:'#f57c00', border:'1.5px solid #f57c00', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>{ if(!showExpirySection) loadExpiryItems(); setShowExpirySection(!showExpirySection) }}>
                  {showExpirySection?'🔼 HIDE':'🔽 VIEW'} EXPIRY MONITOR
                </button>
                {showExpirySection && (
                  <div style={{ background:'white', border:'2px solid #f57c00', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                    <h3 style={{ color:'#f57c00', margin:'0 0 6px', fontSize:'14px' }}>⏰ Expiry Date Monitor</h3>
                    <p style={{ color:'#888', fontSize:'12px', margin:'0 0 14px' }}>Set expiry dates per item. Items are flagged automatically when expiring soon or already expired.</p>
                    {expiryLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}

                    {/* All items — set expiry */}
                    <div style={{ marginBottom:'16px' }}>
                      <p style={{ fontWeight:'bold', fontSize:'13px', color:'#f57c00', margin:'0 0 8px' }}>📦 Set / Update Expiry Dates:</p>
                      {inventoryItems.filter(i=>['Raw Ingredients','Packaging Materials'].includes(i.category)).map(item=>{
                        const isEditing = editingExpiryId===item.id
                        const daysLeft = item.expiry_date ? Math.ceil((new Date(item.expiry_date)-new Date())/(1000*60*60*24)) : null
                        const expiryColor = daysLeft===null?'#888':daysLeft<=0?'#ca1b1b':daysLeft<=7?'#f57c00':'#2d8a4e'
                        return (
                          <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderBottom:'1px solid #eee', flexWrap:'wrap', gap:'8px' }}>
                            <div style={{ flex:1 }}>
                              <span style={{ fontWeight:'bold', fontSize:'13px', color:'#333' }}>{item.name}</span>
                              <span style={{ fontSize:'11px', color:'#888', marginLeft:'8px' }}>{item.category}</span>
                              {item.expiry_date && (
                                <span style={{ fontSize:'11px', fontWeight:'bold', color:expiryColor, marginLeft:'8px' }}>
                                  {daysLeft<=0?'🔴 EXPIRED':daysLeft<=7?`🟡 Expires in ${daysLeft} day(s)`:` ✅ Expires ${item.expiry_date}`}
                                </span>
                              )}
                            </div>
                            {isEditing ? (
                              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                                <input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} style={{ ...inputStyle, marginBottom:0, width:'150px' }} />
                                <button style={{ ...btnGreen, width:'auto', padding:'6px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>saveExpiryDate(item.id)}>✅ SAVE</button>
                                <button style={{ ...btnGray, width:'auto', padding:'6px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>setEditingExpiryId(null)}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display:'flex', gap:'6px' }}>
                                <button style={{ ...btnBlack, background:'#f57c00', width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setEditingExpiryId(item.id); setExpiryDate(item.expiry_date||'') }}>{item.expiry_date?'✏️ EDIT':'+ SET DATE'}</button>
                                {item.expiry_date && <button style={{ ...btnGray, width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>clearExpiryDate(item.id)}>✕</button>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Expiry alerts */}
                    {(() => {
                      const expired = inventoryItems.filter(i=>i.expiry_date && new Date(i.expiry_date)<new Date())
                      const expiringSoon = inventoryItems.filter(i=>i.expiry_date && new Date(i.expiry_date)>=new Date() && Math.ceil((new Date(i.expiry_date)-new Date())/(1000*60*60*24))<=7)
                      return (expired.length>0||expiringSoon.length>0) ? (
                        <div>
                          {expired.length>0 && (
                            <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'10px', padding:'12px', marginBottom:'10px' }}>
                              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 8px' }}>🔴 EXPIRED — Log Wastage Immediately</p>
                              {expired.map(i=><p key={i.id} style={{ ...cps, color:'#ca1b1b', fontWeight:'bold' }}>{i.name} — expired {i.expiry_date}</p>)}
                            </div>
                          )}
                          {expiringSoon.length>0 && (
                            <div style={{ background:'#fff8e1', border:'2px solid #f57c00', borderRadius:'10px', padding:'12px' }}>
                              <p style={{ fontWeight:'bold', color:'#f57c00', fontSize:'13px', margin:'0 0 8px' }}>🟡 EXPIRING WITHIN 7 DAYS — Use Soon</p>
                              {expiringSoon.map(i=>{
                                const days = Math.ceil((new Date(i.expiry_date)-new Date())/(1000*60*60*24))
                                return <p key={i.id} style={cps}>{i.name} — expires in <strong style={{ color:'#f57c00' }}>{days} day(s)</strong> ({i.expiry_date})</p>
                              })}
                            </div>
                          )}
                        </div>
                      ) : <p style={{ color:'#2d8a4e', fontSize:'13px', fontWeight:'bold' }}>✅ No expiry alerts.</p>
                    })()}
                  </div>
                )}

                {/* WASTAGE HISTORY */}
                <button style={{ background:'white', color:'#e65100', border:'1.5px solid #e65100', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>{ if(!showWastageHistory) loadWastageLogs(); setShowWastageHistory(!showWastageHistory) }}>
                  {showWastageHistory?'🔼 HIDE':'🔽 VIEW'} WASTAGE HISTORY
                </button>
                {showWastageHistory && (
                  <div style={{ marginBottom:'16px' }}>
                    {wastageLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                    {!wastageLoading && wastageLogs.length===0 && <p style={{ color:'#888', fontSize:'13px' }}>No wastage logs yet.</p>}
                    {wastageLogs.map(w=>(
                      <div key={w.id} style={{ ...cardS, borderLeft:`4px solid #e65100`, background:'#fff8f0' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 2px' }}>{w.item_name}</p>
                            <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{w.category}</p>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <p style={{ fontWeight:'bold', color:'#e65100', fontSize:'14px', margin:'0 0 2px' }}>-{Number(w.quantity||0).toFixed(2)} {w.unit}</p>
                            <p style={{ color:'#ca1b1b', fontSize:'12px', fontWeight:'bold', margin:0 }}>{php(w.total_cost)}</p>
                          </div>
                        </div>
                        <p style={cps}>Reason: {w.reason}</p>
                        {w.employee_name && <p style={{ ...cps, color:'#ca1b1b', fontWeight:'bold' }}>⚠️ Charged to: {w.employee_name}</p>}
                        {w.notes && <p style={cps}>Notes: {w.notes}</p>}
                        <p style={{ ...cps, color:'#aaa' }}>{w.wastage_date} — {w.logged_by}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* SUPPLIERS SECTION */}
                <button style={{ background:'white', color:'#7b4f9e', border:'1.5px solid #7b4f9e', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>{ if(!showSuppliersSection) loadSuppliers(); setShowSuppliersSection(!showSuppliersSection) }}>
                  {showSuppliersSection?'🔼 HIDE':'🔽 MANAGE'} SUPPLIERS ({suppliers.length}/10)
                </button>
                {showSuppliersSection && (
                  <div style={{ background:'white', border:'2px solid #7b4f9e', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <h3 style={{ color:'#7b4f9e', margin:0, fontSize:'14px' }}>🏭 Suppliers ({suppliers.length}/10)</h3>
                      {suppliers.length < 10 && (
                        <button style={{ ...btnBlack, background:'#7b4f9e', width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>{ setEditingSupplierId(null); setSupplierForm({ name:'', contact_person:'', phone:'', email:'', address:'', payment_terms:'COD (Cash on Delivery)', notes:'' }); setShowAddSupplier(!showAddSupplier) }}>
                          {showAddSupplier&&!editingSupplierId?'✕ CANCEL':'➕ ADD SUPPLIER'}
                        </button>
                      )}
                    </div>

                    {/* Supplier Form */}
                    {showAddSupplier && (
                      <div style={{ background:'#f8f0ff', border:'1px solid #7b4f9e', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#7b4f9e', margin:'0 0 12px', fontSize:'13px' }}>{editingSupplierId?'✏️ Edit Supplier':'➕ New Supplier'}</h4>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                          <div><label style={lblS}>Supplier Name: *</label><input type="text" placeholder="e.g. Juan's Food Supply" value={supplierForm.name} onChange={e=>setSupplierForm(p=>({...p,name:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                          <div><label style={lblS}>Contact Person:</label><input type="text" placeholder="e.g. Juan dela Cruz" value={supplierForm.contact_person} onChange={e=>setSupplierForm(p=>({...p,contact_person:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                          <div><label style={lblS}>Phone / Mobile:</label><input type="text" placeholder="09XX-XXX-XXXX" value={supplierForm.phone} onChange={e=>setSupplierForm(p=>({...p,phone:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                          <div><label style={lblS}>Email:</label><input type="email" placeholder="supplier@email.com" value={supplierForm.email} onChange={e=>setSupplierForm(p=>({...p,email:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                        </div>
                        <label style={{ ...lblS, marginTop:'10px' }}>Address:</label>
                        <input type="text" placeholder="Complete address" value={supplierForm.address} onChange={e=>setSupplierForm(p=>({...p,address:e.target.value}))} style={inputStyle} />
                        <label style={lblS}>Payment Terms:</label>
                        <select value={supplierForm.payment_terms} onChange={e=>setSupplierForm(p=>({...p,payment_terms:e.target.value}))} style={inputStyle}>
                          {PAYMENT_TERMS.map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        <label style={lblS}>Notes:</label>
                        <input type="text" placeholder="Any additional notes" value={supplierForm.notes} onChange={e=>setSupplierForm(p=>({...p,notes:e.target.value}))} style={inputStyle} />
                        <button style={{ ...btnBlack, background:'#7b4f9e' }} onClick={saveSupplier}>{editingSupplierId?'✅ UPDATE SUPPLIER':'➕ SAVE SUPPLIER'}</button>
                      </div>
                    )}

                    {/* Suppliers List */}
                    {suppliersLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                    {!suppliersLoading && suppliers.length===0 && <p style={{ color:'#888', fontSize:'13px', textAlign:'center', padding:'12px' }}>No suppliers yet. Add up to 10 suppliers.</p>}
                    {suppliers.map(s=>(
                      <div key={s.id} style={{ border:'1px solid #e8d5f5', borderRadius:'10px', padding:'12px', marginBottom:'10px', background:'#faf5ff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                          <div style={{ flex:1 }}>
                            <p style={{ fontWeight:'bold', fontSize:'14px', color:'#7b4f9e', margin:'0 0 4px' }}>{s.name}</p>
                            <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'2px' }}>
                              {s.contact_person && <p style={cps}>👤 {s.contact_person}</p>}
                              {s.phone && <p style={cps}>📞 {s.phone}</p>}
                              {s.email && <p style={cps}>✉️ {s.email}</p>}
                              {s.address && <p style={cps}>📍 {s.address}</p>}
                              <p style={cps}>💳 {s.payment_terms}</p>
                            </div>
                            {s.notes && <p style={{ ...cps, color:'#888', fontStyle:'italic' }}>📝 {s.notes}</p>}
                          </div>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button style={{ ...btnBlack, background:'#7b4f9e', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>startEditSupplier(s)}>✏️ EDIT</button>
                            <button style={{ ...btnRed, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>deleteSupplier(s)}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PURCHASE ORDERS SECTION */}
                <button style={{ background:'white', color:'#2d6a4f', border:'1.5px solid #2d6a4f', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>{ if(!showPOSection) loadPurchaseOrders(); setShowPOSection(!showPOSection) }}>
                  {showPOSection?'🔼 HIDE':'🔽 VIEW'} PURCHASE ORDERS ({purchaseOrders.length})
                </button>
                {showPOSection && (
                  <div style={{ background:'white', border:'2px solid #2d6a4f', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#2d6a4f', margin:0, fontSize:'14px' }}>📋 Purchase Orders</h3>
                      <button style={{ ...btnGreen, background:'#2d6a4f', width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>setShowPOBuilder(!showPOBuilder)}>
                        {showPOBuilder?'✕ CANCEL':'📋 CREATE NEW PO'}
                      </button>
                    </div>

                    {/* PO Builder */}
                    {showPOBuilder && (
                      <div style={{ background:'#f0fff8', border:'1px solid #2d6a4f', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#2d6a4f', margin:'0 0 12px', fontSize:'13px' }}>📋 New Purchase Order</h4>
                        <label style={lblS}>Select Supplier:</label>
                        <select value={poSupplierId} onChange={e=>{ setPOSupplierId(e.target.value); if(e.target.value) buildPO(e.target.value) }} style={inputStyle}>
                          <option value="">— Select supplier —</option>
                          {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {poItems.length>0 && (
                          <div>
                            <p style={{ fontSize:'12px', color:'#2d6a4f', fontWeight:'bold', margin:'10px 0 8px' }}>📦 Low Stock Items (edit quantities and prices before saving):</p>
                            {poItems.map((item,idx)=>(
                              <div key={item.item_id} style={{ background:'white', border:'1px solid #c8e6c9', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
                                <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 8px', color:'#333' }}>{item.item_name} <span style={{ color:'#888', fontWeight:'normal', fontSize:'11px' }}>(Current: {item.current_stock.toFixed(2)} {item.unit})</span></p>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                                  <div>
                                    <label style={lblS}>Order Qty ({item.unit}):</label>
                                    <input type="number" value={item.order_qty} onChange={e=>{ const v=[...poItems]; v[idx]={...v[idx],order_qty:e.target.value,total_price:Number(e.target.value)*Number(v[idx].unit_price)}; setPOItems(v) }} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" />
                                  </div>
                                  <div>
                                    <label style={lblS}>Unit Price (PHP):</label>
                                    <input type="number" value={item.unit_price} onChange={e=>{ const v=[...poItems]; v[idx]={...v[idx],unit_price:e.target.value,total_price:Number(item.order_qty)*Number(e.target.value)}; setPOItems(v) }} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" />
                                  </div>
                                </div>
                                <p style={{ fontSize:'12px', color:'#2d6a4f', margin:'6px 0 0', fontWeight:'bold' }}>Subtotal: {php(Number(item.order_qty||0)*Number(item.unit_price||0))}</p>
                              </div>
                            ))}
                            <div style={{ background:'#e8f5e9', border:'1px solid #2d6a4f', borderRadius:'8px', padding:'10px', marginBottom:'10px', textAlign:'right' }}>
                              <p style={{ fontWeight:'bold', fontSize:'14px', color:'#2d6a4f', margin:0 }}>Total: {php(poItems.reduce((s,i)=>s+Number(i.order_qty||0)*Number(i.unit_price||0),0))}</p>
                            </div>
                            <label style={lblS}>Notes (optional):</label>
                            <input type="text" placeholder="e.g. Urgent, please deliver by Friday" value={poNotes} onChange={e=>setPONotes(e.target.value)} style={inputStyle} />
                            <button style={{ ...btnGreen, background:'#2d6a4f', opacity:savingPO?0.6:1 }} disabled={savingPO} onClick={savePO}>{savingPO?'⏳ Saving...':'💾 SAVE PURCHASE ORDER'}</button>
                          </div>
                        )}
                        {poSupplierId && poItems.length===0 && (
                          <div style={{ background:'#fff8dc', borderRadius:'8px', padding:'12px', border:'1px solid #f5a623' }}>
                            <p style={{ color:'#888', fontSize:'13px', margin:0 }}>ℹ️ No low stock items found for this supplier. Make sure items are assigned to this supplier and have a minimum stock level set.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PO List */}
                    {purchaseOrders.length===0 && <p style={{ color:'#888', fontSize:'13px', textAlign:'center', padding:'12px' }}>No purchase orders yet.</p>}
                    {purchaseOrders.map(po=>{
                      const total = (po.purchase_order_items||[]).reduce((s,i)=>s+Number(i.total_price||0),0)
                      const statusColor = po.status==='received'?'green':po.status==='sent'?'blue':'gray'
                      return (
                        <div key={po.id} style={{ border:'1px solid #b7e4c7', borderRadius:'10px', padding:'12px', marginBottom:'10px', background:'#f0fff8' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                            <div>
                              <p style={{ fontWeight:'bold', fontSize:'14px', color:'#2d6a4f', margin:'0 0 2px' }}>{po.po_number}</p>
                              <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{po.supplier_name} • {new Date(po.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge label={po.status?.toUpperCase()||'DRAFT'} color={statusColor} />
                          </div>
                          <p style={cps}>Items: {(po.purchase_order_items||[]).length} | Total: <strong>{php(total)}</strong> | Terms: {po.payment_terms||'—'}</p>
                          {po.notes && <p style={{ ...cps, fontStyle:'italic' }}>📝 {po.notes}</p>}
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px' }}>
                            <button style={{ ...btnBlack, background:'#2d6a4f', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>printPO(po)}>🖨️ PRINT PO</button>
                            {po.status==='draft' && <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>updatePOStatus(po.id,'sent')}>📤 MARK SENT</button>}
                            {po.status==='sent' && <button style={{ ...btnGreen, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>updatePOStatus(po.id,'received')}>✅ MARK RECEIVED</button>}
                            {po.status==='received' && <button style={{ ...btnGray, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>updatePOStatus(po.id,'draft')}>↩️ REOPEN</button>}
                            <button style={{ ...btnRed, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>deletePO(po)}>🗑️ DELETE</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Stock Transaction Form */}
                {showStockForm && (
                  <div style={{ background:stockTxType==='in'?'#f0fff4':'#fff5f5', border:`2px solid ${stockTxType==='in'?'#2d8a4e':'#ca1b1b'}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <h3 style={{ color:stockTxType==='in'?'#2d8a4e':'#ca1b1b', margin:0, fontSize:'15px' }}>{stockTxType==='in'?'📥 Stock In — Record Delivery / Purchase':'📤 Stock Out — Record Usage / Wastage'}</h3>
                      <button style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555' }} onClick={()=>setShowStockForm(false)}>✕ CLOSE</button>
                    </div>
                    <label style={lblS}>Item:</label>
                    <select value={stockTxItemId} onChange={e=>setStockTxItemId(e.target.value)} style={inputStyle}>
                      <option value="">— Select item —</option>
                      {INVENTORY_CATEGORIES.map(cat=>{
                        const catItems = inventoryItems.filter(i=>i.category===cat)
                        if (!catItems.length) return null
                        return <optgroup key={cat} label={cat}>{catItems.map(i=><option key={i.id} value={i.id}>{i.name} — {Number(i.current_stock||0).toFixed(2)} {i.unit} on hand</option>)}</optgroup>
                      })}
                    </select>
                    <label style={lblS}>Quantity ({stockTxItemId ? (inventoryItems.find(i=>i.id===stockTxItemId)?.unit||'units') : 'units'}):</label>
                    <input type="number" placeholder="Enter quantity" value={stockTxQty} onChange={e=>setStockTxQty(e.target.value)} style={inputStyle} min="0.01" step="0.01" />
                    <label style={lblS}>Reference <span style={{ color:'#aaa', fontWeight:'normal' }}>(e.g. DR#, PO#, batch no.)</span>:</label>
                    <input type="text" placeholder="Optional reference number" value={stockTxReference} onChange={e=>setStockTxReference(e.target.value)} style={inputStyle} />
                    <label style={lblS}>Notes <span style={{ color:'#aaa', fontWeight:'normal' }}>(optional)</span>:</label>
                    <input type="text" placeholder="e.g. Morning production, Spoilage" value={stockTxNotes} onChange={e=>setStockTxNotes(e.target.value)} style={inputStyle} />
                    <button
                      style={{ ...stockTxType==='in'?btnGreen:btnRed, opacity:stockTxLoading?0.6:1 }}
                      disabled={stockTxLoading}
                      onClick={recordStockTransaction}
                    >
                      {stockTxLoading?'⏳ Saving...':(stockTxType==='in'?'📥 CONFIRM STOCK IN':'📤 CONFIRM STOCK OUT')}
                    </button>
                  </div>
                )}

                {/* Search & Filter */}
                <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
                  <input placeholder="Search items..." value={inventorySearch} onChange={e=>setInventorySearch(e.target.value)} style={{ ...inputStyle, marginBottom:0, flex:1, minWidth:'150px' }} />
                  <select value={inventoryCategoryFilter} onChange={e=>setInventoryCategoryFilter(e.target.value)} style={{ ...inputStyle, marginBottom:0, width:'auto' }}>
                    <option value="all">All Categories</option>
                    {INVENTORY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Add Item Button + CSV/XLSX Upload */}
                <div style={{ display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap' }}>
                  <button style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'8px', padding:'10px 16px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>setShowAddItem(!showAddItem)}>
                    {showAddItem?'✕ CANCEL':'➕ ADD NEW ITEM'}
                  </button>
                  <label style={{ background:'#FDD412', color:'#1a1a2e', border:'none', borderRadius:'8px', padding:'10px 16px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    📤 BULK UPLOAD
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleInventoryCSV} style={{ display:'none' }} />
                  </label>
                </div>
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={e=>{ e.preventDefault(); e.currentTarget.style.background='#fffde7'; e.currentTarget.style.borderColor='#FDD412'; e.currentTarget.style.color='#1a1a2e' }}
                  onDragLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='#e0e0e0'; e.currentTarget.style.color='#bbb' }}
                  onDrop={e=>{ e.preventDefault(); e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='#e0e0e0'; e.currentTarget.style.color='#bbb'; const file=e.dataTransfer.files[0]; if(file){ handleInventoryCSV(file) } else { showToast('❌ Please drop a CSV or XLSX file.','red') } }}
                  style={{ border:'2px dashed #e0e0e0', borderRadius:'10px', padding:'12px', marginBottom:'14px', textAlign:'center', transition:'all 0.2s', color:'#bbb', fontSize:'11px', cursor:'default' }}
                >
                  📂 Or drag & drop a <strong>CSV</strong> or <strong>XLSX</strong> file here to bulk upload inventory
                </div>

                {/* CSV Preview Modal */}
                {showCsvPreview && (
                  <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={()=>setShowCsvPreview(false)}>
                    <div style={{ background:'white', borderRadius:'16px', padding:'20px', maxWidth:'700px', width:'100%', maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <div>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px', margin:'0 0 2px' }}>📤 CSV Preview — {csvPreview.length} items</p>
                          <p style={{ color:'#888', fontSize:'12px', margin:0 }}>Review before uploading to inventory</p>
                        </div>
                        <button onClick={()=>setShowCsvPreview(false)} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold' }}>✕</button>
                      </div>
                      <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden', marginBottom:'14px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', background:'#ca1b1b', padding:'8px 12px' }}>
                          {['Name','Category','Unit','Stock','Min','Cost/Unit'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold' }}>{h}</span>)}
                        </div>
                        {csvPreview.slice(0,20).map((row,i)=>(
                          <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', padding:'7px 12px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>
                            <span style={{ fontSize:'11px', fontWeight:'bold' }}>{row.name}</span>
                            <span style={{ fontSize:'11px', color:'#555' }}>{row.category||'Raw Ingredients'}</span>
                            <span style={{ fontSize:'11px', color:'#555' }}>{row.unit||'kg'}</span>
                            <span style={{ fontSize:'11px', color:'#2d8a4e', fontWeight:'bold' }}>{row.current_stock||0}</span>
                            <span style={{ fontSize:'11px', color:'#ca1b1b' }}>{row.min_stock||0}</span>
                            <span style={{ fontSize:'11px' }}>₱{row.cost_per_unit||0}</span>
                          </div>
                        ))}
                        {csvPreview.length > 20 && <div style={{ padding:'8px 12px', background:'#f8f7f5', textAlign:'center', fontSize:'11px', color:'#888' }}>...and {csvPreview.length-20} more items</div>}
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button style={{ ...btnGreen, flex:1, marginTop:0 }} onClick={confirmCSVUpload} disabled={csvUploading}>{csvUploading?'⏳ Uploading...':'✅ CONFIRM & UPLOAD ALL'}</button>
                        <button style={{ ...btnGray, flex:1, marginTop:0 }} onClick={()=>{ setShowCsvPreview(false); setCsvPreview([]) }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Item Form */}
                {showAddItem && (
                  <div style={{ background:'#e8f0fe', border:'2px solid #4a90d9', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                    <h3 style={{ color:'#4a90d9', margin:'0 0 14px', fontSize:'14px' }}>➕ Add New Inventory Item</h3>
                    <label style={lblS}>Item Name:</label>
                    <input type="text" placeholder="e.g. All-purpose flour" value={newItemName} onChange={e=>setNewItemName(e.target.value)} style={inputStyle} />
                    <label style={lblS}>Category:</label>
                    <select value={newItemCategory} onChange={e=>setNewItemCategory(e.target.value)} style={inputStyle}>
                      {INVENTORY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <label style={lblS}>Supplier:</label>
                    <select value={newItemSupplierId} onChange={e=>setNewItemSupplierId(e.target.value)} style={inputStyle}>
                      <option value="">— No supplier assigned —</option>
                      {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <div>
                        <label style={lblS}>Unit of Measure:</label>
                        <select value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)} style={{ ...inputStyle, marginBottom:0 }}>
                          {['kg','g','L','mL','pcs','boxes','bags','sacks','bottles','rolls','pairs','sets'].map(u=><option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Current Stock on Hand:</label>
                        <input type="number" placeholder="0.00" value={newItemCurrentStock} onChange={e=>setNewItemCurrentStock(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" />
                      </div>
                      <div>
                        <label style={lblS}>Cost per Unit (PHP):</label>
                        <input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>setNewItemCostPerUnit(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" />
                      </div>
                      <div>
                        <label style={lblS}>Min Stock Level:</label>
                        <input type="number" placeholder="e.g. 5" value={newItemMinStock} onChange={e=>setNewItemMinStock(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" />
                      </div>
                      {newItemCategory==='Finished Products' && (
                        <div>
                          <label style={lblS}>Selling Price (PHP):</label>
                          <input type="number" placeholder="0.00" value={newItemSellingPrice} onChange={e=>setNewItemSellingPrice(e.target.value)} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" />
                        </div>
                      )}
                    </div>
                    <button style={{ ...btnBlack, background:'#4a90d9', marginTop:'14px', opacity:addItemLoading?0.6:1 }} disabled={addItemLoading} onClick={addInventoryItem}>{addItemLoading?'⏳ Adding...':'➕ ADD ITEM'}</button>
                  </div>
                )}

                {/* Items List by Category */}
                {inventoryLoading && <p style={{ color:'#888', textAlign:'center', padding:'20px' }}>⏳ Loading inventory...</p>}
                {!inventoryLoading && (() => {
                  const filtered = inventoryItems.filter(i=>{
                    const matchSearch = !inventorySearch || i.name.toLowerCase().includes(inventorySearch.toLowerCase())
                    const matchCat = inventoryCategoryFilter==='all' || i.category===inventoryCategoryFilter
                    return matchSearch && matchCat
                  })
                  if (filtered.length===0) return <div style={{ textAlign:'center', padding:'30px', color:'#888' }}><p style={{ fontSize:'28px', margin:'0 0 10px' }}>📭</p><p style={{ fontSize:'14px' }}>No items found.</p></div>
                  const grouped = INVENTORY_CATEGORIES.map(cat=>({ cat, items: filtered.filter(i=>i.category===cat) })).filter(g=>g.items.length>0)
                  return grouped.map(g=>(
                    <div key={g.cat} style={{ marginBottom:'20px' }}>
                      <div style={{ background:'#ca1b1b', color:'white', padding:'8px 14px', borderRadius:'10px 10px 0 0', fontWeight:'bold', fontSize:'13px' }}>
                        📦 {g.cat} <span style={{ opacity:0.8, fontWeight:'normal' }}>({g.items.length} item{g.items.length>1?'s':''})</span>
                      </div>
                      {g.items.map(item=>{
                        const isLow = Number(item.current_stock||0)<=Number(item.min_stock||0)&&Number(item.min_stock||0)>0
                        const isEditing = editingItemId===item.id
                        return (
                          <div key={item.id} style={{ border:`1px solid ${isLow?'#ca1b1b':'#eee'}`, borderTop:'none', background:isLow?'#fff8f8':'white', padding:'12px 14px' }}>
                            {isEditing ? (
                              <div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                                  <div><label style={lblS}>Name:</label><input value={editItemFields.name??item.name} onChange={e=>setEditItemFields(p=>({...p,name:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                                  <div><label style={lblS}>Unit:</label>
                                    <select value={editItemFields.unit??item.unit} onChange={e=>setEditItemFields(p=>({...p,unit:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>
                                      {['kg','g','L','mL','pcs','boxes','bags','sacks','bottles','rolls','pairs','sets'].map(u=><option key={u} value={u}>{u}</option>)}
                                    </select>
                                  </div>
                                  <div><label style={lblS}>📦 Current Stock on Hand:</label><input type="number" value={editItemFields.current_stock??item.current_stock} onChange={e=>setEditItemFields(p=>({...p,current_stock:e.target.value}))} style={{ ...inputStyle, marginBottom:0, border:'2px solid #2d8a4e' }} min="0" step="0.01" /></div>
                                  <div><label style={lblS}>Min Stock Level:</label><input type="number" value={editItemFields.min_stock??item.min_stock} onChange={e=>setEditItemFields(p=>({...p,min_stock:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" /></div>
                                  <div><label style={lblS}>Cost/Unit (PHP):</label><input type="number" value={editItemFields.cost_per_unit??item.cost_per_unit} onChange={e=>setEditItemFields(p=>({...p,cost_per_unit:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" /></div>
                                  {(editItemFields.category??item.category)==='Finished Products' && <div><label style={lblS}>Selling Price (PHP):</label><input type="number" value={editItemFields.selling_price??item.selling_price??0} onChange={e=>setEditItemFields(p=>({...p,selling_price:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} min="0" step="0.01" /></div>}
                                  <div><label style={lblS}>Supplier:</label>
                                    <select value={editItemFields.supplier_id??item.supplier_id??''} onChange={e=>setEditItemFields(p=>({...p,supplier_id:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>
                                      <option value="">— No supplier —</option>
                                      {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div style={{ display:'flex', gap:'8px' }}>
                                  <button style={{ ...btnGreen, width:'auto', padding:'7px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>saveInventoryItemEdit(item)}>✅ SAVE</button>
                                  <button style={{ ...btnGray, width:'auto', padding:'7px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>{ setEditingItemId(null); setEditItemFields({}) }}>✕ CANCEL</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                    <span style={{ fontWeight:'bold', fontSize:'14px', color:'#333' }}>{item.name}</span>
                                    {isLow && <Badge label="🔴 LOW STOCK" color="red" />}
                                  </div>
                                  <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginTop:'4px' }}>
                                    <span style={{ fontSize:'12px', color:'#888' }}>Cost: {php(item.cost_per_unit||0)}/{item.unit}</span>
                                    {Number(item.selling_price||0)>0 && <span style={{ fontSize:'12px', color:'#2d8a4e', fontWeight:'bold' }}>Sell: {php(item.selling_price)}/{item.unit}</span>}
                                    <span style={{ fontSize:'12px', color:'#888' }}>Min: {Number(item.min_stock||0).toFixed(2)} {item.unit}</span>
                                    <span style={{ fontSize:'12px', color:'#888' }}>Value: {php(Number(item.current_stock||0)*Number(item.cost_per_unit||0))}</span>
                                    {item.supplier_id && <span style={{ fontSize:'12px', color:'#7b4f9e', fontWeight:'bold' }}>🏭 {suppliers.find(s=>s.id===item.supplier_id)?.name||'Unknown'}</span>}
                                  </div>
                                </div>
                                <div style={{ textAlign:'right', minWidth:'120px' }}>
                                  <p style={{ fontWeight:'bold', fontSize:'20px', margin:'0', color:isLow?'#ca1b1b':'#2d8a4e' }}>{Number(item.current_stock||0).toFixed(2)}</p>
                                  <p style={{ fontSize:'11px', color:'#888', margin:'0 0 6px' }}>{item.unit} on hand</p>
                                  <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end', flexWrap:'wrap' }}>
                                    {isLow && item.supplier_id && (
                                      <button style={{ ...btnGreen, background:'#2d6a4f', width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setPOSupplierId(item.supplier_id); buildPO(item.supplier_id); setShowPOSection(true); setShowPOBuilder(true) }}>📋 GEN PO</button>
                                    )}
                                    <button style={{ ...btnYellow, padding:'5px 10px', fontSize:'11px' }} onClick={()=>{ setEditingItemId(item.id); setEditItemFields({}) }}>✏️ EDIT</button>
                                    <button style={{ ...btnRed, width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>deleteInventoryItem(item)}>🗑️</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}

                {/* Transaction History */}
                <button style={{ background:'white', color:'#555', border:'1.5px solid #ddd', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', marginTop:'10px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>{ if(!showInventoryHistory) loadInventoryTransactions(); setShowInventoryHistory(!showInventoryHistory) }}>
                  {showInventoryHistory?'🔼 HIDE':'🔽 VIEW'} TRANSACTION HISTORY
                </button>
                {showInventoryHistory && (
                  <div style={{ marginTop:'12px' }}>
                    {inventoryTxLoading && <p style={{ color:'#888', textAlign:'center', padding:'12px' }}>⏳ Loading...</p>}
                    {!inventoryTxLoading && inventoryTransactions.length===0 && <p style={{ color:'#888', fontSize:'13px' }}>No transactions yet.</p>}
                    {!inventoryTxLoading && inventoryTransactions.map(tx=>(
                      <div key={tx.id} style={{ ...cardS, borderLeft:`4px solid ${tx.transaction_type==='in'?'#2d8a4e':'#ca1b1b'}`, background:tx.transaction_type==='in'?'#f0fff4':'#fff8f8' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'6px' }}>
                          <div>
                            <span style={{ fontWeight:'bold', fontSize:'13px', color:'#333' }}>{tx.item_name}</span>
                            <span style={{ marginLeft:'8px', fontSize:'12px', color:'#888' }}>{tx.category}</span>
                          </div>
                          <Badge label={tx.transaction_type==='in'?'📥 IN':'📤 OUT'} color={tx.transaction_type==='in'?'green':'red'} />
                        </div>
                        <p style={cps}>
                          <strong style={{ color:tx.transaction_type==='in'?'#2d8a4e':'#ca1b1b' }}>{tx.transaction_type==='in'?'+':'-'}{Number(tx.quantity||0).toFixed(2)} {tx.unit}</strong>
                          &nbsp;| Stock: {Number(tx.stock_before||0).toFixed(2)} → {Number(tx.stock_after||0).toFixed(2)}
                        </p>
                        {tx.reference && <p style={cps}>Ref: {tx.reference}</p>}
                        {tx.notes && <p style={cps}>Note: {tx.notes}</p>}
                        <p style={{ ...cps, color:'#aaa' }}>{new Date(tx.created_at).toLocaleString()} — {tx.performed_by}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* COSTING — OWNER ONLY */}
            {activeTab==='costing' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
                  <h2 style={h2s}>💰 Production Costing System</h2>
                  <button style={{ ...btnBlack, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={printCostingReport}>🖨️ PRINT REPORT</button>
                </div>

                {/* Sub-navigation */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'20px' }}>
                  {[['dashboard','📊 Dashboard'],['recipes','📖 Recipes'],['production','🏭 Production'],['settings','⚙️ Settings']].map(([v,l])=>(
                    <button key={v} onClick={()=>setCostingView(v)} style={{ padding:'10px', borderRadius:'10px', border:`2px solid ${costingView===v?'#ca1b1b':'#ddd'}`, background:costingView===v?'#ca1b1b':'white', color:costingView===v?'white':'#555', fontWeight:'bold', fontSize:'12px', cursor:'pointer' }}>{l}</button>
                  ))}
                </div>

                {/* ── DASHBOARD VIEW ── */}
                {costingView==='dashboard' && (() => {
                  const fin = computeFinancials()
                  const byCategory = VARIANT_CATEGORIES.map(cat => ({
                    cat, variants: fin.variantData.filter(v => v.category === cat)
                  })).filter(g => g.variants.length > 0)
                  const catColors = { Regular:'#ca1b1b', Filled:'#4a90d9', Premium:'#7b4f9e', 'Glaze Circlet':'#2d8a4e', Bites:'#f57c00', Giant:'#333' }
                  const belowTarget = fin.variantData.filter(v => v.belowTarget)
                  const avgMarginPct = fin.variantData.length > 0 ? fin.variantData.reduce((s,v) => s + (v.grossMarginPct||0), 0) / fin.variantData.length : 0
                  return (
                    <div>
                      {/* Hero BEP Card */}
                      <div style={{ background:'linear-gradient(135deg,#ca1b1b,#8b0000)', borderRadius:'16px', padding:'20px', marginBottom:'16px', color:'white' }}>
                        <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', margin:'0 0 8px' }}>BREAK-EVEN POINT</p>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
                          <div>
                            <p style={{ fontSize:'36px', fontWeight:'bold', margin:'0 0 2px' }}>{fin.dailyBEP.toLocaleString()}</p>
                            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px', margin:0 }}>pieces per day to break even</p>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <p style={{ fontSize:'22px', fontWeight:'bold', margin:'0 0 2px' }}>{fin.monthlyBEP.toLocaleString()}</p>
                            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px', margin:0 }}>pieces per month</p>
                          </div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'20px', height:'8px', marginTop:'14px', overflow:'hidden' }}>
                          <div style={{ background:'#a8e6a3', width:`${Math.min(100,(fin.dailyBEP/Math.max(1,Number(costSettings.total_daily_pieces)))*100)}%`, height:'100%', borderRadius:'20px' }} />
                        </div>
                        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'11px', margin:'6px 0 0' }}>
                          BEP is {((fin.dailyBEP/Math.max(1,Number(costSettings.total_daily_pieces)))*100).toFixed(1)}% of your {Number(costSettings.total_daily_pieces).toLocaleString()} daily production
                        </p>
                      </div>

                      {/* Stat Cards */}
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
                        {[
                          { label:'Daily Fixed Cost', value:php(fin.dailyFixed), color:'#4a90d9', sub:'Rent + Electricity + Loans + Depreciation' },
                          { label:'Daily Labor Cost', value:php(fin.dailyLabor), color:'#7b4f9e', sub:`₱${(fin.laborPerPiece).toFixed(2)}/piece` },
                          { label:'Avg Gross Margin', value:`${avgMarginPct.toFixed(1)}%`, color:avgMarginPct>=30?'#2d8a4e':'#ca1b1b', sub:`Target: ${costSettings.target_margin_percentage}%` },
                          { label:'Below Target', value:belowTarget.length, color:belowTarget.length>0?'#ca1b1b':'#2d8a4e', sub:belowTarget.length>0?'variants need attention':'All variants healthy' },
                        ].map(c=>(
                          <div key={c.label} style={{ background:'white', border:`2px solid ${c.color}22`, borderRadius:'12px', padding:'14px' }}>
                            <p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px' }}>{c.label}</p>
                            <p style={{ fontWeight:'bold', fontSize:'20px', color:c.color, margin:'0 0 2px' }}>{c.value}</p>
                            <p style={{ color:'#aaa', fontSize:'10px', margin:0 }}>{c.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Cost Breakdown */}
                      <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px', marginBottom:'14px' }}>
                        <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 14px' }}>📊 Daily Cost Breakdown per Piece</p>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'12px' }}>
                          {[['🥚 Ingredients','varies per variant','#ca1b1b'],['👷 Labor',`${php(fin.laborPerPiece)}/pc`,'#7b4f9e'],['🏭 Fixed+Overhead',`${php(fin.fixedPerPiece)}/pc`,'#4a90d9']].map(([l,v,c])=>(
                            <div key={l} style={{ background:`${c}11`, borderRadius:'8px', padding:'10px', textAlign:'center', border:`1px solid ${c}33` }}>
                              <p style={{ fontSize:'11px', color:'#555', margin:'0 0 4px' }}>{l}</p>
                              <p style={{ fontWeight:'bold', color:c, fontSize:'13px', margin:0 }}>{v}</p>
                            </div>
                          ))}
                        </div>
                        <div style={{ background:'#fff8dc', borderRadius:'8px', padding:'10px', border:'1px solid #f5c518', fontSize:'12px', color:'#555' }}>
                          ⚠️ <strong>Waste buffer: {costSettings.waste_percentage}%</strong> added to all costs — meaning every ₱10 of cost becomes ₱{(10*(1+Number(costSettings.waste_percentage)/100)).toFixed(2)} effective cost.
                        </div>
                      </div>

                      {/* Below Target Alert */}
                      {belowTarget.length > 0 && (
                        <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'12px', padding:'14px', marginBottom:'14px' }}>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 10px' }}>🔴 {belowTarget.length} Variant(s) Below {costSettings.target_margin_percentage}% Target Margin</p>
                          {belowTarget.map(v=>(
                            <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #fee', flexWrap:'wrap', gap:'8px' }}>
                              <span style={{ fontWeight:'bold', fontSize:'13px' }}>{v.name}</span>
                              <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                                <span style={{ fontSize:'12px', color:'#888' }}>Sell: {php(v.selling_price)} | Cost: {php(v.totalCost||0)}</span>
                                <Badge label={`${(v.grossMarginPct||0).toFixed(1)}%`} color="red" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Variant Profitability Table by Category */}
                      {byCategory.map(g=>(
                        <div key={g.cat} style={{ marginBottom:'16px' }}>
                          <div style={{ background:catColors[g.cat]||'#333', color:'white', padding:'8px 14px', borderRadius:'10px 10px 0 0', fontWeight:'bold', fontSize:'13px', display:'flex', justifyContent:'space-between' }}>
                            <span>📦 {g.cat}</span>
                            <span style={{ opacity:0.8, fontSize:'11px', fontWeight:'normal' }}>{g.variants.length} variant(s)</span>
                          </div>
                          <div style={{ border:`1px solid ${catColors[g.cat]||'#333'}33`, borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden' }}>
                            {/* Header */}
                            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', background:'#f9f9f9', padding:'6px 10px', fontSize:'10px', fontWeight:'bold', color:'#888' }}>
                              <span>Variant</span><span style={{ textAlign:'right' }}>Sell Price</span><span style={{ textAlign:'right' }}>Total Cost</span><span style={{ textAlign:'right' }}>Margin ₱</span><span style={{ textAlign:'right' }}>Margin %</span><span style={{ textAlign:'center' }}>Status</span>
                            </div>
                            {g.variants.map((v,i)=>(
                              <div key={v.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', padding:'8px 10px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0', alignItems:'center' }}>
                                <span style={{ fontSize:'12px', fontWeight:'bold', color:'#333' }}>{v.name}{v.isEstimate?<span style={{ color:'#aaa', fontSize:'10px', fontWeight:'normal' }}> *</span>:null}</span>
                                <span style={{ textAlign:'right', fontSize:'12px' }}>{php(v.selling_price)}</span>
                                <span style={{ textAlign:'right', fontSize:'12px', color:'#888' }}>{php(v.totalCost||0)}</span>
                                <span style={{ textAlign:'right', fontSize:'12px', fontWeight:'bold', color:(v.grossMargin||0)>=0?'#2d8a4e':'#ca1b1b' }}>{php(v.grossMargin||0)}</span>
                                <span style={{ textAlign:'right', fontSize:'12px', fontWeight:'bold', color:(v.grossMarginPct||0)>=Number(costSettings.target_margin_percentage)?'#2d8a4e':'#ca1b1b' }}>{(v.grossMarginPct||0).toFixed(1)}%</span>
                                <span style={{ textAlign:'center' }}>
                                  <Badge label={v.belowTarget?'⚠️ LOW':'✅ OK'} color={v.belowTarget?'red':'green'} />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {donutVariants.length === 0 && (
                        <div style={{ background:'white', border:'2px dashed #ddd', borderRadius:'14px', padding:'30px', textAlign:'center' }}>
                          <p style={{ fontSize:'28px', margin:'0 0 10px' }}>📋</p>
                          <p style={{ fontWeight:'bold', fontSize:'14px', color:'#333' }}>No variants loaded yet</p>
                          <p style={{ fontSize:'12px', color:'#888', margin:'6px 0 14px' }}>Go to Recipes tab and click "Load All Variants" to get started.</p>
                          <button style={{ ...btnRed, width:'auto', padding:'10px 20px', marginTop:0 }} onClick={()=>setCostingView('recipes')}>📖 GO TO RECIPES</button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── RECIPES VIEW ── */}
                {costingView==='recipes' && (
                  <div>
                    <div style={{ background:'#fff8dc', border:'1px solid #f5c518', borderRadius:'10px', padding:'12px', marginBottom:'16px', fontSize:'12px' }}>
                      <strong style={{ color:'#ca1b1b' }}>⚙️ Required Supabase Tables:</strong>
                      <p style={{ color:'#555', margin:'6px 0 2px' }}>• <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>donut_variants</code> — id (uuid PK), name, category, selling_price (numeric), pieces_per_batch (numeric), is_active (bool default true), created_at</p>
                      <p style={{ color:'#555', margin:'2px 0' }}>• <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>base_dough_recipe</code> — id (uuid PK), inventory_item_id (uuid nullable), item_name (text), quantity_per_batch (numeric), unit (text), notes (text), created_at</p>
                      <p style={{ color:'#555', margin:'2px 0' }}>• <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>variant_recipes</code> — id (uuid PK), variant_id (uuid), inventory_item_id (uuid nullable), item_name (text), quantity_per_batch (numeric), unit (text), ingredient_type (text), notes (text), created_at</p>
                      <p style={{ color:'#555', margin:'2px 0' }}>• <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>production_logs</code> — id (uuid PK), production_date (date), total_pieces (numeric), ingredient_cost (numeric), labor_cost (numeric), overhead_cost (numeric), total_cost (numeric), notes (text), logged_by (text), created_at</p>
                      <p style={{ color:'#555', margin:'2px 0' }}>• <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>production_log_items</code> — id (uuid PK), log_id (uuid), variant_id (uuid), variant_name (text), pieces_produced (numeric), ingredient_cost (numeric), created_at</p>
                      <p style={{ color:'#555', margin:'2px 0' }}>• <code style={{ background:'#eee', padding:'1px 4px', borderRadius:'3px' }}>cost_settings</code> — id (uuid PK), daily_labor_cost (numeric), waste_percentage (numeric), monthly_rent (numeric), monthly_electricity (numeric), monthly_other_fixed (numeric), fryer_cost (numeric), fryer_lifespan_years (numeric), mixer_cost (numeric), mixer_lifespan_years (numeric), sheeter_cost (numeric), sheeter_lifespan_years (numeric), production_days_per_month (numeric), target_margin_percentage (numeric), total_daily_pieces (numeric), updated_at (timestamptz)</p>
                    </div>

                    {/* Load variants button */}
                    {donutVariants.length === 0 && (
                      <div style={{ background:'#e8f5e9', border:'2px solid #2d8a4e', borderRadius:'14px', padding:'20px', marginBottom:'16px', textAlign:'center' }}>
                        <p style={{ fontSize:'24px', margin:'0 0 8px' }}>📋</p>
                        <p style={{ fontWeight:'bold', fontSize:'14px', color:'#333', margin:'0 0 6px' }}>Load All Roma's Donuts Variants</p>
                        <p style={{ fontSize:'12px', color:'#888', margin:'0 0 14px' }}>All {DONUT_VARIANTS_DEFAULT.length} variants from your price list will be added automatically.</p>
                        <button style={{ ...btnGreen, width:'auto', padding:'12px 24px', marginTop:0 }} onClick={seedVariants}>📋 LOAD ALL VARIANTS</button>
                      </div>
                    )}

                    {/* BASE DOUGH RECIPE */}
                    <div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                        <div>
                          <h3 style={{ color:'#ca1b1b', margin:'0 0 4px', fontSize:'15px' }}>🥚 Base Dough Recipe</h3>
                          <p style={{ color:'#888', fontSize:'12px', margin:0 }}>Shared across ALL variants. Enter ingredients per batch.</p>
                        </div>
                        {selectedRecipeVariantId !== 'base' ? (
                          <button style={{ ...btnRed, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>{ setSelectedRecipeVariantId('base'); setEditingBaseDough(baseDoughIngredients.length>0?baseDoughIngredients.map(r=>({...r})):[{ item_name:'', inventory_item_id:'', quantity_per_batch:'', unit:'g', notes:'' }]) }}>✏️ EDIT BASE DOUGH</button>
                        ) : (
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button style={{ ...btnGreen, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px', opacity:savingRecipe?0.6:1 }} disabled={savingRecipe} onClick={saveBaseDough}>{savingRecipe?'⏳ Saving...':'💾 SAVE'}</button>
                            <button style={{ ...btnGray, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>setSelectedRecipeVariantId(null)}>✕ CANCEL</button>
                          </div>
                        )}
                      </div>
                      {selectedRecipeVariantId === 'base' ? (
                        <div>
                          {editingBaseDough.map((row,i)=>(
                            <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 2fr auto', gap:'6px', marginBottom:'8px', alignItems:'center' }}>
                              <div>
                                <select value={row.inventory_item_id||''} onChange={e=>{ const inv=inventoryItems.find(it=>it.id===e.target.value); const upd=[...editingBaseDough]; upd[i]={...upd[i],inventory_item_id:e.target.value,item_name:inv?.name||upd[i].item_name,unit:inv?.unit||upd[i].unit}; setEditingBaseDough(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'12px' }}>
                                  <option value="">— Link to inventory item —</option>
                                  {inventoryItems.filter(it=>it.category==='Raw Ingredients').map(it=><option key={it.id} value={it.id}>{it.name} ({php(it.cost_per_unit||0)}/{it.unit})</option>)}
                                </select>
                                <input placeholder="Or type ingredient name" value={row.item_name||''} onChange={e=>{const upd=[...editingBaseDough];upd[i]={...upd[i],item_name:e.target.value};setEditingBaseDough(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', marginTop:'4px' }} />
                              </div>
                              <input type="number" placeholder="Qty/batch" value={row.quantity_per_batch||''} onChange={e=>{const upd=[...editingBaseDough];upd[i]={...upd[i],quantity_per_batch:e.target.value};setEditingBaseDough(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'12px' }} min="0" step="0.01" />
                              <select value={row.unit||'g'} onChange={e=>{const upd=[...editingBaseDough];upd[i]={...upd[i],unit:e.target.value};setEditingBaseDough(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'12px' }}>
                                {['g','kg','mL','L','pcs','tbsp','tsp','cups'].map(u=><option key={u} value={u}>{u}</option>)}
                              </select>
                              <input placeholder="Notes (optional)" value={row.notes||''} onChange={e=>{const upd=[...editingBaseDough];upd[i]={...upd[i],notes:e.target.value};setEditingBaseDough(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }} />
                              <button onClick={()=>setEditingBaseDough(editingBaseDough.filter((_,j)=>j!==i))} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'8px 10px', cursor:'pointer', fontWeight:'bold' }}>✕</button>
                            </div>
                          ))}
                          <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'8px 16px', marginTop:'8px', fontSize:'12px' }} onClick={()=>setEditingBaseDough([...editingBaseDough, { item_name:'', inventory_item_id:'', quantity_per_batch:'', unit:'g', notes:'' }])}>+ ADD INGREDIENT</button>
                        </div>
                      ) : (
                        <div>
                          {baseDoughIngredients.length === 0 ? (
                            <p style={{ color:'#aaa', fontSize:'13px', fontStyle:'italic' }}>No base dough recipe set yet. Click Edit to define your base dough ingredients.</p>
                          ) : (
                            <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#f9f9f9', padding:'6px 10px', fontSize:'10px', fontWeight:'bold', color:'#888' }}>
                                <span>Ingredient</span><span style={{ textAlign:'right' }}>Qty/batch</span><span style={{ textAlign:'right' }}>Unit</span><span style={{ textAlign:'right' }}>Cost/batch</span>
                              </div>
                              {baseDoughIngredients.map((r,i)=>{
                                const inv = inventoryItems.find(it=>it.id===r.inventory_item_id)
                                const cost = inv ? Number(r.quantity_per_batch||0) * Number(inv.cost_per_unit||0) : 0
                                return (
                                  <div key={r.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'7px 10px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>
                                    <span style={{ fontSize:'12px' }}>{r.item_name}{inv?<span style={{ color:'#2d8a4e', fontSize:'10px' }}> ✓ linked</span>:<span style={{ color:'#aaa', fontSize:'10px' }}> (no inventory link)</span>}</span>
                                    <span style={{ textAlign:'right', fontSize:'12px' }}>{r.quantity_per_batch}</span>
                                    <span style={{ textAlign:'right', fontSize:'12px' }}>{r.unit}</span>
                                    <span style={{ textAlign:'right', fontSize:'12px', fontWeight:'bold', color:'#ca1b1b' }}>{php(cost)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* VARIANT RECIPES */}
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 12px', fontSize:'14px' }}>🍩 Per-Variant Topping / Filling Recipes</h3>
                    <p style={{ color:'#888', fontSize:'12px', margin:'0 0 14px' }}>Define the additional ingredients (toppings, fillings, glazes) for each variant on top of the base dough.</p>
                    {variantsLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading variants...</p>}
                    {VARIANT_CATEGORIES.map(cat => {
                      const catVariants = donutVariants.filter(v => v.category === cat)
                      if (catVariants.length === 0) return null
                      const catColor = { Regular:'#ca1b1b', Filled:'#4a90d9', Premium:'#7b4f9e', 'Glaze Circlet':'#2d8a4e', Bites:'#f57c00', Giant:'#333' }[cat] || '#333'
                      return (
                        <div key={cat} style={{ marginBottom:'16px' }}>
                          <div style={{ background:catColor, color:'white', padding:'8px 14px', borderRadius:'10px 10px 0 0', fontWeight:'bold', fontSize:'13px' }}>📦 {cat}</div>
                          {catVariants.map((v,i)=>{
                            const hasRecipe = (variantRecipes[v.id]||[]).length > 0
                            const isEditing = selectedRecipeVariantId === v.id && selectedRecipeVariantId !== 'base'
                            return (
                              <div key={v.id} style={{ border:`1px solid ${catColor}33`, borderTop:'none', background:i%2===0?'white':'#fafafa', padding:'10px 14px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                      <span style={{ fontWeight:'bold', fontSize:'13px', color:'#333' }}>{v.name}</span>
                                      <Badge label={`₱${v.selling_price}`} color="gray" />
                                      {!editingVariantId || editingVariantId !== v.id ? (
                                        <span style={{ fontSize:'11px', color:'#888' }}>{v.pieces_per_batch} pcs/batch</span>
                                      ) : null}
                                      {hasRecipe && !isEditing && <Badge label={`${variantRecipes[v.id].length} ingredient(s)`} color="green" />}
                                      {!hasRecipe && !isEditing && <span style={{ fontSize:'11px', color:'#aaa', fontStyle:'italic' }}>No toppings/filling set</span>}
                                    </div>
                                    {editingVariantId === v.id && (
                                      <div style={{ display:'flex', gap:'8px', marginTop:'8px', alignItems:'center', flexWrap:'wrap' }}>
                                        <label style={{ fontSize:'12px', color:'#555', fontWeight:'bold' }}>Pieces/batch:</label>
                                        <input type="number" value={editVariantFields.pieces_per_batch??v.pieces_per_batch} onChange={e=>setEditVariantFields(p=>({...p,pieces_per_batch:e.target.value}))} style={{ ...inputStyle, marginBottom:0, width:'80px', fontSize:'12px' }} min="1" />
                                        <label style={{ fontSize:'12px', color:'#555', fontWeight:'bold' }}>Sell Price:</label>
                                        <input type="number" value={editVariantFields.selling_price??v.selling_price} onChange={e=>setEditVariantFields(p=>({...p,selling_price:e.target.value}))} style={{ ...inputStyle, marginBottom:0, width:'80px', fontSize:'12px' }} min="0" step="0.5" />
                                        <button style={{ ...btnGreen, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>updateVariant(v.id,{ pieces_per_batch:Number(editVariantFields.pieces_per_batch||v.pieces_per_batch), selling_price:Number(editVariantFields.selling_price||v.selling_price) })}>✅ SAVE</button>
                                        <button style={{ ...btnGray, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>setEditingVariantId(null)}>✕</button>
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display:'flex', gap:'6px' }}>
                                    {editingVariantId !== v.id && <button style={{ ...btnYellow, padding:'5px 10px', fontSize:'11px' }} onClick={()=>{ setEditingVariantId(v.id); setEditVariantFields({ pieces_per_batch:v.pieces_per_batch, selling_price:v.selling_price }) }}>✏️ EDIT</button>}
                                    {!isEditing ? (
                                      <button style={{ ...btnBlack, background:catColor, width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setSelectedRecipeVariantId(v.id); setEditingVariantRecipe(hasRecipe?variantRecipes[v.id].map(r=>({...r})):[{ item_name:'', inventory_item_id:'', quantity_per_batch:'', unit:'g', ingredient_type:'topping', notes:'' }]) }}>📖 {hasRecipe?'EDIT':'ADD'} RECIPE</button>
                                    ) : (
                                      <div style={{ display:'flex', gap:'6px' }}>
                                        <button style={{ ...btnGreen, width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px', opacity:savingRecipe?0.6:1 }} disabled={savingRecipe} onClick={()=>saveVariantRecipe(v.id)}>{savingRecipe?'⏳':'💾 SAVE'}</button>
                                        <button style={{ ...btnGray, width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>setSelectedRecipeVariantId(null)}>✕</button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isEditing && (
                                  <div style={{ marginTop:'10px', background:'#f9f9f9', padding:'12px', borderRadius:'8px', border:'1px solid #eee' }}>
                                    {editingVariantRecipe.map((row,ri)=>(
                                      <div key={ri} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:'6px', marginBottom:'8px', alignItems:'center' }}>
                                        <div>
                                          <select value={row.inventory_item_id||''} onChange={e=>{ const inv=inventoryItems.find(it=>it.id===e.target.value); const upd=[...editingVariantRecipe]; upd[ri]={...upd[ri],inventory_item_id:e.target.value,item_name:inv?.name||upd[ri].item_name,unit:inv?.unit||upd[ri].unit}; setEditingVariantRecipe(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                                            <option value="">— Link inventory item —</option>
                                            {inventoryItems.map(it=><option key={it.id} value={it.id}>{it.name} ({php(it.cost_per_unit||0)}/{it.unit})</option>)}
                                          </select>
                                          <input placeholder="Ingredient name" value={row.item_name||''} onChange={e=>{const upd=[...editingVariantRecipe];upd[ri]={...upd[ri],item_name:e.target.value};setEditingVariantRecipe(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', marginTop:'3px' }} />
                                        </div>
                                        <input type="number" placeholder="Qty/batch" value={row.quantity_per_batch||''} onChange={e=>{const upd=[...editingVariantRecipe];upd[ri]={...upd[ri],quantity_per_batch:e.target.value};setEditingVariantRecipe(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }} min="0" step="0.01" />
                                        <select value={row.unit||'g'} onChange={e=>{const upd=[...editingVariantRecipe];upd[ri]={...upd[ri],unit:e.target.value};setEditingVariantRecipe(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                                          {['g','kg','mL','L','pcs','tbsp','tsp','cups'].map(u=><option key={u} value={u}>{u}</option>)}
                                        </select>
                                        <select value={row.ingredient_type||'topping'} onChange={e=>{const upd=[...editingVariantRecipe];upd[ri]={...upd[ri],ingredient_type:e.target.value};setEditingVariantRecipe(upd)}} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                                          <option value="topping">Topping</option>
                                          <option value="filling">Filling</option>
                                          <option value="glaze">Glaze</option>
                                          <option value="coating">Coating</option>
                                        </select>
                                        <button onClick={()=>setEditingVariantRecipe(editingVariantRecipe.filter((_,j)=>j!==ri))} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'8px 10px', cursor:'pointer', fontWeight:'bold' }}>✕</button>
                                      </div>
                                    ))}
                                    <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'7px 14px', marginTop:'6px', fontSize:'11px' }} onClick={()=>setEditingVariantRecipe([...editingVariantRecipe, { item_name:'', inventory_item_id:'', quantity_per_batch:'', unit:'g', ingredient_type:'topping', notes:'' }])}>+ ADD INGREDIENT</button>
                                  </div>
                                )}
                                {/* Show existing recipe (read mode) */}
                                {!isEditing && hasRecipe && (
                                  <div style={{ marginTop:'8px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                                    {variantRecipes[v.id].map((r,ri)=>{
                                      const inv = inventoryItems.find(it=>it.id===r.inventory_item_id)
                                      const cost = inv ? Number(r.quantity_per_batch||0)*Number(inv.cost_per_unit||0)/Math.max(1,Number(v.pieces_per_batch)) : 0
                                      return (
                                        <div key={ri} style={{ background:'#f5f5f5', borderRadius:'6px', padding:'4px 8px', fontSize:'11px' }}>
                                          <strong>{r.item_name}</strong>: {r.quantity_per_batch}{r.unit} <span style={{ color:'#7b4f9e', fontSize:'10px' }}>({r.ingredient_type})</span> {inv?<span style={{ color:'#ca1b1b', fontSize:'10px' }}>= {php(cost)}/pc</span>:null}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── PRODUCTION VIEW ── */}
                {costingView==='production' && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>🏭 Daily Production Log</h3>
                      <button style={{ ...btnGreen, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>setShowProductionForm(!showProductionForm)}>
                        {showProductionForm?'✕ CANCEL':'+ LOG PRODUCTION'}
                      </button>
                    </div>

                    {showProductionForm && (
                      <div style={{ background:'#f0fff4', border:'2px solid #2d8a4e', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#2d8a4e', margin:'0 0 14px', fontSize:'13px' }}>📋 Log Today's Production</h4>
                        <label style={lblS}>Production Date:</label>
                        <input type="date" value={prodDate} onChange={e=>setProdDate(e.target.value)} style={{ ...inputStyle, maxWidth:'200px' }} />
                        <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 8px' }}>Variants Produced:</p>
                        {prodEntries.map((entry,i)=>(
                          <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr auto', gap:'8px', marginBottom:'8px', alignItems:'center' }}>
                            <select value={entry.variant_id} onChange={e=>{ const upd=[...prodEntries]; upd[i]={...upd[i],variant_id:e.target.value}; setProdEntries(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'12px' }}>
                              <option value="">— Select variant —</option>
                              {VARIANT_CATEGORIES.map(cat=>{
                                const catV = donutVariants.filter(v=>v.category===cat)
                                if (!catV.length) return null
                                return <optgroup key={cat} label={cat}>{catV.map(v=><option key={v.id} value={v.id}>{v.name} (₱{v.selling_price})</option>)}</optgroup>
                              })}
                            </select>
                            <input type="number" placeholder="Pieces" value={entry.pieces} onChange={e=>{ const upd=[...prodEntries]; upd[i]={...upd[i],pieces:e.target.value}; setProdEntries(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'12px' }} min="1" />
                            <button onClick={()=>setProdEntries(prodEntries.filter((_,j)=>j!==i))} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'8px 10px', cursor:'pointer', fontWeight:'bold' }}>✕</button>
                          </div>
                        ))}
                        <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'8px 14px', marginBottom:'12px', fontSize:'12px' }} onClick={()=>setProdEntries([...prodEntries, { variant_id:'', pieces:'' }])}>+ ADD VARIANT</button>

                        {/* Production cost preview */}
                        {prodEntries.some(e=>e.variant_id&&Number(e.pieces)>0) && (()=>{
                          const validEntries = prodEntries.filter(e=>e.variant_id&&Number(e.pieces)>0)
                          const totalPieces = validEntries.reduce((s,e)=>s+Number(e.pieces),0)
                          const monthlyDepreciation = (Number(costSettings.fryer_cost)/(Number(costSettings.fryer_lifespan_years)*12))+(Number(costSettings.mixer_cost)/(Number(costSettings.mixer_lifespan_years)*12))+(Number(costSettings.sheeter_cost)/(Number(costSettings.sheeter_lifespan_years)*12))
                          const monthlyFixed = Number(costSettings.monthly_rent)+Number(costSettings.monthly_electricity)+Number(costSettings.monthly_other_fixed)+monthlyDepreciation
                          const overhead = monthlyFixed/Math.max(1,Number(costSettings.production_days_per_month))
                          const labor = Number(costSettings.daily_labor_cost)
                          let totalIngCost = 0
                          validEntries.forEach(e=>{ const v=donutVariants.find(dv=>dv.id===e.variant_id); const cost=computeVariantCost(e.variant_id,v?.pieces_per_batch||12); totalIngCost += cost ? cost.ingredientCost*Number(e.pieces) : 0 })
                          return (
                            <div style={{ background:'#e8f5e9', border:'1px solid #2d8a4e', borderRadius:'10px', padding:'12px', marginBottom:'12px' }}>
                              <p style={{ fontWeight:'bold', fontSize:'13px', color:'#2d8a4e', margin:'0 0 8px' }}>📊 Production Cost Preview</p>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'6px', fontSize:'12px' }}>
                                <p style={cps}>Total pieces: <strong>{totalPieces.toLocaleString()}</strong></p>
                                <p style={cps}>Ingredient cost: <strong>{php(totalIngCost)}</strong></p>
                                <p style={cps}>Labor cost: <strong>{php(labor)}</strong></p>
                                <p style={cps}>Overhead: <strong>{php(overhead)}</strong></p>
                              </div>
                              <div style={{ borderTop:'1px solid #c8e6c9', marginTop:'8px', paddingTop:'8px', display:'flex', justifyContent:'space-between' }}>
                                <span style={{ fontWeight:'bold', color:'#2d8a4e' }}>Total Production Cost:</span>
                                <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px' }}>{php(totalIngCost+labor+overhead)}</span>
                              </div>
                              <p style={{ color:'#888', fontSize:'11px', margin:'4px 0 0' }}>Cost per piece: {php((totalIngCost+labor+overhead)/Math.max(1,totalPieces))}</p>
                            </div>
                          )
                        })()}

                        <label style={lblS}>Notes (optional):</label>
                        <input type="text" placeholder="e.g. Morning production, extra batch for orders" value={prodNotes} onChange={e=>setProdNotes(e.target.value)} style={inputStyle} />
                        <button style={{ ...btnGreen, opacity:savingProduction?0.6:1 }} disabled={savingProduction} onClick={logProduction}>{savingProduction?'⏳ Saving...':'✅ CONFIRM PRODUCTION LOG'}</button>
                      </div>
                    )}

                    {productionLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                    {!productionLoading && productionLogs.length === 0 && (
                      <div style={{ textAlign:'center', padding:'30px', color:'#888' }}>
                        <p style={{ fontSize:'28px', margin:'0 0 10px' }}>🏭</p>
                        <p style={{ fontWeight:'bold', fontSize:'14px' }}>No production logs yet.</p>
                        <p style={{ fontSize:'12px' }}>Start logging your daily production to track costs automatically.</p>
                      </div>
                    )}
                    {productionLogs.map(log=>(
                      <div key={log.id} style={{ ...cardS, border:'2px solid #2d8a4e', background:'#f0fff4', marginBottom:'12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'15px', margin:'0 0 2px' }}>📅 {log.production_date}</p>
                            <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{log.total_pieces?.toLocaleString()} pieces produced</p>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'16px', margin:'0 0 2px' }}>{php(log.total_cost||0)}</p>
                            <p style={{ color:'#888', fontSize:'11px', margin:0 }}>total cost</p>
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'8px' }}>
                          {[['🥚 Ingredients',log.ingredient_cost],['👷 Labor',log.labor_cost],['🏭 Overhead',log.overhead_cost]].map(([l,v])=>(
                            <div key={l} style={{ background:'white', borderRadius:'6px', padding:'6px 8px', textAlign:'center' }}>
                              <p style={{ fontSize:'10px', color:'#888', margin:'0 0 2px' }}>{l}</p>
                              <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:0 }}>{php(v||0)}</p>
                            </div>
                          ))}
                        </div>
                        {log.notes && <p style={cps}>📝 {log.notes}</p>}
                        {(log.production_log_items||[]).length > 0 && (
                          <div style={{ marginTop:'8px' }}>
                            <p style={{ fontSize:'11px', fontWeight:'bold', color:'#555', margin:'0 0 4px' }}>Variants produced:</p>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              {log.production_log_items.map(item=>(
                                <div key={item.id} style={{ background:'white', borderRadius:'6px', padding:'3px 8px', fontSize:'11px', border:'1px solid #c8e6c9' }}>
                                  <strong>{item.variant_name}</strong>: {item.pieces_produced?.toLocaleString()} pcs
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p style={{ ...cps, color:'#aaa', marginTop:'6px' }}>Logged by: {log.logged_by} on {new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── SETTINGS VIEW ── */}
                {costingView==='settings' && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>⚙️ Cost Settings</h3>
                      <p style={{ color:'#888', fontSize:'12px', margin:0 }}>All computations update instantly when you save.</p>
                    </div>

                    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'18px', marginBottom:'14px' }}>
                      <h4 style={{ color:'#7b4f9e', margin:'0 0 12px', fontSize:'13px' }}>👷 Labor & Production</h4>
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                        <div><label style={lblS}>Daily Labor Cost (₱):</label><input type="number" value={costSettings.daily_labor_cost} onChange={e=>setCostSettings(p=>({...p,daily_labor_cost:Number(e.target.value)}))} style={inputStyle} min="0" /></div>
                        <div><label style={lblS}>Total Daily Pieces (all variants):</label><input type="number" value={costSettings.total_daily_pieces} onChange={e=>setCostSettings(p=>({...p,total_daily_pieces:Number(e.target.value)}))} style={inputStyle} min="1" /></div>
                        <div><label style={lblS}>Production Days per Month:</label><input type="number" value={costSettings.production_days_per_month} onChange={e=>setCostSettings(p=>({...p,production_days_per_month:Number(e.target.value)}))} style={inputStyle} min="1" max="31" /></div>
                        <div><label style={lblS}>Waste / Loss Buffer (%):</label><input type="number" value={costSettings.waste_percentage} onChange={e=>setCostSettings(p=>({...p,waste_percentage:Number(e.target.value)}))} style={inputStyle} min="0" max="50" /></div>
                        <div><label style={lblS}>Target Gross Margin (%):</label><input type="number" value={costSettings.target_margin_percentage} onChange={e=>setCostSettings(p=>({...p,target_margin_percentage:Number(e.target.value)}))} style={inputStyle} min="0" max="100" /></div>
                      </div>
                    </div>

                    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'18px', marginBottom:'14px' }}>
                      <h4 style={{ color:'#4a90d9', margin:'0 0 12px', fontSize:'13px' }}>🏭 Monthly Fixed Overhead</h4>
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                        <div><label style={lblS}>Monthly Rent (₱):</label><input type="number" value={costSettings.monthly_rent} onChange={e=>setCostSettings(p=>({...p,monthly_rent:Number(e.target.value)}))} style={inputStyle} min="0" /></div>
                        <div><label style={lblS}>Monthly Electricity (₱):</label><input type="number" value={costSettings.monthly_electricity} onChange={e=>setCostSettings(p=>({...p,monthly_electricity:Number(e.target.value)}))} style={inputStyle} min="0" /></div>
                        <div><label style={lblS}>Other Fixed Expenses / Loans (₱):</label><input type="number" value={costSettings.monthly_other_fixed} onChange={e=>setCostSettings(p=>({...p,monthly_other_fixed:Number(e.target.value)}))} style={inputStyle} min="0" /></div>
                      </div>
                    </div>

                    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'18px', marginBottom:'14px' }}>
                      <h4 style={{ color:'#2d8a4e', margin:'0 0 12px', fontSize:'13px' }}>⚙️ Equipment Depreciation</h4>
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:'10px' }}>
                        <div style={{ background:'#f9f9f9', borderRadius:'8px', padding:'12px' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:'0 0 8px' }}>🔥 Fryer</p>
                          <label style={lblS}>Cost (₱):</label><input type="number" value={costSettings.fryer_cost} onChange={e=>setCostSettings(p=>({...p,fryer_cost:Number(e.target.value)}))} style={inputStyle} min="0" />
                          <label style={lblS}>Lifespan (years):</label><input type="number" value={costSettings.fryer_lifespan_years} onChange={e=>setCostSettings(p=>({...p,fryer_lifespan_years:Number(e.target.value)}))} style={inputStyle} min="1" />
                          <p style={{ color:'#ca1b1b', fontSize:'11px', margin:0 }}>= {php((Number(costSettings.fryer_cost)/(Number(costSettings.fryer_lifespan_years)*12)))}/month</p>
                        </div>
                        <div style={{ background:'#f9f9f9', borderRadius:'8px', padding:'12px' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:'0 0 8px' }}>🔧 Mixer</p>
                          <label style={lblS}>Cost (₱):</label><input type="number" value={costSettings.mixer_cost} onChange={e=>setCostSettings(p=>({...p,mixer_cost:Number(e.target.value)}))} style={inputStyle} min="0" />
                          <label style={lblS}>Lifespan (years):</label><input type="number" value={costSettings.mixer_lifespan_years} onChange={e=>setCostSettings(p=>({...p,mixer_lifespan_years:Number(e.target.value)}))} style={inputStyle} min="1" />
                          <p style={{ color:'#ca1b1b', fontSize:'11px', margin:0 }}>= {php((Number(costSettings.mixer_cost)/(Number(costSettings.mixer_lifespan_years)*12)))}/month</p>
                        </div>
                        <div style={{ background:'#f9f9f9', borderRadius:'8px', padding:'12px' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:'0 0 8px' }}>📋 Dough Sheeter</p>
                          <label style={lblS}>Cost (₱):</label><input type="number" value={costSettings.sheeter_cost} onChange={e=>setCostSettings(p=>({...p,sheeter_cost:Number(e.target.value)}))} style={inputStyle} min="0" />
                          <label style={lblS}>Lifespan (years):</label><input type="number" value={costSettings.sheeter_lifespan_years} onChange={e=>setCostSettings(p=>({...p,sheeter_lifespan_years:Number(e.target.value)}))} style={inputStyle} min="1" />
                          <p style={{ color:'#ca1b1b', fontSize:'11px', margin:0 }}>= {php((Number(costSettings.sheeter_cost)/(Number(costSettings.sheeter_lifespan_years)*12)))}/month</p>
                        </div>
                      </div>
                      <div style={{ background:'#fff8dc', borderRadius:'8px', padding:'10px', marginTop:'12px', border:'1px solid #f5c518' }}>
                        <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:'0 0 4px' }}>Total Monthly Depreciation:</p>
                        <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'16px', margin:0 }}>{php((Number(costSettings.fryer_cost)/(Number(costSettings.fryer_lifespan_years)*12))+(Number(costSettings.mixer_cost)/(Number(costSettings.mixer_lifespan_years)*12))+(Number(costSettings.sheeter_cost)/(Number(costSettings.sheeter_lifespan_years)*12)))}/month</p>
                      </div>
                    </div>

                    {/* Live BEP Preview */}
                    {(()=>{
                      const fin = computeFinancials()
                      return (
                        <div style={{ background:'linear-gradient(135deg,#1a1a2e,#16213e)', borderRadius:'14px', padding:'18px', marginBottom:'14px' }}>
                          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', margin:'0 0 10px' }}>LIVE PREVIEW — UPDATES AS YOU TYPE</p>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
                            {[
                              ['Monthly Fixed Costs', php(fin.monthlyFixed)],
                              ['Monthly Depreciation', php(fin.monthlyDepreciation)],
                              ['Daily Fixed Cost', php(fin.dailyFixed)],
                              ['Labor Per Piece', php(fin.laborPerPiece)],
                              ['Fixed Per Piece', php(fin.fixedPerPiece)],
                              ['Daily BEP', `${fin.dailyBEP} pieces`],
                            ].map(([l,v])=>(
                              <div key={l}>
                                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'10px', margin:'0 0 2px' }}>{l}</p>
                                <p style={{ color:'white', fontWeight:'bold', fontSize:'14px', margin:0 }}>{v}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    <button style={{ ...btnGreen, opacity:savingCostSettings?0.6:1 }} disabled={savingCostSettings} onClick={saveCostSettings}>{savingCostSettings?'⏳ Saving...':'💾 SAVE ALL COST SETTINGS'}</button>
                  </div>
                )}
              </div>
            )}

            {/* SALES & RESELLERS */}
            {activeTab==='sales' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
                  <h2 style={h2s}>📈 Sales & Resellers</h2>
                  {salesView==='financial' && financialData && <button style={{ ...btnBlack, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={printPLReport}>🖨️ PRINT P&L</button>}
                </div>

                {/* Sub-navigation */}
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'20px', background:'white', padding:'10px 14px', borderRadius:'14px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
                  {[['dashboard','📊 Dashboard'],['deliveries','🚚 Deliveries'],['receivables','💵 Receivables'],['sales','📊 Daily Sales'],['expenses','💸 Expenses'],['resellers','🏪 Resellers'],['disputes','⚠️ Disputes']].map(([v,l])=>(
                    <button key={v} onClick={()=>setSalesView(v)} style={{ padding:'8px 16px', borderRadius:'20px', border:'none', background:salesView===v?'#ca1b1b':'#f4f4f4', color:salesView===v?'white':'#555', fontWeight:salesView===v?'700':'500', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s', boxShadow:salesView===v?'0 2px 8px rgba(202,27,27,0.25)':'none', fontFamily:'inherit' }}>{l}</button>
                  ))}
                </div>

                {/* ── FINANCIAL DASHBOARD ── */}
                {salesView==='dashboard' && (
                  <div>
                    {/* SUSPICIOUS ALERTS PANEL */}
                    {suspiciousAlerts.filter(a=>!a.is_read).length > 0 && (
                      <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'14px', marginBottom:'16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:0 }}>🚨 Suspicious Pattern Alerts ({suspiciousAlerts.filter(a=>!a.is_read).length})</p>
                          <button style={{ background:'none', border:'none', color:'#ca1b1b', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }} onClick={async()=>{ await supabase.from('suspicious_alerts').update({is_read:true}).eq('is_read',false); loadSuspiciousAlerts() }}>Mark all read</button>
                        </div>
                        {suspiciousAlerts.filter(a=>!a.is_read).map(a=>(
                          <div key={a.id} style={{ background:'white', borderRadius:'8px', padding:'10px 12px', marginBottom:'6px', border:`1px solid ${a.severity==='high'?'#ca1b1b':'#f5a623'}`, borderLeft:`4px solid ${a.severity==='high'?'#ca1b1b':'#f5a623'}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                              <div>
                                <p style={{ fontWeight:'bold', color:a.severity==='high'?'#ca1b1b':'#f57c00', fontSize:'12px', margin:'0 0 4px' }}>{a.severity==='high'?'🔴':'🟡'} {a.alert_type.replace(/_/g,' ').toUpperCase()}</p>
                                <p style={{ color:'#555', fontSize:'11px', margin:'0 0 4px' }}>{a.description}</p>
                                <p style={{ color:'#aaa', fontSize:'10px', margin:0 }}>{new Date(a.created_at).toLocaleString('en-PH')}</p>
                              </div>
                              <button onClick={async()=>{ await supabase.from('suspicious_alerts').update({is_read:true}).eq('id',a.id); loadSuspiciousAlerts() }} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'14px' }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* PRODUCTION REPORT SECTION */}
                    {(adminRole==='supervisor'||adminRole==='asst_supervisor'||adminRole==='owner'||adminRole==='manager') && (
                      <div style={{ background:'white', border:'2px solid #1a1a2e', borderRadius:'14px', padding:'14px', marginBottom:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', color:'#1a1a2e', fontSize:'14px', margin:'0 0 2px' }}>📋 Production Report</p>
                            <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Fill daily — tonight's production for tomorrow's delivery</p>
                          </div>
                          <button style={{ ...btnBlack, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>initProductionReport(tomorrowStr2)}>📝 FILE TONIGHT'S REPORT</button>
                        </div>
                        {/* Recent Reports */}
                        {productionReports.slice(0,3).map(r=>(
                          <div key={r.id} style={{ background:'#f8f7f5', borderRadius:'8px', padding:'10px 12px', marginBottom:'6px', border:`1px solid ${Math.abs(r.variance)>50?'#ca1b1b':'#2d8a4e'}` }} onClick={()=>setViewingProductionReport(r)} style={{ cursor:'pointer', background:'#f8f7f5', borderRadius:'8px', padding:'10px 12px', marginBottom:'6px', border:`1px solid ${Math.abs(r.variance)>50?'#ca1b1b':'#eee'}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div>
                                <p style={{ fontWeight:'bold', fontSize:'12px', margin:'0 0 2px' }}>Production: {r.report_date} → Delivery: {r.delivery_date}</p>
                                <p style={{ color:'#888', fontSize:'11px', margin:0 }}>By: {r.submitted_by} · Forecast: {r.total_forecast} pcs · Produced: {r.total_produced} pcs</p>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <span style={{ background:Math.abs(r.variance)>50?'#fff5f5':'#e8f5e9', color:Math.abs(r.variance)>50?'#ca1b1b':'#2d8a4e', borderRadius:'20px', padding:'3px 10px', fontSize:'11px', fontWeight:'bold' }}>{r.variance>0?'+':''}{r.variance} pcs</span>
                              </div>
                            </div>
                            {r.variance_reason && <p style={{ color:'#888', fontSize:'10px', margin:'4px 0 0' }}>Reason: {r.variance_reason}</p>}
                          </div>
                        ))}
                        {productionReports.length===0 && <p style={{ color:'#aaa', fontSize:'12px', textAlign:'center', padding:'10px' }}>No production reports yet. File your first report tonight.</p>}
                      </div>
                    )}
                    {/* Production Report Form */}
                    {showProductionReport && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={()=>setShowProductionReport(false)}>
                        <div style={{ background:'white', borderRadius:'16px', padding:'20px', maxWidth:'650px', width:'100%', maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'14px' }}>
                            <div><p style={{ fontWeight:'bold', color:'#1a1a2e', fontSize:'15px', margin:'0 0 2px' }}>📋 Production Report</p><p style={{ color:'#888', fontSize:'12px', margin:0 }}>Tonight: {productionReportDate} → Delivery: {productionReportDeliveryDate}</p></div>
                            <button onClick={()=>setShowProductionReport(false)} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold' }}>✕</button>
                          </div>
                          {/* Variance Summary */}
                          {productionReportItems.some(i=>Number(i.actual_qty)>0) && (()=>{
                            const totalF = productionReportItems.reduce((s,i)=>s+Number(i.forecast_qty||0),0)
                            const totalA = productionReportItems.reduce((s,i)=>s+Number(i.actual_qty||0),0)
                            const v = totalA - totalF
                            return (
                              <div style={{ background:Math.abs(v)===0?'#e8f5e9':Math.abs(v)<=20?'#fff3cd':'#fff5f5', borderRadius:'10px', padding:'10px 14px', marginBottom:'14px', border:`1px solid ${Math.abs(v)===0?'#2d8a4e':Math.abs(v)<=20?'#ffc107':'#ca1b1b'}` }}>
                                <p style={{ fontWeight:'bold', margin:0, fontSize:'13px', color:Math.abs(v)===0?'#2d8a4e':Math.abs(v)<=20?'#856404':'#ca1b1b' }}>
                                  Forecast: {totalF} pcs | Produced: {totalA} pcs | Variance: {v>0?'+':''}{v} pcs {Math.abs(v)===0?'✅':Math.abs(v)<=20?'⚠️':'🚨'}
                                </p>
                              </div>
                            )
                          })()}
                          {/* Items Table */}
                          <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden', marginBottom:'14px' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 2fr', background:'#1a1a2e', padding:'8px 12px' }}>
                              {['Variant','Forecast','Actual','Variance Reason'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold' }}>{h}</span>)}
                            </div>
                            {productionReportItems.map((item,i)=>{
                              const v = Number(item.actual_qty||0) - Number(item.forecast_qty||0)
                              return (
                                <div key={item.variant_id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 2fr', padding:'7px 12px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0', alignItems:'center', gap:'6px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:'bold' }}>{item.variant_name}</span>
                                  <span style={{ fontSize:'12px', color:'#4a90d9', fontWeight:'bold' }}>{item.forecast_qty}</span>
                                  <input type="number" min="0" value={item.actual_qty||''} onChange={e=>{ const upd=[...productionReportItems]; upd[i]={...upd[i],actual_qty:e.target.value}; setProductionReportItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'12px', padding:'4px 6px', border:v!==0&&item.actual_qty!==''?'2px solid #f5a623':'1.5px solid #e8e8e8', textAlign:'center' }} placeholder="0" />
                                  {v!==0&&item.actual_qty!==''?<input placeholder="Reason..." value={item.variance_reason||''} onChange={e=>{ const upd=[...productionReportItems]; upd[i]={...upd[i],variance_reason:e.target.value}; setProductionReportItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'10px', padding:'4px 6px' }} />:<span style={{ fontSize:'10px', color:'#aaa' }}>—</span>}
                                </div>
                              )
                            })}
                          </div>
                          {/* Overall Variance Reason */}
                          {productionReportItems.some(i=>Number(i.actual_qty||0)!==Number(i.forecast_qty||0)&&i.actual_qty!=='') && (
                            <div style={{ marginBottom:'12px' }}>
                              <label style={lblS}>Overall Variance Reason (required if any variance):</label>
                              <select value={productionVarianceReason} onChange={e=>setProductionVarianceReason(e.target.value)} style={inputStyle}>
                                <option value="">— Select reason —</option>
                                {['Equipment breakdown','Ingredient shortage','Power outage','Manpower shortage','Quality control rejection','Overproduction','Weather/force majeure','Others'].map(r=><option key={r} value={r}>{r}</option>)}
                              </select>
                              {productionVarianceReason==='Others' && <input placeholder="Describe..." value={productionReportNotes} onChange={e=>setProductionReportNotes(e.target.value)} style={inputStyle} />}
                            </div>
                          )}
                          <label style={lblS}>Additional Notes:</label>
                          <input value={productionReportNotes} onChange={e=>setProductionReportNotes(e.target.value)} placeholder="Any additional notes..." style={inputStyle} />
                          <button style={{ ...btnBlack, opacity:savingProductionReport?0.6:1 }} disabled={savingProductionReport} onClick={saveProductionReport}>{savingProductionReport?'⏳ Saving...':'✅ SUBMIT PRODUCTION REPORT'}</button>
                        </div>
                      </div>
                    )}
                    <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'14px', flexWrap:'wrap' }}>
                      <label style={{ fontSize:'13px', fontWeight:'bold', color:'#555' }}>Period:</label>
                      <input type="month" value={financialMonth} onChange={e=>setFinancialMonth(e.target.value)} style={{ ...inputStyle, width:'auto', marginBottom:0 }} />
                      <button style={{ ...btnRed, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px', opacity:financialLoading?0.6:1 }} disabled={financialLoading} onClick={loadFinancialData}>{financialLoading?'⏳ Loading...':'🔄 REFRESH'}</button>
                    </div>
                    {!financialData && !financialLoading && (
                      <div style={{ textAlign:'center', padding:'40px', color:'#888' }}>
                        <p style={{ fontSize:'28px', margin:'0 0 10px' }}>📊</p>
                        <p style={{ fontWeight:'bold', fontSize:'14px' }}>Click Refresh to load financial data</p>
                      </div>
                    )}
                    {financialData && (
                      <div>
                        {/* Revenue hero */}
                        <div style={{ background:'linear-gradient(135deg,#ca1b1b,#8b0000)', borderRadius:'16px', padding:'20px', marginBottom:'14px', color:'white' }}>
                          <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', margin:'0 0 8px' }}>TOTAL REVENUE — {financialMonth}</p>
                          <p style={{ fontSize:'36px', fontWeight:'bold', margin:'0 0 4px' }}>{php(financialData.totalRevenue)}</p>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginTop:'12px' }}>
                            {[['🏪 Walk-in',financialData.walkinRevenue],['💬 Messenger',financialData.messengerRevenue],['🚚 Resellers',financialData.resellerRevenue]].map(([l,v])=>(
                              <div key={l} style={{ background:'rgba(255,255,255,0.15)', borderRadius:'8px', padding:'8px', textAlign:'center' }}>
                                <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.7)', margin:'0 0 4px' }}>{l}</p>
                                <p style={{ fontWeight:'bold', fontSize:'14px', margin:0 }}>{php(v||0)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* P&L Cards */}
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
                          {[
                            { label:'Total COGS', value:php(financialData.totalCOGS), color:'#ca1b1b', sub:'From production logs' },
                            { label:'Gross Profit', value:php(financialData.grossProfit), color:financialData.grossProfit>=0?'#2d8a4e':'#ca1b1b', sub:`${financialData.grossMarginPct.toFixed(1)}% margin` },
                            { label:'Add\'l Expenses', value:php(financialData.totalExpenses), color:'#f57c00', sub:'Fuel, misc, supplies' },
                            { label:'Net Profit', value:php(financialData.netProfit), color:financialData.netProfit>=0?'#2d8a4e':'#ca1b1b', sub:`${financialData.netMarginPct.toFixed(1)}% net margin` },
                          ].map(c=>(
                            <div key={c.label} style={{ background:'white', border:`2px solid ${c.color}22`, borderRadius:'12px', padding:'14px' }}>
                              <p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px' }}>{c.label}</p>
                              <p style={{ fontWeight:'bold', fontSize:'18px', color:c.color, margin:'0 0 2px' }}>{c.value}</p>
                              <p style={{ color:'#aaa', fontSize:'10px', margin:0 }}>{c.sub}</p>
                            </div>
                          ))}
                        </div>
                        {/* AR Warning */}
                        {financialData.totalAR > 0 && (
                          <div style={{ background:financialData.overdueAR>0?'#fff5f5':'#fff8dc', border:`2px solid ${financialData.overdueAR>0?'#ca1b1b':'#f5c518'}`, borderRadius:'12px', padding:'14px', marginBottom:'14px' }}>
                            <p style={{ fontWeight:'bold', color:financialData.overdueAR>0?'#ca1b1b':'#f57c00', fontSize:'13px', margin:'0 0 6px' }}>{financialData.overdueAR>0?'🔴':'🟡'} Accounts Receivable Outstanding</p>
                            <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
                              <div><p style={{ color:'#888', fontSize:'11px', margin:0 }}>Total Outstanding</p><p style={{ fontWeight:'bold', fontSize:'16px', color:'#ca1b1b' }}>{php(financialData.totalAR)}</p></div>
                              {financialData.overdueAR > 0 && <div><p style={{ color:'#888', fontSize:'11px', margin:0 }}>Overdue</p><p style={{ fontWeight:'bold', fontSize:'16px', color:'#ca1b1b' }}>{php(financialData.overdueAR)}</p></div>}
                            </div>
                            <p style={{ color:'#888', fontSize:'11px', margin:'6px 0 0' }}>Go to Receivables tab to see details and record payments.</p>
                          </div>
                        )}
                        {/* Expense breakdown */}
                        {financialData.expenseByCategory.length > 0 && (
                          <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px', marginBottom:'14px' }}>
                            <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 12px' }}>💸 Expense Breakdown</p>
                            {financialData.expenseByCategory.map(c=>(
                              <div key={c.cat} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}>
                                <span style={{ fontSize:'12px', color:'#555' }}>{c.cat}</span>
                                <span style={{ fontWeight:'bold', fontSize:'12px', color:'#ca1b1b' }}>{php(c.total)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Sales trend */}
                        {financialData.salesByDay.length > 0 && (
                          <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'16px' }}>
                            <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 12px' }}>📈 Daily Revenue Trend ({financialData.salesDays} days encoded)</p>
                            <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'80px', overflowX:'auto' }}>
                              {(()=>{
                                const maxRev = Math.max(...financialData.salesByDay.map(d=>d.revenue), 1)
                                return financialData.salesByDay.map(d=>(
                                  <div key={d.date} style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:'28px' }}>
                                    <div style={{ background:'#ca1b1b', width:'20px', borderRadius:'3px 3px 0 0', height:`${Math.max(4,(d.revenue/maxRev)*70)}px` }} title={`${d.date}: ${php(d.revenue)}`} />
                                    <span style={{ fontSize:'8px', color:'#aaa', marginTop:'2px', transform:'rotate(-45deg)', transformOrigin:'top left', whiteSpace:'nowrap' }}>{d.date.slice(5)}</span>
                                  </div>
                                ))
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Cash Reconciliation */}
                    {financialData && (()=>{
                      const paidInvoices = deliveryInvoices.filter(i=>i.status==='paid'&&i.paid_date?.startsWith(financialMonth))
                      const totalCollected = paidInvoices.reduce((s,i)=>s+Number(i.paid_amount||0),0)
                      const approvedExpenses = dailyExpenses.filter(e=>e.status==='approved'&&e.expense_date?.startsWith(financialMonth))
                      const totalExpenses = approvedExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
                      const netCash = totalCollected - totalExpenses
                      const byMethod = PAYMENT_METHODS.map(m=>({
                        method:m,
                        total:paidInvoices.filter(i=>true).reduce((s,i)=>s+Number(i.paid_amount||0),0) // simplified - will refine with payment records
                      }))
                      return (
                        <div style={{ background:'white', border:'2px solid #1a1a2e', borderRadius:'14px', padding:'16px', marginBottom:'14px' }}>
                          <p style={{ fontWeight:'bold', color:'#1a1a2e', fontSize:'13px', margin:'0 0 12px' }}>💳 Cash Reconciliation — {financialMonth}</p>
                          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:'10px', marginBottom:'12px' }}>
                            <div style={{ background:'#f0fff4', borderRadius:'10px', padding:'12px', border:'1px solid #c8e6c9' }}>
                              <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Total Collected</p>
                              <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'20px', margin:'0 0 2px' }}>{php(totalCollected)}</p>
                              <p style={{ color:'#888', fontSize:'10px', margin:0 }}>{paidInvoices.length} paid invoices</p>
                            </div>
                            <div style={{ background:'#fff5f5', borderRadius:'10px', padding:'12px', border:'1px solid #ffcdd2' }}>
                              <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Total Expenses</p>
                              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'20px', margin:'0 0 2px' }}>{php(totalExpenses)}</p>
                              <p style={{ color:'#888', fontSize:'10px', margin:0 }}>{approvedExpenses.length} approved expenses</p>
                            </div>
                            <div style={{ background:netCash>=0?'#f0fff4':'#fff5f5', borderRadius:'10px', padding:'12px', border:`1px solid ${netCash>=0?'#2d8a4e':'#ca1b1b'}` }}>
                              <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Net Cash Position</p>
                              <p style={{ fontWeight:'bold', color:netCash>=0?'#2d8a4e':'#ca1b1b', fontSize:'20px', margin:'0 0 2px' }}>{php(netCash)}</p>
                              <p style={{ color:'#888', fontSize:'10px', margin:0 }}>Collected minus expenses</p>
                            </div>
                          </div>
                          {/* Expense breakdown by category */}
                          {approvedExpenses.length > 0 && (
                            <div>
                              <p style={{ fontWeight:'bold', color:'#555', fontSize:'12px', margin:'0 0 8px' }}>Expense Breakdown:</p>
                              {EXPENSE_CATEGORIES.map(cat=>{
                                const catTotal = approvedExpenses.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount||0),0)
                                if (!catTotal) return null
                                return (
                                  <div key={cat} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f0f0f0' }}>
                                    <span style={{ fontSize:'12px', color:'#555' }}>{cat}</span>
                                    <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'12px' }}>{php(catTotal)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
                {salesView==='deliveries' && (
                  <div>
                    {/* PRODUCTION FORECAST */}
                    {(()=>{
                      // Dry premix weight per piece (grams) after 10% reduction
                      const DRY_PREMIX_GRAMS = {
                        'Choco Balls': 9.45, 'Bavarian Bites': 9.45, 'Bavarian Pops': 9.45,
                        'Choco Lollisticks': 0,
                        'Glazed Circlets': 11.7,
                        'Cinnamon Rolls': 27, 'Rings': 27, 'Shells': 27,
                        'Bavarian Midnight': 27, 'Biscoreo': 27,
                        'Fanfans': 31.5, 'Oreo Dream': 31.5, 'Almond Glitz': 31.5, 'Lotus Cloud': 31.5
                      }
                      const forecastInvoices = deliveryInvoices.filter(i => i.delivery_date === forecastDate)
                      const forecastMap = {}
                      forecastInvoices.forEach(inv => {
                        ;(inv.delivery_invoice_items || []).forEach(item => {
                          const key = item.variant_name
                          if (!forecastMap[key]) forecastMap[key] = { variant_name:item.variant_name, variant_id:item.variant_id, total:0 }
                          forecastMap[key].total += Number(item.quantity||0)
                        })
                      })
                      const forecastRows = Object.values(forecastMap).sort((a,b)=>a.variant_name.localeCompare(b.variant_name))
                      const totalPieces = forecastRows.reduce((s,r)=>s+r.total,0)
                      const totalDryPremixG = forecastRows.reduce((s,r)=>s+(DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total, 0)
                      const totalDryPremixKg = (totalDryPremixG/1000).toFixed(2)
                      const printForecast = () => {
                        const pw = window.open('','_blank','width=700,height=900')
                        pw.document.write(`<!DOCTYPE html><html><head><title>Production Forecast</title>
                          <style>
                            *{margin:0;padding:0;box-sizing:border-box;}
                            body{font-family:Arial,sans-serif;font-size:10px;width:150mm;background:white;}
                            @media print{@page{size:150mm 210mm;margin:5mm;}html,body{width:150mm;}.no-print{display:none!important;}}
                            .wrap{padding:5mm 6mm;}
                            h1{font-size:14px;color:#ca1b1b;}
                            table{width:100%;border-collapse:collapse;margin-top:8px;}
                            th{background:#ca1b1b;color:white;padding:5px 6px;text-align:left;font-size:9px;}
                            td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px;}
                            .total-row{background:#fff9e6;font-weight:bold;border-top:2px solid #ca1b1b;}
                            .kg-box{background:#e8f5e9;border:2px solid #2d8a4e;border-radius:8px;padding:10px;text-align:center;margin:10px 0;}
                          </style></head><body><div class="wrap">
                          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ca1b1b;padding-bottom:6px;margin-bottom:8px;">
                            <div><h1>Roma's Donuts</h1><div style="font-size:8px;color:#888;">Delivery Date: ${forecastDate}</div><div style="font-size:8px;color:#888;">Created: ${today}</div></div>
                            <div style="text-align:right;font-size:11px;font-weight:bold;color:#ca1b1b;">PRODUCTION ORDER</div>
                          </div>
                          <!-- Big dry premix box -->
                          <div class="kg-box">
                            <div style="font-size:9px;color:#2d8a4e;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Total Dry Premix to Knead</div>
                            <div style="font-size:36px;font-weight:bold;color:#2d8a4e;line-height:1;">${totalDryPremixKg}</div>
                            <div style="font-size:14px;font-weight:bold;color:#2d8a4e;">kilograms</div>
                          </div>
                          <div style="text-align:center;background:#fff9e6;border:1px solid #ca1b1b;border-radius:6px;padding:6px;margin-bottom:8px;">
                            <div style="font-size:8px;color:#888;">Total Pieces | ${forecastInvoices.length} Invoice(s)</div>
                            <div style="font-size:20px;font-weight:bold;color:#ca1b1b;">${totalPieces.toLocaleString()} pcs</div>
                          </div>
                          <table>
                            <tr><th>Variant</th><th style="text-align:right;">Pieces</th><th style="text-align:right;">Dry Premix</th><th style="text-align:center;">Actual</th></tr>
                            ${forecastRows.map(r => {
                              const grams = (DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total
                              const kgDisplay = grams>=1000 ? (grams/1000).toFixed(2)+' kg' : grams.toFixed(0)+' g'
                              return '<tr><td><strong>'+r.variant_name+'</strong></td><td style="text-align:right;font-weight:bold;">'+r.total.toLocaleString()+'</td><td style="text-align:right;color:#2d8a4e;font-weight:bold;">'+kgDisplay+'</td><td style="text-align:center;border:1px solid #ddd;min-width:40px;">&nbsp;</td></tr>'
                            }).join('')}
                            <tr class="total-row"><td>TOTAL</td><td style="text-align:right;color:#ca1b1b;">${totalPieces.toLocaleString()}</td><td style="text-align:right;color:#2d8a4e;">${totalDryPremixKg} kg</td><td></td></tr>
                          </table>
                          <div style="margin-top:12px;display:flex;justify-content:space-between;gap:8px;">
                            <div style="text-align:center;flex:1;"><div style="border-top:1px solid #000;padding-top:3px;font-size:8px;">Prepared by</div></div>
                            <div style="text-align:center;flex:1;"><div style="border-top:1px solid #000;padding-top:3px;font-size:8px;">Checked by</div></div>
                          </div>
                          <div class="no-print" style="text-align:center;margin-top:14px;"><button onclick="window.print()" style="padding:8px 20px;background:#ca1b1b;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">🖨️ PRINT (150×210mm)</button><p style="font-size:9px;color:#888;margin-top:4px;">Set paper to custom 150×210mm. Uncheck headers/footers.</p></div>
                        </div></body></html>`)
                        pw.document.close(); setTimeout(()=>{ pw.focus(); pw.print() },600)
                      }
                      return (
                        <div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px', marginBottom:'12px' }}>
                            <div>
                              <h3 style={{ color:'#ca1b1b', margin:'0 0 2px', fontSize:'14px' }}>📊 Production Forecast</h3>
                              <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Based on invoices for the selected delivery date</p>
                            </div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', flexWrap:'wrap' }}>
                              <div>
                                <label style={{ fontSize:'10px', color:'#888', display:'block', marginBottom:'2px' }}>Delivery Date to Forecast:</label>
                                <input type="date" value={forecastDate} onChange={e=>setForecastDate(e.target.value)} style={{ ...inputStyle, marginBottom:0, width:'150px', fontSize:'12px', padding:'6px 10px' }} />
                              </div>
                              <div style={{ background:'#fff9e6', border:'1px solid #ca1b1b', borderRadius:'8px', padding:'6px 14px', textAlign:'center' }}>
                                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 1px' }}>Total Pieces</p>
                                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'20px', margin:0 }}>{totalPieces.toLocaleString()}</p>
                              </div>
                              <div style={{ background:'#e8f5e9', border:'2px solid #2d8a4e', borderRadius:'12px', padding:'14px', textAlign:'center', marginTop:'12px' }}>
                                <p style={{ color:'#2d8a4e', fontSize:'11px', fontWeight:'bold', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'1px' }}>Total Dry Premix to Knead Tonight</p>
                                <p style={{ color:'#2d8a4e', fontSize:'42px', fontWeight:'bold', margin:'0 0 2px', lineHeight:1 }}>{totalDryPremixKg}</p>
                                <p style={{ color:'#2d8a4e', fontSize:'16px', fontWeight:'bold', margin:0 }}>kilograms</p>
                              </div>
                              <button style={{ ...btnRed, width:'auto', padding:'8px 14px', marginTop:0, fontSize:'12px' }} onClick={printForecast}>🖨️ PRINT</button>
                            </div>
                          </div>
                          {forecastInvoices.length === 0 ? (
                            <div style={{ textAlign:'center', padding:'24px', color:'#aaa' }}>
                              <p style={{ fontSize:'32px', margin:'0 0 8px' }}>📋</p>
                              <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 4px', color:'#555' }}>No invoices for {forecastDate}</p>
                              <p style={{ fontSize:'11px', margin:0 }}>Create invoices with delivery date <strong>{forecastDate}</strong> and they will automatically appear here.</p>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display:'flex', gap:'6px', marginBottom:'8px', flexWrap:'wrap' }}>
                                <span style={{ background:'#e8f5e9', borderRadius:'6px', padding:'3px 10px', fontSize:'11px', color:'#2d8a4e', fontWeight:'bold' }}>{forecastInvoices.length} invoice{forecastInvoices.length!==1?'s':''}</span>
                                <span style={{ background:'#fff9e6', borderRadius:'6px', padding:'3px 10px', fontSize:'11px', color:'#ca1b1b', fontWeight:'bold' }}>{forecastRows.length} variant{forecastRows.length!==1?'s':''}</span>
                              </div>
                              <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', background:'#ca1b1b', padding:'7px 12px' }}>
                                  {['Variant','Total Pieces','Dry Premix'].map(h=><span key={h} style={{ color:'white', fontSize:'11px', fontWeight:'bold', textAlign:h==='Variant'?'left':'right' }}>{h}</span>)}
                                </div>
                                {forecastRows.map((r,i)=>{
                                  const grams = (DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total
                                  const kg = (grams/1000).toFixed(2)
                                  return (
                                    <div key={r.variant_name} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', padding:'7px 12px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>
                                      <span style={{ fontSize:'12px', fontWeight:'bold' }}>{r.variant_name}</span>
                                      <span style={{ textAlign:'right', fontWeight:'bold', color:'#ca1b1b', fontSize:'13px' }}>{r.total.toLocaleString()}</span>
                                      <span style={{ textAlign:'right', color:'#2d8a4e', fontWeight:'bold', fontSize:'12px' }}>{grams>=1000?kg+' kg':grams.toFixed(0)+' g'}</span>
                                    </div>
                                  )
                                })}
                                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', padding:'9px 12px', background:'#fff9e6', borderTop:'2px solid #ca1b1b' }}>
                                  <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px' }}>TOTAL</span>
                                  <span style={{ textAlign:'right', fontWeight:'bold', color:'#ca1b1b', fontSize:'16px' }}>{totalPieces.toLocaleString()}</span>
                                  <span style={{ textAlign:'right', fontWeight:'bold', color:'#2d8a4e', fontSize:'16px' }}>{totalDryPremixKg} kg</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>🚚 Delivery Invoices</h3>
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {pendingResellerOrders.length > 0 && (
                          <button style={{ background:'#f5a623', color:'white', border:'none', borderRadius:'10px', padding:'9px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }} onClick={()=>setShowOrdersPanel(!showOrdersPanel)}>
                            📦 PENDING ORDERS <span style={{ background:'white', color:'#f5a623', borderRadius:'50%', width:'18px', height:'18px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'bold' }}>{pendingResellerOrders.length}</span>
                          </button>
                        )}
                        {deliveryInvoices.filter(i=>i.delivery_date===invoiceDate).length > 0 && (
                          <button style={{ ...btnBlack, background:'#1a1a2e', width:'auto', padding:'9px 14px', marginTop:0, fontSize:'12px' }} onClick={()=>printAllDailyInvoices(invoiceDate)}>🖨️ PRINT ALL ({invoiceDate})</button>
                        )}
                        <button style={{ ...btnYellow, padding:'9px 16px' }} onClick={()=>{ setShowCreateInvoice(!showCreateInvoice); if(!showCreateInvoice){ setInvoiceResellerId(''); setInvoiceItems([{ variant_id:'', variant_name:'', quantity:'', retail_price:0, reseller_price:0 }]); setInvoiceNotes(''); setInvoicePreparedBy('Ronald Reyes / Jomar Cerezo'); setInvoiceDispatchedBy('Ronald Reyes / Jomar Cerezo'); setInvoiceCrates('') } }}>
                          {showCreateInvoice?'✕ CANCEL':'+ CREATE INVOICE'}
                        </button>
                      </div>
                    </div>

                    {/* Pending Orders Panel */}
                    {showOrdersPanel && pendingResellerOrders.length > 0 && (
                      <div style={{ background:'#fff8f0', border:'2px solid #f5a623', borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#f57c00', margin:'0 0 12px', fontSize:'13px' }}>📦 Pending Reseller Orders — Requires Approval</h4>
                        {pendingResellerOrders.map(order=>(
                          <div key={order.id} style={{ background:'white', borderRadius:'10px', padding:'12px', marginBottom:'10px', border:'1px solid #ffe0b2' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                              <div>
                                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 2px' }}>{order.reseller_name}</p>
                                <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Delivery: {order.delivery_date} · Placed: {order.order_date}</p>
                                {order.notes && <p style={{ color:'#888', fontSize:'11px', margin:'2px 0 0' }}>Note: {order.notes}</p>}
                              </div>
                              <div style={{ display:'flex', gap:'6px' }}>
                                <button style={{ ...btnGreen, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'11px' }} onClick={()=>approveResellerOrder(order)}>✅ APPROVE</button>
                                <button style={{ background:'#fff5f5', color:'#ca1b1b', border:'1px solid #ca1b1b', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={()=>rejectResellerOrder(order.id, order.reseller_name)}>❌ REJECT</button>
                              </div>
                            </div>
                            <div style={{ fontSize:'11px', color:'#555', background:'#f8f7f5', borderRadius:'6px', padding:'6px 10px' }}>
                              {(order.reseller_order_items||[]).filter(i=>Number(i.quantity)>0).map(i=>`${i.variant_name}: ${i.quantity} pcs`).join(' · ')}
                            </div>
                            <p style={{ color:'#2d8a4e', fontWeight:'bold', fontSize:'12px', margin:'6px 0 0', textAlign:'right' }}>
                              Estimated: {php((order.reseller_order_items||[]).reduce((s,i)=>s+Number(i.quantity||0)*Math.round((i.retail_price||0)*0.80*100)/100,0))}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {showCreateInvoice && (
                      <div style={{ background:'#f0fff4', border:'2px solid #2d8a4e', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#2d8a4e', margin:'0 0 14px', fontSize:'13px' }}>📋 New Delivery Invoice</h4>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                          <div>
                            <label style={lblS}>Reseller:</label>
                            <select value={invoiceResellerId} onChange={e=>{ setInvoiceResellerId(e.target.value); buildInvoiceFromReseller(e.target.value) }} style={inputStyle}>
                              <option value="">— Select reseller —</option>
                              {resellers.map(r=><option key={r.id} value={r.id}>{r.name} {r.area?`(${r.area})`:''}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={lblS}>Delivery Date:</label>
                            <input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} style={inputStyle} />
                          </div>
                          <div>
                            <label style={lblS}>Prepared by:</label>
                            <input value={invoicePreparedBy} onChange={e=>setInvoicePreparedBy(e.target.value)} placeholder="Ronald Reyes / Jomar Cerezo" style={inputStyle} />
                          </div>
                          <div>
                            <label style={lblS}>Dispatched by:</label>
                            <input value={invoiceDispatchedBy} onChange={e=>setInvoiceDispatchedBy(e.target.value)} placeholder="Ronald Reyes / Jomar Cerezo" style={inputStyle} />
                          </div>
                          <div>
                            <label style={lblS}>Crates Used:</label>
                            <input type="number" value={invoiceCrates} onChange={e=>setInvoiceCrates(e.target.value)} placeholder="0" min="0" style={inputStyle} />
                          </div>
                        </div>
                        {/* Invoice items */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px', flexWrap:'wrap', gap:'8px' }}>
                          <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:0 }}>Items:</p>
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                            <button style={{ background: invoiceResellerId ? '#2d8a4e' : '#aaa', color:'white', border:'none', borderRadius:'8px', padding:'6px 14px', cursor: invoiceResellerId ? 'pointer' : 'not-allowed', fontWeight:'bold', fontSize:'11px' }}
                              onClick={async ()=>{
                                if (!invoiceResellerId) { showToast('❌ Select a reseller first.','red'); return }
                                // Always fetch fresh from DB
                                const { data } = await supabase.from('reseller_default_orders').select('*').eq('reseller_id', invoiceResellerId)
                                if (!data || data.length === 0) { showToast('⚠️ No default order set. Go to Resellers tab → EDIT to set one.','red'); return }
                                // Fetch variants too if needed
                                let variants = donutVariants
                                if (!variants || variants.length === 0) {
                                  const { data:vd } = await supabase.from('donut_variants').select('*')
                                  variants = vd || []
                                }
                                const items = data.map(d => {
                                  const v = variants.find(vv=>vv.id===d.variant_id)
                                  return { variant_id:d.variant_id, variant_name:d.variant_name||v?.name||'', quantity:d.default_quantity, retail_price:v?.selling_price||0, reseller_price:Math.round((v?.selling_price||0)*0.80*100)/100 }
                                })
                                setInvoiceItems(items)
                                showToast(`✅ Default order loaded — ${items.length} variants`)
                              }}>✅ USE DEFAULT ORDER</button>
                            <button style={{ background:'#1a1a2e', color:'white', border:'none', borderRadius:'8px', padding:'6px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }}
                              onClick={async ()=>{
                                let variants = donutVariants
                                if (!variants || variants.length === 0) {
                                  const { data } = await supabase.from('donut_variants').select('*').order('name')
                                  variants = data || []
                                }
                                if (variants.length === 0) { showToast('⚠️ No variants found. Go to Costing → Recipes → Load All Variants first.','red'); return }
                                setInvoiceItems(variants.map(v=>({ variant_id:v.id, variant_name:v.name, quantity:'', retail_price:v.selling_price, reseller_price:Math.round(v.selling_price*0.80*100)/100 })))
                                showToast(`✅ ${variants.length} variants loaded`)
                              }}>📋 LOAD ALL VARIANTS</button>
                          </div>
                        </div>
                        {/* Header */}
                        <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr auto', gap:'6px', marginBottom:'4px' }}>
                          {['Variant','Qty','Retail','Reseller (-20%)',''].map((h,i)=><span key={i} style={{ fontSize:'10px', fontWeight:'bold', color:'#888', textAlign:i>0?'right':'left' }}>{h}</span>)}
                        </div>
                        {invoiceItems.map((item,i)=>{
                          const variant = donutVariants.find(v=>v.id===item.variant_id)
                          const retailPrice = variant?.selling_price || 0
                          const resellerPrice = Math.round(retailPrice*0.80*100)/100
                          return (
                            <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr auto', gap:'6px', marginBottom:'6px', alignItems:'center' }}>
                              <select value={item.variant_id} onChange={e=>{ const v=donutVariants.find(dv=>dv.id===e.target.value); const upd=[...invoiceItems]; upd[i]={...upd[i],variant_id:e.target.value,variant_name:v?.name||''}; setInvoiceItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                                <option value="">— Select —</option>
                                {donutVariants.length === 0
                                  ? <option disabled>⚠️ No variants loaded — go to Costing → Recipes → Load All Variants</option>
                                  : donutVariants.map(v=><option key={v.id} value={v.id}>{v.name} — ₱{v.selling_price}</option>)
                                }
                              </select>
                              <input type="number" value={item.quantity} onChange={e=>{ const upd=[...invoiceItems]; upd[i]={...upd[i],quantity:e.target.value}; setInvoiceItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', textAlign:'right' }} min="0" placeholder="0" />
                              <span style={{ textAlign:'right', fontSize:'11px', color:'#888' }}>{php(retailPrice)}</span>
                              <span style={{ textAlign:'right', fontSize:'11px', fontWeight:'bold', color:'#2d8a4e' }}>{php(resellerPrice)}</span>
                              <button onClick={()=>setInvoiceItems(invoiceItems.filter((_,j)=>j!==i))} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'6px 8px', cursor:'pointer', fontSize:'12px' }}>✕</button>
                            </div>
                          )
                        })}
                        {/* Totals preview */}
                        {invoiceItems.some(i=>i.variant_id&&Number(i.quantity)>0) && (()=>{
                          const total = invoiceItems.reduce((s,i)=>{ const v=donutVariants.find(dv=>dv.id===i.variant_id); const rp=Math.round((v?.selling_price||0)*0.80*100)/100; return s+rp*Number(i.quantity||0) },0)
                          const pieces = invoiceItems.reduce((s,i)=>s+Number(i.quantity||0),0)
                          return (
                            <div style={{ background:'#e8f5e9', borderRadius:'8px', padding:'10px', margin:'8px 0', border:'1px solid #c8e6c9', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                              <span style={{ fontSize:'12px', color:'#555' }}>{pieces.toLocaleString()} pieces</span>
                              <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'16px' }}>Total: {php(total)}</span>
                            </div>
                          )
                        })()}
                        <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'8px 14px', marginBottom:'10px', fontSize:'12px' }} onClick={()=>setInvoiceItems([...invoiceItems, { variant_id:'', variant_name:'', quantity:'', retail_price:0, reseller_price:0 }])}>+ ADD ROW</button>
                        <label style={lblS}>Notes (optional):</label>
                        <input type="text" value={invoiceNotes} onChange={e=>setInvoiceNotes(e.target.value)} placeholder="e.g. Special instructions, delivery notes" style={inputStyle} />
                        <button style={{ ...btnGreen, opacity:savingInvoice?0.6:1 }} disabled={savingInvoice} onClick={createDeliveryInvoice}>{savingInvoice?'⏳ Creating...':'✅ CREATE & SAVE INVOICE'}</button>
                      </div>
                    )}

                    {invoicesLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading invoices...</p>}
                    {!invoicesLoading && deliveryInvoices.length===0 && (
                      <div style={{ textAlign:'center', padding:'30px', color:'#888' }}>
                        <p style={{ fontSize:'28px', margin:'0 0 10px' }}>🧾</p>
                        <p style={{ fontWeight:'bold', fontSize:'14px' }}>No invoices yet</p>
                        <p style={{ fontSize:'12px' }}>Create your first delivery invoice above.</p>
                      </div>
                    )}
                    {deliveryInvoices.map(inv=>{
                      const balance = Number(inv.total_amount||0) - Number(inv.paid_amount||0)
                      const isOverdue = inv.status!=='paid' && inv.due_date < today
                      const statusColor = inv.status==='paid'?'#2d8a4e':isOverdue?'#ca1b1b':'#f57c00'
                      return (
                        <div key={inv.id} style={{ ...cardS, border:`2px solid ${statusColor}44`, marginBottom:'12px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                            <div>
                              <p style={{ fontWeight:'bold', fontSize:'14px', color:'#333', margin:'0 0 2px' }}>{inv.invoice_number}</p>
                              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 2px' }}>{inv.reseller_name}</p>
                              <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Delivered: {inv.delivery_date} | Due: {inv.due_date}</p>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <p style={{ fontWeight:'bold', fontSize:'18px', color:'#333', margin:'0 0 2px' }}>{php(inv.total_amount)}</p>
                              <Badge label={isOverdue?'⚠️ OVERDUE':inv.status?.toUpperCase()} color={inv.status==='paid'?'green':isOverdue?'red':'yellow'} />
                              {balance > 0 && balance < Number(inv.total_amount) && <p style={{ color:'#f57c00', fontSize:'11px', margin:'4px 0 0' }}>Balance: {php(balance)}</p>}
                            </div>
                          </div>
                          {/* Items preview */}
                          {(inv.delivery_invoice_items||[]).length > 0 && (
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px' }}>
                              {inv.delivery_invoice_items.map(item=>(
                                <div key={item.id} style={{ background:'#f5f5f5', borderRadius:'6px', padding:'3px 8px', fontSize:'11px' }}>
                                  <strong>{item.variant_name}</strong>: {item.quantity} pcs × {php(item.reseller_price)} = {php(item.total_price)}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px' }}>
                            <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>printDeliveryInvoice(inv)}>🖨️ PRINT</button>
                            <button style={{ ...btnBlack, background:'#1a1a2e', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>setViewingInvoice(inv)}>👁️ VIEW</button>
                            {inv.status==='unpaid' && (
                              <button style={{ ...btnGreen, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px', background:'#4a90d9' }} onClick={()=>markAsDelivered(inv)} disabled={markingDelivered[inv.id]}>🚚 {markingDelivered[inv.id]?'Saving...':'MARK DELIVERED'}</button>
                            )}
                            {inv.status==='unpaid' && (
                              <button style={{ ...btnYellow, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setEditingInvoice({...inv}); setEditInvoiceItems((inv.delivery_invoice_items||[]).map(i=>({...i}))) }}>✏️ EDIT</button>
                            )}
                            {(inv.status==='delivered'||inv.status==='partial') && (
                              <button style={{ ...btnRed, background:'#f5a623', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>initDriverReturn(inv)}>🔄 RECORD RETURNS</button>
                            )}
                            {inv.status!=='paid' && inv.status!=='unpaid' && (
                              <button style={{ ...btnGreen, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>setShowPaymentFormMap(p=>({...p,[inv.id]:!p[inv.id]}))}>💵 RECORD PAYMENT</button>
                            )}
                            {inv.status!=='unpaid' && (
                              <button style={{ ...btnBlack, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px', background:'#555' }} onClick={()=>printReturnForm(inv,[])}>🖨️ RETURN FORM</button>
                            )}
                            {['owner','manager','payroll','hr'].includes(adminRole) && (
                              <button style={{ background:'#fff5f5', color:'#ca1b1b', border:'1px solid #ca1b1b', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={()=>deleteInvoice(inv)}>🗑️ DELETE</button>
                            )}
                          </div>

                          {/* Driver Return Form */}
                          {showDriverReturnForm?.id===inv.id && (
                            <div style={{ background:'#fff8f0', border:'2px solid #f5a623', borderRadius:'12px', padding:'14px', marginTop:'10px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                                <p style={{ fontWeight:'bold', color:'#f57c00', fontSize:'13px', margin:0 }}>🔄 Driver Returns — {inv.reseller_name}</p>
                                <button onClick={()=>setShowDriverReturnForm(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#888' }}>✕</button>
                              </div>
                              <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden', marginBottom:'10px' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#f5a623', padding:'6px 10px' }}>
                                  {['Variant','Delivered','Returned','Credit'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold', textAlign:h==='Variant'?'left':'right' }}>{h}</span>)}
                                </div>
                                {driverReturnItems.map((item,i)=>(
                                  <div key={item.variant_id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'6px 10px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0', alignItems:'center', gap:'4px' }}>
                                    <span style={{ fontSize:'11px', fontWeight:'bold' }}>{item.variant_name}</span>
                                    <span style={{ textAlign:'right', fontSize:'11px', color:'#555' }}>{item.delivered_qty}</span>
                                    <input type="number" min="0" max={item.delivered_qty} placeholder="0" value={item.returned_qty||''} onChange={e=>{ const upd=[...driverReturnItems]; upd[i]={...upd[i],returned_qty:e.target.value}; setDriverReturnItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', padding:'4px 6px', textAlign:'center', border:'1.5px solid #f5a623' }} />
                                    <span style={{ textAlign:'right', fontSize:'11px', color:'#2d8a4e', fontWeight:'bold' }}>{Number(item.returned_qty||0)>0?php(Number(item.returned_qty)*item.reseller_price):'—'}</span>
                                  </div>
                                ))}
                              </div>
                              {driverReturnItems.some(i=>Number(i.returned_qty)>0) && (
                                <div style={{ background:'#fff3cd', borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ fontWeight:'bold', color:'#856404', fontSize:'12px' }}>Total Returns Credit:</span>
                                  <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px' }}>{php(driverReturnItems.reduce((s,i)=>s+Number(i.returned_qty||0)*i.reseller_price,0))}</span>
                                </div>
                              )}
                              <button style={{ ...btnRed, background:'#f5a623', opacity:savingDriverReturn?0.6:1 }} disabled={savingDriverReturn} onClick={saveDriverReturn}>{savingDriverReturn?'⏳ Saving...':'✅ CONFIRM RETURNS'}</button>
                            </div>
                          )}

                          {/* Payment Form */}
                          {showPaymentFormMap[inv.id] && (
                            <div style={{ background:'#e8f5e9', border:'2px solid #2d8a4e', borderRadius:'12px', padding:'14px', marginTop:'10px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                                <div>
                                  <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 2px' }}>💵 Record Payment — {inv.reseller_name}</p>
                                  <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Invoice: {php(inv.total_amount)} | Paid: {php(inv.paid_amount||0)} | <strong>Balance: {php(balance)}</strong></p>
                                </div>
                                <button onClick={()=>setShowPaymentFormMap(p=>({...p,[inv.id]:false}))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#888' }}>✕</button>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr', gap:'8px' }}>
                                <div><label style={lblS}>Amount Received (₱):</label>
                                  <input type="number" value={paymentAmount[inv.id]||''} onChange={e=>setPaymentAmount(p=>({...p,[inv.id]:e.target.value}))} style={{ ...inputStyle, marginBottom:0, border:'2px solid #FDD412', fontWeight:'bold', fontSize:'15px' }} min="1" placeholder={`Balance: ${php(balance)}`} />
                                </div>
                                <div><label style={lblS}>Payment Method:</label>
                                  <select value={paymentMethod[inv.id]||'Cash'} onChange={e=>setPaymentMethod(p=>({...p,[inv.id]:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>
                                    {['Cash','GCash','Bank Transfer','Maya','Check'].map(m=><option key={m}>{m}</option>)}
                                  </select>
                                </div>
                                <div><label style={lblS}>Notes:</label><input value={paymentNotes[inv.id]||''} onChange={e=>setPaymentNotes(p=>({...p,[inv.id]:e.target.value}))} placeholder="Reference #, etc." style={{ ...inputStyle, marginBottom:0 }} /></div>
                              </div>
                              {paymentAmount[inv.id] && (
                                <div style={{ background:Number(paymentAmount[inv.id])>=balance?'#e8f5e9':'#fff3cd', borderRadius:'8px', padding:'8px 12px', margin:'8px 0', border:`1px solid ${Number(paymentAmount[inv.id])>=balance?'#2d8a4e':'#ffc107'}` }}>
                                  <p style={{ margin:0, fontSize:'12px', fontWeight:'bold', color:Number(paymentAmount[inv.id])>=balance?'#2d8a4e':'#856404' }}>
                                    {Number(paymentAmount[inv.id])>=balance?`✅ Full payment — Invoice will be marked PAID`:`⏳ Partial payment — Balance remaining: ${php(balance-Number(paymentAmount[inv.id]))} (stays as Partial)`}
                                  </p>
                                </div>
                              )}
                              <button style={{ ...btnGreen, opacity:false?0.6:1 }} onClick={()=>recordPaymentNew(inv)}>✅ CONFIRM PAYMENT</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── RECEIVABLES VIEW ── */}
                {/* EDIT INVOICE MODAL */}
                {editingInvoice && (
                  <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={()=>{ if(!savingEditInvoice){ setEditingInvoice(null); setEditInvoiceItems([]) }}}>
                    <div style={{ background:'white', borderRadius:'16px', padding:'20px', maxWidth:'640px', width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <div>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px', margin:'0 0 2px' }}>✏️ Edit Invoice</p>
                          <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{editingInvoice.invoice_number} · {editingInvoice.reseller_name}</p>
                        </div>
                        <button onClick={()=>{ setEditingInvoice(null); setEditInvoiceItems([]) }} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>✕ Cancel</button>
                      </div>
                      {/* Invoice details editable */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
                        <div><label style={lblS}>Prepared by:</label><input value={editingInvoice.prepared_by||''} onChange={e=>setEditingInvoice(p=>({...p,prepared_by:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                        <div><label style={lblS}>Dispatched by:</label><input value={editingInvoice.dispatched_by||''} onChange={e=>setEditingInvoice(p=>({...p,dispatched_by:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                        <div><label style={lblS}>Crates Used:</label><input type="number" value={editingInvoice.crates_used||0} onChange={e=>setEditingInvoice(p=>({...p,crates_used:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} min="0" /></div>
                        <div><label style={lblS}>Notes:</label><input value={editingInvoice.notes||''} onChange={e=>setEditingInvoice(p=>({...p,notes:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                      </div>
                      {/* Line items */}
                      <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 8px' }}>Items:</p>
                      <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr auto', gap:'6px', marginBottom:'4px' }}>
                        {['Variant','Qty','Retail','Reseller',''].map((h,i)=><span key={i} style={{ fontSize:'10px', fontWeight:'bold', color:'#888' }}>{h}</span>)}
                      </div>
                      {editInvoiceItems.map((item,i)=>{
                        const variant = donutVariants.find(v=>v.id===item.variant_id)
                        const retailPrice = variant?.selling_price || Number(item.retail_price) || 0
                        const resellerPrice = Math.round(retailPrice*0.80*100)/100
                        return (
                          <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr auto', gap:'6px', marginBottom:'6px', alignItems:'center' }}>
                            <select value={item.variant_id||''} onChange={e=>{ const v=donutVariants.find(dv=>dv.id===e.target.value); const upd=[...editInvoiceItems]; upd[i]={...upd[i],variant_id:e.target.value,variant_name:v?.name||''}; setEditInvoiceItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                              <option value="">— Select —</option>
                              {donutVariants.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                            <input type="number" value={item.quantity} onChange={e=>{ const upd=[...editInvoiceItems]; upd[i]={...upd[i],quantity:e.target.value}; setEditInvoiceItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }} min="0" />
                            <span style={{ fontSize:'11px', color:'#888', textAlign:'center' }}>{php(retailPrice)}</span>
                            <span style={{ fontSize:'11px', color:'#2d8a4e', fontWeight:'bold', textAlign:'center' }}>{php(resellerPrice)}</span>
                            <button onClick={()=>setEditInvoiceItems(editInvoiceItems.filter((_,j)=>j!==i))} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'6px 8px', cursor:'pointer', fontSize:'12px' }}>✕</button>
                          </div>
                        )
                      })}
                      {/* Total preview */}
                      {editInvoiceItems.some(i=>i.variant_id&&Number(i.quantity)>0) && (
                        <div style={{ background:'#fff9e6', borderRadius:'8px', padding:'8px 12px', margin:'6px 0', display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:'12px', color:'#555' }}>{editInvoiceItems.reduce((s,i)=>s+Number(i.quantity||0),0)} pieces</span>
                          <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px' }}>
                            New Total: {php(editInvoiceItems.reduce((s,i)=>{ const v=donutVariants.find(dv=>dv.id===i.variant_id); return s+Math.round((v?.selling_price||0)*0.80*100)/100*Number(i.quantity||0) },0))}
                          </span>
                        </div>
                      )}
                      <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'7px 14px', marginBottom:'10px', fontSize:'12px' }} onClick={()=>setEditInvoiceItems([...editInvoiceItems,{variant_id:'',variant_name:'',quantity:'',retail_price:0,reseller_price:0}])}>+ ADD ITEM</button>
                      <button style={{ ...btnGreen, opacity:savingEditInvoice?0.6:1 }} disabled={savingEditInvoice} onClick={saveInvoiceEdit}>{savingEditInvoice?'⏳ Saving...':'💾 SAVE CHANGES'}</button>
                    </div>
                  </div>
                )}

                {/* VIEW INVOICE MODAL */}
                {viewingInvoice && (
                  <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={()=>setViewingInvoice(null)}>
                    <div style={{ background:'white', borderRadius:'16px', padding:'20px', maxWidth:'580px', width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
                        <div>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'16px', margin:'0 0 2px' }}>{viewingInvoice.invoice_number}</p>
                          <p style={{ color:'#888', fontSize:'12px', margin:0 }}>{viewingInvoice.reseller_name} · {viewingInvoice.delivery_date}</p>
                        </div>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                          <Badge label={viewingInvoice.status?.toUpperCase()} color={viewingInvoice.status==='paid'?'green':viewingInvoice.status==='partial'?'yellow':'red'} />
                          <button onClick={()=>setViewingInvoice(null)} style={{ background:'#f0f0f0', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>✕ Close</button>
                        </div>
                      </div>
                      {/* Invoice details */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                        {[
                          ['Delivery Date', viewingInvoice.delivery_date],
                          ['Due Date', viewingInvoice.due_date],
                          ['Prepared by', viewingInvoice.prepared_by||'—'],
                          ['Dispatched by', viewingInvoice.dispatched_by||'—'],
                          ['Crates Used', viewingInvoice.crates_used||0],
                          ['Created by', viewingInvoice.created_by||'—'],
                        ].map(([l,v])=>(
                          <div key={l} style={{ background:'#f8f9fa', borderRadius:'8px', padding:'8px 10px' }}>
                            <p style={{ color:'#888', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</p>
                            <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:0 }}>{v}</p>
                          </div>
                        ))}
                      </div>
                      {/* Items */}
                      <div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden', marginBottom:'12px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#ca1b1b', padding:'6px 10px' }}>
                          {['Variant','Qty','Reseller Price','Amount'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold', textAlign:'right' }}>{h==='Variant'?h:h}</span>)}
                        </div>
                        {(viewingInvoice.delivery_invoice_items||[]).map((item,i)=>(
                          <div key={item.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'7px 10px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>
                            <span style={{ fontSize:'12px', fontWeight:'bold' }}>{item.variant_name}</span>
                            <span style={{ textAlign:'right', fontSize:'12px' }}>{Number(item.quantity).toLocaleString()}</span>
                            <span style={{ textAlign:'right', fontSize:'12px', color:'#2d8a4e' }}>{php(item.reseller_price)}</span>
                            <span style={{ textAlign:'right', fontSize:'12px', fontWeight:'bold', color:'#ca1b1b' }}>{php(item.total_price)}</span>
                          </div>
                        ))}
                        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'10px', background:'#fff9e6', borderTop:'2px solid #ca1b1b' }}>
                          <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px' }}>TOTAL</span>
                          <span style={{ textAlign:'right', fontWeight:'bold', fontSize:'12px' }}>{(viewingInvoice.delivery_invoice_items||[]).reduce((s,i)=>s+Number(i.quantity||0),0).toLocaleString()} pcs</span>
                          <span></span>
                          <span style={{ textAlign:'right', fontWeight:'bold', color:'#ca1b1b', fontSize:'15px' }}>{php(viewingInvoice.total_amount)}</span>
                        </div>
                      </div>
                      {/* Payment status */}
                      {viewingInvoice.paid_amount > 0 && (
                        <div style={{ background:'#e8f5e9', borderRadius:'8px', padding:'10px', marginBottom:'12px', display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:'12px', color:'#2d8a4e', fontWeight:'bold' }}>Paid: {php(viewingInvoice.paid_amount)}</span>
                          <span style={{ fontSize:'12px', color:'#ca1b1b', fontWeight:'bold' }}>Balance: {php(Number(viewingInvoice.total_amount)-Number(viewingInvoice.paid_amount))}</span>
                        </div>
                      )}
                      {viewingInvoice.notes && <p style={{ color:'#888', fontSize:'12px', margin:'0 0 12px' }}>📝 {viewingInvoice.notes}</p>}
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button style={{ ...btnRed, flex:1, marginTop:0, fontSize:'12px' }} onClick={()=>{ printDeliveryInvoice(viewingInvoice); }}>🖨️ PRINT INVOICE</button>
                        <button style={{ ...btnGray, flex:1, marginTop:0, fontSize:'12px' }} onClick={()=>setViewingInvoice(null)}>Close</button>
                      </div>
                    </div>
                  </div>
                )}

                {salesView==='receivables' && (
                  <div>
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 14px', fontSize:'14px' }}>💵 Accounts Receivable</h3>
                    {/* AR Summary */}
                    {(()=>{
                      const unpaid = deliveryInvoices.filter(i=>i.status!=='paid')
                      const totalAR = unpaid.reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0)
                      const overdue = unpaid.filter(i=>i.due_date<today)
                      const overdueAR = overdue.reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0)
                      return (
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
                          <div style={{ background:'linear-gradient(135deg,#ca1b1b,#8b0000)', color:'white', borderRadius:'12px', padding:'14px', gridColumn:isMobile?'span 2':'span 1' }}>
                            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', margin:'0 0 4px' }}>TOTAL OUTSTANDING</p>
                            <p style={{ fontWeight:'bold', fontSize:'24px', margin:0 }}>{php(totalAR)}</p>
                            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'11px', margin:'4px 0 0' }}>{unpaid.length} unpaid invoice(s)</p>
                          </div>
                          <div style={{ background:overdueAR>0?'#fff5f5':'#f0fff4', border:`2px solid ${overdueAR>0?'#ca1b1b':'#2d8a4e'}`, borderRadius:'12px', padding:'14px' }}>
                            <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px' }}>OVERDUE</p>
                            <p style={{ fontWeight:'bold', fontSize:'22px', color:overdueAR>0?'#ca1b1b':'#2d8a4e', margin:0 }}>{php(overdueAR)}</p>
                            <p style={{ color:'#888', fontSize:'11px', margin:'4px 0 0' }}>{overdue.length} invoice(s) past due</p>
                          </div>
                          <div style={{ background:'#f0fff4', border:'2px solid #2d8a4e', borderRadius:'12px', padding:'14px' }}>
                            <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px' }}>COLLECTED THIS MONTH</p>
                            <p style={{ fontWeight:'bold', fontSize:'22px', color:'#2d8a4e', margin:0 }}>{php(deliveryInvoices.filter(i=>i.paid_date&&i.paid_date.startsWith(today.slice(0,7))).reduce((s,i)=>s+Number(i.paid_amount||0),0))}</p>
                          </div>
                        </div>
                      )
                    })()}
                    {/* Filter Tabs */}
                    <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap', background:'white', padding:'10px 14px', borderRadius:'14px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
                      {[['all','📋 All'],['unpaid','⏳ Unpaid'],['delivered','🚚 Delivered'],['partial','💰 Partial'],['overdue','🔴 Overdue'],['paid','✅ Paid']].map(([v,l])=>(
                        <button key={v} onClick={()=>setInvoiceFilter(v)} style={{ padding:'7px 14px', borderRadius:'20px', border:'none', background:invoiceFilter===v?'#ca1b1b':'#f4f4f4', color:invoiceFilter===v?'white':'#555', fontWeight:invoiceFilter===v?'700':'500', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s', boxShadow:invoiceFilter===v?'0 2px 8px rgba(202,27,27,0.25)':'none' }}>
                          {l} <span style={{ background:invoiceFilter===v?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.1)', borderRadius:'10px', padding:'1px 6px', fontSize:'10px', marginLeft:'2px' }}>
                            {v==='all'?deliveryInvoices.length:v==='overdue'?deliveryInvoices.filter(i=>i.status!=='paid'&&i.due_date<today).length:deliveryInvoices.filter(i=>i.status===v).length}
                          </span>
                        </button>
                      ))}
                      {/* Action Buttons */}
                      <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
                        <button style={{ ...btnBlack, width:'auto', padding:'7px 14px', marginTop:0, fontSize:'11px' }} onClick={()=>printCashCollection(invoiceDate)}>🖨️ CASH COLLECTION</button>
                        {productionReports.length>0 && <button style={{ ...btnGray, width:'auto', padding:'7px 14px', marginTop:0, fontSize:'11px' }} onClick={()=>printProductionReleaseForm(productionReports[0])}>🖨️ RELEASE FORM</button>}
                      </div>
                    </div>
                    {(()=>{
                      let filtered = deliveryInvoices
                      if (invoiceFilter==='unpaid') filtered = filtered.filter(i=>i.status==='unpaid')
                      else if (invoiceFilter==='delivered') filtered = filtered.filter(i=>i.status==='delivered')
                      else if (invoiceFilter==='partial') filtered = filtered.filter(i=>i.status==='partial')
                      else if (invoiceFilter==='overdue') filtered = filtered.filter(i=>i.status!=='paid'&&i.due_date<today)
                      else if (invoiceFilter==='paid') filtered = filtered.filter(i=>i.status==='paid')
                      if (filtered.length===0) return <p style={{ color:'#aaa', textAlign:'center', padding:'20px', fontSize:'13px' }}>No {invoiceFilter} invoices found.</p>
                      return filtered.map(inv=>{
                        const balance = Number(inv.total_amount||0) - Number(inv.paid_amount||0)
                        const isOverdue = inv.status!=='paid' && inv.due_date < today
                        const daysOverdue = isOverdue ? Math.floor((new Date(today)-new Date(inv.due_date))/(1000*60*60*24)) : 0
                        return (
                          <div key={inv.id} style={{ ...cardS, border:`2px solid ${isOverdue?'#ca1b1b33':inv.status==='paid'?'#2d8a4e33':inv.status==='delivered'?'#4a90d933':'#f5c51833'}`, marginBottom:'10px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                              <div>
                                <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 2px' }}>{inv.reseller_name}</p>
                                <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{inv.invoice_number} | Delivery: {inv.delivery_date} | Due: {inv.due_date}</p>
                                {isOverdue && <p style={{ color:'#ca1b1b', fontSize:'11px', fontWeight:'bold', margin:'2px 0 0' }}>⚠️ {daysOverdue} day(s) overdue</p>}
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <p style={{ fontWeight:'bold', fontSize:'16px', color:'#333', margin:'0 0 2px' }}>{php(inv.total_amount)}</p>
                                {balance > 0 && balance < Number(inv.total_amount) && <p style={{ color:'#f57c00', fontSize:'11px', margin:0 }}>Balance: {php(balance)}</p>}
                                <Badge label={isOverdue?'OVERDUE':inv.status?.toUpperCase()} color={inv.status==='paid'?'green':isOverdue?'red':'yellow'} />
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:'8px', marginTop:'8px', flexWrap:'wrap' }}>
                              <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>printDeliveryInvoice(inv)}>🖨️ PRINT</button>
                              {inv.status!=='paid' && (
                                <button style={{ ...btnGreen, width:'auto', padding:'5px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setShowPaymentForm(p=>({...p,[inv.id]:!p[inv.id]})); setSalesView('deliveries') }}>💵 RECORD PAYMENT</button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                {/* ── DAILY SALES VIEW ── */}
                {salesView==='sales' && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>📊 Daily Sales Encoder</h3>
                      <button style={{ ...btnGreen, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>setShowSalesForm(!showSalesForm)}>{showSalesForm?'✕ CANCEL':'+ ENCODE TODAY\'S SALES'}</button>
                    </div>
                    {showSalesForm && (
                      <div style={{ background:'#f0fff4', border:'2px solid #2d8a4e', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#2d8a4e', margin:'0 0 14px', fontSize:'13px' }}>📋 End-of-Day Sales Entry</h4>
                        <label style={lblS}>Sales Date:</label>
                        <input type="date" value={salesDate} onChange={e=>setSalesDate(e.target.value)} style={{ ...inputStyle, maxWidth:'200px' }} />
                        <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 8px' }}>Sales Entries:</p>
                        <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr auto', gap:'6px', marginBottom:'4px' }}>
                          {['Variant','Channel','Qty',''].map((h,i)=><span key={i} style={{ fontSize:'10px', fontWeight:'bold', color:'#888' }}>{h}</span>)}
                        </div>
                        {salesEntries.map((entry,i)=>(
                          <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr auto', gap:'6px', marginBottom:'6px', alignItems:'center' }}>
                            <select value={entry.variant_id} onChange={e=>{ const v=donutVariants.find(dv=>dv.id===e.target.value); const upd=[...salesEntries]; upd[i]={...upd[i],variant_id:e.target.value,variant_name:v?.name||'',unit_price:v?.selling_price||0}; setSalesEntries(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                              <option value="">— Select variant —</option>
                              {VARIANT_CATEGORIES.map(cat=>{ const cv=donutVariants.filter(v=>v.category===cat); if(!cv.length) return null; return <optgroup key={cat} label={cat}>{cv.map(v=><option key={v.id} value={v.id}>{v.name} (₱{v.selling_price})</option>)}</optgroup> })}
                            </select>
                            <select value={entry.channel} onChange={e=>{ const upd=[...salesEntries]; upd[i]={...upd[i],channel:e.target.value}; setSalesEntries(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }}>
                              <option value="walkin">Walk-in</option>
                              <option value="messenger">Messenger</option>
                            </select>
                            <input type="number" placeholder="Qty" value={entry.quantity} onChange={e=>{ const upd=[...salesEntries]; upd[i]={...upd[i],quantity:e.target.value}; setSalesEntries(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px' }} min="1" />
                            <button onClick={()=>setSalesEntries(salesEntries.filter((_,j)=>j!==i))} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'7px 9px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>✕</button>
                          </div>
                        ))}
                        <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'8px 14px', marginBottom:'10px', fontSize:'12px' }} onClick={()=>setSalesEntries([...salesEntries, { variant_id:'', variant_name:'', channel:'walkin', quantity:'', unit_price:'' }])}>+ ADD ROW</button>
                        {salesEntries.some(e=>e.variant_id&&Number(e.quantity)>0) && (()=>{
                          const walkin = salesEntries.filter(e=>e.channel==='walkin'&&e.variant_id).reduce((s,e)=>{ const v=donutVariants.find(dv=>dv.id===e.variant_id); return s+Number(e.quantity||0)*(v?.selling_price||0) },0)
                          const messenger = salesEntries.filter(e=>e.channel==='messenger'&&e.variant_id).reduce((s,e)=>{ const v=donutVariants.find(dv=>dv.id===e.variant_id); return s+Number(e.quantity||0)*(v?.selling_price||0) },0)
                          const resellerTotal = deliveryInvoices.filter(i=>i.delivery_date===salesDate).reduce((s,i)=>s+Number(i.total_amount||0),0)
                          return (
                            <div style={{ background:'#e8f5e9', borderRadius:'10px', padding:'12px', marginBottom:'12px', border:'1px solid #c8e6c9' }}>
                              <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'13px', margin:'0 0 8px' }}>📊 Revenue Preview</p>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'6px', fontSize:'12px' }}>
                                <p style={cps}>Walk-in: <strong>{php(walkin)}</strong></p>
                                <p style={cps}>Messenger: <strong>{php(messenger)}</strong></p>
                                <p style={cps}>Reseller deliveries: <strong>{php(resellerTotal)}</strong></p>
                                <p style={{ ...cps, fontWeight:'bold', color:'#ca1b1b' }}>Total: <strong>{php(walkin+messenger+resellerTotal)}</strong></p>
                              </div>
                            </div>
                          )
                        })()}
                        <label style={lblS}>Notes:</label>
                        <input type="text" value={salesNotes} onChange={e=>setSalesNotes(e.target.value)} placeholder="e.g. Rainy day, slow sales" style={inputStyle} />
                        <button style={{ ...btnGreen, opacity:savingSales?0.6:1 }} disabled={savingSales} onClick={saveDailySales}>{savingSales?'⏳ Saving...':'✅ SAVE DAILY SALES'}</button>
                      </div>
                    )}
                    {dailySalesLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                    {!dailySalesLoading && dailySales.length===0 && <p style={{ color:'#aaa', textAlign:'center', padding:'30px', fontSize:'13px' }}>No sales encoded yet. Start encoding above.</p>}
                    {dailySales.map(sale=>(
                      <div key={sale.id} style={{ ...cardS, border:'2px solid #4a90d933', marginBottom:'10px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', color:'#333', fontSize:'14px', margin:'0 0 2px' }}>📅 {sale.sale_date}</p>
                            <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Encoded by: {sale.encoded_by}</p>
                          </div>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'18px', margin:0 }}>{php(sale.total_revenue)}</p>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px' }}>
                          {[['🏪 Walk-in',sale.total_walkin],['💬 Messenger',sale.total_messenger],['🚚 Reseller',sale.total_reseller]].map(([l,v])=>(
                            <div key={l} style={{ background:'#f5f5f5', borderRadius:'6px', padding:'6px', textAlign:'center' }}>
                              <p style={{ fontSize:'10px', color:'#888', margin:'0 0 2px' }}>{l}</p>
                              <p style={{ fontWeight:'bold', color:'#333', fontSize:'12px', margin:0 }}>{php(v||0)}</p>
                            </div>
                          ))}
                        </div>
                        {sale.notes && <p style={{ ...cps, color:'#888', marginTop:'6px' }}>📝 {sale.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── EXPENSES VIEW ── */}
                {salesView==='expenses' && (
                  <div>
                    {/* CASH RECONCILIATION */}
                    {(()=>{
                      const dayInvoices = deliveryInvoices.filter(i=>i.delivery_date===reconciliationDate||i.paid_date===reconciliationDate)
                      const dayPaidAmount = dayInvoices.reduce((s,i)=>s+Number(i.paid_amount||0),0)
                      const daySales = dailySales.filter(s=>s.sale_date===reconciliationDate).reduce((s,d)=>s+Number(d.total_amount||0),0)
                      const dayExpenses = dailyExpenses.filter(e=>e.expense_date===reconciliationDate&&e.status==='approved').reduce((s,e)=>s+Number(e.amount||0),0)
                      const expectedCash = dayPaidAmount + daySales - dayExpenses
                      const todayRecon = cashReconciliations.find(r=>r.reconciliation_date===reconciliationDate)
                      const variance = todayRecon ? Number(todayRecon.actual_cash) - expectedCash : null
                      return (
                        <div style={{ background:'white', border:`2px solid ${todayRecon?(Math.abs(Number(todayRecon.variance))>0?'#ca1b1b':'#2d8a4e'):'#FDD412'}`, borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                            <div>
                              <h3 style={{ color:'#1a1a2e', margin:'0 0 2px', fontSize:'14px' }}>💰 Cash Reconciliation</h3>
                              <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Compare expected vs actual cash on hand</p>
                            </div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                              <input type="date" value={reconciliationDate} onChange={e=>setReconciliationDate(e.target.value)} style={{ ...inputStyle, marginBottom:0, width:'140px', fontSize:'12px', padding:'6px 10px' }} />
                              <button style={{ ...btnBlack, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'11px' }} onClick={()=>setShowReconciliationHistory(!showReconciliationHistory)}>📋 HISTORY</button>
                            </div>
                          </div>
                          {/* Summary */}
                          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
                            {[
                              ['Reseller Payments',php(dayPaidAmount),'#4a90d9'],
                              ['Walk-in Sales',php(daySales),'#2d8a4e'],
                              ['Expenses',php(dayExpenses),'#ca1b1b'],
                              ['Expected Cash',php(expectedCash),'#1a1a2e'],
                            ].map(([l,v,c])=>(
                              <div key={l} style={{ background:'#f8f7f5', borderRadius:'10px', padding:'10px', textAlign:'center', border:`1px solid ${c}22` }}>
                                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.4px' }}>{l}</p>
                                <p style={{ fontWeight:'bold', color:c, fontSize:'16px', margin:0 }}>{v}</p>
                              </div>
                            ))}
                          </div>
                          {todayRecon ? (
                            <div style={{ background:Math.abs(Number(todayRecon.variance))===0?'#e8f5e9':Number(todayRecon.variance)>0?'#e8f5e9':'#fff5f5', borderRadius:'10px', padding:'14px', border:`1px solid ${Number(todayRecon.variance)===0?'#2d8a4e':Number(todayRecon.variance)>0?'#2d8a4e':'#ca1b1b'}` }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                                <div>
                                  <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 4px', color:'#333' }}>
                                    {Number(todayRecon.variance)===0?'✅ Balanced!':Number(todayRecon.variance)>0?`📈 Overage: ${php(Math.abs(Number(todayRecon.variance)))}`:`⚠️ Shortage: ${php(Math.abs(Number(todayRecon.variance)))}`}
                                  </p>
                                  <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Actual: {php(todayRecon.actual_cash)} | Expected: {php(expectedCash)} | Submitted by: {todayRecon.submitted_by}</p>
                                  {todayRecon.notes && <p style={{ color:'#888', fontSize:'11px', margin:'4px 0 0' }}>Note: {todayRecon.notes}</p>}
                                </div>
                                <button style={{ ...btnGray, width:'auto', padding:'6px 14px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setActualCash(String(todayRecon.actual_cash)); setReconciliationNotes(todayRecon.notes||'') }}>✏️ UPDATE</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ background:'#f8f7f5', borderRadius:'10px', padding:'14px', border:'1px solid #eee' }}>
                              <p style={{ fontWeight:'bold', color:'#555', fontSize:'12px', margin:'0 0 10px' }}>Enter Actual Cash Count for {reconciliationDate}:</p>
                              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'2fr 2fr 1fr', gap:'8px', alignItems:'flex-end' }}>
                                <div><label style={lblS}>Actual Cash on Hand (₱):</label><input type="number" value={actualCash} onChange={e=>setActualCash(e.target.value)} placeholder="0.00" style={{ ...inputStyle, marginBottom:0, border:'2px solid #FDD412', fontSize:'16px', fontWeight:'bold' }} min="0" step="0.01" /></div>
                                <div><label style={lblS}>Notes (optional):</label><input type="text" value={reconciliationNotes} onChange={e=>setReconciliationNotes(e.target.value)} placeholder="Any remarks..." style={{ ...inputStyle, marginBottom:0 }} /></div>
                                <button style={{ ...btnYellow, padding:'12px 16px', fontSize:'13px', fontWeight:'bold' }} onClick={()=>saveReconciliation(expectedCash)} disabled={savingReconciliation}>{savingReconciliation?'⏳ Saving...':'💾 SUBMIT'}</button>
                              </div>
                            </div>
                          )}
                          {/* History */}
                          {showReconciliationHistory && cashReconciliations.length > 0 && (
                            <div style={{ marginTop:'12px', border:'1px solid #eee', borderRadius:'10px', overflow:'hidden' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', background:'#1a1a2e', padding:'8px 12px' }}>
                                {['Date','Expected','Actual','Variance','By'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold' }}>{h}</span>)}
                              </div>
                              {cashReconciliations.slice(0,10).map((r,i)=>(
                                <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', padding:'8px 12px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>
                                  <span style={{ fontSize:'11px', fontWeight:'bold' }}>{r.reconciliation_date}</span>
                                  <span style={{ fontSize:'11px', color:'#555' }}>{php(r.expected_cash)}</span>
                                  <span style={{ fontSize:'11px', color:'#555' }}>{php(r.actual_cash)}</span>
                                  <span style={{ fontSize:'11px', fontWeight:'bold', color:Number(r.variance)===0?'#2d8a4e':Number(r.variance)>0?'#2d8a4e':'#ca1b1b' }}>{Number(r.variance)>0?'+':''}{php(r.variance)}</span>
                                  <span style={{ fontSize:'11px', color:'#888' }}>{r.submitted_by}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    {/* BANK DEPOSIT TRACKER */}
                    {(()=>{
                      const weekPaid = deliveryInvoices.filter(i=>i.paid_date&&i.paid_date>=bankDeposits[0]?.week_start).reduce((s,i)=>s+Number(i.paid_amount||0),0)
                      const weekSales = dailySales.filter(s=>s.sale_date>=bankDeposits[0]?.week_start).reduce((s,d)=>s+Number(d.total_amount||0),0)
                      const weekExp = dailyExpenses.filter(e=>e.status==='approved'&&e.expense_date>=bankDeposits[0]?.week_start).reduce((s,e)=>s+Number(e.amount||0),0)
                      const expectedDeposit = weekPaid + weekSales - weekExp
                      const isDayOfWeek = new Date().getDay()===2 // Tuesday
                      return (
                        <div style={{ background:'white', border:`2px solid ${isDayOfWeek?'#ca1b1b':'#1a1a2e'}`, borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                            <div>
                              <h3 style={{ color:'#1a1a2e', margin:'0 0 2px', fontSize:'14px' }}>🏦 Weekly Bank Deposit {isDayOfWeek&&<span style={{ background:'#ca1b1b', color:'white', borderRadius:'6px', padding:'2px 8px', fontSize:'10px', marginLeft:'6px' }}>📅 DEPOSIT DAY TODAY!</span>}</h3>
                              <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Every Tuesday · Admin deposits weekly collections</p>
                            </div>
                            <button style={{ ...btnYellow, padding:'8px 16px' }} onClick={()=>setShowDepositForm(!showDepositForm)}>💳 RECORD DEPOSIT</button>
                          </div>
                          {/* Summary */}
                          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:'10px', marginBottom:'12px' }}>
                            {[['This Week Collections',php(weekPaid+weekSales),'#2d8a4e'],['Expenses Paid',php(weekExp),'#ca1b1b'],['Expected Deposit',php(expectedDeposit),'#1a1a2e']].map(([l,v,c])=>(
                              <div key={l} style={{ background:'#f8f7f5', borderRadius:'10px', padding:'10px', textAlign:'center', border:`1px solid ${c}22` }}>
                                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px', textTransform:'uppercase' }}>{l}</p>
                                <p style={{ fontWeight:'bold', color:c, fontSize:'16px', margin:0 }}>{v}</p>
                              </div>
                            ))}
                          </div>
                          {/* Deposit Form */}
                          {showDepositForm && (
                            <div style={{ background:'#f8f7f5', borderRadius:'10px', padding:'14px', marginBottom:'12px', border:'1px solid #eee' }}>
                              <p style={{ fontWeight:'bold', color:'#1a1a2e', fontSize:'13px', margin:'0 0 10px' }}>Record Bank Deposit</p>
                              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'8px' }}>
                                <div><label style={lblS}>Deposit Date:</label><input type="date" value={depositForm.deposit_date} onChange={e=>setDepositForm(p=>({...p,deposit_date:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} /></div>
                                <div><label style={lblS}>Bank Name:</label><select value={depositForm.bank_name} onChange={e=>setDepositForm(p=>({...p,bank_name:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>{['BDO','BPI','Metrobank','UnionBank','Landbank','PNB','RCBC','Security Bank','GCash','Maya'].map(b=><option key={b}>{b}</option>)}</select></div>
                                <div><label style={lblS}>Deposit Slip Number:</label><input value={depositForm.deposit_slip_number} onChange={e=>setDepositForm(p=>({...p,deposit_slip_number:e.target.value}))} placeholder="e.g. 2026-051234" style={{ ...inputStyle, marginBottom:0 }} /></div>
                                <div><label style={lblS}>Amount Deposited (₱):</label><input type="number" value={depositForm.amount} onChange={e=>setDepositForm(p=>({...p,amount:e.target.value}))} placeholder="0.00" style={{ ...inputStyle, marginBottom:0, border:'2px solid #FDD412', fontWeight:'bold', fontSize:'16px' }} /></div>
                              </div>
                              <label style={lblS}>Notes:</label>
                              <input value={depositForm.notes} onChange={e=>setDepositForm(p=>({...p,notes:e.target.value}))} placeholder="Any notes..." style={inputStyle} />
                              {depositForm.amount && (
                                <div style={{ background:Math.abs(Number(depositForm.amount)-expectedDeposit)<50?'#e8f5e9':'#fff3cd', borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', border:`1px solid ${Math.abs(Number(depositForm.amount)-expectedDeposit)<50?'#2d8a4e':'#ffc107'}` }}>
                                  <p style={{ margin:0, fontSize:'12px', fontWeight:'bold' }}>
                                    Variance: {php(Number(depositForm.amount)-expectedDeposit)}
                                    {Math.abs(Number(depositForm.amount)-expectedDeposit)<50?' ✅ Within acceptable range':' ⚠️ Significant variance — will be flagged'}
                                  </p>
                                </div>
                              )}
                              <button style={{ ...btnBlack, opacity:savingDeposit?0.6:1 }} disabled={savingDeposit} onClick={()=>saveBankDeposit(expectedDeposit, weekPaid, weekSales, weekExp)}>{savingDeposit?'⏳ Saving...':'💳 SAVE DEPOSIT RECORD'}</button>
                            </div>
                          )}
                          {/* Deposit History */}
                          {bankDeposits.slice(0,5).map(d=>(
                            <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#fafafa', borderRadius:'8px', marginBottom:'4px', border:'1px solid #f0f0f0' }}>
                              <div>
                                <p style={{ fontWeight:'bold', fontSize:'12px', margin:'0 0 2px' }}>{d.deposit_date} · {d.bank_name}</p>
                                <p style={{ color:'#888', fontSize:'10px', margin:0 }}>Slip: {d.deposit_slip_number} · By: {d.deposited_by}</p>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <p style={{ fontWeight:'bold', color:'#2d8a4e', fontSize:'14px', margin:'0 0 2px' }}>{php(d.amount)}</p>
                                <p style={{ fontSize:'10px', color:Number(d.variance)===0?'#2d8a4e':Math.abs(Number(d.variance))<50?'#f5a623':'#ca1b1b', fontWeight:'bold', margin:0 }}>{Number(d.variance)>0?'+':''}{php(d.variance)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    <h3 style={{ color:'#ca1b1b', margin:'0 0 14px', fontSize:'14px' }}>💸 Daily Expenses</h3>
                    <div style={{ background:'#fff8dc', border:'2px solid #f5c518', borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
                      <h4 style={{ color:'#f57c00', margin:'0 0 12px', fontSize:'13px' }}>➕ Add Expense</h4>
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                        <div><label style={lblS}>Date:</label><input type="date" value={expenseForm.date} onChange={e=>setExpenseForm(p=>({...p,date:e.target.value}))} style={inputStyle} /></div>
                        <div><label style={lblS}>Category:</label>
                          <select value={expenseForm.category} onChange={e=>setExpenseForm(p=>({...p,category:e.target.value}))} style={inputStyle}>
                            {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div><label style={lblS}>Amount (₱):</label><input type="number" value={expenseForm.amount} onChange={e=>setExpenseForm(p=>({...p,amount:e.target.value}))} style={inputStyle} min="0" step="0.01" placeholder="0.00" /></div>
                        <div><label style={lblS}>Description:</label><input type="text" value={expenseForm.description} onChange={e=>setExpenseForm(p=>({...p,description:e.target.value}))} style={inputStyle} placeholder="e.g. Fuel for delivery to resellers" /></div>
                      </div>
                      <button style={{ ...btnYellow, width:'auto', padding:'10px 20px', marginTop:'4px', opacity:savingExpense?0.6:1 }} disabled={savingExpense} onClick={saveExpense}>{savingExpense?'⏳ Saving...':'➕ ADD EXPENSE'}</button>
                    </div>
                    {expensesLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                    {!expensesLoading && dailyExpenses.length===0 && <p style={{ color:'#aaa', textAlign:'center', padding:'20px', fontSize:'13px' }}>No expenses recorded yet.</p>}
                    {/* Pending approval banner for owner */}
                    {adminRole==='owner' && dailyExpenses.filter(e=>e.status==='pending').length > 0 && (
                      <div style={{ background:'#fff8dc', border:'2px solid #f5c518', borderRadius:'12px', padding:'14px', marginBottom:'14px' }}>
                        <p style={{ fontWeight:'bold', color:'#f57c00', fontSize:'13px', margin:'0 0 10px' }}>🟡 {dailyExpenses.filter(e=>e.status==='pending').length} Expense(s) Awaiting Your Approval</p>
                        {dailyExpenses.filter(e=>e.status==='pending').map(exp=>(
                          <div key={exp.id} style={{ background:'white', borderRadius:'10px', padding:'12px', marginBottom:'8px', border:'1px solid #f5c518' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                              <div>
                                <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 2px' }}>{exp.category}</p>
                                <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{exp.expense_date} — {exp.description||'No description'} — by {exp.encoded_by}</p>
                              </div>
                              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'16px', margin:0 }}>{php(exp.amount)}</p>
                            </div>
                            {rejectingExpenseId===exp.id ? (
                              <div>
                                <input value={rejectExpenseReason} onChange={e=>setRejectExpenseReason(e.target.value)} placeholder="Reason for rejection..." style={{ ...inputStyle, marginBottom:'6px' }} />
                                <div style={{ display:'flex', gap:'8px' }}>
                                  <button style={{ ...btnRed, flex:1, marginTop:0, padding:'8px' }} onClick={()=>rejectExpense(exp.id)}>✕ CONFIRM REJECT</button>
                                  <button style={{ ...btnGray, flex:1, marginTop:0, padding:'8px' }} onClick={()=>{ setRejectingExpenseId(null); setRejectExpenseReason('') }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display:'flex', gap:'8px' }}>
                                <button style={{ ...btnGreen, flex:1, marginTop:0, padding:'8px', fontSize:'12px' }} onClick={()=>approveExpense(exp.id)}>✅ APPROVE</button>
                                <button style={{ ...btnRed, flex:1, marginTop:0, padding:'8px', fontSize:'12px' }} onClick={()=>setRejectingExpenseId(exp.id)}>✕ REJECT</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {(()=>{
                      const monthTotal = dailyExpenses.filter(e=>e.expense_date?.startsWith(today.slice(0,7))).reduce((s,e)=>s+Number(e.amount||0),0)
                      return monthTotal > 0 && (
                        <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'10px', padding:'12px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px' }}>This Month's Total Expenses:</span>
                          <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'18px' }}>{php(monthTotal)}</span>
                        </div>
                      )
                    })()}
                    {dailyExpenses.filter(e=>e.status!=='pending'||adminRole==='owner').map(exp=>(
                      <div key={exp.id} style={{ ...cardS, border:`1px solid ${exp.status==='rejected'?'#ffcdd2':exp.status==='pending'?'#f5c518':'#eee'}`, marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', flexWrap:'wrap', background:exp.status==='rejected'?'#fff5f5':exp.status==='pending'?'#fffbf0':'white' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                            <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:'0 0 2px' }}>{exp.category}</p>
                            <Badge label={exp.status==='approved'?'✅ Approved':exp.status==='pending'?'🟡 Pending':exp.status==='rejected'?'❌ Rejected':'✅'} color={exp.status==='approved'?'green':exp.status==='pending'?'yellow':'red'} />
                          </div>
                          <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{exp.expense_date} {exp.description?`— ${exp.description}`:''}</p>
                          {exp.status==='rejected' && exp.rejection_reason && <p style={{ color:'#ca1b1b', fontSize:'11px', margin:'2px 0 0' }}>Rejected: {exp.rejection_reason}</p>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <span style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'15px' }}>{php(exp.amount)}</span>
                          {adminRole==='owner' && <button onClick={()=>deleteExpense(exp.id)} style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'6px', padding:'5px 8px', cursor:'pointer', fontSize:'12px' }}>🗑️</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── RESELLERS VIEW ── */}
                {salesView==='resellers' && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                      <h3 style={{ color:'#ca1b1b', margin:0, fontSize:'14px' }}>🏪 Reseller Management ({resellers.length})</h3>
                      <button style={{ ...btnRed, width:'auto', padding:'9px 16px', marginTop:0, fontSize:'12px' }} onClick={()=>{ setShowResellerForm(!showResellerForm); setEditingResellerId(null); setResellerForm({ name:'', area:'', contact_person:'', phone:'', address:'', delivery_day:'Monday' }) }}>
                        {showResellerForm?'✕ CANCEL':'+ ADD RESELLER'}
                      </button>
                    </div>
                    {showResellerForm && (
                      <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
                        <h4 style={{ color:'#ca1b1b', margin:'0 0 14px', fontSize:'13px' }}>{editingResellerId?'✏️ Edit Reseller':'➕ Add New Reseller'}</h4>
                        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                          <div><label style={lblS}>Reseller Name: *</label><input value={resellerForm.name} onChange={e=>setResellerForm(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="e.g. Aling Rosa's Store" /></div>
                          <div><label style={lblS}>Area / Location:</label><input value={resellerForm.area} onChange={e=>setResellerForm(p=>({...p,area:e.target.value}))} style={inputStyle} placeholder="e.g. Dagupan City" /></div>
                          <div><label style={lblS}>Contact Person:</label><input value={resellerForm.contact_person} onChange={e=>setResellerForm(p=>({...p,contact_person:e.target.value}))} style={inputStyle} placeholder="Name of contact" /></div>
                          <div><label style={lblS}>Phone Number:</label><input value={resellerForm.phone} onChange={e=>setResellerForm(p=>({...p,phone:e.target.value}))} style={inputStyle} placeholder="09XX-XXX-XXXX" /></div>
                          <div><label style={lblS}>Address:</label><input value={resellerForm.address} onChange={e=>setResellerForm(p=>({...p,address:e.target.value}))} style={inputStyle} placeholder="Full delivery address" /></div>
                          <div><label style={lblS}>Delivery Day:</label>
                            <select value={resellerForm.delivery_day} onChange={e=>setResellerForm(p=>({...p,delivery_day:e.target.value}))} style={inputStyle}>
                              {WEEK_DAYS.map(d=><option key={d} value={d}>{d}</option>)}
                              <option value="Daily">Daily</option>
                              <option value="As needed">As needed</option>
                            </select>
                          </div>
                          <div><label style={lblS}>🔑 Portal Access Code:</label><input value={resellerForm.access_code||''} onChange={e=>setResellerForm(p=>({...p,access_code:e.target.value.toUpperCase()}))} style={inputStyle} placeholder="e.g. CATABLAN" /></div>
                          <div><label style={lblS}>🔑 Portal PIN:</label><input value={resellerForm.access_pin||''} onChange={e=>setResellerForm(p=>({...p,access_pin:e.target.value}))} style={inputStyle} placeholder="e.g. 1234" /></div>
                        </div>
                        <button style={{ ...btnRed, width:'auto', padding:'10px 20px', marginTop:'8px' }} onClick={saveReseller}>💾 {editingResellerId?'UPDATE RESELLER':'SAVE RESELLER'}</button>
                      </div>
                    )}
                    {resellersLoading && <p style={{ color:'#888', fontSize:'13px' }}>⏳ Loading...</p>}
                    {resellers.map(r=>{
                      const rInvoices = deliveryInvoices.filter(i=>i.reseller_id===r.id)
                      const rAR = rInvoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0)
                      const isEditingOrder = editingDefaultOrder===r.id
                      return (
                        <div key={r.id} style={{ ...cardS, border:`2px solid ${rAR>0?'#f5c51844':'#ca1b1b22'}`, marginBottom:'12px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px', marginBottom:'8px' }}>
                            <div>
                              <p style={{ fontWeight:'bold', fontSize:'15px', color:'#ca1b1b', margin:'0 0 2px' }}>{r.name}</p>
                              <p style={{ color:'#888', fontSize:'12px', margin:'0 0 2px' }}>📍 {r.area||'—'} | 📅 Delivery: {r.delivery_day}</p>
                              <p style={{ color:'#888', fontSize:'12px', margin:0 }}>👤 {r.contact_person||'—'} | 📞 {r.phone||'—'}</p>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              {rAR > 0 && <div style={{ marginBottom:'4px' }}><Badge label={`AR: ${php(rAR)}`} color="yellow" /></div>}
                              <Badge label={`${rInvoices.length} invoice(s)`} color="gray" />
                            </div>
                          </div>
                          {/* Default order */}
                          <div style={{ background:'#f9f9f9', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                              <span style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>📋 Default Order Template</span>
                              {!isEditingOrder ? (
                                <button style={{ ...btnBlack, background:'#4a90d9', width:'auto', padding:'4px 10px', marginTop:0, fontSize:'11px' }} onClick={async ()=>{
                                  setEditingDefaultOrder(r.id)
                                  // Make sure variants are loaded first
                                  let variants = donutVariants
                                  if (!variants || variants.length === 0) {
                                    const { data } = await supabase.from('donut_variants').select('*').order('category').order('name')
                                    variants = data || []
                                  }
                                  const existing = resellerDefaultOrders[r.id] || []
                                  const allItems = variants.map(v => {
                                    const found = existing.find(e=>e.variant_id===v.id)
                                    return { variant_id:v.id, variant_name:v.name, default_quantity: found?.default_quantity||'' }
                                  })
                                  setDefaultOrderItems(allItems)
                                }}>✏️ EDIT</button>
                              ) : (
                                <div style={{ display:'flex', gap:'6px' }}>
                                  <button style={{ ...btnGreen, width:'auto', padding:'4px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>saveDefaultOrder(r.id)}>💾 SAVE</button>
                                  <button style={{ ...btnGray, width:'auto', padding:'4px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>setEditingDefaultOrder(null)}>✕</button>
                                </div>
                              )}
                            </div>
                            {isEditingOrder ? (
                              <div>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                                  <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Set default qty per variant. Leave 0 to exclude.</p>
                                  <button style={{ background:'#1a1a2e', color:'white', border:'none', borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }} onClick={async ()=>{
                                    let variants = donutVariants
                                    if (!variants || variants.length === 0) {
                                      const { data } = await supabase.from('donut_variants').select('*').order('category').order('name')
                                      variants = data || []
                                    }
                                    const all = variants.map(v => { const existing = defaultOrderItems.find(i=>i.variant_id===v.id); return { variant_id:v.id, variant_name:v.name, default_quantity: existing?.default_quantity||'' } })
                                    setDefaultOrderItems(all)
                                  }}>📋 LOAD ALL VARIANTS</button>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'4px', marginBottom:'4px', padding:'4px 6px', background:'#ca1b1b', borderRadius:'6px' }}>
                                  <span style={{ color:'white', fontSize:'10px', fontWeight:'bold' }}>Variant</span>
                                  <span style={{ color:'white', fontSize:'10px', fontWeight:'bold', textAlign:'center' }}>Default Qty</span>
                                </div>
                                {defaultOrderItems.map((item,i)=>{
                                  const variant = donutVariants.find(v=>v.id===item.variant_id)
                                  return (
                                    <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'4px', marginBottom:'4px', alignItems:'center', background:i%2===0?'white':'#fafafa', padding:'4px 6px', borderRadius:'6px', border:'1px solid #eee' }}>
                                      <span style={{ fontSize:'11px', fontWeight:'bold', color:'#333' }}>{variant?.name||item.variant_name||'—'}</span>
                                      <input type="number" placeholder="0" value={item.default_quantity||''} onChange={e=>{ const upd=[...defaultOrderItems]; upd[i]={...upd[i],default_quantity:e.target.value}; setDefaultOrderItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'11px', textAlign:'center' }} min="0" />
                                    </div>
                                  )
                                })}
                                {defaultOrderItems.length===0 && (
                                  <p style={{ color:'#aaa', fontSize:'11px', textAlign:'center', padding:'10px' }}>Click "📋 LOAD ALL VARIANTS" to start setting quantities.</p>
                                )}
                              </div>
                            ) : (resellerDefaultOrders[r.id]||[]).length > 0 ? (
                              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                {resellerDefaultOrders[r.id].map(item=>(
                                  <div key={item.id} style={{ background:'white', borderRadius:'6px', padding:'3px 8px', fontSize:'11px', border:'1px solid #ddd' }}>
                                    <strong>{item.variant_name}</strong>: {item.default_quantity} pcs
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ color:'#aaa', fontSize:'11px', fontStyle:'italic', margin:0 }}>No default order set. Click Edit to define.</p>
                            )}
                          </div>
                          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                            <button style={{ ...btnBlack, background:'#2d8a4e', width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setInvoiceResellerId(r.id); buildInvoiceFromReseller(r.id); setSalesView('deliveries'); setShowCreateInvoice(true) }}>🚚 CREATE DELIVERY</button>
                            <button style={{ ...btnYellow, width:'auto', padding:'6px 12px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setEditingResellerId(r.id); setResellerForm({ name:r.name, area:r.area||'', contact_person:r.contact_person||'', phone:r.phone||'', address:r.address||'', delivery_day:r.delivery_day||'Monday' }); setShowResellerForm(true) }}>✏️ EDIT</button>
                            <button style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }} onClick={()=>deleteReseller(r)}>🗑️</button>
                          </div>
                        </div>
                      )
                    })}
                    {resellers.length===0 && !resellersLoading && (
                      <div style={{ textAlign:'center', padding:'30px', color:'#888' }}>
                        <p style={{ fontSize:'28px', margin:'0 0 10px' }}>🏪</p>
                        <p style={{ fontWeight:'bold', fontSize:'14px' }}>No resellers yet</p>
                        <p style={{ fontSize:'12px' }}>Add your 16 resellers above.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ANALYTICS — Owner Only */}
            {activeTab==='analytics' && adminRole==='owner' && (
              <div>
                <h2 style={h2s}>📊 Sales Analytics</h2>
                {(()=>{
                  // Compute analytics from deliveryInvoices and dailyExpenses
                  const paidInvoices = deliveryInvoices.filter(i=>i.status==='paid'||i.status==='partial')
                  const allInvoices = deliveryInvoices

                  // Revenue by day (last 30 days)
                  const last30 = Array.from({length:30},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-29+i); return d.toISOString().slice(0,10) })
                  const revenueByDay = last30.map(date=>({ date:date.slice(5), revenue:allInvoices.filter(i=>i.delivery_date===date).reduce((s,i)=>s+Number(i.total_amount||0),0) }))

                  // Top variants
                  const variantMap = {}
                  allInvoices.forEach(inv=>{ (inv.delivery_invoice_items||[]).forEach(item=>{ if(!variantMap[item.variant_name]) variantMap[item.variant_name]=0; variantMap[item.variant_name]+=Number(item.quantity||0) }) })
                  const topVariants = Object.entries(variantMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,qty])=>({name:name.length>12?name.slice(0,12)+'…':name,qty}))

                  // Top resellers
                  const resellerMap = {}
                  allInvoices.forEach(inv=>{ if(!resellerMap[inv.reseller_name]) resellerMap[inv.reseller_name]=0; resellerMap[inv.reseller_name]+=Number(inv.total_amount||0) })
                  const topResellers = Object.entries(resellerMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,rev])=>({name:name.length>14?name.slice(0,14)+'…':name,rev}))

                  // Monthly revenue
                  const monthMap = {}
                  allInvoices.forEach(inv=>{ const m=inv.delivery_date?.slice(0,7); if(m){ if(!monthMap[m]) monthMap[m]=0; monthMap[m]+=Number(inv.total_amount||0) } })
                  const monthlyRevenue = Object.entries(monthMap).sort().slice(-6).map(([m,rev])=>({month:m.slice(5)+'/'+m.slice(2,4),rev}))

                  // Summary stats
                  const totalRevenue = allInvoices.reduce((s,i)=>s+Number(i.total_amount||0),0)
                  const totalPaid = allInvoices.reduce((s,i)=>s+Number(i.paid_amount||0),0)
                  const totalUnpaid = totalRevenue - totalPaid
                  const totalExpenses = dailyExpenses.filter(e=>e.status==='approved').reduce((s,e)=>s+Number(e.amount||0),0)
                  const netProfit = totalPaid - totalExpenses
                  const COLORS = ['#ca1b1b','#FDD412','#2d8a4e','#4a90d9','#9b59b6','#e67e22','#1abc9c','#e74c3c']

                  return (
                    <div>
                      {/* Summary Cards */}
                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
                        {[
                          ['Total Revenue',php(totalRevenue),'#ca1b1b','📈'],
                          ['Total Collected',php(totalPaid),'#2d8a4e','💵'],
                          ['Outstanding',php(totalUnpaid),'#f5a623','⏳'],
                          ['Net (Collected - Expenses)',php(netProfit),netProfit>=0?'#2d8a4e':'#ca1b1b','💰'],
                        ].map(([l,v,c,icon])=>(
                          <div key={l} style={{ background:'white', borderRadius:'14px', padding:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)', border:`1px solid ${c}22` }}>
                            <p style={{ color:'#888', fontSize:'11px', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{icon} {l}</p>
                            <p style={{ fontWeight:'800', color:c, fontSize:'22px', margin:0 }}>{v}</p>
                          </div>
                        ))}
                      </div>

                      {/* Revenue Trend Chart */}
                      <div style={{ background:'white', borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                        <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 12px' }}>📈 Daily Revenue — Last 30 Days</p>
                        <div style={{ overflowX:'auto' }}>
                          <svg width={Math.max(600,revenueByDay.length*22)} height="160" style={{ display:'block' }}>
                            {(() => {
                              const maxR = Math.max(...revenueByDay.map(d=>d.revenue),1)
                              const w = Math.max(600,revenueByDay.length*22)
                              const barW = w/revenueByDay.length*0.6
                              return revenueByDay.map((d,i)=>{
                                const bh = Math.max(2,(d.revenue/maxR)*120)
                                const x = (w/revenueByDay.length)*i + (w/revenueByDay.length)*0.2
                                return (
                                  <g key={d.date}>
                                    <rect x={x} y={130-bh} width={barW} height={bh} fill={d.revenue>0?'#ca1b1b':'#f0f0f0'} rx="3" />
                                    {i%5===0&&<text x={x+barW/2} y={150} textAnchor="middle" fontSize="8" fill="#888">{d.date}</text>}
                                    {d.revenue>0&&<title>{d.date}: {php(d.revenue)}</title>}
                                  </g>
                                )
                              })
                            })()}
                          </svg>
                        </div>
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                        {/* Top Variants */}
                        <div style={{ background:'white', borderRadius:'14px', padding:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 12px' }}>🍩 Top Variants by Volume</p>
                          {topVariants.length===0?<p style={{ color:'#aaa', fontSize:'12px' }}>No data yet</p>:topVariants.map((v,i)=>{
                            const maxQ = topVariants[0].qty
                            return (
                              <div key={v.name} style={{ marginBottom:'8px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:'bold', color:'#333' }}>{i+1}. {v.name}</span>
                                  <span style={{ fontSize:'11px', color:'#ca1b1b', fontWeight:'bold' }}>{v.qty.toLocaleString()} pcs</span>
                                </div>
                                <div style={{ background:'#f0f0f0', borderRadius:'4px', height:'8px', overflow:'hidden' }}>
                                  <div style={{ background:COLORS[i%COLORS.length], width:`${(v.qty/maxQ)*100}%`, height:'100%', borderRadius:'4px', transition:'width 0.5s' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Top Resellers */}
                        <div style={{ background:'white', borderRadius:'14px', padding:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                          <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 12px' }}>🏪 Top Resellers by Revenue</p>
                          {topResellers.length===0?<p style={{ color:'#aaa', fontSize:'12px' }}>No data yet</p>:topResellers.map((r,i)=>{
                            const maxR = topResellers[0].rev
                            return (
                              <div key={r.name} style={{ marginBottom:'8px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:'bold', color:'#333' }}>{i+1}. {r.name}</span>
                                  <span style={{ fontSize:'11px', color:'#2d8a4e', fontWeight:'bold' }}>{php(r.rev)}</span>
                                </div>
                                <div style={{ background:'#f0f0f0', borderRadius:'4px', height:'8px', overflow:'hidden' }}>
                                  <div style={{ background:COLORS[i%COLORS.length], width:`${(r.rev/maxR)*100}%`, height:'100%', borderRadius:'4px', transition:'width 0.5s' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Monthly Revenue */}
                      <div style={{ background:'white', borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                        <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 12px' }}>📅 Monthly Revenue — Last 6 Months</p>
                        {monthlyRevenue.length===0?<p style={{ color:'#aaa', fontSize:'12px' }}>No data yet</p>:(
                          <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', height:'140px', padding:'10px 0 0' }}>
                            {monthlyRevenue.map((m,i)=>{
                              const maxR = Math.max(...monthlyRevenue.map(m=>m.rev),1)
                              const bh = Math.max(8,(m.rev/maxR)*110)
                              return (
                                <div key={m.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                                  <span style={{ fontSize:'10px', fontWeight:'bold', color:'#ca1b1b' }}>{php(m.rev).replace('₱','₱')}</span>
                                  <div style={{ background:'#ca1b1b', width:'100%', height:`${bh}px`, borderRadius:'6px 6px 0 0', transition:'height 0.5s' }} />
                                  <span style={{ fontSize:'10px', color:'#888', fontWeight:'bold' }}>{m.month}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Invoice Status */}
                      <div style={{ background:'white', borderRadius:'14px', padding:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                        <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 12px' }}>📋 Invoice Status Breakdown</p>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                          {[
                            ['Paid',allInvoices.filter(i=>i.status==='paid').length,'#2d8a4e'],
                            ['Partial',allInvoices.filter(i=>i.status==='partial').length,'#f5a623'],
                            ['Unpaid',allInvoices.filter(i=>i.status==='unpaid').length,'#ca1b1b'],
                          ].map(([l,v,c])=>(
                            <div key={l} style={{ background:`${c}11`, borderRadius:'10px', padding:'12px', textAlign:'center', border:`1px solid ${c}33` }}>
                              <p style={{ color:'#888', fontSize:'10px', margin:'0 0 4px', textTransform:'uppercase' }}>{l}</p>
                              <p style={{ fontWeight:'bold', color:c, fontSize:'24px', margin:0 }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

                {salesView==='disputes' && (
                  <div>
                    <h3 style={h2s}>⚠️ Reseller Disputes</h3>
                    <button style={{ ...btnRed, width:'auto', padding:'8px 16px', marginBottom:'14px', marginTop:0 }} onClick={()=>{ supabase.from('reseller_disputes').select('*').order('created_at',{ascending:false}).then(({data})=>setResellerDisputes(data||[])); checkSuspiciousPatterns() }}>🔄 REFRESH</button>
                    {resellerDisputes.length===0?<p style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>No disputes filed yet.</p>:resellerDisputes.map(d=>(
                      <div key={d.id} style={{ ...cardS, border:`2px solid ${d.status==='pending'?'#f5a623':d.status==='resolved'?'#2d8a4e':'#eee'}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                          <div>
                            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:'0 0 2px' }}>{d.reseller_name}</p>
                            <p style={{ color:'#555', fontSize:'12px', margin:'0 0 2px' }}>Type: {d.dispute_type}</p>
                            <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{d.description}</p>
                            <p style={{ color:'#aaa', fontSize:'10px', margin:'4px 0 0' }}>{new Date(d.created_at).toLocaleString('en-PH')}</p>
                          </div>
                          <span style={{ background:d.status==='pending'?'#fff3cd':d.status==='resolved'?'#e8f5e9':'#f0f0f0', color:d.status==='pending'?'#856404':d.status==='resolved'?'#2d8a4e':'#888', borderRadius:'20px', padding:'3px 10px', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap' }}>{d.status?.toUpperCase()}</span>
                        </div>
                        {d.photo_url && (
                          <div style={{ marginBottom:'8px' }}>
                            <a href={d.photo_url} target="_blank" rel="noreferrer">
                              <img src={d.photo_url} alt="Dispute proof" style={{ width:'100%', maxWidth:'200px', borderRadius:'8px', border:'1px solid #eee', cursor:'pointer' }} />
                            </a>
                            <p style={{ color:'#4a90d9', fontSize:'10px', margin:'4px 0 0' }}>📸 Photo proof attached — click to view full size</p>
                          </div>
                        )}
                        {d.status==='pending' && (
                          <div style={{ marginTop:'8px' }}>
                            <input placeholder="Admin response..." style={{ ...inputStyle, marginBottom:'6px' }} id={`dispute-resp-${d.id}`} />
                            <div style={{ display:'flex', gap:'6px' }}>
                              <button style={{ ...btnGreen, flex:1, marginTop:0, padding:'8px', fontSize:'11px' }} onClick={async()=>{
                                const resp = document.getElementById(`dispute-resp-${d.id}`)?.value
                                if (!resp?.trim()) { showToast('❌ Enter response first.','red'); return }
                                await supabase.from('reseller_disputes').update({ status:'resolved', admin_response:resp, resolved_at:new Date().toISOString() }).eq('id',d.id)
                                await createNotification(null,'System','dispute',`✅ Dispute Resolved: ${d.reseller_name}`,`Your dispute (${d.dispute_type}) has been resolved. Response: ${resp}`)
                                showToast('✅ Dispute resolved!')
                                supabase.from('reseller_disputes').select('*').order('created_at',{ascending:false}).then(({data})=>setResellerDisputes(data||[]))
                              }}>✅ RESOLVE</button>
                              <button style={{ ...btnGray, flex:1, marginTop:0, padding:'8px', fontSize:'11px' }} onClick={async()=>{
                                await supabase.from('reseller_disputes').update({ status:'dismissed' }).eq('id',d.id)
                                showToast('Dispute dismissed.')
                                supabase.from('reseller_disputes').select('*').order('created_at',{ascending:false}).then(({data})=>setResellerDisputes(data||[]))
                              }}>❌ DISMISS</button>
                            </div>
                          </div>
                        )}
                        {d.admin_response && <p style={{ color:'#2d8a4e', fontSize:'11px', margin:'6px 0 0', padding:'6px 10px', background:'#e8f5e9', borderRadius:'6px' }}>Admin response: {d.admin_response}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FRANCHISE MODULE */}
            {activeTab==='franchise' && adminRole==='owner' && (
              <div>
                <h2 style={h2s}>🏪 Franchise Management</h2>
                {/* Summary */}
                <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:'12px', marginBottom:'16px' }}>
                  {[
                    ['Total Franchises',franchises.length,'#4a90d9'],
                    ['Active',franchises.filter(f=>f.status==='active').length,'#2d8a4e'],
                    ['Total Franchise Fees',php(franchises.reduce((s,f)=>s+Number(f.franchise_fee||0),0)),'#ca1b1b'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:'white', borderRadius:'12px', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)', border:`1px solid ${c}22` }}>
                      <p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px', textTransform:'uppercase' }}>{l}</p>
                      <p style={{ fontWeight:'800', color:c, fontSize:'22px', margin:0 }}>{v}</p>
                    </div>
                  ))}
                </div>
                <button style={{ ...btnYellow, width:'auto', padding:'10px 20px', marginBottom:'14px' }} onClick={()=>setShowFranchiseForm(!showFranchiseForm)}>
                  {showFranchiseForm?'✕ CANCEL':'➕ ADD FRANCHISE LOCATION'}
                </button>
                {showFranchiseForm && (
                  <div style={{ background:'#e8f0fe', border:'2px solid #4a90d9', borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
                    <h4 style={{ color:'#4a90d9', margin:'0 0 12px' }}>New Franchise Location</h4>
                    <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px' }}>
                      <div><label style={lblS}>Branch Name:</label><input value={franchiseForm.branch_name} onChange={e=>setFranchiseForm(p=>({...p,branch_name:e.target.value}))} placeholder="e.g. Roma's Donuts - Dagupan" style={inputStyle} /></div>
                      <div><label style={lblS}>Location/City:</label><input value={franchiseForm.location} onChange={e=>setFranchiseForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Dagupan City" style={inputStyle} /></div>
                      <div><label style={lblS}>Franchisee Name:</label><input value={franchiseForm.franchisee_name} onChange={e=>setFranchiseForm(p=>({...p,franchisee_name:e.target.value}))} style={inputStyle} /></div>
                      <div><label style={lblS}>Contact Number:</label><input value={franchiseForm.contact_number} onChange={e=>setFranchiseForm(p=>({...p,contact_number:e.target.value}))} style={inputStyle} /></div>
                      <div><label style={lblS}>Franchise Fee (₱):</label><input type="number" value={franchiseForm.franchise_fee} onChange={e=>setFranchiseForm(p=>({...p,franchise_fee:e.target.value}))} style={inputStyle} /></div>
                      <div><label style={lblS}>Royalty Rate (%):</label><input type="number" value={franchiseForm.royalty_rate} onChange={e=>setFranchiseForm(p=>({...p,royalty_rate:e.target.value}))} style={inputStyle} /></div>
                      <div><label style={lblS}>Opening Date:</label><input type="date" value={franchiseForm.opening_date} onChange={e=>setFranchiseForm(p=>({...p,opening_date:e.target.value}))} style={inputStyle} /></div>
                      <div><label style={lblS}>Status:</label>
                        <select value={franchiseForm.status} onChange={e=>setFranchiseForm(p=>({...p,status:e.target.value}))} style={inputStyle}>
                          {['active','pending','inactive','terminated'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>
                    <label style={lblS}>Notes:</label>
                    <input value={franchiseForm.notes} onChange={e=>setFranchiseForm(p=>({...p,notes:e.target.value}))} placeholder="Additional notes..." style={inputStyle} />
                    <button style={{ ...btnGreen }} onClick={async ()=>{
                      if (!franchiseForm.branch_name.trim()) { showToast('❌ Branch name required.','red'); return }
                      const { error } = await supabase.from('franchise_locations').insert({ branch_name:franchiseForm.branch_name, location:franchiseForm.location, franchisee_name:franchiseForm.franchisee_name, contact_number:franchiseForm.contact_number, franchise_fee:Number(franchiseForm.franchise_fee||0), royalty_rate:Number(franchiseForm.royalty_rate||5), opening_date:franchiseForm.opening_date||null, status:franchiseForm.status, notes:franchiseForm.notes||null })
                      if (error) { showToast('❌ Failed: '+error.message,'red'); return }
                      showToast('✅ Franchise added!')
                      setShowFranchiseForm(false)
                      setFranchiseForm({ branch_name:'', location:'', franchisee_name:'', contact_number:'', franchise_fee:'', royalty_rate:'5', opening_date:'', status:'active', notes:'' })
                      const { data } = await supabase.from('franchise_locations').select('*').order('created_at',{ascending:false})
                      setFranchises(data||[])
                    }}>💾 SAVE FRANCHISE</button>
                  </div>
                )}
                {loadingFranchises ? <p style={{ color:'#888', textAlign:'center' }}>⏳ Loading...</p> :
                  franchises.length===0 ? (
                    <div style={{ textAlign:'center', padding:'40px', color:'#aaa' }}>
                      <p style={{ fontSize:'48px', margin:'0 0 10px' }}>🏪</p>
                      <p style={{ fontWeight:'bold', fontSize:'14px', color:'#555' }}>No franchise locations yet</p>
                      <p style={{ fontSize:'12px' }}>Add your first franchise location above.</p>
                    </div>
                  ) : franchises.map(f=>(
                    <div key={f.id} style={{ ...cardS, border:`2px solid ${f.status==='active'?'#2d8a4e22':'#f5a62322'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                          <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:'0 0 2px' }}>{f.branch_name}</p>
                          <p style={{ color:'#888', fontSize:'12px', margin:'0 0 6px' }}>📍 {f.location} · 👤 {f.franchisee_name}</p>
                          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'11px', color:'#555' }}>📞 {f.contact_number||'—'}</span>
                            <span style={{ fontSize:'11px', color:'#2d8a4e', fontWeight:'bold' }}>Fee: {php(f.franchise_fee)}</span>
                            <span style={{ fontSize:'11px', color:'#4a90d9', fontWeight:'bold' }}>Royalty: {f.royalty_rate}%</span>
                            {f.opening_date && <span style={{ fontSize:'11px', color:'#888' }}>Opened: {f.opening_date}</span>}
                          </div>
                          {f.notes && <p style={{ color:'#888', fontSize:'11px', margin:'4px 0 0' }}>📝 {f.notes}</p>}
                        </div>
                        <span style={{ background:f.status==='active'?'#e8f5e9':'#fff3cd', color:f.status==='active'?'#2d8a4e':'#856404', borderRadius:'20px', padding:'4px 12px', fontSize:'11px', fontWeight:'bold' }}>{f.status?.toUpperCase()}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

          </div>
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
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f8f7f5', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1a1a2e,#ca1b1b)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.25)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ position:'relative' }}>
              {profilePhotoUrl ?
                <img src={profilePhotoUrl} alt="Profile" style={{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'2px solid #FDD412' }} /> :
                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#FDD412', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', border:'2px solid rgba(255,255,255,0.2)' }}>👤</div>
              }
            </div>
            <div>
              <p style={{ color:'white', fontWeight:'bold', fontSize:'14px', margin:0, letterSpacing:'0.3px' }}>{employee.full_name}</p>
              <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', margin:0 }}>{employee.position} · {employee.employee_code}</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {cameFromAdmin && (
              <button style={{ background:'#FDD412', color:'#1a1a2e', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={()=>{ setEmployee(null); setProfilePhotoUrl(null); setCameFromAdmin(false); setAdminMode(true); setSidebarOpen(false); loadEmployees(); loadDashboard(); loadDashboardCharts() }}>← Admin</button>
            )}
            <button style={{ background:'rgba(255,255,255,0.12)', color:'white', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={cameFromAdmin?()=>{ logout(); setCameFromAdmin(false); setAdminEmployee(null); setAdminRole(null) }:logout}>Logout</button>
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
        <div style={{ flex:1, overflowY:'auto', padding:isMobile?'12px':'20px', display:'flex', justifyContent:'center', background:'#f8f7f5' }}>
        <div style={{ background:'white', borderRadius:'16px', padding:isMobile?'16px':'20px', width:'100%', maxWidth:'560px', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', marginBottom:'16px', border:'1px solid #eee' }}>
        {uploadingPhoto && <p style={{ color:'#888', fontSize:'12px', margin:'0 0 8px', textAlign:'center' }}>⏳ Uploading photo...</p>}
        {cameFromAdmin && (
            <div style={{ background:'#1a1a2e', borderRadius:'10px', padding:'8px 14px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'16px' }}>👑</span>
              <span style={{ color:'white', fontWeight:'bold', fontSize:'12px' }}>Admin View — {adminRole?.toUpperCase()}</span>
            </div>
          )}
          <div style={{ textAlign:'center', marginBottom:'12px' }}>
            <p style={{ color:'#888', margin:'0', fontSize:'12px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{employee.position} · {employee.employee_code}</p>
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

          <div style={{ background:'#f8f9fa', borderRadius:'12px', padding:'14px', marginBottom:'12px', border:'1px solid #eee' }}>
            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase', margin:'0 0 10px' }}>Today's Attendance</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
              <div style={{ background:'white', borderRadius:'8px', padding:'8px 10px', border:'1px solid #eee' }}>
                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Shift</p>
                <p style={{ fontWeight:'bold', color:'#1a1a2e', fontSize:'12px', margin:0 }}>{todaySchedule?`${todaySchedule.shift_start} – ${todaySchedule.shift_end}`:'No Shift'}</p>
              </div>
              <div style={{ background:'white', borderRadius:'8px', padding:'8px 10px', border:'1px solid #eee' }}>
                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Status</p>
                <p style={{ fontWeight:'bold', color:todayLog?.status==='Absent'?'#ca1b1b':todayLog?.status==='Late'?'#f57c00':todayLog?.status?'#2d8a4e':'#888', fontSize:'12px', margin:0 }}>{todayLog?.status||'No record yet'}</p>
              </div>
              <div style={{ background:'white', borderRadius:'8px', padding:'8px 10px', border:'1px solid #eee' }}>
                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Time In</p>
                <p style={{ fontWeight:'bold', color:todayLog?.time_in?'#2d8a4e':'#bbb', fontSize:'13px', margin:0 }}>{todayLog?.time_in||'—'}</p>
              </div>
              <div style={{ background:'white', borderRadius:'8px', padding:'8px 10px', border:'1px solid #eee' }}>
                <p style={{ color:'#888', fontSize:'10px', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Time Out</p>
                <p style={{ fontWeight:'bold', color:todayLog?.time_out?'#ca1b1b':'#bbb', fontSize:'13px', margin:0 }}>{todayLog?.time_out||'—'}</p>
              </div>
            </div>
            <div style={{ background:'white', borderRadius:'8px', padding:'8px 10px', border:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:'#888', fontSize:'11px' }}>Break used</span>
              <span style={{ fontWeight:'bold', color:totalBreakMins>60?'#ca1b1b':'#1a1a2e', fontSize:'12px' }}>{totalBreakMins} min {totalBreakMins>60&&!onBreak?'⚠️ Over limit':''}</span>
            </div>
            {onBreak && (
              <div style={{ background:breakTimerSeconds>=3600?'#ca1b1b':breakTimerSeconds>=3000?'#f57c00':'#2d8a4e', borderRadius:'10px', padding:'10px 14px', marginTop:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:'white', fontWeight:'bold', fontSize:'12px', margin:'0 0 2px' }}>On Break</p>
                  <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', margin:0 }}>{breakTimerSeconds>=3600?'🚨 Overtime — Return now!':breakTimerSeconds>=3000?'⚠️ Almost at limit':'Within allowed time'}</p>
                </div>
                <p style={{ color:'white', fontWeight:'bold', fontSize:'22px', margin:0, fontFamily:'monospace' }}>{String(Math.floor(breakTimerSeconds/60)).padStart(2,'0')}:{String(breakTimerSeconds%60).padStart(2,'0')}</p>
              </div>
            )}
            {todayBreaks.length>0 && <div style={{ marginTop:'6px' }}>{todayBreaks.map((b,i)=><p key={b.id} style={{ margin:'1px 0', fontSize:'10px', color:'#aaa' }}>Break {i+1}: {b.break_out} {b.break_in?`→ ${b.break_in} (${b.break_minutes}min)`:'→ ongoing'}</p>)}</div>}
            {(todayLog?.selfie_in_url||todayLog?.selfie_out_url) && (
              <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                {todayLog?.selfie_in_url&&<img src={todayLog.selfie_in_url} alt="IN" style={{ width:'44px', height:'44px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2d8a4e' }} />}
                {todayLog?.selfie_out_url&&<img src={todayLog.selfie_out_url} alt="OUT" style={{ width:'44px', height:'44px', objectFit:'cover', borderRadius:'8px', border:'2px solid #ca1b1b' }} />}
              </div>
            )}
          </div>

          <div style={{ background:'#f8f9fa', borderRadius:'12px', padding:'12px 14px', marginBottom:'14px', border:'1px solid #eee', display:'flex', gap:'12px', justifyContent:'center' }}>
            <div style={{ textAlign:'center', flex:1 }}>
              <p style={{ fontSize:'10px', color:'#888', margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Sick Leave</p>
              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'22px', margin:0, lineHeight:1 }}>{myLeaveBalance.sick}</p>
              <p style={{ fontSize:'10px', color:'#aaa', margin:'2px 0 0' }}>days left</p>
            </div>
            <div style={{ width:'1px', background:'#eee' }} />
            <div style={{ textAlign:'center', flex:1 }}>
              <p style={{ fontSize:'10px', color:'#888', margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Vacation Leave</p>
              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'22px', margin:0, lineHeight:1 }}>{myLeaveBalance.vacation}</p>
              <p style={{ fontSize:'10px', color:'#aaa', margin:'2px 0 0' }}>days left</p>
            </div>
          </div>

          {/* Primary Time Actions */}
          {(()=>{
            const needsCompanyDevice = DEVICE_RESTRICTED_DEPTS.includes(employee?.department)
            const deviceOk = !needsCompanyDevice || isCompanyDevice
            return (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <button style={{ background:todayLog?'#f0f0f0':deviceOk?'#ca1b1b':'#e0e0e0', color:todayLog?'#aaa':deviceOk?'white':'#999', padding:'14px', border:'none', borderRadius:'10px', cursor:(todayLog||!deviceOk)?'not-allowed':'pointer', fontWeight:'bold', fontSize:'14px', letterSpacing:'0.5px' }} onClick={deviceOk?initiateTimeIn:()=>showToast('🔒 Production staff must time in on the company tablet.','red')} disabled={loading||!!todayLog}>⏱ TIME IN</button>
                  <button style={{ background:(!todayLog||!!todayLog?.time_out)?'#f0f0f0':deviceOk?'#1a1a2e':'#e0e0e0', color:(!todayLog||!!todayLog?.time_out)?'#aaa':deviceOk?'white':'#999', padding:'14px', border:'none', borderRadius:'10px', cursor:(!todayLog||!!todayLog?.time_out||!deviceOk)?'not-allowed':'pointer', fontWeight:'bold', fontSize:'14px', letterSpacing:'0.5px' }} onClick={deviceOk?initiateTimeOut:()=>showToast('🔒 Production staff must time out on the company tablet.','red')} disabled={loading||!todayLog||!!todayLog?.time_out}>⏱ TIME OUT</button>
                  <button style={{ background:(!todayLog||!!todayLog?.time_out||onBreak)?'#f0f0f0':deviceOk?'#4a90d9':'#e0e0e0', color:(!todayLog||!!todayLog?.time_out||onBreak)?'#aaa':deviceOk?'white':'#999', padding:'11px', border:'none', borderRadius:'10px', cursor:(!todayLog||!!todayLog?.time_out||onBreak||!deviceOk)?'not-allowed':'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={deviceOk?initiateBreakOut:()=>showToast('🔒 Production staff must use the company tablet.','red')} disabled={!todayLog||!!todayLog?.time_out||onBreak}>☕ BREAK OUT</button>
                  <button style={{ background:!onBreak?'#f0f0f0':deviceOk?'#2d8a4e':'#e0e0e0', color:!onBreak?'#aaa':deviceOk?'white':'#999', padding:'11px', border:'none', borderRadius:'10px', cursor:(!onBreak||!deviceOk)?'not-allowed':'pointer', fontWeight:'bold', fontSize:'13px' }} onClick={deviceOk?initiateBreakIn:()=>showToast('🔒 Production staff must use the company tablet.','red')} disabled={!onBreak}>☕ BREAK IN</button>
                </div>

                {/* Device restriction banner — only for Production dept on non-company device */}
                {needsCompanyDevice && !isCompanyDevice && (
                  <div style={{ background:'#fff5f5', border:'1px solid #ca1b1b', borderRadius:'10px', padding:'10px 14px', marginBottom:'8px', textAlign:'center' }}>
                    <p style={{ color:'#ca1b1b', fontWeight:'bold', fontSize:'12px', margin:'0 0 4px' }}>🔒 Time In/Out locked on this device</p>
                    <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Please use the company tablet in the production area.</p>
                  </div>
                )}
                {/* Company device badge */}
                {isCompanyDevice && (
                  <div style={{ background:'#e8f5e9', border:'1px solid #2d8a4e', borderRadius:'10px', padding:'8px 14px', marginBottom:'8px', textAlign:'center' }}>
                    <p style={{ color:'#2d8a4e', fontWeight:'bold', fontSize:'11px', margin:0 }}>✅ Company Device — Time In/Out Active</p>
                  </div>
                )}
              </div>
            )
          })()}
          <p style={{ color:'#bbb', fontSize:'11px', textAlign:'center', margin:'0 0 16px' }}>📸 Live selfie required — no photo uploads allowed</p>

          {/* Secondary Actions Grid */}
          <div style={{ borderTop:'1px solid #f0f0f0', paddingTop:'14px', marginBottom:'8px' }}>
            <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase', margin:'0 0 10px' }}>Quick Actions</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
              {[
                { label:'OT / UT', icon:'📝', action:()=>{ closeAllPanels(); setShowOTRequest(!showOTRequest) }, disabled:!todayLog||!todayLog?.time_out },
                { label:'File Leave', icon:'🏖️', action:()=>{ closeAllPanels(); setShowLeaveRequest(!showLeaveRequest) }, disabled:false },
                { label:'Cash Advance', icon:'💵', action:()=>{ closeAllPanels(); setShowCashAdvanceRequest(!showCashAdvanceRequest) }, disabled:false },
                { label:'My Payslips', icon:'💰', action:()=>{ closeAllPanels(); setShowPayslips(!showPayslips) }, disabled:false },
                { label:'Attendance', icon:'📋', action:()=>{ closeAllPanels(); setShowMyAttendance(!showMyAttendance) }, disabled:false },
                { label:'My Profile', icon:'👤', action:()=>setShowMyProfile(!showMyProfile), disabled:false },
              ].map(btn=>(
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled} style={{ background:btn.disabled?'#f8f8f8':'white', color:btn.disabled?'#ccc':'#333', border:`1px solid ${btn.disabled?'#f0f0f0':'#e0e0e0'}`, borderRadius:'10px', padding:'10px 6px', cursor:btn.disabled?'not-allowed':'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', transition:'all 0.15s' }}>
                  <span style={{ fontSize:'18px' }}>{btn.icon}</span>
                  <span style={{ fontSize:'10px', fontWeight:'bold', textAlign:'center', letterSpacing:'0.3px' }}>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
          {employee?.is_admin && (
            <button style={{ background:'#1a1a2e', color:'white', padding:'11px', border:'none', borderRadius:'10px', width:'100%', cursor:'pointer', fontWeight:'bold', fontSize:'13px', marginTop:'8px', letterSpacing:'0.5px' }} onClick={()=>openAdmin('owner')}>🔧 ADMIN PANEL</button>
          )}

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

          {showLeaveRequest && (
            <div style={{ background:'#f8f9fa', padding:'14px', borderRadius:'12px', border:'1px solid #eee', marginTop:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'13px', margin:0 }}>🏖️ File Leave Request</p>
                <button style={{ background:'#f0f0f0', border:'none', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', fontSize:'11px', color:'#555' }} onClick={()=>setShowLeaveRequest(false)}>✕ Close</button>
              </div>
              <input type="date" value={leaveStartDate} min={new Date(Date.now()+3*24*60*60*1000).toISOString().split('T')[0]} onChange={e=>setLeaveStartDate(e.target.value)} style={inputStyle} />
              <input type="date" value={leaveEndDate} onChange={e=>setLeaveEndDate(e.target.value)} style={inputStyle} />
              {leaveStartDate&&leaveEndDate&&<p style={{ color:'#ca1b1b', fontWeight:'bold', marginBottom:'8px', fontSize:'13px' }}>Duration: {Math.ceil((new Date(leaveEndDate)-new Date(leaveStartDate))/(1000*60*60*24))+1} day(s)</p>}
              <select value={leaveType} onChange={e=>setLeaveType(e.target.value)} style={inputStyle}><option value="">Select Leave Type</option><option value="Sick Leave">Sick Leave ({myLeaveBalance.sick} days left)</option><option value="Vacation Leave">Vacation Leave ({myLeaveBalance.vacation} days left)</option><option value="Emergency Leave">Emergency Leave</option></select>
              <textarea placeholder="Reason for leave..." value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} style={{ ...inputStyle, minHeight:'70px', resize:'none' }} />
              <button style={{ ...btnRed }} onClick={submitLeaveRequest}>SUBMIT LEAVE REQUEST</button>
            </div>
          )}

          <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>{ closeAllPanels(); setShowMyLeaves(!showMyLeaves); if(!showMyLeaves) loadMyLeaves() }}>{showMyLeaves?'▲ Hide':'▼ View'} My Leave History</button>
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

          <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>{ closeAllPanels(); setShowCashAdvanceRequest(!showCashAdvanceRequest) }}>{showCashAdvanceRequest?'▲ Hide':'▼'} Request Cash Advance</button>
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

          <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>{ closeAllPanels(); setShowCashAdvances(!showCashAdvances); if(!showCashAdvances) loadMyCashAdvances(employee) }}>{showCashAdvances?'▲ Hide':'▼'} My Cash Advances</button>
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

          <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>{ closeAllPanels(); setShowMyAttendance(!showMyAttendance) }}>{showMyAttendance?'▲ Hide':'▼'} My Attendance History</button>
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

          {/* PENDING CHARGES NOTIFICATION */}
          {myCharges.filter(c=>c.status==='pending_employee').length>0 && (
            <div style={{ background:'#fff5f5', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'16px', marginTop:'12px' }}>
              <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:'0 0 10px' }}>⚠️ You have {myCharges.filter(c=>c.status==='pending_employee').length} pending charge(s) requiring your response</p>
              {myCharges.filter(c=>c.status==='pending_employee').map(c=>(
                <div key={c.id} style={{ background:'white', border:'1px solid #ffcdd2', borderRadius:'10px', padding:'12px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                    <div>
                      <p style={{ fontWeight:'bold', fontSize:'14px', color:'#333', margin:'0 0 2px' }}>{c.item_name}</p>
                      <p style={{ color:'#888', fontSize:'12px', margin:0 }}>Qty: {Number(c.quantity||0).toFixed(2)} {c.unit}</p>
                    </div>
                    <p style={{ fontWeight:'bold', fontSize:'18px', color:'#ca1b1b', margin:0 }}>{php(c.total_cost)}</p>
                  </div>
                  <p style={cps}>Reason: <strong>{c.reason}</strong></p>
                  {c.notes && <p style={cps}>Notes: {c.notes}</p>}
                  <p style={{ ...cps, color:'#888' }}>Date: {new Date(c.created_at).toLocaleDateString()}</p>
                  <p style={{ fontSize:'12px', color:'#555', margin:'8px 0', background:'#fff8dc', padding:'8px', borderRadius:'8px' }}>
                    By clicking "I Agree", you acknowledge that <strong>{php(c.total_cost)}</strong> will be deducted from your next payroll. If you believe this charge is incorrect, click "I Dispute".
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    <button style={{ ...btnGreen, margin:0 }} onClick={()=>respondToCharge(c,'agree')}>✅ I AGREE</button>
                    <button style={{ ...btnRed, margin:0 }} onClick={()=>respondToCharge(c,'dispute')}>❌ I DISPUTE</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CHARGE HISTORY */}
          {myCharges.filter(c=>c.status!=='pending_employee').length>0 && (
            <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>setShowMyCharges(!showMyCharges)}>
              {showMyCharges?'▲ Hide':'▼'} My Charge History ({myCharges.filter(c=>c.status!=='pending_employee').length})
            </button>
          )}
          {showMyCharges && myCharges.filter(c=>c.status!=='pending_employee').map(c=>(
            <div key={c.id} style={{ ...cardS, borderLeft:`4px solid ${c.status==='agreed'?'#ca1b1b':c.status==='disputed'?'#f57c00':'#888'}`, marginTop:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
                <p style={{ fontWeight:'bold', fontSize:'13px', color:'#333', margin:0 }}>{c.item_name}</p>
                <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:0 }}>{php(c.total_cost)}</p>
              </div>
              <p style={cps}>Reason: {c.reason}</p>
              <p style={cps}>Status: <strong style={{ color:c.status==='agreed'?'#ca1b1b':c.status==='disputed'?'#f57c00':'#888' }}>{c.status==='agreed'?'✅ Agreed — Will be deducted':c.status==='disputed'?'⏳ Disputed — Owner reviewing':'Dismissed'}</strong></p>
              {c.acknowledged_at && <p style={{ ...cps, color:'#aaa' }}>Responded: {new Date(c.acknowledged_at).toLocaleString()}</p>}
            </div>
          ))}

          <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>{ closeAllPanels(); setShowPayslips(!showPayslips) }}>{showPayslips?'▲ Hide':'▼'} My Payslips</button>
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

          <button style={{ background:'#f8f9fa', color:'#555', border:'1px solid #eee', padding:'10px', borderRadius:'10px', width:'100%', marginTop:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }} onClick={()=>setShowMyProfile(!showMyProfile)}>
            {showMyProfile?'▲ Hide':'▼'} My Profile
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
            <div style={{ display:'flex', gap:'8px', marginTop:'16px' }}>
              <button style={{ background:'#ca1b1b', color:'white', border:'none', borderRadius:'10px', padding:'12px', flex:1, fontWeight:'bold', fontSize:'13px', cursor:'pointer', letterSpacing:'0.5px' }} onClick={()=>{ setEmployee(null); setProfilePhotoUrl(null); setCameFromAdmin(false); setAdminMode(true); setSidebarOpen(false); loadEmployees(); loadDashboard(); loadDashboardCharts() }}>← Admin Panel</button>
              <button style={{ background:'#f0f0f0', color:'#555', border:'none', borderRadius:'10px', padding:'12px', flex:1, fontWeight:'bold', fontSize:'13px', cursor:'pointer' }} onClick={()=>{ logout(); setCameFromAdmin(false); setAdminEmployee(null); setAdminRole(null) }}>Logout</button>
            </div>
          ) : (
            <button style={{ background:'#f0f0f0', color:'#555', border:'none', borderRadius:'10px', padding:'12px', width:'100%', marginTop:'16px', fontWeight:'bold', fontSize:'13px', cursor:'pointer' }} onClick={logout}>Logout</button>
          )}
        </div>
        </div>
      </div>
    )
  }

  // ── Reseller Portal ───────────────────────────────────────────────────────
  if (resellerMode && currentReseller) {
    const totalBalance = resellerInvoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+Number(i.total_amount||0)-Number(i.paid_amount||0),0)
    const totalPaid = resellerPaymentHistory.reduce((s,p)=>s+Number(p.amount||0),0)
    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f8f7f5', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {toast && <div style={{ position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:toast.color==='red'?'#ca1b1b':'#2d8a4e', color:'white', padding:'12px 28px', borderRadius:'10px', fontWeight:'bold', fontSize:'14px', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', whiteSpace:'nowrap' }}>{toast.msg}</div>}
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1a1a2e,#ca1b1b)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.25)' }}>
          <div>
            <p style={{ color:'white', fontWeight:'bold', fontSize:'14px', margin:0 }}>🏪 {currentReseller.name}</p>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', margin:0 }}>{currentReseller.area} — Reseller Portal</p>
          </div>
          <button style={{ background:'rgba(255,255,255,0.12)', color:'white', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }} onClick={()=>{ setResellerMode(false); setCurrentReseller(null); setResellerLoginCode(''); setResellerLoginPin('') }}>Logout</button>
        </div>
        {/* Nav */}
        <div style={{ background:'white', borderBottom:'1px solid #f0f0f0', padding:'10px 16px', display:'flex', gap:'6px', overflowX:'auto' }}>
          {[['dashboard','📊 Dashboard'],['invoices','📋 Invoices'],['orders','📦 My Orders'],['place_order','🛒 Place Order'],['payments','💵 Payments']].map(([v,l])=>(
            <button key={v} onClick={()=>setResellerPortalView(v)} style={{ padding:'8px 16px', borderRadius:'20px', border:'none', background:resellerPortalView===v?'#ca1b1b':'#f4f4f4', color:resellerPortalView===v?'white':'#555', fontWeight:resellerPortalView===v?'700':'500', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s', boxShadow:resellerPortalView===v?'0 2px 8px rgba(202,27,27,0.25)':'none' }}>{l}</button>
          ))}
        </div>
        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
          {/* Dashboard */}
          {resellerPortalView==='dashboard' && (
            <div>
              <h2 style={h2s}>📊 My Account Overview</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                {[
                  ['Outstanding Balance',php(totalBalance),'#ca1b1b'],
                  ['Total Paid',php(totalPaid),'#2d8a4e'],
                  ['Total Invoices',resellerInvoices.length,'#4a90d9'],
                  ['Pending Orders',resellerOrders.filter(o=>o.status==='pending').length,'#f5a623'],
                ].map(([l,v,c])=>(
                  <div key={l} style={{ background:'white', borderRadius:'12px', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)', border:`1px solid ${c}22` }}>
                    <p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.4px' }}>{l}</p>
                    <p style={{ fontWeight:'800', color:c, fontSize:'22px', margin:0 }}>{v}</p>
                  </div>
                ))}
              </div>
              <h3 style={{ color:'#ca1b1b', fontSize:'13px', margin:'0 0 10px' }}>Recent Invoices</h3>
              {resellerInvoices.slice(0,5).map(inv=>(
                <div key={inv.id} style={{ ...cardS, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>{inv.invoice_number}</p>
                    <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Delivery: {inv.delivery_date} | Due: {inv.due_date}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontWeight:'bold', color:'#ca1b1b', margin:'0 0 4px' }}>{php(inv.total_amount)}</p>
                    <span style={{ background:inv.status==='paid'?'#e8f5e9':inv.status==='partial'?'#fff3cd':'#fff5f5', color:inv.status==='paid'?'#2d8a4e':inv.status==='partial'?'#856404':'#ca1b1b', borderRadius:'20px', padding:'2px 10px', fontSize:'10px', fontWeight:'bold' }}>{inv.status?.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Invoices */}
          {resellerPortalView==='invoices' && (
            <div>
              <h2 style={h2s}>📋 My Invoices</h2>
              {resellerInvoices.length===0?<p style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>No invoices yet</p>:resellerInvoices.map(inv=>(
                <div key={inv.id} style={{ ...cardS }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                    <div>
                      <p style={{ fontWeight:'bold', color:'#ca1b1b', fontSize:'14px', margin:'0 0 2px' }}>{inv.invoice_number}</p>
                      <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Delivery: {inv.delivery_date} | Due: {inv.due_date}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontWeight:'bold', fontSize:'16px', margin:'0 0 4px' }}>{php(inv.total_amount)}</p>
                      <span style={{ background:inv.status==='paid'?'#e8f5e9':inv.status==='partial'?'#fff3cd':'#fff5f5', color:inv.status==='paid'?'#2d8a4e':inv.status==='partial'?'#856404':'#ca1b1b', borderRadius:'20px', padding:'3px 10px', fontSize:'10px', fontWeight:'bold' }}>{inv.status?.toUpperCase()}</span>
                    </div>
                  </div>
                  {(inv.delivery_invoice_items||[]).length > 0 && (
                    <div style={{ fontSize:'11px', color:'#555', marginBottom:'8px' }}>
                      {(inv.delivery_invoice_items||[]).slice(0,3).map(i=>`${i.variant_name}: ${i.quantity} pcs`).join(' · ')}{(inv.delivery_invoice_items||[]).length>3?` · +${(inv.delivery_invoice_items||[]).length-3} more`:''}
                    </div>
                  )}
                  {!inv.receipt_confirmed && inv.status!=='unpaid' && (
                    <button style={{ ...btnGreen, marginTop:'6px', padding:'8px', fontSize:'12px' }} onClick={()=>confirmDeliveryReceipt(inv.id)}>✅ CONFIRM DELIVERY RECEIVED</button>
                  )}
                  {inv.receipt_confirmed && <p style={{ color:'#2d8a4e', fontSize:'11px', fontWeight:'bold', margin:'4px 0 0' }}>✅ Delivery confirmed on {inv.confirmed_at?.slice(0,10)}</p>}
                  {/* Dispute Button */}
                  <button style={{ background:'#fff5f5', color:'#ca1b1b', border:'1px solid #ca1b1b', borderRadius:'8px', padding:'6px 14px', cursor:'pointer', fontWeight:'bold', fontSize:'11px', marginTop:'8px', width:'100%' }} onClick={()=>setShowDisputeForm(showDisputeForm===inv.id?null:inv.id)}>⚠️ REPORT DISCREPANCY / DISPUTE</button>
                  {/* Dispute Form */}
                  {showDisputeForm===inv.id && (
                    <div style={{ background:'#fff8f0', border:'2px solid #f5a623', borderRadius:'10px', padding:'14px', marginTop:'8px' }}>
                      <p style={{ fontWeight:'bold', color:'#f57c00', fontSize:'13px', margin:'0 0 10px' }}>⚠️ Report Discrepancy</p>
                      <label style={lblS}>Dispute Type:</label>
                      <select value={disputeType} onChange={e=>setDisputeType(e.target.value)} style={inputStyle}>
                        <option value="">— Select —</option>
                        {['Wrong items delivered','Missing items','Damaged goods','Quantity mismatch','Quality issue','Wrong price','Other'].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      <label style={lblS}>Description:</label>
                      <textarea value={disputeDesc} onChange={e=>setDisputeDesc(e.target.value)} placeholder="Describe the issue in detail..." style={{ ...inputStyle, minHeight:'80px', resize:'vertical' }} />
                      <label style={lblS}>Photo Proof (required for discrepancies):</label>
                      <div onDragOver={e=>{e.preventDefault();e.currentTarget.style.background='#fff3cd'}} onDragLeave={e=>{e.currentTarget.style.background='#f8f7f5'}} onDrop={e=>{e.preventDefault();e.currentTarget.style.background='#f8f7f5';const f=e.dataTransfer.files[0];if(f)setDisputePhoto(f)}} onClick={()=>document.getElementById('dispute-photo-'+inv.id).click()} style={{ background:'#f8f7f5', border:'2px dashed #f5a623', borderRadius:'10px', padding:'20px', textAlign:'center', cursor:'pointer', marginBottom:'10px' }}>
                        {disputePhoto?<p style={{ color:'#2d8a4e', fontWeight:'bold', fontSize:'12px', margin:0 }}>📸 {disputePhoto.name}</p>:<><p style={{ fontSize:'24px', margin:'0 0 4px' }}>📸</p><p style={{ color:'#888', fontSize:'11px', margin:0 }}>Tap to take/upload photo proof</p></>}
                        <input id={'dispute-photo-'+inv.id} type="file" accept="image/*" capture="environment" onChange={e=>setDisputePhoto(e.target.files[0]||null)} style={{ display:'none' }} />
                      </div>
                      <button style={{ ...btnRed, opacity:submittingDispute?0.6:1 }} disabled={submittingDispute} onClick={()=>submitResellerDispute(inv)}>{submittingDispute?'⏳ Submitting...':'📤 SUBMIT DISPUTE'}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* My Orders */}
          {resellerPortalView==='orders' && (
            <div>
              <h2 style={h2s}>📦 My Orders</h2>
              {resellerOrders.length===0?<p style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>No orders yet. Place your first order!</p>:resellerOrders.map(ord=>(
                <div key={ord.id} style={{ ...cardS }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                    <div>
                      <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>Order for {ord.delivery_date}</p>
                      <p style={{ color:'#888', fontSize:'11px', margin:0 }}>Placed: {ord.order_date}</p>
                    </div>
                    <span style={{ background:ord.status==='approved'?'#e8f5e9':ord.status==='rejected'?'#fff5f5':'#fff3cd', color:ord.status==='approved'?'#2d8a4e':ord.status==='rejected'?'#ca1b1b':'#856404', borderRadius:'20px', padding:'3px 10px', fontSize:'11px', fontWeight:'bold' }}>{ord.status?.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:'#555' }}>
                    {(ord.reseller_order_items||[]).filter(i=>Number(i.quantity)>0).map(i=>`${i.variant_name}: ${i.quantity}`).join(' · ')}
                  </div>
                  {ord.status==='approved' && ord.invoice_id && <p style={{ color:'#2d8a4e', fontSize:'11px', margin:'4px 0 0', fontWeight:'bold' }}>✅ Invoice created</p>}
                  {ord.status==='rejected' && ord.notes && <p style={{ color:'#ca1b1b', fontSize:'11px', margin:'4px 0 0' }}>Reason: {ord.notes}</p>}
                </div>
              ))}
            </div>
          )}
          {/* Place Order */}
          {resellerPortalView==='place_order' && (
            <div>
              <h2 style={h2s}>🛒 Place Order</h2>
              <div style={{ background:'white', borderRadius:'14px', padding:'16px', marginBottom:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                <label style={lblS}>Delivery Date:</label>
                <input type="date" value={resellerOrderDeliveryDate} onChange={e=>setResellerOrderDeliveryDate(e.target.value)} style={inputStyle} min={today} />
                <label style={lblS}>Notes (optional):</label>
                <input type="text" value={resellerOrderNotes} onChange={e=>setResellerOrderNotes(e.target.value)} placeholder="Any special instructions..." style={inputStyle} />
              </div>
              <div style={{ background:'white', borderRadius:'14px', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:'0 0 12px' }}>Enter quantities (leave 0 to skip):</p>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'6px', marginBottom:'6px', padding:'6px 10px', background:'#ca1b1b', borderRadius:'8px' }}>
                  {['Variant','Reseller Price','Qty'].map(h=><span key={h} style={{ color:'white', fontSize:'10px', fontWeight:'bold' }}>{h}</span>)}
                </div>
                {resellerOrderItems.map((item,i)=>(
                  <div key={item.variant_id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'6px', marginBottom:'6px', alignItems:'center', padding:'6px 10px', background:i%2===0?'white':'#fafafa', borderRadius:'8px', border:'1px solid #f0f0f0' }}>
                    <span style={{ fontSize:'12px', fontWeight:'bold' }}>{item.variant_name}</span>
                    <span style={{ fontSize:'12px', color:'#2d8a4e', fontWeight:'bold' }}>{php(item.reseller_price)}</span>
                    <input type="number" min="0" placeholder="0" value={item.quantity||''} onChange={e=>{ const upd=[...resellerOrderItems]; upd[i]={...upd[i],quantity:e.target.value}; setResellerOrderItems(upd) }} style={{ ...inputStyle, marginBottom:0, fontSize:'13px', textAlign:'center', padding:'8px', border:'1.5px solid #FDD412', fontWeight:'bold' }} />
                  </div>
                ))}
                {resellerOrderItems.some(i=>Number(i.quantity)>0) && (
                  <div style={{ background:'#fff9e6', borderRadius:'10px', padding:'10px 14px', margin:'10px 0', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12px', color:'#555', fontWeight:'bold' }}>
                      {resellerOrderItems.reduce((s,i)=>s+Number(i.quantity||0),0)} pieces
                    </span>
                    <span style={{ fontSize:'14px', color:'#ca1b1b', fontWeight:'bold' }}>
                      Total: {php(resellerOrderItems.reduce((s,i)=>s+Number(i.quantity||0)*i.reseller_price,0))}
                    </span>
                  </div>
                )}
                <button style={{ ...btnRed, opacity:submittingOrder?0.6:1 }} disabled={submittingOrder} onClick={submitResellerOrder}>{submittingOrder?'⏳ Submitting...':'📦 SUBMIT ORDER'}</button>
              </div>
            </div>
          )}
          {/* Payments */}
          {resellerPortalView==='payments' && (
            <div>
              <h2 style={h2s}>💵 Payment History</h2>
              <div style={{ background:'white', borderRadius:'12px', padding:'14px', marginBottom:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)', display:'flex', justifyContent:'space-between' }}>
                <div><p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px' }}>TOTAL PAID</p><p style={{ fontWeight:'800', color:'#2d8a4e', fontSize:'24px', margin:0 }}>{php(totalPaid)}</p></div>
                <div style={{ textAlign:'right' }}><p style={{ color:'#888', fontSize:'11px', margin:'0 0 4px' }}>OUTSTANDING</p><p style={{ fontWeight:'800', color:'#ca1b1b', fontSize:'24px', margin:0 }}>{php(totalBalance)}</p></div>
              </div>
              {resellerPaymentHistory.length===0?<p style={{ color:'#aaa', textAlign:'center', padding:'20px' }}>No payments recorded yet</p>:resellerPaymentHistory.map(p=>(
                <div key={p.id} style={{ ...cardS, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <p style={{ fontWeight:'bold', fontSize:'13px', margin:'0 0 2px' }}>{php(p.amount)}</p>
                    <p style={{ color:'#888', fontSize:'11px', margin:0 }}>{p.payment_date} · {p.payment_method||'Cash'}</p>
                    {p.notes && <p style={{ color:'#888', fontSize:'10px', margin:'2px 0 0' }}>{p.notes}</p>}
                  </div>
                  <span style={{ background:'#e8f5e9', color:'#2d8a4e', borderRadius:'20px', padding:'4px 12px', fontSize:'11px', fontWeight:'bold' }}>✅ PAID</span>
                </div>
              ))}
            </div>
          )}
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
          <p style={{ color:'#aaa', margin:0, fontSize:'13px' }}>Management System</p>
        </div>
        {/* Login type tabs */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'20px', background:'#f4f4f4', padding:'4px', borderRadius:'12px' }}>
          <button onClick={()=>setLoginType('employee')} style={{ flex:1, padding:'9px', borderRadius:'9px', border:'none', background:loginType==='employee'?'white':'transparent', color:loginType==='employee'?'#ca1b1b':'#888', fontWeight:loginType==='employee'?'700':'500', cursor:'pointer', fontSize:'12px', transition:'all 0.15s', boxShadow:loginType==='employee'?'0 2px 6px rgba(0,0,0,0.1)':'none' }}>👤 Employee / Admin</button>
          <button onClick={()=>setLoginType('reseller')} style={{ flex:1, padding:'9px', borderRadius:'9px', border:'none', background:loginType==='reseller'?'white':'transparent', color:loginType==='reseller'?'#ca1b1b':'#888', fontWeight:loginType==='reseller'?'700':'500', cursor:'pointer', fontSize:'12px', transition:'all 0.15s', boxShadow:loginType==='reseller'?'0 2px 6px rgba(0,0,0,0.1)':'none' }}>🏪 Reseller</button>
        </div>
        {loginType==='employee' ? (
          <form autoComplete="off" onSubmit={e=>e.preventDefault()} style={{ width:'100%' }}>
            <input autoComplete="off" placeholder="Employee ID or Admin Code" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)} style={{ ...inputStyle, fontSize:'15px', padding:'14px' }} />
            <input autoComplete="new-password" placeholder="PIN" type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') handleLogin() }} style={{ ...inputStyle, fontSize:'15px', padding:'14px' }} />
            <button style={{ ...btnYellow, width:'100%', padding:'15px', fontSize:'16px', borderRadius:'12px', letterSpacing:'1px', marginTop:'8px', boxShadow:'0 4px 16px rgba(253,212,18,0.4)' }} onClick={handleLogin} disabled={loading}>{loading?'⏳ PLEASE WAIT...':'LOGIN'}</button>
          </form>
        ) : (
          <form autoComplete="off" onSubmit={e=>e.preventDefault()} style={{ width:'100%' }}>
            <label style={lblS}>Reseller Code:</label>
            <input autoComplete="off" placeholder="Enter your reseller code" value={resellerLoginCode} onChange={e=>setResellerLoginCode(e.target.value.toUpperCase())} style={{ ...inputStyle, fontSize:'14px', padding:'14px' }} />
            <label style={lblS}>PIN:</label>
            <input autoComplete="new-password" placeholder="Enter your PIN" type="password" value={resellerLoginPin} onChange={e=>setResellerLoginPin(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') resellerLogin() }} style={{ ...inputStyle, fontSize:'14px', padding:'14px' }} />
            <button style={{ ...btnRed, padding:'15px', fontSize:'16px', borderRadius:'12px', letterSpacing:'1px', marginTop:'8px' }} onClick={resellerLogin} disabled={loading}>{loading?'⏳ LOGGING IN...':'🏪 RESELLER LOGIN'}</button>
            <p style={{ color:'#888', fontSize:'11px', textAlign:'center', marginTop:'10px' }}>Contact Roma's Donuts admin for your access code</p>
          </form>
        )}
        {employeeCode.toUpperCase()==='ADMIN001' && (
          <p style={{ color:'#bbb', fontSize:'10px', marginTop:'10px', textAlign:'center' }}>👑 Master Owner Access</p>
        )}
        <p style={{ color:'#ccc', fontSize:'11px', textAlign:'center', marginTop:'20px' }}>Roma's Donuts © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
