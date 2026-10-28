import { useCallback, useEffect, useState } from 'react'

const money = value => '₱' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })
const card = { background:'white', border:'1px solid #ddd', borderRadius:12, padding:16, marginBottom:14 }
const field = { width:'100%', boxSizing:'border-box', minHeight:40, padding:'8px 10px', border:'1px solid #ccc', borderRadius:7, fontSize:13 }
const grid = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12 }
const button = { padding:'9px 14px', border:0, borderRadius:7, background:'#b82025', color:'white', cursor:'pointer', fontWeight:700 }
const blank = today => ({ borrower_type:'employee', employee_id:'', reseller_id:'', cart_identifier:'', agreement_id:'', start_date:today, cart_price:'', down_payment:'0', installment_amount:'', frequency:'Flexible', first_due_date:'', notes:'', down_method:'Cash', down_reference:'' })

export default function RollingCartLoans({ supabase, today }) {
 const [loans,setLoans]=useState([])
 const [payments,setPayments]=useState([])
 const [charges,setCharges]=useState([])
 const [employees,setEmployees]=useState([])
 const [resellers,setResellers]=useState([])
 const [agreements,setAgreements]=useState([])
 const [form,setForm]=useState(()=>blank(today))
 const [selected,setSelected]=useState('')
 const [payment,setPayment]=useState({ amount:'', payment_date:today, method:'Cash', reference:'', notes:'' })
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID())
 const [charge,setCharge]=useState({category:'Uniform',description:'',charge_date:today,quantity:'1',unit_amount:'',notes:''})
 const [chargeRequestId,setChargeRequestId]=useState(()=>crypto.randomUUID())
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const refresh=useCallback(async()=>{
  setLoading(true)
  try {
   const [l,p,c,e,r,a]=await Promise.all([
    supabase.from('rolling_cart_loans').select('*').order('created_at',{ascending:false}),
    supabase.from('rolling_cart_payments').select('*').order('created_at',{ascending:true}),
    supabase.from('rolling_cart_charges').select('*').order('created_at',{ascending:true}),
    supabase.from('employees').select('id,full_name,employee_code').order('full_name'),
    supabase.from('resellers').select('id,name').order('name'),
    supabase.from('company_document_records').select('id,document_no,reseller_id').eq('form_key','RES-CART').order('created_at',{ascending:false})
   ])
   for (const result of [l,p,c,e,r,a]) if (result.error) throw result.error
   setLoans(l.data||[]);setPayments(p.data||[]);setCharges(c.data||[]);setEmployees(e.data||[]);setResellers(r.data||[]);setAgreements(a.data||[])
  } catch (err) { setError(err.message || 'Could not load cart loans. The database migration may still be pending.') }
  finally { setLoading(false) }
 },[supabase])
 useEffect(()=>{ void refresh() },[refresh])
 const change=(key,value)=>setForm(current=>({...current,[key]:value}))
 const person=loan=> loan.borrower_type==='employee' ? employees.find(e=>e.id===loan.employee_id)?.full_name : resellers.find(r=>r.id===loan.reseller_id)?.name
 const active=loans.find(loan=>loan.id===selected)
 const activePayments=payments.filter(p=>p.loan_id===selected)
 const reversed=new Set(activePayments.filter(p=>p.event_type==='reversal').map(p=>p.reverses_payment_id))
 const activeCharges=charges.filter(c=>c.loan_id===selected)
 const reversedCharges=new Set(activeCharges.filter(c=>c.event_type==='reversal').map(c=>c.reverses_charge_id))
 const chargeTotal=loanId=>charges.filter(c=>c.loan_id===loanId).reduce((sum,c)=>sum+(c.event_type==='charge'?1:-1)*Number(c.total_amount),0)
 const total=loans.reduce((sum,loan)=>sum+Number(loan.balance),0)
 async function create(event) {
  event.preventDefault();setError('');setNotice('')
  if (busy) return
  const price=Number(form.cart_price), down=Number(form.down_payment)
  if (!Number.isFinite(price) || price<=0 || !Number.isFinite(down) || down<0 || down>price) { setError('Check the cart price and down payment.');return }
  setBusy(true)
  try {
   const {data,error:saveError}=await supabase.rpc('create_rolling_cart_loan',{
    p_borrower_type:form.borrower_type,p_employee_id:form.employee_id||null,p_reseller_id:form.reseller_id||null,
    p_cart_identifier:form.cart_identifier.trim(),p_agreement_id:form.agreement_id||null,p_start_date:form.start_date,
    p_cart_price:price,p_down_payment:down,p_installment_amount:form.installment_amount?Number(form.installment_amount):null,
    p_frequency:form.frequency,p_first_due_date:form.first_due_date||null,p_notes:form.notes,
    p_down_method:form.down_method,p_down_reference:form.down_reference
   })
   if (saveError) throw saveError
   setForm(blank(today));setSelected(data);setNotice('Cart loan saved.');await refresh()
  } catch(err) { setError(err.message) } finally { setBusy(false) }
 }
 async function record(event) {
  event.preventDefault();setError('');setNotice('')
  if (busy || !active) return
  const amount=Number(payment.amount)
  if (!Number.isFinite(amount) || amount<=0 || amount>Number(active.balance)) { setError('Payment must be greater than zero and no more than the balance.');return }
  setBusy(true)
  try {
   const {error:saveError}=await supabase.rpc('record_rolling_cart_payment',{
    p_loan_id:active.id,p_amount:amount,p_payment_date:payment.payment_date,p_method:payment.method,
    p_reference:payment.reference,p_notes:payment.notes,p_request_id:requestId
   })
   if (saveError) throw saveError
   setPayment({amount:'',payment_date:today,method:'Cash',reference:'',notes:''});setRequestId(crypto.randomUUID())
   setNotice('Payment recorded and balance updated.');await refresh()
  } catch(err) { setError(err.message) } finally { setBusy(false) }
 }
 async function reverse(row) {
  const reason=window.prompt('Reason for reversing this payment (at least 10 characters):')
  if (reason===null) return
  if (reason.trim().length<10) { setError('Enter at least 10 characters for the correction reason.');return }
  if (!window.confirm(`Reverse ${money(row.amount)}? This restores the balance and keeps the original payment in history.`)) return
  setBusy(true);setError('');setNotice('')
  try {
   const {error:saveError}=await supabase.rpc('reverse_rolling_cart_payment',{p_payment_id:row.id,p_reason:reason.trim()})
   if (saveError) throw saveError
   setNotice('Payment reversed; balance restored.');await refresh()
  } catch(err) { setError(err.message) } finally { setBusy(false) }
 }
 async function addCharge(event) {
  event.preventDefault();setError('');setNotice('')
  if (busy || !active) return
  const quantity=Number(charge.quantity), unitAmount=Number(charge.unit_amount)
  if (!Number.isSafeInteger(quantity) || quantity<1 || !Number.isFinite(unitAmount) || unitAmount<=0 || !/^\d+(\.\d{1,2})?$/.test(String(charge.unit_amount)) ||
      (charge.category==='Others' && !charge.description.trim())) { setError('Enter a valid date, whole-piece quantity, unit amount, and description for Others.');return }
  setBusy(true)
  try {
   const {error:saveError}=await supabase.rpc('add_rolling_cart_charge',{
    p_loan_id:active.id,p_category:charge.category,p_description:charge.description.trim()||null,
    p_charge_date:charge.charge_date,p_quantity:quantity,p_unit_amount:unitAmount,
    p_notes:charge.notes,p_request_id:chargeRequestId
   })
   if (saveError) throw saveError
   setCharge({category:'Uniform',description:'',charge_date:today,quantity:'1',unit_amount:'',notes:''})
   setChargeRequestId(crypto.randomUUID());setNotice('Item added; outstanding balance updated.');await refresh()
  } catch(err) { setError(err.message) } finally { setBusy(false) }
 }
 async function reverseCharge(row) {
  const reason=window.prompt('Reason for reversing this item charge (at least 10 characters):')
  if (reason===null) return
  if (reason.trim().length<10) { setError('Enter at least 10 characters for the correction reason.');return }
  if (!window.confirm(`Reverse ${money(row.total_amount)} for ${row.category}? This will reduce the outstanding balance.`)) return
  setBusy(true);setError('');setNotice('')
  try {
   const {error:saveError}=await supabase.rpc('reverse_rolling_cart_charge',{p_charge_id:row.id,p_reason:reason.trim()})
   if (saveError) throw saveError
   setNotice('Item charge reversed; balance updated.');await refresh()
  } catch(err) { setError(err.message) } finally { setBusy(false) }
 }
 return <div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 5px'}}>Rolling Cart Loans</h2><p style={{margin:'0 0 16px',color:'#666'}}>Cart installments are tracked separately from cash advances and donut invoices.</p></div><button type="button" onClick={refresh} disabled={loading||busy} style={button}>{loading?'Loading…':'Refresh'}</button></div>
  {error && <p role="alert" style={{color:'#b82025',fontWeight:700}}>{error}</p>}{notice && <p role="status" style={{color:'#287943',fontWeight:700}}>{notice}</p>}
  <div style={card}><strong>Outstanding across {loans.length} cart loan(s): {money(total)}</strong></div>
  <form onSubmit={create} style={card}><h3 style={{marginTop:0}}>New cart loan</h3><div style={grid}>
   <label>Responsible borrower<select style={field} value={form.borrower_type} onChange={e=>change('borrower_type',e.target.value)}><option value="employee">Employee</option><option value="reseller">Reseller</option></select></label>
   <label>Employee {form.borrower_type==='employee'?'*':'(optional link)'}<select style={field} required={form.borrower_type==='employee'} value={form.employee_id} onChange={e=>change('employee_id',e.target.value)}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}</select></label>
   <label>Reseller {form.borrower_type==='reseller'?'*':'(optional link)'}<select style={field} required={form.borrower_type==='reseller'} value={form.reseller_id} onChange={e=>change('reseller_id',e.target.value)}><option value="">Select reseller</option>{resellers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <label>Cart ID / description *<input style={field} required value={form.cart_identifier} onChange={e=>change('cart_identifier',e.target.value)} /></label>
   <label>Rolling cart agreement<select style={field} value={form.agreement_id} onChange={e=>change('agreement_id',e.target.value)}><option value="">None linked</option>{agreements.filter(a=>!form.reseller_id||a.reseller_id===form.reseller_id).map(a=><option value={a.id} key={a.id}>{a.document_no}</option>)}</select></label>
   <label>Loan date *<input type="date" style={field} required value={form.start_date} onChange={e=>change('start_date',e.target.value)} /></label>
   <label>Agreed cart price *<input type="number" min="0.01" step="0.01" style={field} required value={form.cart_price} onChange={e=>change('cart_price',e.target.value)} /></label>
   <label>Down payment<input type="number" min="0" step="0.01" style={field} value={form.down_payment} onChange={e=>change('down_payment',e.target.value)} /></label>
   <label>Down payment method<select style={field} value={form.down_method} onChange={e=>change('down_method',e.target.value)}>{['Cash','GCash','Bank Transfer','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Down payment reference<input style={field} value={form.down_reference} onChange={e=>change('down_reference',e.target.value)} /></label>
   <label>Installment amount<input type="number" min="0.01" step="0.01" style={field} value={form.installment_amount} onChange={e=>change('installment_amount',e.target.value)} /></label>
   <label>Frequency<select style={field} value={form.frequency} onChange={e=>change('frequency',e.target.value)}>{['Flexible','Weekly','Semi-monthly','Monthly'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>First due date<input type="date" style={field} value={form.first_due_date} onChange={e=>change('first_due_date',e.target.value)} /></label>
   <label>Agreement / terms notes<input style={field} value={form.notes} onChange={e=>change('notes',e.target.value)} /></label>
  </div><button type="submit" disabled={busy} style={{...button,marginTop:14}}>{busy?'Saving…':'Create cart loan'}</button></form>
  <div style={card}><h3 style={{marginTop:0}}>Cart loan accounts</h3>{loans.length===0?<p>No cart loans recorded yet.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['Borrower','Cart','Cart price','Added items','Balance','Status','Details'].map(h=><th key={h} style={{textAlign:'left',padding:8,borderBottom:'1px solid #ddd'}}>{h}</th>)}</tr></thead><tbody>{loans.map(l=><tr key={l.id}><td style={{padding:8}}>{person(l)||'Linked record unavailable'}</td><td>{l.cart_identifier}</td><td>{money(l.cart_price)}</td><td>{money(chargeTotal(l.id))}</td><td><strong>{money(l.balance)}</strong></td><td>{Number(l.balance)===0?'Paid':'Active'}</td><td><button type="button" style={button} onClick={()=>setSelected(l.id)}>View / Pay</button></td></tr>)}</tbody></table></div>}</div>
  {active && <div style={card}><h3 style={{marginTop:0}}>{active.cart_identifier} — {person(active)}</h3><p>Cart: {money(active.cart_price)} · Added items: {money(chargeTotal(active.id))} · Total charged: {money(Number(active.cart_price)+chargeTotal(active.id))} · Remaining: <strong>{money(active.balance)}</strong> · Start: {active.start_date} · {active.frequency}{active.installment_amount?` ${money(active.installment_amount)}`:''}{active.first_due_date?` · First due: ${active.first_due_date}`:''}</p>
   <h4>Uniform, additional tray, solar light, or other item</h4>
   <form onSubmit={addCharge} style={grid}><label>Item *<select style={field} value={charge.category} onChange={e=>setCharge({...charge,category:e.target.value})}>{['Uniform','Additional Tray','Solar Light','Others'].map(v=><option key={v}>{v}</option>)}</select></label><label>Description {charge.category==='Others'?'*':'(optional)'}<input style={field} required={charge.category==='Others'} value={charge.description} onChange={e=>setCharge({...charge,description:e.target.value})} /></label><label>Date given *<input type="date" required style={field} value={charge.charge_date} onChange={e=>setCharge({...charge,charge_date:e.target.value})} /></label><label>Pieces *<input type="number" min="1" step="1" required style={field} value={charge.quantity} onChange={e=>setCharge({...charge,quantity:e.target.value})} /></label><label>Amount per piece *<input type="number" min="0.01" step="0.01" required style={field} value={charge.unit_amount} onChange={e=>setCharge({...charge,unit_amount:e.target.value})} /></label><label>Notes<input style={field} value={charge.notes} onChange={e=>setCharge({...charge,notes:e.target.value})} /></label><div style={{alignSelf:'end'}}><strong>Total: {money(Number(charge.quantity)*Number(charge.unit_amount))}</strong><br/><button type="submit" disabled={busy} style={{...button,marginTop:6}}>{busy?'Saving…':'Add item to balance'}</button></div></form>
   <h4>Items and corrections</h4>{activeCharges.length===0?<p>No added items recorded.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:13}}><thead><tr>{['Date given','Item','Pieces','Per piece','Total','Entry / reason','Action'].map(h=><th key={h} style={{textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{activeCharges.map(c=><tr key={c.id}><td>{c.charge_date}</td><td>{c.category}{c.description?` — ${c.description}`:''}</td><td>{c.quantity}</td><td>{money(c.unit_amount)}</td><td>{money(c.total_amount)}</td><td>{c.event_type}{reversedCharges.has(c.id)?' (reversed)':''}{c.event_type==='reversal'&&c.notes?` — ${c.notes}`:''}</td><td>{c.event_type==='charge'&&!reversedCharges.has(c.id)&&<button type="button" disabled={busy} onClick={()=>reverseCharge(c)} style={{...button,background:'#555'}}>Reverse</button>}</td></tr>)}</tbody></table></div>}
   {Number(active.balance)>0 && <form onSubmit={record} style={grid}><label>Payment date *<input type="date" required style={field} value={payment.payment_date} onChange={e=>setPayment({...payment,payment_date:e.target.value})} /></label><label>Amount *<input type="number" min="0.01" max={active.balance} step="0.01" required style={field} value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} /></label><label>Method<select style={field} value={payment.method} onChange={e=>setPayment({...payment,method:e.target.value})}>{['Cash','GCash','Bank Transfer','Other'].map(v=><option key={v}>{v}</option>)}</select></label><label>Reference<input style={field} value={payment.reference} onChange={e=>setPayment({...payment,reference:e.target.value})} /></label><label>Notes<input style={field} value={payment.notes} onChange={e=>setPayment({...payment,notes:e.target.value})} /></label><div style={{alignSelf:'end'}}><button type="submit" disabled={busy} style={button}>{busy?'Saving…':'Record payment'}</button></div></form>}
   <h4>Payment and correction history</h4>{activePayments.length===0?<p>No payments recorded.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:13}}><thead><tr>{['Date','Entry','Amount','Method','Reference / reason','Recorded','Action'].map(h=><th key={h} style={{textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{activePayments.map(p=><tr key={p.id}><td>{p.payment_date}</td><td>{p.event_type}{reversed.has(p.id)?' (reversed)':''}</td><td>{money(p.amount)}</td><td>{p.method}</td><td>{p.notes||p.reference_number||'—'}</td><td>{new Date(p.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</td><td>{p.event_type==='payment'&&!reversed.has(p.id)&&<button type="button" disabled={busy} onClick={()=>reverse(p)} style={{...button,background:'#555'}}>Reverse</button>}</td></tr>)}</tbody></table></div>}</div>}
 </div>
}
