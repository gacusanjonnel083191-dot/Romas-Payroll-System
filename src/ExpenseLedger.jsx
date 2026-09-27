import { useState } from 'react'
import './ExpenseLedger.css'

const peso = amount => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ExpenseLedger({ expenses, loading, isOwner, today, rejectingId, rejectionReason, setRejectingId, setRejectionReason, approve, reject, voidExpense }) {
 const [filters, setFilters] = useState({ from:'', to:'', category:'', status:'', search:'' })
 const categories = [...new Set(expenses.map(row => row.category).filter(Boolean))].sort()
 const visible = expenses.filter(row => row.status !== 'pending' || isOwner)
 const search = filters.search.trim().toLocaleLowerCase()
 const filtered = visible.filter(row =>
  (!filters.from || row.expense_date >= filters.from) &&
  (!filters.to || row.expense_date <= filters.to) &&
  (!filters.category || row.category === filters.category) &&
  (!filters.status || row.status === filters.status) &&
  (!search || [row.expense_date, row.category, row.description, row.encoded_by, row.rejection_reason, row.id].some(value => String(value || '').toLocaleLowerCase().includes(search)))
 )
 const monthRows = visible.filter(row => row.expense_date?.startsWith(today.slice(0, 7)))
 const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0)
 const pending = visible.filter(row => row.status === 'pending')
 const update = (key, value) => setFilters(previous => ({ ...previous, [key]:value }))

 return <section className="expense-ledger" aria-label="Expense records">
  <div className="expense-ledger__heading">
   <div><h3>Expense ledger</h3><p>{filtered.length} of {expenses.length} loaded records shown · Filters cover the latest 100 records</p></div>
   {isOwner && pending.length > 0 && <span className="expense-ledger__notice">{pending.length} awaiting approval</span>}
  </div>
  <div className="expense-ledger__summary">
   <div><span>Approved this month <small>loaded records</small></span><strong>{peso(sum(monthRows.filter(row => row.status === 'approved')))}</strong></div>
   <div><span>Pending approval <small>loaded records</small></span><strong>{peso(sum(pending))}</strong></div>
   <div><span>Records shown</span><strong>{filtered.length.toLocaleString('en-PH')} <small>of {expenses.length.toLocaleString('en-PH')} loaded</small></strong></div>
  </div>
  <div className="expense-ledger__filters" aria-label="Filter expenses">
   <label>From<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label>
   <label>To<input type="date" value={filters.to} onChange={event => update('to', event.target.value)} /></label>
   <label>Category<select value={filters.category} onChange={event => update('category', event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
   <label>Status<select value={filters.status} onChange={event => update('status', event.target.value)}><option value="">All statuses</option>{[...new Set(visible.map(row => row.status).filter(Boolean))].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
   <label className="expense-ledger__search">Search<input type="search" value={filters.search} onChange={event => update('search', event.target.value)} placeholder="Description, reference, encoder…" /></label>
   <button type="button" onClick={() => setFilters({ from:'', to:'', category:'', status:'', search:'' })}>Reset</button>
  </div>
  <div className="expense-ledger__table-wrap">
   <table className="expense-ledger__table">
    <colgroup><col className="expense-ledger__col-date" /><col className="expense-ledger__col-category" /><col /><col className="expense-ledger__col-status" /><col className="expense-ledger__col-amount" /><col className="expense-ledger__col-actions" /></colgroup>
    <thead><tr><th>Date</th><th>Category</th><th>Description / reference</th><th>Status</th><th className="expense-ledger__amount-heading">Amount</th><th>Actions</th></tr></thead>
    <tbody>
     {!loading && filtered.length === 0 && <tr><td colSpan="6" className="expense-ledger__empty">{expenses.length ? 'No expenses match these filters.' : 'No expenses recorded yet.'}</td></tr>}
     {loading && <tr><td colSpan="6" className="expense-ledger__empty">Loading expenses…</td></tr>}
     {!loading && filtered.map(row => {
      const description = String(row.description || '')
      const hasDetails = description.length > 85 || Boolean(row.rejection_reason)
      return <tr key={row.id}>
       <td data-label="Date" className="expense-ledger__date">{row.expense_date || '—'}</td>
       <td data-label="Category"><span className="expense-ledger__category" title={row.category || 'Uncategorized'}>{row.category || 'Uncategorized'}</span></td>
       <td data-label="Description / reference" className="expense-ledger__description">
        <span className="expense-ledger__excerpt" title={description || 'No description'}>{description ? (description.length > 85 ? `${description.slice(0, 85).trimEnd()}…` : description) : 'No description'}</span>
        {hasDetails && <details><summary>View details</summary><div className="expense-ledger__detail">{description.length > 85 && <p>{description}</p>}{row.encoded_by && <p>Encoded by: {row.encoded_by}</p>}{row.rejection_reason && <p>Rejection reason: {row.rejection_reason}</p>}{row.id && <p>Record ID: {row.id}</p>}</div></details>}
       </td>
       <td data-label="Status"><span className={`expense-ledger__status expense-ledger__status--${row.status || 'unknown'}`}>{row.status ? row.status[0].toUpperCase() + row.status.slice(1) : 'Unknown'}</span></td>
       <td data-label="Amount" className="expense-ledger__amount">{peso(row.amount)}</td>
       <td data-label="Actions" className="expense-ledger__actions">
        {isOwner && row.status === 'pending' && (rejectingId === row.id ? <div className="expense-ledger__reject"><input aria-label="Reason for rejection" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} placeholder="Reason for rejection" /><button type="button" onClick={() => reject(row.id)}>Confirm reject</button><button type="button" onClick={() => { setRejectingId(null); setRejectionReason('') }}>Cancel</button></div> : <><button type="button" onClick={() => approve(row.id)}>Approve</button><button type="button" onClick={() => setRejectingId(row.id)}>Reject</button></>)}
        {isOwner && <details className="expense-ledger__more"><summary aria-label={`More actions for ${row.category || 'expense'} on ${row.expense_date || 'unknown date'}`}>More</summary><button type="button" onClick={() => voidExpense(row.id)} aria-label={`Void expense ${row.expense_date || ''} ${row.category || ''}`}>Void expense</button></details>}
        {!isOwner && <span>—</span>}
       </td>
      </tr>
     })}
    </tbody>
   </table>
  </div>
 </section>
}
