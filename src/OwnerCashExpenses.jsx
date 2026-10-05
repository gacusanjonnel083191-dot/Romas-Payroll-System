import { useState } from 'react'

const peso = amount => '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })
const field = { minHeight:36, padding:'6px 8px', border:'1px solid #bbb', borderRadius:6, fontSize:12 }
const cell = { textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #eee', verticalAlign:'top', fontSize:12 }

function ExpensePaymentRow({ row, date, today, supabase, onSaved }) {
  const [method, setMethod] = useState(row.payment_method || '')
  const [paidDate, setPaidDate] = useState(row.paid_date || date)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const approved = row.status === 'approved'
  const correctionNeedsNote = Boolean(row.classified_at)
  const unchanged = method === row.payment_method && (method === 'unpaid' ? !row.paid_date : paidDate === row.paid_date)

  async function save() {
    if (!approved || !method || saving) return
    setSaving(true); setError('')
    try {
      const { error:saveError } = await supabase.rpc('owner_record_expense_payment', {
        p_expense_id:row.id, p_payment_method:method,
        p_paid_date:method === 'unpaid' ? null : paidDate, p_note:note.trim() || null
      })
      if (saveError) throw saveError
      await onSaved()
      setNote('')
    } catch (saveError) {
      setError(saveError?.message || String(saveError))
    } finally { setSaving(false) }
  }

  return <tr>
    <td style={cell}>{row.expense_date || '—'}</td>
    <td style={cell}><strong>{row.category || 'Expense'}</strong>{row.description && <div style={{ color:'#666', marginTop:3 }}>{row.description}</div>}</td>
    <td style={cell}>{row.status || 'Unknown'}</td>
    <td style={{ ...cell, textAlign:'right', whiteSpace:'nowrap' }}>{peso(row.amount)}</td>
    <td style={cell}>
      {approved ? <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <select aria-label={`Payment status for ${row.category || 'expense'} ${row.expense_date}`} value={method} onChange={event=>setMethod(event.target.value)} style={field}>
          <option value="">Not classified</option>
          <option value="cash">Paid in cash</option>
          <option value="gcash">Paid by GCash</option>
          <option value="other_online">Paid online / bank</option>
          <option value="unpaid">Not paid</option>
        </select>
        {method && method !== 'unpaid' && <input aria-label={`Paid date for ${row.category || 'expense'} ${row.expense_date}`} type="date" value={paidDate} max={today} onChange={event=>setPaidDate(event.target.value)} style={field} />}
        <input aria-label={`Payment note for ${row.category || 'expense'} ${row.expense_date}`} type="text" value={note} onChange={event=>setNote(event.target.value)} placeholder={correctionNeedsNote ? 'Correction reason required' : 'Note (optional)'} maxLength={500} style={{ ...field, width:170 }} />
        <button type="button" onClick={save} disabled={saving || !method || unchanged || (method !== 'unpaid' && !paidDate) || (correctionNeedsNote && !note.trim())} style={{ ...field, background:'#1a1a2e', color:'#fff', border:0, cursor:'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
      </div> : <span>Approve this expense before classifying its payment.</span>}
      {row.payment_method && <div style={{ color:'#666', marginTop:5 }}>Recorded: {row.payment_method === 'unpaid' ? 'Not paid' : `${row.payment_method.replace('_',' ')} on ${row.paid_date}`}</div>}
      {error && <div role="alert" style={{ color:'#a11', marginTop:5 }}>{error}</div>}
    </td>
  </tr>
}

export default function OwnerCashExpenses({ rows, date, today, supabase, onSaved, onOpenExpenses }) {
  return <details style={{ background:'#fff', border:'1px solid #e7e7e7', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
    <summary style={{ fontWeight:700, cursor:'pointer' }}>Expenses and cash deductions ({rows.length})</summary>
    <p style={{ color:'#555', fontSize:12 }}>
      Only owner-confirmed expenses paid in cash on the selected date reduce the cash figure. Existing expenses remain unclassified until reviewed. Each change is saved as a new audit event.
    </p>
    <button type="button" onClick={onOpenExpenses} style={{ background:'#f5c518', border:0, borderRadius:6, padding:'8px 12px', cursor:'pointer', fontWeight:700, marginBottom:10 }}>Open full Expenses ledger</button>
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
        <thead style={{ background:'#1a1a2e', color:'#fff' }}><tr>{['Expense date','Expense','Status','Amount','Payment classification'].map(label=><th key={label} style={{ ...cell, color:'#fff', textAlign:label === 'Amount' ? 'right' : 'left' }}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(row=><ExpensePaymentRow key={`${row.id}-${row.classified_at || ''}`} row={row} date={date} today={today} supabase={supabase} onSaved={onSaved} />)}</tbody>
      </table>
      {rows.length === 0 && <p style={{ fontSize:12, color:'#777' }}>No expenses are dated or marked paid on this date.</p>}
    </div>
  </details>
}
