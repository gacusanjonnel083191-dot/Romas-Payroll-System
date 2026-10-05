// Local-only synthetic fixture. Never connects to Supabase or uses business data.
import React from 'react'
import { createRoot } from 'react-dom/client'
import OwnerDailyReceipts from '../../src/OwnerDailyReceipts.jsx'
import { cashVariances } from '../../src/cashHandover.js'
const day='2026-10-06'
const read=()=>JSON.parse(localStorage.getItem('cash-handover-qa') || '[]')
const raw={daily_sales:[{id:'qa-sale',sale_date:day,total_walkin:1000,total_messenger:0,cash_received:1000,gcash_received:0,other_online_received:0,unpaid_amount:0}],daily_online:[],reseller_payments:[],pos_closings:[],outlet_remittances:[],invoices:[],cash_counts:[],bank_deposits:[{deposit_date:day,status:'deposited',amount:200}],expenses:[]}
const supabase={
  from:()=>({select:()=>({eq:()=>({order:async()=>({data:read(),error:localStorage.getItem('qa-load-error') ? {message:'Synthetic load failure'} : null})})})}),
  rpc:async(name,p)=>{
    if(name==='owner_daily_receipts')return {data:raw}
    if(name==='owner_cash_expenses_for_day')return {data:[{id:'qa-expense',status:'approved',expense_date:day,payment_method:'cash',paid_date:day,classified_amount:100,amount:100}]}
    if(name==='owner_save_cash_handover'){
      await new Promise(resolve=>setTimeout(resolve,250))
      if(localStorage.getItem('qa-save-error'))return {error:{message:'Synthetic save failure'}}
      const rows=read();const prev=rows[0]
      const retry=rows.find(row=>row.request_id===p.p_request_id)
      if(retry)return {data:retry.id}
      if((prev?.id || null)!==p.p_previous_id)return {error:{message:'History changed; refresh'}}
      const v=cashVariances(p.p_expected,p.p_handed,p.p_count)
      const row={id:crypto.randomUUID(),business_date:p.p_day,revision:(prev?.revision || 0)+1,previous_id:prev?.id || null,request_id:p.p_request_id,system_expected_cash:p.p_expected,cash_handed_over:p.p_handed,owner_physical_count:p.p_count,collection_variance:v.collection,counting_variance:v.counting,final_variance:v.final,handed_over_by:p.p_handed_by,received_by:'QA Owner',handover_at:p.p_handover_at,created_at:new Date().toISOString(),owner_count_at:p.p_count==null ? null : new Date().toISOString(),notes:p.p_notes}
      localStorage.setItem('cash-handover-qa',JSON.stringify([row,...rows])); return {data:row.id}
    }
    return {error:{message:'Unexpected QA RPC'}}
  }
}
document.body.style.cssText='font-family:Arial;margin:8px;color:#222'
createRoot(document.getElementById('root')).render(<><p>Synthetic local QA — no production connection</p><OwnerDailyReceipts supabase={supabase} today={day} adminRole={new URLSearchParams(location.search).get('role') || 'owner'} onOpenExpenses={()=>{}} /></>)
