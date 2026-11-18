import { useEffect, useRef, useState } from 'react'
import SourceBreakdown from './SourceBreakdown.jsx'

export default function InvoicePaymentSources({ client, invoice }) {
  const [state,setState] = useState({ rows:[], loading:true, error:'', invoiceId:null })
  const [retry,setRetry] = useState(0)
  const request = useRef(0)
  useEffect(()=>{
    const id=++request.current
    setState({rows:[],loading:true,error:'',invoiceId:invoice.id})
    ;(async()=>{
      try {
        const all=[]
        for(let start=0;;start+=500) {
          const {data,error}=await client.from('reseller_payments').select('*').eq('invoice_id',invoice.id).order('created_at',{ascending:false}).order('id').range(start,start+499)
          if(error) throw error
          if(id!==request.current)return
          all.push(...(data||[]))
          if((data||[]).length<500)break
        }
        setState({rows:all,loading:false,error:'',invoiceId:invoice.id})
      } catch(error) { if(id===request.current)setState({rows:[],loading:false,error:error.message || String(error),invoiceId:invoice.id}) }
    })()
    return ()=>{request.current++}
  },[client,invoice.id,retry])
  return <details style={{margin:'12px 0',color:'#333'}}>
    <summary style={{cursor:'pointer',fontWeight:700}}>View payment records behind Already Paid</summary>
    {state.loading || state.invoiceId !== invoice.id ? <p role="status">Loading payment records…</p> : state.error ? <p role="alert">Payment records could not be loaded: {state.error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p> : <SourceBreakdown title={'Payment history · '+invoice.invoice_number}
      rows={state.rows.map(row=>({id:row.id,recordId:row.id,source:'Invoice payment',description:row.reseller_name || invoice.reseller_name,amount:Number(row.amount||0),businessDate:row.payment_date,method:row.payment_method,recordedBy:row.recorded_by,enteredAt:row.created_at,invoiceNumber:invoice.invoice_number}))}
      total={Number(invoice.paid_amount||0)} explanation="Individual payment records linked to this invoice, compared with its saved cumulative paid amount. A mismatch needs review; opening this history does not change any records." />}
  </details>
}
