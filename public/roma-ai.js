(() => {
  'use strict'
  if (window.__ROMA_AI_LOADED__) return
  window.__ROMA_AI_LOADED__ = true

  const VERSION = '2026.08.12.10-restored'
  const MANILA_TZ = 'Asia/Manila'
  const php = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0
  const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
  const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  const manilaNow = () => new Date(new Date().toLocaleString('en-US', { timeZone:MANILA_TZ }))
  const addDays = (date, amount) => { const copy = new Date(date); copy.setDate(copy.getDate()+amount); return copy }
  const monthNames = {
    january:0, jan:0, enero:0, february:1, feb:1, pebrero:1, march:2, mar:2, marzo:2,
    april:3, apr:3, abril:3, may:4, mayo:4, june:5, jun:5, hunyo:5, july:6, jul:6, hulyo:6,
    august:7, aug:7, agosto:7, september:8, sep:8, setyembre:8, october:9, oct:9, oktubre:9,
    november:10, nov:10, nobyembre:10, december:11, dec:11, disyembre:11
  }

  function getBridge() { return window.__ROMA_AI_BRIDGE__ || null }
  function getContext() { return getBridge()?.getContext?.() || { role:'guest', isOwner:false, userName:'User' } }
  function hasAny(text, words) { const clean = norm(text); return words.some(word => clean.includes(norm(word))) }
  function rangeLabel(range) { return range.start === range.end ? range.start : `${range.start} to ${range.end}` }

  function resolveDateRange(message) {
    const clean = norm(message)
    const now = manilaNow()
    const yearHit = clean.match(/\b(20\d{2})\b/)
    const explicit = clean.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})(?:\s+(?:to|hanggang|through|-)\s+(?:(20\d{2})-(\d{1,2})-(\d{1,2})|(\d{1,2})))?\b/)
    if (explicit) {
      const start = `${explicit[1]}-${String(explicit[2]).padStart(2,'0')}-${String(explicit[3]).padStart(2,'0')}`
      let end = start
      if (explicit[4]) end = `${explicit[4]}-${String(explicit[5]).padStart(2,'0')}-${String(explicit[6]).padStart(2,'0')}`
      else if (explicit[7]) end = `${explicit[1]}-${String(explicit[2]).padStart(2,'0')}-${String(explicit[7]).padStart(2,'0')}`
      return { start, end, source:'explicit date' }
    }
    if (hasAny(clean, ['today','ngayon','araw na ito'])) return { start:iso(now), end:iso(now), source:'today' }
    if (hasAny(clean, ['yesterday','kahapon'])) { const day=addDays(now,-1); return { start:iso(day), end:iso(day), source:'yesterday' } }
    if (hasAny(clean, ['this week','week na ito','ngayong linggo'])) {
      const monday=addDays(now,-((now.getDay()+6)%7)); return { start:iso(monday), end:iso(addDays(monday,6)), source:'this week' }
    }
    if (hasAny(clean, ['last week','previous week','nakaraang linggo'])) {
      const monday=addDays(now,-((now.getDay()+6)%7)-7); return { start:iso(monday), end:iso(addDays(monday,6)), source:'last week' }
    }
    if (hasAny(clean, ['current cutoff','this cutoff','cutoff na ito'])) {
      if (now.getDate() >= 11 && now.getDate() <= 25) return { start:iso(new Date(now.getFullYear(),now.getMonth(),11)), end:iso(new Date(now.getFullYear(),now.getMonth(),25)), source:'current cutoff' }
      if (now.getDate() >= 26) return { start:iso(new Date(now.getFullYear(),now.getMonth(),26)), end:iso(new Date(now.getFullYear(),now.getMonth()+1,10)), source:'current cutoff' }
      return { start:iso(new Date(now.getFullYear(),now.getMonth()-1,26)), end:iso(new Date(now.getFullYear(),now.getMonth(),10)), source:'current cutoff' }
    }
    if (hasAny(clean, ['previous cutoff','last cutoff','nakaraang cutoff'])) {
      const current=resolveDateRange('current cutoff'); const priorEnd=addDays(new Date(`${current.start}T12:00:00`),-1)
      if (priorEnd.getDate() === 25) return { start:iso(new Date(priorEnd.getFullYear(),priorEnd.getMonth(),11)), end:iso(priorEnd), source:'previous cutoff' }
      return { start:iso(new Date(priorEnd.getFullYear(),priorEnd.getMonth()-1,26)), end:iso(priorEnd), source:'previous cutoff' }
    }
    let selectedMonth = null
    Object.entries(monthNames).some(([name,index]) => { if (new RegExp(`\\b${name}\\b`).test(clean)) { selectedMonth=index; return true } return false })
    const wantsLastMonth = hasAny(clean, ['last month','previous month','nakaraang buwan'])
    const wantsThisMonth = hasAny(clean, ['this month','current month','buwan na ito','ngayong buwan'])
    if (selectedMonth !== null || wantsLastMonth || wantsThisMonth) {
      let year=yearHit ? Number(yearHit[1]) : now.getFullYear()
      let month=selectedMonth
      if (wantsLastMonth) { month=now.getMonth()-1; if(month<0){month=11;year-=1} }
      if (wantsThisMonth) month=now.getMonth()
      const daySpan = clean.match(/\b(\d{1,2})\s*(?:to|hanggang|through|-)\s*(\d{1,2})\b/)
      const startDay=daySpan ? Number(daySpan[1]) : 1
      const lastDay=new Date(year,month+1,0).getDate()
      const endDay=daySpan ? Math.min(Number(daySpan[2]),lastDay) : lastDay
      return { start:iso(new Date(year,month,startDay)), end:iso(new Date(year,month,endDay)), source:'month' }
    }
    if (yearHit) return { start:`${yearHit[1]}-01-01`, end:`${yearHit[1]}-12-31`, source:'year' }
    const start=new Date(now.getFullYear(),now.getMonth(),1)
    const end=new Date(now.getFullYear(),now.getMonth()+1,0)
    return { start:iso(start), end:iso(end), source:'default current month' }
  }

  function levenshtein(a,b) {
    a=norm(a); b=norm(b); const row=Array.from({length:b.length+1},(_,i)=>i)
    for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}
    return row[b.length]
  }
  function bestNameMatch(message, rows, fields=['full_name','name','employee_name']) {
    const clean=norm(message); let best=null
    rows.forEach(row => {
      const name=fields.map(field=>row?.[field]).find(Boolean); if(!name) return
      const normalized=norm(name); let score=clean.includes(normalized) ? 100+normalized.length : 0
      normalized.split(' ').filter(part=>part.length>2).forEach(part=>{if(clean.includes(part)) score+=part.length*3})
      const words=clean.split(' '); words.forEach(word=>{const distance=levenshtein(word,normalized.split(' ')[0]);if(distance<=2)score+=Math.max(1,5-distance)})
      if(!best || score>best.score) best={row,name,score}
    })
    return best && best.score>2 ? best.row : null
  }

  const permissions = {
    expenses:['owner','manager'], sales:['owner','manager'], payroll:['owner','payroll'], attendance:['owner','manager','hr','payroll','supervisor','asst_supervisor'],
    employees:['owner','manager','hr'], production:['owner','manager','supervisor','asst_supervisor'], inventory:['owner','manager','supervisor','asst_supervisor'],
    suppliers:['owner','manager'], approvals:['owner']
  }
  function assertAccess(domain) {
    const ctx=getContext(); const role=norm(ctx.role).replace(/ /g,'_')
    if (ctx.isOwner || role==='owner') return
    if (!(permissions[domain] || []).includes(role)) throw new Error(`Your ${ctx.role || 'current'} role does not have access to ${domain}. Roma AI follows the same role limits as the app.`)
  }
  async function table(name) {
    const bridge=getBridge(); if(!bridge?.supabase) throw new Error('Roma AI is waiting for the app session. Please close and reopen Roma AI.')
    return bridge.supabase.from(name)
  }

  async function queryExpenses(message) {
    assertAccess('expenses'); const range=resolveDateRange(message)
    let q=(await table('daily_expenses')).select('*').gte('expense_date',range.start).lte('expense_date',range.end).order('expense_date',{ascending:true})
    const {data,error}=await q; if(error) throw error
    const rows=data||[]
    const activeRows=rows.filter(row=>!['rejected','voided'].includes(norm(row.status)))
    const excludedRows=rows.filter(row=>['rejected','voided'].includes(norm(row.status)))
    const byCategory={}; rows.forEach(row=>{const key=row.category||'Uncategorized';byCategory[key]=(byCategory[key]||0)+num(row.amount)})
    const total=rows.reduce((sum,row)=>sum+num(row.amount),0)
    const activeTotal=activeRows.reduce((sum,row)=>sum+num(row.amount),0)
    const top=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,8)
    return `Expenses for ${rangeLabel(range)}\n\nRecorded total: ${php(total)}\nRecords: ${rows.length}${excludedRows.length?`\nApproved/active total: ${php(activeTotal)}\nRejected/voided: ${excludedRows.length} record(s), ${php(excludedRows.reduce((sum,row)=>sum+num(row.amount),0))}`:''}${top.length?`\n\nBreakdown of recorded entries:\n${top.map(([name,value],i)=>`${i+1}. ${name}: ${php(value)}`).join('\n')}`:''}`
  }

  async function queryAttendance(message) {
    assertAccess('attendance'); const range=resolveDateRange(message)
    const {data:employees,error:employeeError}=await (await table('employees')).select('id,employee_code,full_name,position,department,is_active')
    if(employeeError) throw employeeError
    const ctx=getContext(); let employee=bestNameMatch(message,employees||[])
    if(!employee && ctx.role==='employee') employee=(employees||[]).find(row=>String(row.id)===String(ctx.employeeId))
    let q=(await table('attendance_logs')).select('*').gte('attendance_date',range.start).lte('attendance_date',range.end).order('attendance_date',{ascending:true})
    if(employee) q=q.eq('employee_id',employee.id)
    const {data,error}=await q; if(error) throw error
    const rows=data||[]
    const worked=rows.filter(row=>row.time_in && norm(row.status)!=='absent')
    const late=rows.reduce((sum,row)=>sum+num(row.late_minutes),0)
    const undertime=rows.reduce((sum,row)=>sum+num(row.undertime_minutes),0)
    const overtime=rows.reduce((sum,row)=>sum+num(row.overtime_minutes),0)
    if(employee) return `${employee.full_name} — attendance for ${rangeLabel(range)}\n\nWorked days: ${new Set(worked.map(row=>row.attendance_date)).size}\nAttendance records: ${rows.length}\nLate: ${late} minutes\nUndertime: ${undertime} minutes\nOvertime recorded: ${overtime} minutes`
    const grouped={}; worked.forEach(row=>{const name=row.employee_name||row.employee_code||'Unknown';if(!grouped[name])grouped[name]=new Set();grouped[name].add(row.attendance_date)})
    const top=Object.entries(grouped).map(([name,dates])=>[name,dates.size]).sort((a,b)=>b[1]-a[1]).slice(0,10)
    return `Attendance for ${rangeLabel(range)}\n\nWorked records: ${worked.length}\nEmployees with attendance: ${Object.keys(grouped).length}${top.length?`\n\nWorked days by employee:\n${top.map(([name,days],i)=>`${i+1}. ${name}: ${days} day${days===1?'':'s'}`).join('\n')}`:''}`
  }

  async function querySales(message) {
    assertAccess('sales'); const range=resolveDateRange(message)
    const {data,error}=await (await table('daily_sales')).select('*').gte('sale_date',range.start).lte('sale_date',range.end).order('sale_date',{ascending:true})
    if(error) throw error; const rows=data||[]
    const totals=rows.reduce((a,row)=>({revenue:a.revenue+num(row.total_revenue),walkin:a.walkin+num(row.total_walkin),messenger:a.messenger+num(row.total_messenger),reseller:a.reseller+num(row.total_reseller)}),{revenue:0,walkin:0,messenger:0,reseller:0})
    return `Sales for ${rangeLabel(range)}\n\nTotal revenue: ${php(totals.revenue)}\nSales days: ${new Set(rows.map(row=>row.sale_date)).size}\nDaily average: ${php(rows.length?totals.revenue/new Set(rows.map(row=>row.sale_date)).size:0)}\n\nWalk-in: ${php(totals.walkin)}\nMessenger: ${php(totals.messenger)}\nReseller: ${php(totals.reseller)}`
  }

  async function queryPayroll(message) {
    assertAccess('payroll'); const range=resolveDateRange(message)
    const {data,error}=await (await table('payroll_records')).select('*').lte('payroll_start',range.end).gte('payroll_end',range.start).order('employee_name',{ascending:true})
    if(error) throw error; let rows=data||[]
    const employee=bestNameMatch(message,rows,['employee_name'])
    if(employee) rows=rows.filter(row=>String(row.employee_id)===String(employee.employee_id)||norm(row.employee_name)===norm(employee.employee_name))
    const totals=rows.reduce((a,row)=>({basic:a.basic+num(row.basic_pay),gross:a.gross+num(row.gross_pay||row.total_earnings),deductions:a.deductions+num(row.total_deductions),net:a.net+num(row.net_pay)}),{basic:0,gross:0,deductions:0,net:0})
    return `${employee?`${employee.employee_name} — `:''}Payroll overlapping ${rangeLabel(range)}\n\nNet pay: ${php(totals.net)}\nGross/earnings: ${php(totals.gross)}\nBasic pay: ${php(totals.basic)}\nDeductions: ${php(totals.deductions)}\nRecords: ${rows.length}`
  }

  async function queryProduction(message) {
    assertAccess('production'); const range=resolveDateRange(message)
    const [{data:logs,error:logsError},{data:reports,error:reportsError}]=await Promise.all([
      (await table('production_logs')).select('*').gte('production_date',range.start).lte('production_date',range.end).order('production_date',{ascending:true}),
      (await table('production_reports')).select('*,production_report_items(*)').gte('report_date',range.start).lte('report_date',range.end).order('report_date',{ascending:true})
    ])
    if(logsError && reportsError) throw logsError
    const rows=logs||[]; const reportRows=reports||[]; const days=new Set([...rows.map(row=>row.production_date),...reportRows.map(row=>row.report_date)].filter(Boolean))
    const pieces=reportRows.reduce((sum,report)=>sum+(report.production_report_items||[]).reduce((part,item)=>part+num(item.quantity||item.actual_quantity||item.produced_quantity),0),0)
    return `Production for ${rangeLabel(range)}\n\nProduction days: ${days.size}\nProduction logs: ${rows.length}\nProduction reports: ${reportRows.length}${pieces?`\nReported pieces: ${pieces.toLocaleString()}\nAverage pieces per production day: ${Math.round(pieces/Math.max(days.size,1)).toLocaleString()}`:''}`
  }

  async function queryInventory() {
    assertAccess('inventory')
    const {data,error}=await (await table('inventory_items')).select('*').eq('is_active',true).order('name',{ascending:true})
    if(error) throw error; const rows=data||[]
    const low=rows.filter(row=>num(row.min_stock)>0&&num(row.current_stock)<=num(row.min_stock)).sort((a,b)=>num(a.current_stock)-num(b.current_stock))
    const zero=rows.filter(row=>num(row.current_stock)<=0)
    return `Inventory status\n\nActive items: ${rows.length}\nOut of stock: ${zero.length}\nAt or below reorder level: ${low.length}${low.length?`\n\nNeeds attention:\n${low.slice(0,12).map((row,i)=>`${i+1}. ${row.name}: ${num(row.current_stock).toLocaleString()} ${row.unit||''}`.trim()).join('\n')}`:''}`
  }

  async function querySuppliers(message) {
    assertAccess('suppliers')
    const {data,error}=await (await table('inventory_suppliers')).select('*').order('name',{ascending:true})
    if(error) throw error; const rows=data||[]; const match=bestNameMatch(message,rows,['name','supplier_name'])
    if(match) return `${match.name||match.supplier_name}\n\nContact: ${match.contact_person||'Not recorded'}\nPhone: ${match.phone||match.contact_number||'Not recorded'}\nEmail: ${match.email||'Not recorded'}\nStatus: ${match.is_active===false?'Inactive':'Active'}`
    return `Suppliers\n\nTotal records: ${rows.length}\nActive: ${rows.filter(row=>row.is_active!==false).length}${rows.length?`\n\n${rows.slice(0,15).map((row,i)=>`${i+1}. ${row.name||row.supplier_name||'Unnamed supplier'}`).join('\n')}`:''}`
  }

  async function queryEmployees(message) {
    assertAccess('employees')
    const {data,error}=await (await table('employees')).select('id,employee_code,full_name,position,department,is_active,employment_type,hire_date,admin_role').order('full_name',{ascending:true})
    if(error) throw error; const rows=data||[]; const match=bestNameMatch(message,rows)
    if(match) return `${match.full_name}\n\nEmployee code: ${match.employee_code||'Not recorded'}\nPosition: ${match.position||'Not recorded'}\nDepartment: ${match.department||'Not recorded'}\nEmployment: ${match.employment_type||'Not recorded'}\nHire date: ${match.hire_date||'Not recorded'}\nStatus: ${match.is_active===false?'Inactive':'Active'}`
    return `Employees\n\nActive: ${rows.filter(row=>row.is_active!==false).length}\nInactive: ${rows.filter(row=>row.is_active===false).length}\nTotal: ${rows.length}`
  }

  async function createChangeRequest(message) {
    const ctx=getContext(); if(ctx.isOwner) return 'You are logged in as Owner. Tell me the exact change you want; I will keep it as an Owner instruction, but Roma AI will not edit or deploy code autonomously.'
    const details=message.replace(/^(please\s+)?(request|change request|paki request|paki-request)\s*/i,'').trim() || message
    const bridge=getBridge(); await bridge?.logAudit?.('ROMA AI CHANGE REQUEST',ctx.userName||ctx.role,'Roma AI',`PENDING | ${details}`)
    return `Change request recorded for Owner review.\n\nRequested by: ${ctx.userName||ctx.role}\nRequest: ${details}\n\nRoma AI did not change data or code automatically.`
  }

  async function queryApprovals() {
    assertAccess('approvals')
    const {data,error}=await (await table('audit_logs')).select('*').eq('action','ROMA AI CHANGE REQUEST').order('created_at',{ascending:false}).limit(30)
    if(error) throw error; const rows=(data||[]).filter(row=>norm(row.details).includes('pending'))
    return `Roma AI Owner approval inbox\n\nPending requests: ${rows.length}${rows.length?`\n\n${rows.slice(0,12).map((row,i)=>`${i+1}. ${row.performed_by||'Staff'} — ${String(row.details||'').replace(/^PENDING\s*\|\s*/i,'')}`).join('\n')}`:'\nNo pending Roma AI change requests were found.'}\n\nApproval is audit-only. Roma AI will never edit or deploy production code by itself.`
  }

  async function answer(message, attachment) {
    const clean=norm(message)
    if(!clean && attachment) return 'I received the screenshot. Type what you want me to inspect or explain about it.'
    if (hasAny(clean,['request change','change request','paki request','paki-request'])) return createChangeRequest(message)
    if (hasAny(clean,['approval inbox','pending request','owner approval','mga request'])) return queryApprovals()
    if (hasAny(clean,['expense','expenses','gastos','ginastos','cost out'])) return queryExpenses(message)
    if (hasAny(clean,['attendance','worked days','days worked','pasok','pumasok','late','undertime','overtime','dtr'])) return queryAttendance(message)
    if (hasAny(clean,['payroll','pay slip','payslip','sahod','net pay','gross pay'])) return queryPayroll(message)
    if (hasAny(clean,['sales','revenue','benta','walk in','walkin','messenger sale'])) return querySales(message)
    if (hasAny(clean,['production','produced','batches','batch','gawa','production days'])) return queryProduction(message)
    if (hasAny(clean,['inventory','stock','low stock','out of stock','imbentaryo'])) return queryInventory(message)
    if (hasAny(clean,['supplier','vendor','suplayer'])) return querySuppliers(message)
    if (hasAny(clean,['employee','staff','crew','empleyado','worker'])) return queryEmployees(message)
    if (attachment) return 'Screenshot attached. The restored offline business engine can keep the image with this conversation, but visual interpretation requires the connected AI service. Please also describe the warning, number, or screen you want checked.'
    return `I can read the live business data your role is allowed to see. Try asking:\n\n• How much were our July 2026 expenses?\n• How many days did Jimmy Dela Cruz work in July 2026?\n• What were sales this month?\n• Show payroll for the current cutoff.\n• How many production days were there in July?\n• Which inventory items are low?\n\nYou can speak in English, Tagalog, or Taglish, and use names, dates, months, or payroll cutoffs.`
  }

  function mount() {
    if(document.getElementById('roma-ai-root')) return
    const root=document.createElement('div'); root.id='roma-ai-root'
    root.innerHTML=`
      <button class="rai-launch" type="button" aria-label="Open Roma AI" title="Roma AI"><span class="rai-launch-spark" aria-hidden="true">✦</span><span class="rai-launch-label" aria-hidden="true">AI</span></button>
      <section class="rai-panel" role="dialog" aria-label="Roma AI Business Assistant" aria-hidden="true">
        <header class="rai-head"><div class="rai-mark">RA</div><div class="rai-title"><strong>Roma AI</strong><span>Business Operating Assistant · ${esc(VERSION)}</span></div><button class="rai-icon-btn rai-close" type="button" aria-label="Close">×</button></header>
        <div class="rai-status"><span>Live app data · role-aware access</span><b class="rai-role">Connecting…</b></div>
        <div class="rai-chips"><button class="rai-chip" data-prompt="How much were our expenses this month?">Expenses</button><button class="rai-chip" data-prompt="Show sales this month">Sales</button><button class="rai-chip" data-prompt="Show attendance this month">Attendance</button><button class="rai-chip" data-prompt="Which inventory items are low?">Low stock</button><button class="rai-chip" data-prompt="Show the Roma AI approval inbox">Approvals</button></div>
        <div class="rai-messages" aria-live="polite"></div>
        <div class="rai-attachment"><img alt="Attached screenshot"><span>Screenshot ready</span><button type="button">Remove</button></div>
        <div class="rai-compose"><div class="rai-input-wrap"><button class="rai-action rai-attach" type="button" title="Attach screenshot">＋</button><button class="rai-action rai-mic" type="button" title="Speak">🎙</button><textarea rows="1" placeholder="Ask about Roma's business…"></textarea><button class="rai-action rai-send" type="button" title="Send">➤</button></div><div class="rai-foot">Read-only answers. Code edits and deployments require Owner approval.</div></div>
        <input class="rai-file" type="file" accept="image/*" hidden>
      </section>`
    document.body.appendChild(root)
    const launch=root.querySelector('.rai-launch'), panel=root.querySelector('.rai-panel'), close=root.querySelector('.rai-close'), messages=root.querySelector('.rai-messages'), input=root.querySelector('textarea'), send=root.querySelector('.rai-send'), mic=root.querySelector('.rai-mic'), attach=root.querySelector('.rai-attach'), file=root.querySelector('.rai-file'), attachmentBox=root.querySelector('.rai-attachment'), attachmentImg=attachmentBox.querySelector('img'), role=root.querySelector('.rai-role')
    let attachment=null, recognition=null

    function refreshRole(){const ctx=getContext();role.textContent=ctx.role?String(ctx.role).replace(/_/g,' ').toUpperCase():'GUEST'}
    function addMessage(text,type='bot',meta='') { const row=document.createElement('div');row.className=`rai-row rai-${type}`;const bubble=document.createElement('div');bubble.className='rai-bubble';bubble.textContent=text;row.appendChild(bubble);if(meta){const m=document.createElement('div');m.className='rai-meta';m.textContent=meta;bubble.appendChild(m)}messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return row }
    function addTyping(){const row=document.createElement('div');row.className='rai-row rai-bot';row.innerHTML='<div class="rai-bubble"><span class="rai-typing"><i></i><i></i><i></i></span></div>';messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return row}
    function clearAttachment(){attachment=null;file.value='';attachmentBox.classList.remove('rai-show');attachmentImg.removeAttribute('src')}
    async function submit(prefill='') {
      const message=String(prefill||input.value||'').trim(); if(!message&&!attachment)return
      input.value='';input.style.height='auto';addMessage(message||(attachment?'Screenshot attached':''),'user');const typing=addTyping();send.disabled=true
      try { const response=await answer(message,attachment);typing.remove();addMessage(response,'bot',new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}));getBridge()?.logAudit?.('ROMA AI QUERY',getContext().userName||getContext().role,'Roma AI',`${message.slice(0,180)} | read-only`).catch?.(()=>{}) }
      catch(error){typing.remove();addMessage(`I could not complete that query. ${error?.message||error}`,'bot')}
      finally{send.disabled=false;clearAttachment();input.focus()}
    }
    function open(){panel.classList.add('rai-open');panel.setAttribute('aria-hidden','false');refreshRole();if(!messages.children.length)addMessage(`Hello ${getContext().userName&&getContext().userName!=='Admin'?getContext().userName:'Jonnel'}. Roma AI is restored. Ask me about live sales, expenses, attendance, payroll, production, inventory, employees, or suppliers.`);setTimeout(()=>input.focus(),80)}
    function shut(){panel.classList.remove('rai-open');panel.setAttribute('aria-hidden','true')}
    launch.addEventListener('click',()=>panel.classList.contains('rai-open')?shut():open());close.addEventListener('click',shut);send.addEventListener('click',()=>submit());input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submit()}});input.addEventListener('input',()=>{input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,110)}px`})
    root.querySelectorAll('.rai-chip').forEach(button=>button.addEventListener('click',()=>submit(button.dataset.prompt)))
    attach.addEventListener('click',()=>file.click());file.addEventListener('change',()=>{const selected=file.files?.[0];if(!selected)return;if(!selected.type.startsWith('image/'))return;const reader=new FileReader();reader.onload=()=>{attachment={name:selected.name,type:selected.type,dataUrl:String(reader.result)};attachmentImg.src=attachment.dataUrl;attachmentBox.classList.add('rai-show')};reader.readAsDataURL(selected)});attachmentBox.querySelector('button').addEventListener('click',clearAttachment)
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition
    if(SpeechRecognition){recognition=new SpeechRecognition();recognition.lang='en-PH';recognition.interimResults=false;recognition.continuous=false;recognition.onstart=()=>mic.classList.add('rai-listening');recognition.onend=()=>mic.classList.remove('rai-listening');recognition.onerror=()=>mic.classList.remove('rai-listening');recognition.onresult=event=>{input.value=event.results?.[0]?.[0]?.transcript||'';input.dispatchEvent(new Event('input'));input.focus()};mic.addEventListener('click',()=>{try{recognition.start()}catch{}})}else{mic.disabled=true;mic.title='Voice recognition is not supported by this browser'}
    window.addEventListener('roma-ai-context-ready',refreshRole)
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount()
})()
