import { useEffect, useRef, useState } from 'react'

import { scheduleSunday, staffScheduleDates } from './staffScheduleDates.js'

const marker = '[schedule:fixed]'
const cellStyle = {padding:8, border:'1px solid #ddd', verticalAlign:'top'}
export default function StaffScheduler({supabase, employees = [], today, onSaved}) {
 const [start, setStart] = useState(() => scheduleSunday(today))
 const [duration, setDuration] = useState('1week')
 const [rows, setRows] = useState({})
 const [busy, setBusy] = useState(true)
 const [saving, setSaving] = useState('')
 const [message, setMessage] = useState('')
 const [search, setSearch] = useState('')
 const lock = useRef(false)
 const generation = useRef(0)
 const dates = staffScheduleDates(start,duration)
 useEffect(() => {
  const version = ++generation.current
  setBusy(true); setMessage('')
  supabase.from('daily_schedules').select('*').gte('schedule_date',start).lte('schedule_date',dates[dates.length-1]).then(({data,error}) => {
   if (version !== generation.current) return
   if (error) {setRows({});setMessage(`Cannot load schedules: ${error.message}`);setBusy(false);return}
   const result = {}
   for (const emp of employees.filter(e=>e.is_active !== false)) {
    const stored = (data || []).filter(r=>r.employee_id === emp.id)
    result[emp.id] = {mode:stored.some(r=>String(r.notes || '').includes(marker))?'fixed':'variable', days:dates.map(date=>{
     const row = stored.find(r=>r.schedule_date === date)
     return {date, start:String(row?.shift_start || '').slice(0,5), end:String(row?.shift_end || '').slice(0,5), notes:row?.notes || '', exists:!!row}
    })}
   }
   setRows(result);setBusy(false)
  }).catch(error=>{if(version===generation.current){setMessage(error.message);setBusy(false)}})
  return ()=>{generation.current++}
 // Employees are refreshed by the existing admin loader.
 }, [start, duration, employees, supabase])
 function edit(id,index,key,value) {
  setRows(prev=>({...prev,[id]:{...prev[id],days:prev[id].days.map((d,i)=>i===index?{...d,[key]:value}:d)}}))
 }
 async function save(emp) {
  if (lock.current) return
  const row = rows[emp.id]
  let days = row.days
  if (row.mode === 'fixed') {
   const template = days.find(d=>d.date>=today)
   if (!template?.start || !template?.end) {setMessage('Enter the fixed start and end times.');return}
   days = days.map(d=>d.date>=today?{...d,start:template.start,end:template.end}:d)
  }
  const targets = days.filter(d=>d.date>=today && (d.start || d.end || d.exists))
  if (!targets.length) {setMessage('Enter at least one future schedule.');return}
  if (targets.some(d=>!d.start || !d.end || d.start===d.end)) {setMessage('Each scheduled day needs different start and end times. Overnight shifts are allowed.');return}
  lock.current=true;setSaving(emp.id);setMessage('')
  try {
   const {data:attendance,error:attendanceError} = await supabase.from('attendance_logs').select('id,attendance_date').eq('employee_id',emp.id).in('attendance_date',targets.map(d=>d.date)).not('time_in','is',null)
   if (attendanceError) throw attendanceError
   if (attendance?.length) throw new Error('A selected date already has a Time In. Adjust that attendance record through the existing correction process, or choose future dates.')
   const records = targets.map(d=>({employee_id:emp.id,schedule_date:d.date,shift_start:d.start,shift_end:d.end,notes:(d.notes.replaceAll(marker,'').trim()+(row.mode==='fixed'?` ${marker}`:'')).trim()}))
   const {data:saved,error} = await supabase.from('daily_schedules').upsert(records,{onConflict:'employee_id,schedule_date'}).select('employee_id,schedule_date,shift_start,shift_end,notes')
   if (error) throw error
   if (saved?.length !== records.length || records.some(r=>!saved.some(v=>v.schedule_date===r.schedule_date && String(v.shift_start).slice(0,5)===r.shift_start && String(v.shift_end).slice(0,5)===r.shift_end))) throw new Error('Save could not be fully verified. Reload before trying again.')
   setRows(prev=>({...prev,[emp.id]:{...row,days:days.map(d=>targets.some(t=>t.date===d.date)?{...d,exists:true}:d)}}))
   setMessage(`${emp.full_name}: ${records.length} dated schedule(s) saved and verified.`)
   await onSaved?.()
  } catch(error) {setMessage(`Save failed: ${error.message}`)}
  finally {lock.current=false;setSaving('')}
 }
 return <section style={{background:'white',border:'1px solid #ddd',borderRadius:12,padding:16,marginBottom:20}}>
  <h3 style={{marginTop:0,color:'#ca1b1b'}}>Staff Schedule Worksheet</h3>
  <p style={{fontSize:12}}>Fixed: repeat one start/end pair across the selected period. Variable: edit each day separately. Blank days are left unchanged. Past dates and dates already timed in cannot be changed here.</p>
  <label>Sunday starting <input aria-label="Week starting" type="date" value={start} disabled={!!saving} onChange={e=>e.target.value && setStart(scheduleSunday(e.target.value))} /></label>{' '}
  <label>Duration <select aria-label="Schedule duration" value={duration} disabled={!!saving} onChange={e=>setDuration(e.target.value)}><option value="1week">1 week</option><option value="2weeks">2 weeks</option><option value="3weeks">3 weeks</option><option value="1month">1 month</option></select></label>{' '}
  <p style={{fontSize:12}}>Schedule period: <strong>{dates[0]} to {dates[dates.length-1]}</strong> ({dates.length} days). Start dates are aligned to Sunday. Saved times connect automatically to staff attendance and late detection.</p>
  <input aria-label="Search staff" placeholder="Search staff" value={search} onChange={e=>setSearch(e.target.value)} />
  <p role="status">{busy?'Loading schedules…':message}</p>
  {!busy && <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
   <thead><tr><th style={cellStyle}>Employee</th><th style={cellStyle}>Schedule type</th>{dates.map(date=><th key={date} style={cellStyle}>{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH',{weekday:'short',timeZone:'UTC'})}<br />{date}</th>)}<th style={cellStyle}>Save</th></tr></thead>
   <tbody>{employees.filter(e=>e.is_active!==false && `${e.full_name} ${e.employee_code}`.toLowerCase().includes(search.toLowerCase())).map(emp=>{
    const row=rows[emp.id];if(!row)return null
    const firstEditable=row.days.findIndex(d=>d.date>=today)
    return <tr key={emp.id}><td style={cellStyle}>{emp.full_name}</td><td style={cellStyle}><select aria-label={`${emp.full_name} schedule type`} value={row.mode} disabled={!!saving} onChange={e=>setRows(prev=>({...prev,[emp.id]:{...prev[emp.id],mode:e.target.value}}))}><option value="fixed">Fixed schedule</option><option value="variable">Variable schedule</option></select></td>
     {row.days.map((d,i)=><td key={d.date} style={cellStyle}>{row.mode==='fixed' && d.date>=today && i!==firstEditable?<span>Same as first day</span>:<><input aria-label={`${emp.full_name} ${d.date} start`} type="time" value={d.start} disabled={!!saving || d.date<today} onChange={e=>edit(emp.id,i,'start',e.target.value)} /><input aria-label={`${emp.full_name} ${d.date} end`} type="time" value={d.end} disabled={!!saving || d.date<today} onChange={e=>edit(emp.id,i,'end',e.target.value)} /></>}</td>)}
     <td style={cellStyle}><button disabled={!!saving} onClick={()=>save(emp)}>{saving===emp.id?'Saving…':'Save row'}</button></td></tr>
   })}</tbody>
  </table></div>}
 </section>
}
