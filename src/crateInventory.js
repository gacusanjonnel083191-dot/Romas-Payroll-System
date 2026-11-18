export function crateRequest({action,resellerId=null,crates=0,covers=0,day,driver='',reference='',notes='',invoiceId=null,countEventId=null,requestId}) {
  const c=Number(crates||0),v=Number(covers||0)
  if(!Number.isSafeInteger(c)||!Number.isSafeInteger(v)||c<0||v<0)throw new Error('Use whole quantities of zero or more.')
  return {p_request_id:requestId,p_action:action,p_reseller_id:resellerId,p_crates:c,p_covers:v,p_day:day,p_driver:driver.trim(),p_reference:reference.trim(),p_notes:notes,p_invoice_id:invoiceId,p_count_event_id:countEventId}
}
export async function fetchCrateRows(client,table) {
  const rows=[]
  for(let start=0;;start+=500){
    const {data,error}=await client.from(table).select('*').order(table==='crate_inventory_locations'?'location_key':'created_at',{ascending:false}).range(start,start+499)
    if(error)throw error
    rows.push(...(data||[]))
    if((data||[]).length<500)return rows
  }
}
export function dailyCrateMovements(events,key,day){
  const result={sent:[0,0],received:[0,0]}
  for(const e of events){
    if(e.business_date!==day||!['dispatch','collection'].includes(e.action)||(key!=='production'&&e.location_key!==key))continue
    const sent=key==='production'?e.action==='dispatch':e.action==='collection'
    const pair=result[sent?'sent':'received'];pair[0]+=e.crates;pair[1]+=e.covers
  }
  return result
}
