const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-before-clean-run2-void.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

if (app.includes("cleanVoidSaleWithAdminPin")) {
  console.log("Clean RUN 2 Void Sale already installed.");
  process.exit(0);
}

// Add void states after transaction search
app = app.replace(
  "const [transactionSearch, setTransactionSearch] = useState('')",
  `const [transactionSearch, setTransactionSearch] = useState('')
 const [voidReceiptNo, setVoidReceiptNo] = useState('')
 const [voidReason, setVoidReason] = useState('')
 const [voidedBy, setVoidedBy] = useState('')
 const [voidAdminPin, setVoidAdminPin] = useState('')`
);

// Add clean void function before Shift Closing function
app = app.replace(
  "async function saveShiftClosing() {",
  `async function cleanVoidSaleWithAdminPin() {
  const receiptNo = String(voidReceiptNo || '').trim()
  const reason = String(voidReason || '').trim()
  const userName = String(voidedBy || '').trim()
  const adminPin = String(voidAdminPin || '').trim()

  if (!receiptNo) {
   alert('Please enter the receipt number.')
   return
  }

  if (!reason) {
   alert('Please enter the reason for voiding.')
   return
  }

  if (!userName) {
   alert('Please enter who voided this receipt.')
   return
  }

  if (adminPin !== 'SAGS') {
   alert('Invalid admin PIN.')
   return
  }

  const sale = posSales.find(s => String(s.receipt_no || '').trim() === receiptNo)
  if (!sale) {
   alert('Receipt not found for the selected date. Check the date or receipt number.')
   return
  }

  if (String(sale.status || 'completed').toLowerCase() === 'void') {
   alert('This receipt is already voided.')
   return
  }

  const proceed = confirm('Void receipt ' + receiptNo + '? This will return inventory movements.')
  if (!proceed) return

  try {
   const saleId = sale.id || sale.sale_id || receiptNo
   const originalTotal = safeNum(sale.net_total || sale.total || sale.total_amount, 0)

   const relatedItems = posItems.filter(item =>
    String(item.receipt_no || '') === receiptNo ||
    String(item.sale_id || '') === String(saleId)
   )

   const { error: updateError } = await supabase
    .from('pos_sales')
    .update({
     status: 'void',
     voided_at: new Date().toISOString(),
     voided_by: userName,
     void_reason: reason
    })
    .eq('receipt_no', receiptNo)

   if (updateError) throw updateError

   const { error: logError } = await supabase.from('pos_void_logs').insert([{
    outlet_id: 'OUTLET-MALUED',
    receipt_no: receiptNo,
    sale_id: String(saleId),
    business_date: posDate,
    voided_by: userName,
    void_reason: reason,
    original_total: originalTotal
   }])

   if (logError) throw logError

   const returnMovements = relatedItems.map(item => ({
    outlet_id: 'OUTLET-MALUED',
    product_id: item.product_id || '',
    sku: item.sku || '',
    barcode: item.barcode || '',
    product_name: item.product_name || item.name || '',
    movement_type: 'void_return',
    qty: safeNum(item.qty, 0),
    reference_no: 'VOID-' + receiptNo,
    remarks: 'Void return for receipt ' + receiptNo + ' | Reason: ' + reason
   })).filter(move => move.qty > 0)

   if (returnMovements.length > 0) {
    const { error: movementError } = await supabase
     .from('pos_inventory_movements')
     .insert(returnMovements)

    if (movementError) throw movementError
   }

   alert('Receipt voided successfully.')
   setVoidReceiptNo('')
   setVoidReason('')
   setVoidedBy('')
   setVoidAdminPin('')
   await loadPosMonitor()
  } catch (err) {
   console.error('Void sale failed:', err)
   alert('Void sale failed: ' + (err?.message || String(err)))
  }
 }

 async function saveShiftClosing() {`
);

// Insert Void panel before Recent Receipts
app = app.replace(
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>`,
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Void / Cancel Sale</h3>
    <p style={{ margin:'0 0 12px', color:'#777', fontSize:'13px' }}>
     Void a receipt using admin PIN. The sale will be marked as void and inventory will be returned.
    </p>

    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '1fr 2fr 1fr 1fr auto', gap:'10px', alignItems:'end' }}>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Receipt No.</label>
      <input value={voidReceiptNo} onChange={e=>setVoidReceiptNo(e.target.value)} placeholder="ROMA-..." style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Reason</label>
      <input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Wrong item / cancelled / test void" style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Voided By</label>
      <input value={voidedBy} onChange={e=>setVoidedBy(e.target.value)} placeholder="Name" style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Admin PIN</label>
      <input type="password" value={voidAdminPin} onChange={e=>setVoidAdminPin(e.target.value)} placeholder="PIN" style={{...inputStyle, marginBottom:0}} />
     </div>

     <button
      onClick={cleanVoidSaleWithAdminPin}
      style={{
       background:'#ca1b1b',
       color:'white',
       border:'none',
       borderRadius:'10px',
       padding:'12px 16px',
       fontWeight:'bold',
       cursor:'pointer',
       whiteSpace:'nowrap'
      }}
     >
      Void Sale
     </button>
    </div>
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>`
);

// Add VOID label in receipts without changing totals
app = app.replaceAll(
  `{sale.payment_method || 'Cash'}`,
  `{sale.payment_method || 'Cash'} {String(sale.status || 'completed').toLowerCase() === 'void' ? ' • VOID' : ''}`
);

fs.writeFileSync(file, app);
console.log("Clean RUN 2 Void Sale added safely.");
