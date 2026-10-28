import { useEffect, useState } from 'react'
import { tomorrowInManila } from './employeeDeliverySummaryPolicy.js'

export default function EmployeeDeliverySummary({ supabase, sessionToken }) {
  // This component mounts anew each time the Delivery Summary panel opens.
  const [date, setDate] = useState(tomorrowInManila)
  const [result, setResult] = useState({ loading: true, names: [], error: '' })
  useEffect(() => {
    let cancelled = false
    setResult({ loading: true, names: [], error: '' })
    async function load() {
      try {
        if (!sessionToken) throw new Error('Please log in again to view the delivery summary.')
        const { data, error } = await supabase.rpc('employee_delivery_summary', {
          p_session_token: sessionToken, p_delivery_date: date,
        })
        if (error) throw error
        if (!cancelled) setResult({ loading: false, names: data || [], error: '' })
      } catch (error) {
        if (!cancelled) setResult({ loading: false, names: [], error: error.message || 'Unable to load delivery summary. Please reopen this tab to retry.' })
      }
    }
    if (date) void load()
    else setResult({ loading: false, names: [], error: 'Choose a delivery date.' })
    return () => { cancelled = true }
  }, [supabase, sessionToken, date])

  return <section aria-label="Delivery Summary" style={{ background: '#fffdf1', padding: 14, borderRadius: 12, border: '1.5px solid #FDD412', marginBottom: 8 }}>
    <h3 style={{ color: '#ca1b1b', margin: '0 0 12px', fontSize: 16 }}>Delivery Summary</h3>
    <label htmlFor="employee-delivery-date" style={{ display: 'block', fontSize: 12, fontWeight: 'bold' }}>Delivery date</label>
    <input id="employee-delivery-date" type="date" value={date} onChange={event => setDate(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 10, margin: '6px 0 12px', border: '1px solid #ddd', borderRadius: 8, background: 'white', color: '#1a1a2e' }} />
    <div aria-live="polite">
      {result.loading ? <p>Loading delivery summary…</p> : result.error ? <p role="alert" style={{ color: '#ca1b1b' }}>{result.error}</p> : result.names.length === 0 ? <p>No orders or deliveries for this date.</p> : <>
        <p style={{ fontSize: 12, fontWeight: 'bold' }}>Outlet / Reseller</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {result.names.map(row => <li key={row.outlet_name} style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: 10, marginBottom: 6, overflowWrap: 'anywhere' }}>{row.outlet_name}</li>)}
        </ul>
      </>}
    </div>
  </section>
}
