const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/

function replaceExactlyOnce(source, from, to, label) {
  const firstIndex = source.indexOf(from)
  if (firstIndex < 0) throw new Error(`Reseller manual copy-last-order patch failed: ${label} was not found.`)
  const secondIndex = source.indexOf(from, firstIndex + from.length)
  if (secondIndex >= 0) throw new Error(`Reseller manual copy-last-order patch failed: ${label} matched more than once.`)
  return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

const ORDER_ITEMS_STATE = " const [resellerOrderItems, setResellerOrderItems] = useState([])\n"
const SUBMIT_ORDER_ANCHOR = " async function submitResellerOrder() {\n"

const COPY_LAST_ORDER_HANDLER = ` async function copyLastOrderToManualOrder() {
 if (resellerManualOrderCopying || editingResellerOrderId) return
 const orderBranch = resellerPortalBranches.find(b => String(b.id) === String(selectedResellerBranchId)) || currentReseller
 if (!orderBranch?.id) { showToast(' Select the branch/outlet for this order first.', 'red'); return }
 setResellerManualOrderCopying(true)
 try {
  const excludedStatuses = ['cancelled','canceled','void','voided','rejected','deleted']
  const isUsableOrder = order => (
   String(order?.reseller_id || '') === String(orderBranch.id)
   && !excludedStatuses.includes(String(order?.status || '').toLowerCase())
   && Array.isArray(order?.reseller_order_items)
   && order.reseller_order_items.some(item=>safeNum(item?.quantity,0)>0)
  )
  let recentOrders = resellerOrders.filter(isUsableOrder)
  if (recentOrders.length === 0) {
   const { data, error } = await supabase
    .from('reseller_orders')
    .select('*, reseller_order_items(*)')
    .eq('reseller_id', orderBranch.id)
    .order('created_at',{ascending:false})
    .limit(20)
   if (error) throw error
   recentOrders = (data || []).filter(isUsableOrder)
  }
  recentOrders = recentOrders.slice().sort((a,b)=>String(b?.created_at || b?.order_date || '').localeCompare(String(a?.created_at || a?.order_date || '')))
  const lastOrder = recentOrders[0]
  if (!lastOrder) {
   showToast(' No previous order with product quantities was found for this branch/outlet.', 'red')
   return
  }
  const lastQuantityByVariant = new Map()
  ;(lastOrder.reseller_order_items || []).forEach(item=>{
   const variantId = String(item?.variant_id || '')
   if (!variantId) return
   const quantity = Math.max(0, Math.round(safeNum(item?.quantity,0)))
   lastQuantityByVariant.set(variantId, safeNum(lastQuantityByVariant.get(variantId),0) + quantity)
  })
  const copiedItems = resellerOrderItems.map(item=>{
   const quantity = Math.max(0, Math.round(safeNum(lastQuantityByVariant.get(String(item.variant_id)),0)))
   return { ...item, quantity:quantity > 0? String(quantity):'' }
  })
  const copiedCount = copiedItems.filter(item=>safeNum(item.quantity,0)>0).length
  const copiedPieces = copiedItems.reduce((sum,item)=>sum+safeNum(item.quantity,0),0)
  setResellerOrderItems(copiedItems)
  const lastOrderDate = lastOrder.delivery_date || lastOrder.order_date || String(lastOrder.created_at || '').slice(0,10)
  const dateSuffix = lastOrderDate? ' (' + lastOrderDate + ')': ''
  showToast(' Copied ' + copiedCount + ' product quantities (' + copiedPieces + ' pieces) from the last order' + dateSuffix + '. Review and edit before submitting.')
 } catch (err) {
  showToast(' Could not copy the last order: ' + (err?.message || err), 'red')
 } finally {
  setResellerManualOrderCopying(false)
 }
 }

`

const MANUAL_ORDER_HEADER = ` <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
 <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:0 }}>Enter quantities for {currentReseller.name}</p>
 <button style={{...btnGray, width:'auto', padding:'7px 12px', marginTop:0, fontSize:'11px', opacity:editingResellerOrderId?0.55:1, cursor:editingResellerOrderId?'not-allowed':'pointer' }} disabled={!!editingResellerOrderId} onClick={()=>loadResellerOrderItems(currentReseller.id)}> SHOW ALL VARIANTS</button>
 </div>`

const MANUAL_ORDER_HEADER_WITH_COPY = ` <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
 <p style={{ fontWeight:'bold', color:'#333', fontSize:'13px', margin:0 }}>Enter quantities for {currentReseller.name}</p>
 <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', justifyContent:'flex-end' }}>
 <button style={{...btnYellow, width:'auto', padding:'7px 12px', marginTop:0, fontSize:'11px', opacity:(resellerManualOrderCopying||submittingOrder||updatingResellerOrder||editingResellerOrderId)?0.55:1, cursor:(resellerManualOrderCopying||submittingOrder||updatingResellerOrder||editingResellerOrderId)?'not-allowed':'pointer' }} disabled={resellerManualOrderCopying || submittingOrder || updatingResellerOrder || !!editingResellerOrderId} onClick={copyLastOrderToManualOrder}>{resellerManualOrderCopying?' COPYING...':' COPY FROM LAST ORDER'}</button>
 <button style={{...btnGray, width:'auto', padding:'7px 12px', marginTop:0, fontSize:'11px', opacity:editingResellerOrderId?0.55:1, cursor:editingResellerOrderId?'not-allowed':'pointer' }} disabled={!!editingResellerOrderId} onClick={()=>loadResellerOrderItems(currentReseller.id)}> SHOW ALL VARIANTS</button>
 </div>
 </div>`

export function applyResellerManualCopyLastOrder(rawCode, filePath = 'src/App.jsx') {
  let code = String(rawCode || '').replace(/\r\n/g, '\n')
  code = replaceExactlyOnce(
    code,
    ORDER_ITEMS_STATE,
    ORDER_ITEMS_STATE + " const [resellerManualOrderCopying, setResellerManualOrderCopying] = useState(false)\n",
    'manual-order copy loading state',
  )
  code = replaceExactlyOnce(
    code,
    SUBMIT_ORDER_ANCHOR,
    COPY_LAST_ORDER_HANDLER + SUBMIT_ORDER_ANCHOR,
    'manual-order submit handler anchor',
  )
  code = replaceExactlyOnce(
    code,
    MANUAL_ORDER_HEADER,
    MANUAL_ORDER_HEADER_WITH_COPY,
    'manual-order quantity header',
  )

  if (!code.includes("COPY FROM LAST ORDER") || !code.includes('copyLastOrderToManualOrder')) {
    throw new Error(`Reseller manual copy-last-order patch failed validation in ${filePath}.`)
  }
  return code
}

export function resellerManualCopyLastOrder() {
  return {
    name: 'reseller-manual-copy-last-order',
    enforce: 'pre',
    transform(code, id) {
      if (!APP_MODULE_RE.test(String(id || ''))) return null
      return { code: applyResellerManualCopyLastOrder(code, id), map: null }
    },
  }
}

export default resellerManualCopyLastOrder
