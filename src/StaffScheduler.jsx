import { useEffect, useRef, useState } from 'react'
import { scheduleDateAt, scheduleSunday, staffScheduleDates } from './staffScheduleDates.js'
import { scheduleRange, shiftLabel } from './staffScheduleRange.js'
import './staffScheduler.css'

const marker = '[schedule:fixed]'
export default function StaffScheduler({supabase, employees = [], today, onSaved}) {
 const [week, setWeek] = useState(()=>scheduleSunday(today))
 const [stored, setStored] = useState([])
 const [busy, setBusy] = useState(true)
 const [saving, setSaving] = useState(false)
 const [message, setMessage] = useState('')
 const [search, setSearch] = useState('')
 const [revision, setRevision] = useState(0)
 const [employeeId, setEmployeeId] = useState('')
 const [mode, setMode] = useState('variable')
 const [from, setFrom] = useState(today)
 const [until, setUntil] = useState(today)
 const [shiftStart, setShiftStart] = useState('')
 const [shiftEnd, setShiftEnd] = useState('')
 const lock = useRef(false)
 const dates = staffScheduleDates(week)
 const active = employees.filter(e=>e.is_active !== false)
 useEffect(()=>{
  let cancelled=false
  setBusy(true)
  supabase.from('daily_schedules').select('employee_id,schedule_date,shift_start,shift_end,notes').gte('schedule_date',week).lte('schedule_date',scheduleDateAt(week,6)).then(({data,error})=>{
   if(cancelled)return
   setStored(error?[]:data || []);setBusy(false)
   if(error)setMessage(`Cannot load schedules: ${error.message}`)
  }).catch(error=>{if(!cancelled){setMessage(`Cannot load schedules: ${error.message}`);setBusy(false)}})
  return ()=>{cancelled=true}
 },[week,revision,supabase])
 function selectDay(emp,date,row) {
  setEmployeeId(emp.id);setFrom(date);setUntil(date)
  setMode(String(row?.notes || '').includes(marker)?'fixed':'variable')
  setShiftStart(String(row?.shift_start || '').slice(0,5));setShiftEnd(String(row?.shift_end || '').slice(0,5))
  setMessage(`${emp.full_name}: choose times and an Until date, then Save & publish.`)
 }
 async function save(event) {
  event.preventDefault()
  if(lock.current)return
  const emp=active.find(e=>e.id===employeeId)
  if(!emp){setMessage('Select an employee.');return}
  if(!shiftStart || !shiftEnd || shiftStart===shiftEnd){setMessage('Enter different start and end times. Overnight shifts are allowed.');return}
  let targets
  try {targets=scheduleRange(from,until,today)}catch(error){setMessage(error.message);return}
  lock.current=true;setSaving(true);setMessage('')
  try {
   const {data:attendance,error:attendanceError}=await supabase.from('attendance_logs').select('id,attendance_date').eq('employee_id',employeeId).in('attendance_date',targets).not('time_in','is',null)
   if(attendanceError)throw attendanceError
   if(attendance?.length)throw new Error('A selected date already has a Time In. Choose future dates or use the attendance correction process.')
   const {data:previous,error:readError}=await supabase.from('daily_schedules').select('schedule_date,notes').eq('employee_id',employeeId).gte('schedule_date',from).lte('schedule_date',until)
   if(readError)throw readError
   const records=targets.map(date=>({employee_id:employeeId,schedule_date:date,shift_start:shiftStart,shift_end:shiftEnd,notes:((previous || []).find(r=>r.schedule_date===date)?.notes || '').replaceAll(marker,'').trim()+(mode==='fixed'?` ${marker}`:'')}))
   const {data:saved,error}=await supabase.from('daily_schedules').upsert(records,{onConflict:'employee_id,schedule_date'}).select('employee_id,schedule_date,shift_start,shift_end,notes')
   if(error)throw error
   if(saved?.length!==records.length || records.some(r=>!saved.some(v=>v.employee_id===r.employee_id && v.schedule_date===r.schedule_date && String(v.shift_start).slice(0,5)===r.shift_start && String(v.shift_end).slice(0,5)===r.shift_end)))throw new Error('Save could not be fully verified. Refresh before trying again.')
   setWeek(scheduleSunday(from));setRevision(n=>n+1)
   setMessage(`${emp.full_name}: ${from} to ${until} saved and published (${records.length} days). Available in their My Schedule portal.`)
   try {await onSaved?.()}catch { /* The schedule write is already verified; the week reload remains authoritative. */ }
  }catch(error){setMessage(`Save failed: ${error.message}`)}
  finally{lock.current=false;setSaving(false)}
 }
 return <section className="staff-scheduler">
  <h3>Staff Scheduler</h3>
  <p>View one week at a time. Select a day to edit it, or apply the same times to any date range below.</p>
  <form onSubmit={save} className="schedule-editor">
   <label>Employee<select aria-label="Schedule employee" required value={employeeId} disabled={saving} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{active.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label>
   <label>Schedule type<select aria-label="Schedule type" value={mode} disabled={saving} onChange={e=>setMode(e.target.value)}><option value="variable">Variable schedule</option><option value="fixed">Fixed schedule</option></select></label>
   <label>Apply from<input aria-label="Apply from" required type="date" min={today} value={from} disabled={saving} onChange={e=>{setFrom(e.target.value);if(e.target.value>until)setUntil(e.target.value)}} /></label>
   <label>Until (inclusive)<input aria-label="Apply until" required type="date" min={from || today} value={until} disabled={saving} onChange={e=>setUntil(e.target.value)} /></label>
   <label>Shift start<input aria-label="Shift start" required type="time" value={shiftStart} disabled={saving} onChange={e=>setShiftStart(e.target.value)} /></label>
   <label>Shift end<input aria-label="Shift end" required type="time" value={shiftEnd} disabled={saving} onChange={e=>setShiftEnd(e.target.value)} /></label>
   <button type="submit" disabled={saving}>{saving?'Saving…':'Save & publish'}</button>
   <small>Times apply every day from Apply from through Until, including both dates. Change a single day later for an exception. Saved schedules appear in the employee portal and determine lateness.</small>
  </form>
  <p role="status" aria-live="polite">{message}</p>
  <div className="schedule-toolbar"><button disabled={saving} onClick={()=>setWeek(scheduleDateAt(week,-7))}>Previous week</button><label>Week of<input aria-label="Week starting" type="date" value={week} disabled={saving} onChange={e=>e.target.value && setWeek(scheduleSunday(e.target.value))} /></label><button disabled={saving} onClick={()=>setWeek(scheduleDateAt(week,7))}>Next week</button><input aria-label="Search staff" placeholder="Search staff" value={search} onChange={e=>setSearch(e.target.value)} /></div>
  <p className="schedule-caption">Sunday–Saturday · {dates[0]} to {dates[6]}</p>
  {busy?<p>Loading schedules…</p>:<div className="schedule-table-wrap"><table><thead><tr><th>Employee</th>{dates.map(date=><th key={date}>{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}</th>)}</tr></thead><tbody>{active.filter(e=>`${e.full_name} ${e.employee_code || ''}`.toLowerCase().includes(search.toLowerCase())).map(emp=><tr key={emp.id}><th scope="row">{emp.full_name}</th>{dates.map(date=>{const row=stored.find(r=>r.employee_id===emp.id && r.schedule_date===date);return <td key={date}><button aria-label={`${emp.full_name} ${date} schedule`} disabled={saving || date<today} onClick={()=>selectDay(emp,date,row)}>{row?shiftLabel(row):'—'}</button></td>})}</tr>)}</tbody></table></div>}
 </section>
}
