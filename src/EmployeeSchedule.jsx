import { useEffect, useState } from 'react'
import { scheduleDateAt, scheduleSunday, staffScheduleDates } from './staffScheduleDates.js'
import { shiftLabel } from './staffScheduleRange.js'

export default function EmployeeSchedule({supabase, employeeId, today}) {
 const [week,setWeek]=useState(()=>scheduleSunday(today))
 const [open,setOpen]=useState(false)
 const [rows,setRows]=useState([])
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [revision,setRevision]=useState(0)
 const dates=staffScheduleDates(week)
 useEffect(()=>{
  if(!open || !employeeId)return
  let cancelled=false, sequence=0
  async function load() {
   const version=++sequence
   setLoading(true)
   try {
    const {data,error:queryError}=await supabase.from('daily_schedules').select('schedule_date,shift_start,shift_end').eq('employee_id',employeeId).gte('schedule_date',week).lte('schedule_date',scheduleDateAt(week,6)).order('schedule_date')
    if(cancelled || version!==sequence)return
    setRows(queryError?[]:data || []);setError(queryError?`Cannot load your schedule: ${queryError.message}`:'')
   }catch(err){if(!cancelled && version===sequence){setRows([]);setError(`Cannot load your schedule: ${err.message}`)}}
   finally{if(!cancelled && version===sequence)setLoading(false)}
  }
  const refresh=()=>{if(document.visibilityState!=='hidden')load()}
  load()
  const timer=setInterval(refresh,60000)
  window.addEventListener('focus',refresh)
  document.addEventListener('visibilitychange',refresh)
  return ()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
 },[supabase,employeeId,week,open,revision])
 return <section style={{border:'1px solid #e0e0e0',borderRadius:12,padding:14,margin:'12px 0',textAlign:'left',background:'#fff'}}>
  <button onClick={()=>setOpen(v=>!v)} aria-expanded={open} style={{width:'100%',border:0,background:'transparent',textAlign:'left',fontWeight:700,color:'#ca1b1b',fontSize:14,cursor:'pointer'}}>My Schedule {open?'▴':'▾'}</button>
  {open && <>
   <p style={{fontSize:12,color:'#666'}}>Your published work schedule. Updates refresh automatically while this view is open.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
    <button aria-label="My schedule previous week" onClick={()=>setWeek(scheduleDateAt(week,-7))}>Previous</button>
    <label style={{fontSize:12}}>Week of <input aria-label="My schedule week" type="date" value={week} onChange={e=>e.target.value && setWeek(scheduleSunday(e.target.value))} /></label>
    <button aria-label="My schedule next week" onClick={()=>setWeek(scheduleDateAt(week,7))}>Next</button>
    <button onClick={()=>setRevision(n=>n+1)}>Refresh</button>
   </div>
   <p role="status" style={{fontSize:12}}>{loading?'Loading your schedule…':error}</p>
   {!loading && !error && <div style={{display:'grid',gap:6}}>{dates.map(date=>{const row=rows.find(r=>r.schedule_date===date);return <div key={date} style={{border:'1px solid #eee',borderRadius:8,padding:10,background:date===today?'#fff8dc':'#fafafa'}}><strong style={{fontSize:12}}>{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'})}{date===today?' · Today':''}</strong><div style={{fontSize:13,marginTop:4}}>{shiftLabel(row)}</div></div>})}</div>}
  </>}
 </section>
}
