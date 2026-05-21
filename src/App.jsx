import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hebbunlnzklavkkugtzs.supabase.co'
const supabaseKey = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYmJ1bmxuemtsYXZra3VndHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTU5MDgsImV4cCI6MjA5NDU5MTkwOH0.mdgYJBoRvHQcf-Tn-1AbTN-rnB5pPxOCSTxGlUrgJpg`
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour12: false }) }
function minutesFromTime(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m }
function roundPenaltyMinutes(minutes) {
  if (!minutes || minutes <= 10) return 0
  return Math.ceil(minutes / 30) * 30
}
function php(amount) {
  return `PHP ${Number(amount || 0).toFixed(2)}`
}

function EmployeeSelect({ value, onChange, employees }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">Select employee</option>
      {employees.map((emp) => (
        <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.employee_code}</option>
      ))}
    </select>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const today = getTodayDate()
  const isMobile = window.innerWidth <= 768

  // Auth
  const [employeeCode, setEmployeeCode] = useState('')
  const [pin, setPin] = useState('')
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(false)

  // Employee portal
  const [todayLog, setTodayLog] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState(null)
  const [myPayslips, setMyPayslips] = useState([])
  const [showLeaveRequest, setShowLeaveRequest] = useState(false)
  const [showPayslips, setShowPayslips] = useState(false)
  const [showCashAdvances, setShowCashAdvances] = useState(false)
  const [showCashAdvanceRequest, setShowCashAdvanceRequest] = useState(false)
  const [myCashAdvances, setMyCashAdvances] = useState([])
  const [requestCashAmount, setRequestCashAmount] = useState('')
  const [requestCashReason, setRequestCashReason] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')
  const [leaveType, setLeaveType] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [disputeReasons, setDisputeReasons] = useState({})
  const [showDisputeBox, setShowDisputeBox] = useState({})

  // Admin
  const [adminMode, setAdminMode] = useState(false)
  const [activeTab, setActiveTab] = useState('attendance')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Employees
  const [employees, setEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [editEmployeeCode, setEditEmployeeCode] = useState('')
  const [editEmployeeName, setEditEmployeeName] = useState('')
  const [editEmployeePosition, setEditEmployeePosition] = useState('')
  const [editEmployeePin, setEditEmployeePin] = useState('')
  const [editEmployeeRate, setEditEmployeeRate] = useState('')
  const [editEmployeeHasSss, setEditEmployeeHasSss] = useState(false)
  const [editEmployeeHasPagibig, setEditEmployeeHasPagibig] = useState(false)
  const [editEmployeeHasPhilhealth, setEditEmployeeHasPhilhealth] = useState(false)
  const [newEmployeeCode, setNewEmployeeCode] = useState('')
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeePosition, setNewEmployeePosition] = useState('')
  const [newEmployeePin, setNewEmployeePin] = useState('')
  const [newEmployeeRate, setNewEmployeeRate] = useState('')
  const [newEmployeeHasSss, setNewEmployeeHasSss] = useState(false)
  const [newEmployeeHasPagibig, setNewEmployeeHasPagibig] = useState(false)
  const [newEmployeeHasPhilhealth, setNewEmployeeHasPhilhealth] = useState(false)

  // Attendance
  const [adminLogs, setAdminLogs] = useState([])
  const [adminDate, setAdminDate] = useState(today)
  const [editingLog, setEditingLog] = useState(null)
  const [editTimeIn, setEditTimeIn] = useState('')
  const [editTimeOut, setEditTimeOut] = useState('')

  // Schedule
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [scheduleDate, setScheduleDate] = useState(today)
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')

  // Leave
  const [leaveRequests, setLeaveRequests] = useState([])
  const [showResolvedLeaves, setShowResolvedLeaves] = useState(false)
  const [resolvedLeaves, setResolvedLeaves] = useState([])

  // Cash advance
  const [cashAdvanceRequests, setCashAdvanceRequests] = useState([])
  const [installmentCounts, setInstallmentCounts] = useState({})
  const [showResolvedCA, setShowResolvedCA] = useState(false)
  const [resolvedCARequests, setResolvedCARequests] = useState([])

  // Disputes
  const [payslipDisputes, setPayslipDisputes] = useState([])
  const [showResolvedDisputes, setShowResolvedDisputes] = useState(false)
  const [resolvedDisputes, setResolvedDisputes] = useState([])

  // Adjustment
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

  // Effects
  useEffect(() => {
    if (employee) {
      loadTodayLog(employee)
      loadTodaySchedule(employee)
      loadMyPayslips(employee)
      loadMyCashAdvances(employee)
    }
  }, [employee])

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async function login() {
    setLoading(true)
    const { data, error } = await supabase.from('employees').select('*')
      .eq('employee_code', employeeCode.trim()).eq('pin', pin.trim()).eq('is_active', true).single()
    setLoading(false)
    if (error || !data) { alert('Invalid Employee ID or PIN'); return }
    setEmployee(data)
  }

  function logout() {
    setEmployee(null); setEmployeeCode(''); setPin('')
    setTodayLog(null); setTodaySchedule(null); setMyPayslips([])
  }

  function closeAllPanels() {
    setShowLeaveRequest(false); setShowPayslips(false)
    setShowCashAdvances(false); setShowCashAdvanceRequest(false)
  }

  // ─── Employee Portal ──────────────────────────────────────────────────────

  async function loadTodayLog(emp) {
    const { data } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).eq('attendance_date', today).maybeSingle()
    setTodayLog(data)
  }
  async function loadTodaySchedule(emp) {
    const { data } = await supabase.from('daily_schedules').select('*').eq('employee_id', emp.id).eq('schedule_date', today).maybeSingle()
    setTodaySchedule(data)
  }
  async function loadMyPayslips(emp) {
    const { data, error } = await supabase.from('payroll_records').select('*').eq('employee_id', emp.id).order('payroll_start', { ascending: false })
    if (error) { console.log(error); return }
    setMyPayslips(data || [])
  }
  async function loadMyCashAdvances(emp) {
    const { data } = await supabase.from('cash_advance_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false })
    setMyCashAdvances(data || [])
  }

  async function timeIn() {
    setLoading(true)
    const { data: existing } = await supabase.from('attendance_logs').select('*').eq('employee_id', employee.id).eq('attendance_date', today).maybeSingle()
    if (existing) { setLoading(false); setTodayLog(existing); alert('You already timed in today.'); return }
    let lateMinutes = 0, status = 'No Assigned Shift'
    if (todaySchedule?.shift_start) {
      const cur = minutesFromTime(nowTime()), shiftS = minutesFromTime(todaySchedule.shift_start)
      lateMinutes = Math.max(0, cur - shiftS)
      status = lateMinutes > 0 ? 'Late' : 'On Time'
    }
    const { data, error } = await supabase.from('attendance_logs').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      attendance_date: today, shift_start: todaySchedule?.shift_start || null, shift_end: todaySchedule?.shift_end || null,
      time_in: nowTime(), late_minutes: lateMinutes, status
    }).select().single()
    setLoading(false)
    if (error) { alert('Time In failed'); return }
    setTodayLog(data); alert('Time In saved successfully')
  }

  async function timeOut() {
    if (!todayLog) { alert('You need to Time In first.'); return }
    if (todayLog.time_out) { alert('You already timed out today.'); return }
    setLoading(true)
    let undertimeMinutes = 0, overtimeMinutes = 0
    let status = todayLog.late_minutes > 0 ? 'Late' : 'Completed'
    if (todaySchedule?.shift_end) {
      const cur = minutesFromTime(nowTime()), shiftE = minutesFromTime(todaySchedule.shift_end)
      const diff = cur - shiftE
      undertimeMinutes = diff < 0 ? Math.abs(diff) : 0
      overtimeMinutes = diff > 0 ? diff : 0
      if (undertimeMinutes > 0) status = 'Undertime'
      if (overtimeMinutes > 0) status = 'Overtime'
    }
    const { data, error } = await supabase.from('attendance_logs')
      .update({ time_out: nowTime(), undertime_minutes: undertimeMinutes, overtime_minutes: overtimeMinutes, status })
      .eq('id', todayLog.id).select().single()
    setLoading(false)
    if (error) { alert('Time Out failed'); return }
    setTodayLog(data); alert('Time Out saved successfully')
  }

  async function submitLeaveRequest() {
    if (!leaveStartDate || !leaveEndDate || !leaveType || !leaveReason) { alert('Please complete all leave request details'); return }
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
    const startD = new Date(leaveStartDate); startD.setHours(0, 0, 0, 0)
    if ((startD - todayMid) / (1000 * 60 * 60 * 24) < 2) { alert('Leave requests must be filed at least 3 days in advance.'); return }
    const durationDays = Math.ceil((new Date(leaveEndDate) - new Date(leaveStartDate)) / (1000 * 60 * 60 * 24)) + 1
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      leave_start: leaveStartDate, leave_end: leaveEndDate, duration_days: durationDays,
      leave_type: leaveType, reason: leaveReason, status: 'pending'
    })
    if (error) { alert(error.message); return }
    alert('Leave request submitted successfully')
    setLeaveStartDate(''); setLeaveEndDate(''); setLeaveType(''); setLeaveReason('')
    setShowLeaveRequest(false)
  }

  async function submitCashAdvanceRequest() {
    if (!requestCashAmount || !requestCashReason) { alert('Please enter amount and reason.'); return }
    const amount = Number(requestCashAmount)
    if (amount <= 0) { alert('Amount must be greater than 0.'); return }
    const { error } = await supabase.from('cash_advance_requests').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      amount, reason: requestCashReason, status: 'pending'
    })
    if (error) { alert('Failed to submit: ' + error.message); return }
    alert('Request submitted! Please wait for admin approval.')
    setRequestCashAmount(''); setRequestCashReason(''); setShowCashAdvanceRequest(false)
    loadMyCashAdvances(employee)
  }

  async function agreePayslip(payId) {
    const { error } = await supabase.from('payroll_records').update({ employee_acknowledgement: 'agreed' }).eq('id', payId)
    if (error) { alert('Failed: ' + error.message); return }
    alert('Payslip acknowledged!'); loadMyPayslips(employee)
  }

  async function submitPayslipDispute(pay) {
    const reason = disputeReasons[pay.id]
    if (!reason?.trim()) { alert('Please enter your reason for disagreement.'); return }
    const { error } = await supabase.from('payslip_disputes').insert({
      employee_id: employee.id, employee_code: employee.employee_code, employee_name: employee.full_name,
      payroll_record_id: String(pay.id), payroll_start: pay.payroll_start, payroll_end: pay.payroll_end,
      reason, status: 'pending'
    })
    if (error) { alert('Failed to submit dispute: ' + error.message); return }
    await supabase.from('payroll_records').update({ employee_acknowledgement: 'disputed' }).eq('id', pay.id)
    alert('Dispute submitted. Admin will review it.')
    setShowDisputeBox(p => ({ ...p, [pay.id]: false }))
    setDisputeReasons(p => ({ ...p, [pay.id]: '' }))
    loadMyPayslips(employee)
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  function openAdmin() {
    setAdminMode(true); setEmployeeSearch(''); setSidebarOpen(false)
    loadEmployees(); loadAdminLogs(); loadLeaveRequests(); loadCashAdvanceRequests()
  }

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('*').eq('is_active', true).order('full_name')
    setEmployees(data || [])
  }

  async function loadAdminLogs() {
    const { data } = await supabase.from('attendance_logs').select('*').eq('attendance_date', adminDate).order('created_at', { ascending: false })
    setAdminLogs(data || [])
  }

  async function saveAttendanceEdit(logId) {
    if (!editTimeIn) { alert('Time In is required.'); return }
    const log = adminLogs.find(l => l.id === logId)
    let lateMinutes = 0, undertimeMinutes = 0, overtimeMinutes = 0, status = 'No Assigned Shift'
    if (log?.shift_start && editTimeIn) {
      const cur = minutesFromTime(editTimeIn), shiftS = minutesFromTime(log.shift_start)
      lateMinutes = Math.max(0, cur - shiftS)
      status = lateMinutes > 0 ? 'Late' : 'On Time'
    }
    if (log?.shift_end && editTimeOut) {
      const cur = minutesFromTime(editTimeOut), shiftE = minutesFromTime(log.shift_end)
      const diff = cur - shiftE
      undertimeMinutes = diff < 0 ? Math.abs(diff) : 0
      overtimeMinutes = diff > 0 ? diff : 0
      if (undertimeMinutes > 0) status = 'Undertime'
      if (overtimeMinutes > 0) status = 'Overtime'
      if (lateMinutes > 0 && overtimeMinutes === 0 && undertimeMinutes === 0) status = 'Late'
    }
    const { error } = await supabase.from('attendance_logs').update({
      time_in: editTimeIn, time_out: editTimeOut || null,
      late_minutes: lateMinutes, undertime_minutes: undertimeMinutes,
      overtime_minutes: overtimeMinutes, status
    }).eq('id', logId)
    if (error) { alert('Failed to update: ' + error.message); return }
    alert('Attendance updated successfully!')
    setEditingLog(null); loadAdminLogs()
  }

  async function loadLeaveRequests() {
    const { data } = await supabase.from('leave_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setLeaveRequests(data || [])
  }
  async function loadResolvedLeaves() {
    const { data } = await supabase.from('leave_requests').select('*').in('status', ['approved', 'disapproved']).order('created_at', { ascending: false })
    setResolvedLeaves(data || [])
  }
  async function updateLeaveStatus(id, status) {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (error) { alert(error.message); return }
    alert(`Leave request ${status}`)
    loadLeaveRequests()
  }

  async function saveEmployeeChanges() {
    try {
      const { error } = await supabase.from('employees').update({
        employee_code: editEmployeeCode, full_name: editEmployeeName, position: editEmployeePosition,
        pin: editEmployeePin, daily_rate: Number(editEmployeeRate),
        has_sss: editEmployeeHasSss, has_pagibig: editEmployeeHasPagibig, has_philhealth: editEmployeeHasPhilhealth
      }).eq('id', editingEmployeeId)
      if (error) { alert(error.message); return }
      setEmployees(prev => prev.map(emp => emp.id === editingEmployeeId
        ? { ...emp, employee_code: editEmployeeCode, full_name: editEmployeeName, position: editEmployeePosition, pin: editEmployeePin, daily_rate: Number(editEmployeeRate), has_sss: editEmployeeHasSss, has_pagibig: editEmployeeHasPagibig, has_philhealth: editEmployeeHasPhilhealth }
        : emp))
      setEditingEmployeeId('')
      alert('Employee updated successfully!')
    } catch (err) { alert(err.message) }
  }

  async function addEmployee() {
    if (!newEmployeeCode || !newEmployeeName || !newEmployeePosition || !newEmployeePin) { alert('Please complete employee details'); return }
    const { error } = await supabase.from('employees').insert({
      employee_code: newEmployeeCode.toUpperCase(), full_name: newEmployeeName, position: newEmployeePosition,
      pin: newEmployeePin, daily_rate: Number(newEmployeeRate || 0), is_active: true,
      has_sss: newEmployeeHasSss, has_pagibig: newEmployeeHasPagibig, has_philhealth: newEmployeeHasPhilhealth
    })
    if (error) { alert('Failed to add employee: ' + error.message); return }
    alert('Employee added successfully')
    setNewEmployeeCode(''); setNewEmployeeName(''); setNewEmployeePosition('')
    setNewEmployeePin(''); setNewEmployeeRate('')
    setNewEmployeeHasSss(false); setNewEmployeeHasPagibig(false); setNewEmployeeHasPhilhealth(false)
    loadEmployees()
  }

  async function deactivateEmployee(empId, empName) {
    if (!window.confirm(`Are you sure you want to deactivate ${empName}?`)) return
    const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', empId)
    if (error) { alert(error.message); return }
    alert(`${empName} has been deactivated.`)
    loadEmployees()
  }

  async function saveSchedule() {
    if (!selectedEmployeeId || !scheduleDate || !shiftStart || !shiftEnd) { alert('Please complete all schedule fields.'); return }
    const { error } = await supabase.from('daily_schedules').upsert(
      { employee_id: selectedEmployeeId, schedule_date: scheduleDate, shift_start: shiftStart, shift_end: shiftEnd, notes: 'Admin assigned' },
      { onConflict: 'employee_id,schedule_date' }
    )
    if (error) { alert('Failed to save schedule: ' + error.message); return }
    alert('Schedule saved successfully')
    setSelectedEmployeeId(''); setShiftStart(''); setShiftEnd('')
  }

  async function saveAdjustment() {
    if (!adjustmentEmployeeId || !adjustmentDate || !adjustmentCategory || !adjustmentAmount) { alert('Please complete all adjustment fields.'); return }
    const emp = employees.find(e => e.id === adjustmentEmployeeId)
    const { error } = await supabase.from('payroll_adjustments').insert({
      employee_id: adjustmentEmployeeId, employee_code: emp?.employee_code || '', employee_name: emp?.full_name || '',
      adjustment_date: adjustmentDate, adjustment_type: adjustmentType,
      category: adjustmentCategory, amount: Number(adjustmentAmount), notes: adjustmentNotes
    })
    if (error) { alert('Failed to save adjustment: ' + error.message); return }
    alert('Adjustment saved successfully')
    setAdjustmentEmployeeId(''); setAdjustmentCategory(''); setAdjustmentAmount(''); setAdjustmentNotes('')
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
    if (!req) { alert('Request not found.'); return }
    const finalStatus = newStatus === 'approved' ? 'approved' : 'disapproved'
    const { error } = await supabase.from('cash_advance_requests').update({ status: finalStatus }).eq('id', id)
    if (error) { alert('Update failed: ' + error.message); return }
    if (newStatus === 'approved') {
      const totalAmount = Number(req.amount)
      const installments = Number(installmentCounts[id] || 1)
      const perPayroll = Math.ceil((totalAmount / installments) * 100) / 100
      const { error: caError } = await supabase.from('cash_advances').insert({
        employee_id: req.employee_id, employee_code: req.employee_code, employee_name: req.employee_name,
        advance_date: today, amount: totalAmount, amount_paid: 0, balance: totalAmount,
        per_payroll_deduction: perPayroll, installments_total: installments, installments_remaining: installments,
        notes: req.reason, status: 'Unpaid'
      })
      if (caError) { alert('Approved but failed to create deduction: ' + caError.message); return }
      alert(`Approved! ${php(perPayroll)} will be deducted for ${installments} payroll(s).`)
    } else { alert('Disapproved.') }
    loadCashAdvanceRequests()
  }

  async function loadPayslipDisputes() {
    const { data } = await supabase.from('payslip_disputes').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setPayslipDisputes(data || [])
  }
  async function loadResolvedDisputes() {
    const { data } = await supabase.from('payslip_disputes').select('*').eq('status', 'resolved').order('created_at', { ascending: false })
    setResolvedDisputes(data || [])
  }

  function applyPayrollCutoff() {
    const [year, month] = payrollMonth.split('-').map(Number)
    if (payrollCutoff === '11-25') {
      setPayrollStart(`${year}-${String(month).padStart(2, '0')}-11`)
      setPayrollEnd(`${year}-${String(month).padStart(2, '0')}-25`)
    } else {
      const start = new Date(year, month - 1, 26)
      const end = new Date(year, month, 10)
      setPayrollStart(start.toISOString().slice(0, 10))
      setPayrollEnd(end.toISOString().slice(0, 10))
    }
  }

  async function computePayroll() {
    // Prevent duplicate payroll for same period
    const { data: existing } = await supabase.from('payroll_records')
      .select('id').eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd).limit(1)
    if (existing && existing.length > 0) {
      if (!window.confirm(`Payroll for ${payrollStart} to ${payrollEnd} already exists. Overwrite?`)) return
      await supabase.from('payroll_records').delete().eq('payroll_start', payrollStart).eq('payroll_end', payrollEnd)
    }

    setPayrollComputing(true)
    const { data: employeeList } = await supabase.from('employees').select('*').eq('is_active', true)
    const results = []

    // Cutoff type: 11-25 = SSS only, 26-10 = Pag-IBIG + PhilHealth
    const startDay = Number(payrollStart.split('-')[2])
    const isFirstCutoff = startDay >= 11 && startDay <= 25
    const isSecondCutoff = !isFirstCutoff

    for (const emp of employeeList || []) {
      const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).gte('attendance_date', payrollStart).lte('attendance_date', payrollEnd)
      const { data: leaves } = await supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').gte('leave_start', payrollStart).lte('leave_end', payrollEnd)
      const { data: cashAdvances } = await supabase.from('cash_advances').select('*').eq('employee_id', emp.id).eq('status', 'Unpaid')
      const { data: adjustments } = await supabase.from('payroll_adjustments').select('*').eq('employee_id', emp.id).gte('adjustment_date', payrollStart).lte('adjustment_date', payrollEnd)

      const workedDays = logs?.filter(l => l.time_in).length || 0
      const paidLeaveDays = leaves?.filter(l => l.is_paid).length || 0
      const rawLate = logs?.reduce((s, l) => s + Number(l.late_minutes || 0), 0) || 0
      const rawUndertime = logs?.reduce((s, l) => s + Number(l.undertime_minutes || 0), 0) || 0
      const lateMinutes = roundPenaltyMinutes(rawLate)
      const undertimeMinutes = roundPenaltyMinutes(rawUndertime)
      const overtimeMinutes = logs?.reduce((s, l) => s + Number(l.overtime_minutes || 0), 0) || 0

      const dailyRate = Number(emp.daily_rate || 0)
      const hourlyRate = dailyRate / 8
      const minuteRate = hourlyRate / 60

      const basicPay = (workedDays + paidLeaveDays) * dailyRate
      const lateDeduction = lateMinutes * minuteRate
      const undertimeDeduction = undertimeMinutes * minuteRate
      const overtimePay = overtimeMinutes * minuteRate * 1.25

      let cashAdvanceDeduction = 0
      for (const ca of cashAdvances || []) {
        cashAdvanceDeduction += ca.per_payroll_deduction ? Number(ca.per_payroll_deduction) : Number(ca.balance || 0)
      }

      let adjustmentEarnings = 0, adjustmentDeductions = 0
      for (const adj of adjustments || []) {
        if (adj.adjustment_type === 'addition') adjustmentEarnings += Number(adj.amount || 0)
        else adjustmentDeductions += Number(adj.amount || 0)
      }

      // Night differential — 10% extra for hours between 10PM-6AM
      let nightDiffPay = 0
      for (const log of logs || []) {
        if (log.time_in && log.time_out) {
          const timeInMins = minutesFromTime(log.time_in)
          const timeOutMins = minutesFromTime(log.time_out) + (minutesFromTime(log.time_out) < timeInMins ? 24 * 60 : 0)
          const nightStart = 22 * 60 // 10PM
          const nightEnd = 30 * 60   // 6AM next day (24+6)
          const overlapStart = Math.max(timeInMins, nightStart)
          const overlapEnd = Math.min(timeOutMins, nightEnd)
          if (overlapEnd > overlapStart) {
            nightDiffPay += (overlapEnd - overlapStart) * minuteRate * 0.10
          }
        }
      }

      const holidayPay = 0

      // Government deductions — split by cutoff
      // SSS: PHP 375 on 11-25 cutoff only
      const sssDeduction = workedDays > 0 && emp.has_sss && isFirstCutoff ? 375 : 0
      // Pag-IBIG: PHP 200 on 26-10 cutoff only
      const pagibigDeduction = workedDays > 0 && emp.has_pagibig && isSecondCutoff ? 200 : 0
      // PhilHealth: FIXED PHP 250 on 26-10 cutoff only
      const philhealthDeduction = workedDays > 0 && emp.has_philhealth && isSecondCutoff ? 250 : 0

      const totalEarnings = basicPay + overtimePay + nightDiffPay + holidayPay + adjustmentEarnings
      const totalDeductions = lateDeduction + undertimeDeduction + cashAdvanceDeduction + sssDeduction + pagibigDeduction + philhealthDeduction + adjustmentDeductions
      const netPay = totalEarnings - totalDeductions

      results.push({
        employeeId: emp.id, employeeName: emp.full_name, employeeCode: emp.employee_code,
        workedDays, paidLeaveDays, lateMinutes, undertimeMinutes, overtimeMinutes,
        basicPay, overtimePay, nightDiffPay, holidayPay, adjustmentEarnings, totalEarnings,
        lateDeduction, undertimeDeduction, cashAdvanceDeduction,
        sssDeduction, pagibigDeduction, philhealthDeduction, adjustmentDeductions, totalDeductions, netPay
      })
    }

    // Update cash advance balances
    for (const pay of results) {
      const { data: empCAs } = await supabase.from('cash_advances').select('*').eq('employee_id', pay.employeeId).eq('status', 'Unpaid')
      for (const ca of empCAs || []) {
        const deducted = ca.per_payroll_deduction ? Number(ca.per_payroll_deduction) : Number(ca.balance || 0)
        const newAmountPaid = Number(ca.amount_paid || 0) + deducted
        const newBalance = Math.max(0, Number(ca.balance || 0) - deducted)
        const newRemaining = Math.max(0, Number(ca.installments_remaining || 1) - 1)
        const newStatus = newBalance <= 0 || newRemaining <= 0 ? 'Paid' : 'Unpaid'
        await supabase.from('cash_advances').update({ amount_paid: newAmountPaid, balance: newBalance, installments_remaining: newRemaining, status: newStatus }).eq('id', ca.id)
      }
    }

    // Insert payroll records
    for (const pay of results) {
      await supabase.from('payroll_records').insert([{
        employee_id: pay.employeeId, employee_code: pay.employeeCode, employee_name: pay.employeeName,
        payroll_start: payrollStart, payroll_end: payrollEnd, worked_days: pay.workedDays,
        basic_pay: pay.basicPay, overtime_pay: pay.overtimePay, night_diff_pay: pay.nightDiffPay,
        holiday_pay: pay.holidayPay, other_earnings: pay.adjustmentEarnings, total_earnings: pay.totalEarnings,
        late_deduction: pay.lateDeduction, undertime_deduction: pay.undertimeDeduction,
        cash_advance_deduction: pay.cashAdvanceDeduction, sss_deduction: pay.sssDeduction,
        pagibig_deduction: pay.pagibigDeduction, philhealth_deduction: pay.philhealthDeduction,
        other_deductions: pay.adjustmentDeductions, total_deductions: pay.totalDeductions,
        net_pay: pay.netPay, employee_acknowledgement: 'pending'
      }])
    }

    // Payroll summary
    const summary = {
      totalEmployees: results.length,
      totalBasicPay: results.reduce((s, p) => s + p.basicPay, 0),
      totalOvertimePay: results.reduce((s, p) => s + p.overtimePay, 0),
      totalNightDiff: results.reduce((s, p) => s + p.nightDiffPay, 0),
      totalEarnings: results.reduce((s, p) => s + p.totalEarnings, 0),
      totalDeductions: results.reduce((s, p) => s + p.totalDeductions, 0),
      totalNetPay: results.reduce((s, p) => s + p.netPay, 0),
      totalSSS: results.reduce((s, p) => s + p.sssDeduction, 0),
      totalPagibig: results.reduce((s, p) => s + p.pagibigDeduction, 0),
      totalPhilhealth: results.reduce((s, p) => s + p.philhealthDeduction, 0),
      totalCashAdvance: results.reduce((s, p) => s + p.cashAdvanceDeduction, 0),
    }

    setPayrollResults(results)
    setPayrollSummary(summary)
    setPayrollComputing(false)
    alert('Payroll computed successfully!')
  }

  // ─── Render: Admin ────────────────────────────────────────────────────────

  if (adminMode) {
    const tabs = [
      ['attendance', '📋 Attendance'],
      ['employees', '👥 Employees'],
      ['schedule', '📅 Schedule'],
      ['adjustment', '⚙️ Adjustment'],
      ['payroll', '💰 Payroll'],
      ['thirteenth', '🎁 13th Month'],
      ['leaveRequests', '🏖️ Leave Requests 🔔'],
      ['cashRequests', '💵 CA Requests 🔔'],
      ['disputes', '⚠️ Disputes 🔔'],
    ]

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#ca1b1b,#fdd412)', padding: isMobile ? '0' : '20px', boxSizing: 'border-box' }}>
        <div style={{ background: 'white', borderRadius: isMobile ? '0' : '20px', width: '100%', maxWidth: '1300px', margin: '0 auto', minHeight: '100vh', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>

          {/* Mobile Header */}
          {isMobile && (
            <div style={{ background: '#ca1b1b', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>Admin Dashboard</span>
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                {sidebarOpen ? '✕' : '☰'}
              </button>
            </div>
          )}

          {/* Sidebar */}
          {(!isMobile || sidebarOpen) && (
            <div style={{ width: isMobile ? '100%' : '230px', background: '#fff8f8', borderRight: isMobile ? 'none' : '2px solid #eee', borderBottom: isMobile ? '2px solid #eee' : 'none', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              {!isMobile && (
                <>
                  <img src="/logo.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 6px' }} />
                  <h2 style={{ color: '#ca1b1b', textAlign: 'center', margin: '0 0 12px', fontSize: '15px' }}>Admin Dashboard</h2>
                </>
              )}
              {tabs.map(([key, label]) => (
                <button key={key} onClick={() => {
                  setActiveTab(key); setSidebarOpen(false)
                  if (key === 'leaveRequests') loadLeaveRequests()
                  if (key === 'cashRequests') loadCashAdvanceRequests()
                  if (key === 'disputes') loadPayslipDisputes()
                }} style={{ padding: '11px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: 'left', width: '100%', background: activeTab === key ? '#ca1b1b' : '#f0f0f0', color: activeTab === key ? 'white' : '#333' }}>
                  {label}
                </button>
              ))}
              <button style={{ padding: '11px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: 'left', width: '100%', background: '#222', color: 'white', marginTop: '10px' }} onClick={() => setAdminMode(false)}>← Back to Login</button>
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, padding: isMobile ? '16px' : '28px', overflowY: 'auto', maxHeight: isMobile ? 'none' : '95vh' }}>

            {/* ── Attendance ── */}
            {activeTab === 'attendance' && (
              <div>
                <h2 style={h2s}>Attendance Records</h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                  <input type="date" value={adminDate} onChange={e => setAdminDate(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} />
                  <button style={{ ...btnBlack, width: 'auto', padding: '10px 20px', marginTop: 0 }} onClick={loadAdminLogs}>LOAD</button>
                  <button style={{ ...btnGreen, width: 'auto', padding: '10px 20px', marginTop: 0 }} onClick={() => window.print()}>PRINT</button>
                </div>
                {adminLogs.length === 0 && <p style={{ color: '#888' }}>No records found for this date.</p>}
                {adminLogs.map(log => (
                  <div key={log.id} style={cardS}>
                    <strong style={{ color: '#ca1b1b', fontSize: '15px' }}>{log.employee_name}</strong>
                    <p style={cps}>Schedule: {log.shift_start || 'None'} – {log.shift_end || 'None'}</p>
                    <p style={cps}>Time In: <strong>{log.time_in || '—'}</strong> | Time Out: <strong>{log.time_out || '—'}</strong></p>
                    <p style={cps}>Late: {log.late_minutes || 0} min | Undertime: {log.undertime_minutes || 0} min | OT: {log.overtime_minutes || 0} min</p>
                    <p style={cps}>Status: <strong>{log.status}</strong></p>
                    {editingLog === log.id ? (
                      <div style={{ marginTop: '10px', background: '#f9f9f9', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ fontWeight: 'bold', color: '#ca1b1b', margin: '0 0 8px' }}>Edit Attendance:</p>
                        <label style={lblS}>Time In:</label>
                        <input type="time" value={editTimeIn} onChange={e => setEditTimeIn(e.target.value)} style={inputStyle} />
                        <label style={lblS}>Time Out (optional):</label>
                        <input type="time" value={editTimeOut} onChange={e => setEditTimeOut(e.target.value)} style={inputStyle} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button style={{ ...btnGreen, width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={() => saveAttendanceEdit(log.id)}>SAVE</button>
                          <button style={{ ...btnGray, width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={() => setEditingLog(null)}>CANCEL</button>
                        </div>
                      </div>
                    ) : (
                      <button style={{ ...btnYellow, marginTop: '8px' }} onClick={() => { setEditingLog(log.id); setEditTimeIn(log.time_in || ''); setEditTimeOut(log.time_out || '') }}>✏ EDIT</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Employees ── */}
            {activeTab === 'employees' && (
              <div>
                <h2 style={h2s}>Employees</h2>
                <input placeholder="Search name, code, or position..." value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} style={inputStyle} />
                {employeeSearch.trim() && (
                  <div style={{ marginBottom: '20px' }}>
                    {employees.filter(emp => `${emp.full_name} ${emp.employee_code} ${emp.position}`.toLowerCase().includes(employeeSearch.toLowerCase())).map(emp => (
                      <div key={emp.id} style={{ ...cardS, border: '2px solid #ca1b1b', background: '#fff8dc' }}>
                        <strong style={{ color: '#ca1b1b' }}>{emp.full_name}</strong>
                        <p style={cps}>{emp.employee_code} | {emp.position} | {php(emp.daily_rate)}/day</p>
                        <p style={cps}>{emp.has_sss ? '✅' : '❌'} SSS &nbsp;{emp.has_pagibig ? '✅' : '❌'} Pag-IBIG &nbsp;{emp.has_philhealth ? '✅' : '❌'} PhilHealth</p>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ color: '#ca1b1b', marginBottom: '10px' }}>Add New Employee</h3>
                <input placeholder="Employee Code" value={newEmployeeCode} onChange={e => setNewEmployeeCode(e.target.value)} style={inputStyle} />
                <input placeholder="Full Name" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} style={inputStyle} />
                <input placeholder="Position" value={newEmployeePosition} onChange={e => setNewEmployeePosition(e.target.value)} style={inputStyle} />
                <input placeholder="PIN" value={newEmployeePin} onChange={e => setNewEmployeePin(e.target.value)} style={inputStyle} />
                <input placeholder="Daily Rate (PHP)" type="number" value={newEmployeeRate} onChange={e => setNewEmployeeRate(e.target.value)} style={inputStyle} />
                <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                  <p style={{ fontWeight: 'bold', color: '#ca1b1b', margin: '0 0 8px' }}>Government Contributions:</p>
                  <label style={lblS}><input type="checkbox" checked={newEmployeeHasSss} onChange={e => setNewEmployeeHasSss(e.target.checked)} style={{ marginRight: '8px' }} />SSS — PHP 375 (deducted every 11–25 cutoff)</label>
                  <label style={lblS}><input type="checkbox" checked={newEmployeeHasPagibig} onChange={e => setNewEmployeeHasPagibig(e.target.checked)} style={{ marginRight: '8px' }} />Pag-IBIG — PHP 200 (deducted every 26–10 cutoff)</label>
                  <label style={lblS}><input type="checkbox" checked={newEmployeeHasPhilhealth} onChange={e => setNewEmployeeHasPhilhealth(e.target.checked)} style={{ marginRight: '8px' }} />PhilHealth — PHP 250 (deducted every 26–10 cutoff)</label>
                </div>
                <button style={btnGreen} onClick={addEmployee}>ADD EMPLOYEE</button>

                <h3 style={{ color: '#ca1b1b', marginTop: '25px', marginBottom: '10px' }}>Employee List</h3>
                <div style={{ maxHeight: '450px', overflowY: 'auto', border: '2px solid #ca1b1b', borderRadius: '10px', padding: '10px', background: '#fff8dc' }}>
                  {employees.map(emp => (
                    <div key={emp.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong style={{ color: '#ca1b1b', fontSize: '15px' }}>{emp.full_name}</strong>
                          <p style={cps}>{emp.employee_code} | {emp.position} | {php(emp.daily_rate)}/day</p>
                          <p style={cps}>{emp.has_sss ? '✅' : '❌'} SSS &nbsp;{emp.has_pagibig ? '✅' : '❌'} Pag-IBIG &nbsp;{emp.has_philhealth ? '✅' : '❌'} PhilHealth</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button style={btnYellow} onClick={() => { setEditingEmployeeId(emp.id); setEditEmployeeCode(emp.employee_code || ''); setEditEmployeeName(emp.full_name || ''); setEditEmployeePosition(emp.position || ''); setEditEmployeePin(emp.pin || ''); setEditEmployeeRate(emp.daily_rate || ''); setEditEmployeeHasSss(emp.has_sss || false); setEditEmployeeHasPagibig(emp.has_pagibig || false); setEditEmployeeHasPhilhealth(emp.has_philhealth || false) }}>✏ EDIT</button>
                          <button style={{ ...btnRed, width: 'auto', padding: '6px 10px', marginTop: 0, fontSize: '12px' }} onClick={() => deactivateEmployee(emp.id, emp.full_name)}>🚫 DEACTIVATE</button>
                        </div>
                      </div>
                      {editingEmployeeId === emp.id && (
                        <div style={{ marginTop: '12px', background: 'white', padding: '14px', borderRadius: '10px', border: '1px solid #ddd' }}>
                          <input style={inputStyle} placeholder="Employee Code" value={editEmployeeCode} onChange={e => setEditEmployeeCode(e.target.value)} />
                          <input style={inputStyle} placeholder="Full Name" value={editEmployeeName} onChange={e => setEditEmployeeName(e.target.value)} />
                          <input style={inputStyle} placeholder="Position" value={editEmployeePosition} onChange={e => setEditEmployeePosition(e.target.value)} />
                          <input style={inputStyle} placeholder="PIN" value={editEmployeePin} onChange={e => setEditEmployeePin(e.target.value)} />
                          <input style={inputStyle} placeholder="Daily Rate (PHP)" type="number" value={editEmployeeRate} onChange={e => setEditEmployeeRate(e.target.value)} />
                          <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                            <p style={{ fontWeight: 'bold', color: '#ca1b1b', margin: '0 0 8px' }}>Government Contributions:</p>
                            <label style={lblS}><input type="checkbox" checked={editEmployeeHasSss} onChange={e => setEditEmployeeHasSss(e.target.checked)} style={{ marginRight: '8px' }} />SSS — PHP 375 (every 11–25 cutoff)</label>
                            <label style={lblS}><input type="checkbox" checked={editEmployeeHasPagibig} onChange={e => setEditEmployeeHasPagibig(e.target.checked)} style={{ marginRight: '8px' }} />Pag-IBIG — PHP 200 (every 26–10 cutoff)</label>
                            <label style={lblS}><input type="checkbox" checked={editEmployeeHasPhilhealth} onChange={e => setEditEmployeeHasPhilhealth(e.target.checked)} style={{ marginRight: '8px' }} />PhilHealth — PHP 250 (every 26–10 cutoff)</label>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={saveEmployeeChanges} style={{ ...btnRed, width: 'auto', padding: '10px 18px', marginTop: 0 }}>SAVE</button>
                            <button onClick={() => setEditingEmployeeId('')} style={{ ...btnGray, width: 'auto', padding: '10px 18px', marginTop: 0 }}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Schedule ── */}
            {activeTab === 'schedule' && (
              <div>
                <h2 style={h2s}>Assign Daily Schedule</h2>
                <EmployeeSelect value={selectedEmployeeId} onChange={setSelectedEmployeeId} employees={employees} />
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={inputStyle} />
                <label style={lblS}>Shift Start:</label>
                <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} style={inputStyle} />
                <label style={lblS}>Shift End:</label>
                <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} style={inputStyle} />
                <button style={btnGreen} onClick={saveSchedule}>SAVE SCHEDULE</button>
              </div>
            )}

            {/* ── Adjustment ── */}
            {activeTab === 'adjustment' && (
              <div>
                <h2 style={h2s}>Payroll Adjustment</h2>
                <p style={{ color: '#888', marginBottom: '15px', fontSize: '13px' }}>Add bonuses or extra deductions for a specific employee. These will be applied automatically during payroll computation.</p>
                <EmployeeSelect value={adjustmentEmployeeId} onChange={setAdjustmentEmployeeId} employees={employees} />
                <input type="date" value={adjustmentDate} onChange={e => setAdjustmentDate(e.target.value)} style={inputStyle} />
                <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)} style={inputStyle}>
                  <option value="deduction">Deduction</option>
                  <option value="addition">Addition / Bonus</option>
                </select>
                <input placeholder="Category (e.g. Bonus, Uniform, Penalty)" value={adjustmentCategory} onChange={e => setAdjustmentCategory(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Amount (PHP)" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} style={inputStyle} />
                <input placeholder="Notes (optional)" value={adjustmentNotes} onChange={e => setAdjustmentNotes(e.target.value)} style={inputStyle} />
                <button style={btnGreen} onClick={saveAdjustment}>SAVE ADJUSTMENT</button>
              </div>
            )}

            {/* ── Payroll ── */}
            {activeTab === 'payroll' && (
              <div>
                <h2 style={h2s}>Payroll Computation</h2>
                <div style={{ background: '#fff8dc', border: '1px solid #f5c518', borderRadius: '10px', padding: '12px', marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                  <strong style={{ color: '#ca1b1b' }}>Cutoff Rules:</strong><br />
                  • 11–25 cutoff → SSS (PHP 375) deducted<br />
                  • 26–10 cutoff → Pag-IBIG (PHP 200) + PhilHealth (PHP 250) deducted<br />
                  • Only for employees with the contribution enabled
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} />
                  <select value={payrollCutoff} onChange={e => setPayrollCutoff(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }}>
                    <option value="11-25">11th – 25th (SSS Cutoff)</option>
                    <option value="26-10">26th – 10th (Pag-IBIG + PhilHealth Cutoff)</option>
                  </select>
                  <button style={{ ...btnGreen, width: 'auto', padding: '10px 18px', marginTop: 0 }} onClick={applyPayrollCutoff}>APPLY</button>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                  <div>
                    <label style={lblS}>From:</label>
                    <input type="date" value={payrollStart} onChange={e => setPayrollStart(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={lblS}>To:</label>
                    <input type="date" value={payrollEnd} onChange={e => setPayrollEnd(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <button style={{ ...btnBlack, width: 'auto', padding: '12px 24px', marginTop: 0 }} onClick={computePayroll} disabled={payrollComputing}>
                    {payrollComputing ? '⏳ COMPUTING...' : '🧮 COMPUTE PAYROLL'}
                  </button>
                  <button className="no-print" style={{ ...btnGreen, width: 'auto', padding: '12px 24px', marginTop: 0 }} onClick={() => window.print()}>🖨 PRINT ALL</button>
                </div>

                {/* Payroll Summary */}
                {payrollSummary && (
                  <div style={{ background: '#fff8dc', border: '2px solid #ca1b1b', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                    <h3 style={{ color: '#ca1b1b', margin: '0 0 14px' }}>📊 Payroll Summary</h3>
                    <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px' }}>{payrollStart} to {payrollEnd}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                      {[
                        ['Total Employees', payrollSummary.totalEmployees],
                        ['Total Basic Pay', php(payrollSummary.totalBasicPay)],
                        ['Total Overtime', php(payrollSummary.totalOvertimePay)],
                        ['Total Night Diff', php(payrollSummary.totalNightDiff)],
                        ['Total Earnings', php(payrollSummary.totalEarnings)],
                        ['Total SSS', php(payrollSummary.totalSSS)],
                        ['Total Pag-IBIG', php(payrollSummary.totalPagibig)],
                        ['Total PhilHealth', php(payrollSummary.totalPhilhealth)],
                        ['Total CA Deduction', php(payrollSummary.totalCashAdvance)],
                        ['Total Deductions', php(payrollSummary.totalDeductions)],
                        ['TOTAL NET PAY', php(payrollSummary.totalNetPay)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: 'white', borderRadius: '8px', padding: '10px 12px', border: '1px solid #eee' }}>
                          <p style={{ color: '#888', fontSize: '11px', margin: '0 0 3px' }}>{label}</p>
                          <p style={{ color: '#ca1b1b', fontWeight: 'bold', fontSize: '14px', margin: 0 }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {payrollResults.map(pay => (
                  <div key={pay.employeeCode} style={{ ...cardS, marginBottom: '24px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #ddd', fontFamily: 'monospace, sans-serif', fontSize: '13px' }}>
                      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '55px', height: '55px', objectFit: 'contain' }} />
                        <h2 style={{ margin: '4px 0', color: '#ca1b1b', fontSize: '17px' }}>Roma's Donuts</h2>
                        <strong>EMPLOYEE PAYSLIP</strong>
                        <p style={{ margin: '3px 0', color: '#666' }}>Period: {payrollStart} to {payrollEnd}</p>
                      </div>
                      <hr />
                      <p><strong>Employee:</strong> {pay.employeeName}</p>
                      <p><strong>Code:</strong> {pay.employeeCode}</p>
                      <p><strong>Worked Days:</strong> {pay.workedDays} | <strong>Paid Leave:</strong> {pay.paidLeaveDays} day(s)</p>
                      <hr />
                      <p style={{ color: 'green', fontWeight: 'bold' }}>EARNINGS</p>
                      <p>Basic Pay: {php(pay.basicPay)}</p>
                      <p>Overtime Pay: {php(pay.overtimePay)}</p>
                      <p>Night Differential: {php(pay.nightDiffPay)}</p>
                      <p>Bonus / Other Earnings: {php(pay.adjustmentEarnings)}</p>
                      <p><strong>Total Earnings: {php(pay.totalEarnings)}</strong></p>
                      <hr />
                      <p style={{ color: '#ca1b1b', fontWeight: 'bold' }}>DEDUCTIONS</p>
                      <p>Late ({pay.lateMinutes} min): {php(pay.lateDeduction)}</p>
                      <p>Undertime ({pay.undertimeMinutes} min): {php(pay.undertimeDeduction)}</p>
                      <p>Cash Advance: {php(pay.cashAdvanceDeduction)}</p>
                      {pay.sssDeduction > 0 && <p>SSS: {php(pay.sssDeduction)}</p>}
                      {pay.pagibigDeduction > 0 && <p>Pag-IBIG: {php(pay.pagibigDeduction)}</p>}
                      {pay.philhealthDeduction > 0 && <p>PhilHealth: {php(pay.philhealthDeduction)}</p>}
                      {pay.adjustmentDeductions > 0 && <p>Other Deductions: {php(pay.adjustmentDeductions)}</p>}
                      <p><strong>Total Deductions: {php(pay.totalDeductions)}</strong></p>
                      <hr />
                      <h3 style={{ color: '#ca1b1b', margin: '8px 0' }}>NET PAY: {php(pay.netPay)}</h3>
                      <button className="no-print" style={{ ...btnBlack, width: 'auto', padding: '8px 16px', marginTop: '8px' }} onClick={() => window.print()}>🖨 PRINT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── 13th Month ── */}
            {activeTab === 'thirteenth' && (
              <div>
                <h2 style={h2s}>13th Month Pay</h2>
                <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>Set the full year date range then click Compute. The system will sum all basic pay records for each employee within that range and divide by 12.</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                  <div>
                    <label style={lblS}>From:</label>
                    <input type="date" value={payrollStart} onChange={e => setPayrollStart(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={lblS}>To:</label>
                    <input type="date" value={payrollEnd} onChange={e => setPayrollEnd(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} />
                  </div>
                </div>
                <button style={btnGreen} onClick={async () => {
                  const { data: empList } = await supabase.from('employees').select('*').eq('is_active', true)
                  const r = []
                  for (const emp of empList || []) {
                    const { data: records } = await supabase.from('payroll_records').select('basic_pay').eq('employee_id', emp.id).gte('payroll_start', payrollStart).lte('payroll_end', payrollEnd)
                    const totalBasic = records?.reduce((s, rec) => s + Number(rec.basic_pay || 0), 0) || 0
                    r.push({ employeeName: emp.full_name, employeeCode: emp.employee_code, totalBasic, thirteenthMonth: totalBasic / 12 })
                  }
                  setPayrollResults(r)
                }}>COMPUTE 13TH MONTH</button>
                {payrollResults.map(pay => (
                  <div key={pay.employeeCode} style={cardS}>
                    <strong style={{ color: '#ca1b1b', fontSize: '15px' }}>{pay.employeeName}</strong>
                    <p style={cps}>Code: {pay.employeeCode}</p>
                    <p style={cps}>Total Basic Pay (Year): {php(pay.totalBasic)}</p>
                    <h3 style={{ color: '#ca1b1b', margin: '6px 0 0' }}>13th Month Pay: {php(pay.thirteenthMonth)}</h3>
                  </div>
                ))}
              </div>
            )}

            {/* ── Leave Requests ── */}
            {activeTab === 'leaveRequests' && (
              <div>
                <h2 style={h2s}>Leave Requests</h2>
                <button style={{ ...btnGreen, width: 'auto', padding: '10px 20px', marginBottom: '15px' }} onClick={loadLeaveRequests}>REFRESH</button>
                {leaveRequests.length === 0 && <p style={{ color: '#888' }}>No pending leave requests.</p>}
                {leaveRequests.map(req => (
                  <div key={req.id} style={{ ...cardS, border: '2px solid #ca1b1b', background: '#fff8dc' }}>
                    <strong style={{ color: '#ca1b1b', fontSize: '15px' }}>{req.employee_name}</strong>
                    <p style={cps}>Code: {req.employee_code}</p>
                    <p style={cps}>Leave: {req.leave_start} to {req.leave_end} ({req.duration_days} day(s))</p>
                    <p style={cps}>Type: {req.leave_type}</p>
                    <p style={cps}>Reason: {req.reason}</p>
                    <p style={{ fontWeight: 'bold', color: '#f5a623', margin: '4px 0' }}>Status: {req.status}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button style={{ ...btnGreen, width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={() => updateLeaveStatus(req.id, 'approved')}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={() => updateLeaveStatus(req.id, 'disapproved')}>❌ DISAPPROVE</button>
                    </div>
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop: '20px' }} onClick={async () => { await loadResolvedLeaves(); setShowResolvedLeaves(!showResolvedLeaves) }}>
                  {showResolvedLeaves ? '🔼 HIDE' : '🔽 VIEW'} APPROVED / REJECTED LEAVES
                </button>
                {showResolvedLeaves && (
                  <div style={{ marginTop: '10px' }}>
                    {resolvedLeaves.length === 0 && <p style={{ color: '#888' }}>No resolved leaves found.</p>}
                    {resolvedLeaves.map(req => (
                      <div key={req.id} style={{ ...cardS, border: '1px solid #ccc' }}>
                        <strong>{req.employee_name}</strong>
                        <p style={cps}>{req.leave_start} to {req.leave_end} | {req.leave_type}</p>
                        <p style={cps}>Reason: {req.reason}</p>
                        <p style={{ fontWeight: 'bold', color: req.status === 'approved' ? 'green' : 'red', margin: '4px 0' }}>Status: {req.status}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CA Requests ── */}
            {activeTab === 'cashRequests' && (
              <div>
                <h2 style={h2s}>Cash Advance Requests</h2>
                <button style={{ ...btnGreen, width: 'auto', padding: '10px 20px', marginBottom: '15px' }} onClick={loadCashAdvanceRequests}>REFRESH</button>
                {cashAdvanceRequests.length === 0 && <p style={{ color: '#888' }}>No pending cash advance requests.</p>}
                {cashAdvanceRequests.map(req => (
                  <div key={req.id} style={{ ...cardS, border: '2px solid #ca1b1b', background: '#fff8dc' }}>
                    <strong style={{ color: '#ca1b1b', fontSize: '15px' }}>{req.employee_name}</strong>
                    <p style={cps}>Code: {req.employee_code}</p>
                    <p style={cps}>Reason: {req.reason}</p>
                    <p style={{ color: '#ca1b1b', fontWeight: 'bold', fontSize: '17px', margin: '6px 0' }}>Amount: {php(req.amount)}</p>
                    <label style={lblS}>Number of Payroll Deductions:</label>
                    <input type="number" min="1" max="24" value={installmentCounts[req.id] || 1}
                      onChange={e => setInstallmentCounts(p => ({ ...p, [req.id]: Number(e.target.value) }))}
                      style={{ ...inputStyle, marginBottom: '4px' }} />
                    <p style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>
                      {php(Number(req.amount) / (installmentCounts[req.id] || 1))} per payroll cutoff
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ ...btnGreen, width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={() => updateCashAdvanceStatus(req.id, 'approved')}>✅ APPROVE</button>
                      <button style={{ ...btnRed, width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={() => updateCashAdvanceStatus(req.id, 'disapproved')}>❌ DISAPPROVE</button>
                    </div>
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop: '20px' }} onClick={async () => { await loadResolvedCARequests(); setShowResolvedCA(!showResolvedCA) }}>
                  {showResolvedCA ? '🔼 HIDE' : '🔽 VIEW'} APPROVED / DISAPPROVED REQUESTS
                </button>
                {showResolvedCA && (
                  <div style={{ marginTop: '10px' }}>
                    {resolvedCARequests.length === 0 && <p style={{ color: '#888' }}>No resolved requests found.</p>}
                    {resolvedCARequests.map(req => (
                      <div key={req.id} style={{ ...cardS, border: '1px solid #ccc' }}>
                        <strong>{req.employee_name}</strong>
                        <p style={cps}>Amount: {php(req.amount)} | Reason: {req.reason}</p>
                        <p style={{ fontWeight: 'bold', color: req.status === 'approved' ? 'green' : 'red', margin: '4px 0' }}>Status: {req.status}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Disputes ── */}
            {activeTab === 'disputes' && (
              <div>
                <h2 style={h2s}>Payslip Disputes</h2>
                <button style={{ ...btnGreen, width: 'auto', padding: '10px 20px', marginBottom: '15px' }} onClick={loadPayslipDisputes}>REFRESH</button>
                {payslipDisputes.length === 0 && <p style={{ color: '#888' }}>No pending disputes.</p>}
                {payslipDisputes.map(d => (
                  <div key={d.id} style={{ ...cardS, border: '2px solid #ca1b1b', background: '#fff8dc' }}>
                    <strong style={{ color: '#ca1b1b', fontSize: '15px' }}>{d.employee_name}</strong>
                    <p style={cps}>Code: {d.employee_code}</p>
                    <p style={cps}>Cutoff: {d.payroll_start} to {d.payroll_end}</p>
                    <p style={cps}>Reason: {d.reason}</p>
                    <p style={cps}>Filed: {new Date(d.created_at).toLocaleDateString()}</p>
                    <button style={{ ...btnGreen, width: 'auto', padding: '8px 16px', marginTop: '10px' }} onClick={async () => {
                      await supabase.from('payslip_disputes').update({ status: 'resolved' }).eq('id', d.id)
                      alert('Marked as resolved.'); loadPayslipDisputes()
                    }}>✅ MARK AS RESOLVED</button>
                  </div>
                ))}
                <button style={{ ...btnBlack, marginTop: '20px' }} onClick={async () => { await loadResolvedDisputes(); setShowResolvedDisputes(!showResolvedDisputes) }}>
                  {showResolvedDisputes ? '🔼 HIDE' : '🔽 VIEW'} RESOLVED DISPUTES
                </button>
                {showResolvedDisputes && (
                  <div style={{ marginTop: '10px' }}>
                    {resolvedDisputes.length === 0 && <p style={{ color: '#888' }}>No resolved disputes found.</p>}
                    {resolvedDisputes.map(d => (
                      <div key={d.id} style={{ ...cardS, border: '1px solid #ccc' }}>
                        <strong>{d.employee_name}</strong>
                        <p style={cps}>Cutoff: {d.payroll_start} to {d.payroll_end}</p>
                        <p style={cps}>Reason: {d.reason}</p>
                        <p style={{ fontWeight: 'bold', color: 'green', margin: '4px 0' }}>Status: resolved</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Employee Portal ──────────────────────────────────────────────

  if (employee) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, width: isMobile ? '100%' : '420px', maxWidth: '100%', margin: isMobile ? '0' : 'auto', borderRadius: isMobile ? '0' : '20px', minHeight: isMobile ? '100vh' : 'auto' }}>
          <img src="/logo.png" alt="Logo" style={logoStyle} />
          <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: '#ca1b1b', textAlign: 'center', margin: '0 0 2px' }}>{employee.full_name}</h2>
          <p style={{ color: '#888', margin: '0 0 12px', fontSize: '14px' }}>{employee.position}</p>

          <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>📅 Shift: {todaySchedule ? `${todaySchedule.shift_start} – ${todaySchedule.shift_end}` : 'No Assigned Shift'}</p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>🟢 Time In: <strong>{todayLog?.time_in || 'Not yet'}</strong></p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>🔴 Time Out: <strong>{todayLog?.time_out || 'Not yet'}</strong></p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>📌 Status: <strong>{todayLog?.status || 'No record yet'}</strong></p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '4px' }}>
            <button style={{ ...btnGreen, margin: 0, opacity: todayLog ? 0.5 : 1, fontSize: '14px' }} onClick={timeIn} disabled={loading || !!todayLog}>⏰ TIME IN</button>
            <button style={{ ...btnBlack, margin: 0, opacity: (!todayLog || todayLog?.time_out) ? 0.5 : 1, fontSize: '14px' }} onClick={timeOut} disabled={loading || !todayLog || !!todayLog?.time_out}>⏰ TIME OUT</button>
          </div>

          {/* File Leave Request */}
          <button style={{ ...btnRed, background: '#ca1b1b' }} onClick={() => { closeAllPanels(); setShowLeaveRequest(!showLeaveRequest) }}>🏖️ FILE LEAVE REQUEST</button>
          {showLeaveRequest && (
            <div style={{ marginTop: '10px', background: '#f9f9f9', padding: '14px', borderRadius: '12px', border: '1px solid #ddd', textAlign: 'left' }}>
              <input type="date" value={leaveStartDate} min={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} onChange={e => setLeaveStartDate(e.target.value)} style={inputStyle} />
              <input type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} style={inputStyle} />
              {leaveStartDate && leaveEndDate && (
                <p style={{ color: '#ca1b1b', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                  Duration: {Math.ceil((new Date(leaveEndDate) - new Date(leaveStartDate)) / (1000 * 60 * 60 * 24)) + 1} day(s)
                </p>
              )}
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)} style={inputStyle}>
                <option value="">Select Leave Type</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Vacation Leave">Vacation Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
              </select>
              <textarea placeholder="Reason for leave..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'none' }} />
              <button style={btnGreen} onClick={submitLeaveRequest}>SUBMIT LEAVE REQUEST</button>
            </div>
          )}

          {/* Request Cash Advance */}
          <button style={{ background: '#f5a623', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', width: '100%', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            onClick={() => { closeAllPanels(); setShowCashAdvanceRequest(!showCashAdvanceRequest) }}>
            💵 REQUEST CASH ADVANCE
          </button>
          {showCashAdvanceRequest && (
            <div style={{ marginTop: '10px', background: '#f9f9f9', padding: '14px', borderRadius: '12px', border: '1px solid #ddd', textAlign: 'left' }}>
              <p style={{ color: '#888', fontSize: '13px', margin: '0 0 10px' }}>Once approved, the amount will be deducted from your next payroll cutoff.</p>
              <input type="number" placeholder="Amount (PHP)" value={requestCashAmount} onChange={e => setRequestCashAmount(e.target.value)} style={inputStyle} />
              <textarea placeholder="Reason for cash advance..." value={requestCashReason} onChange={e => setRequestCashReason(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'none' }} />
              <button style={btnGreen} onClick={submitCashAdvanceRequest}>SUBMIT REQUEST</button>
            </div>
          )}

          {/* View My Cash Advances */}
          <button style={{ background: '#f5a623', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', width: '100%', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            onClick={() => { closeAllPanels(); setShowCashAdvances(!showCashAdvances) }}>
            {showCashAdvances ? '🔼 HIDE MY CASH ADVANCES' : '🔽 VIEW MY CASH ADVANCES'}
          </button>
          {showCashAdvances && (
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              {myCashAdvances.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>No cash advance requests found.</p>}
              {myCashAdvances.map(ca => (
                <div key={ca.id} style={cardS}>
                  <p style={cps}><strong>Amount:</strong> {php(ca.amount)}</p>
                  <p style={cps}><strong>Reason:</strong> {ca.reason}</p>
                  <p style={{ fontWeight: 'bold', fontSize: '13px', color: ca.status === 'approved' ? 'green' : ca.status === 'pending' ? '#f5a623' : '#ca1b1b', margin: '4px 0' }}>Status: {ca.status}</p>
                </div>
              ))}
            </div>
          )}

          {employee?.is_admin && (
            <button style={{ ...btnBlack, background: '#333' }} onClick={openAdmin}>🔧 ADMIN PANEL</button>
          )}

          {/* View My Payslips */}
          <button style={{ ...btnBlack, background: '#222' }} onClick={() => { closeAllPanels(); setShowPayslips(!showPayslips) }}>
            {showPayslips ? '🔼 HIDE PAYSLIPS' : '🔽 VIEW MY PAYSLIPS'}
          </button>
          {showPayslips && (
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              {myPayslips.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>No payslips found.</p>}
              {myPayslips.map(pay => (
                <div key={pay.id} style={cardS}>
                  <h3 style={{ color: '#ca1b1b', margin: '0 0 8px', fontSize: '15px' }}>Payslip</h3>
                  <p style={cps}>Period: {pay.payroll_start} to {pay.payroll_end}</p>
                  <p style={cps}>Basic Pay: {php(pay.basic_pay)}</p>
                  <p style={cps}>Total Earnings: {php(pay.total_earnings)}</p>
                  <p style={cps}>Total Deductions: {php(pay.total_deductions)}</p>
                  <h3 style={{ color: '#ca1b1b', margin: '6px 0' }}>Net Pay: {php(pay.net_pay)}</h3>
                  {pay.employee_acknowledgement === 'agreed' && <p style={{ color: 'green', fontWeight: 'bold', fontSize: '13px' }}>✅ You agreed to this payslip</p>}
                  {pay.employee_acknowledgement === 'disputed' && <p style={{ color: '#ca1b1b', fontWeight: 'bold', fontSize: '13px' }}>⚠️ You disputed this payslip</p>}
                  {(pay.employee_acknowledgement === 'pending' || !pay.employee_acknowledgement) && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 8px' }}>Please review and confirm this payslip.</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ ...btnGreen, width: 'auto', padding: '8px 14px', marginTop: 0, fontSize: '13px' }} onClick={() => agreePayslip(pay.id)}>✅ AGREE</button>
                        <button style={{ ...btnRed, width: 'auto', padding: '8px 14px', marginTop: 0, fontSize: '13px' }} onClick={() => setShowDisputeBox(p => ({ ...p, [pay.id]: !p[pay.id] }))}>❌ DISAGREE</button>
                      </div>
                      {showDisputeBox[pay.id] && (
                        <div style={{ marginTop: '10px' }}>
                          <textarea placeholder="Please explain why you disagree..." value={disputeReasons[pay.id] || ''} onChange={e => setDisputeReasons(p => ({ ...p, [pay.id]: e.target.value }))} style={{ ...inputStyle, minHeight: '70px', resize: 'none' }} />
                          <button style={btnRed} onClick={() => submitPayslipDispute(pay)}>SUBMIT DISPUTE</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button style={{ ...btnRed, marginTop: '20px', background: '#888' }} onClick={logout}>🚪 LOGOUT</button>
        </div>
      </div>
    )
  }

  // ─── Render: Login ────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, width: isMobile ? '95%' : '400px' }}>
        <img src="/logo.png" alt="Logo" style={logoStyle} />
        <h1 style={{ color: '#ca1b1b', margin: '0 0 4px', fontSize: isMobile ? '22px' : '26px' }}>Roma's Donuts</h1>
        <p style={{ color: '#888', margin: '0 0 20px', fontSize: '14px' }}>Payroll & Attendance System</p>
        <input placeholder="Employee ID" value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} style={inputStyle} />
        <input placeholder="PIN" type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} style={inputStyle} />
        <button style={btnRed} onClick={login} disabled={loading}>{loading ? 'PLEASE WAIT...' : 'LOGIN'}</button>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle = { minHeight: '100vh', background: 'linear-gradient(135deg,#ca1b1b,#fdd412)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }
const cardStyle = { background: 'white', padding: '25px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'center' }
const logoStyle = { width: '90px', height: '90px', objectFit: 'contain', marginBottom: '8px' }
const inputStyle = { width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' }
const cardS = { border: '1px solid #eee', padding: '14px', borderRadius: '12px', marginBottom: '12px', background: '#fafafa' }
const cps = { margin: '3px 0', color: '#555', fontSize: '13px' }
const h2s = { color: '#ca1b1b', marginTop: 0, marginBottom: '15px' }
const lblS = { display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#555', fontSize: '13px' }
const btnRed = { width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: '#ca1b1b', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', fontSize: '14px' }
const btnGreen = { ...btnRed, background: '#2d8a4e' }
const btnBlack = { ...btnRed, background: '#222' }
const btnGray = { ...btnRed, background: '#777' }
const btnYellow = { ...btnRed, background: '#f5c518', color: '#222', width: 'auto', padding: '6px 12px', marginTop: 0, fontSize: '13px' }
