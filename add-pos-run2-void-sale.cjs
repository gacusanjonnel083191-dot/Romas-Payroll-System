const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-before-pos-run2-void.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

if (app.includes("voidAdminPin")) {
  console.log("RUN 2 Void Sale patch already appears to be installed.");
  process.exit(0);
}

// 1. Add void states after transactionSearch state
app = app.replace(
  "const [transactionSearch, setTransactionSearch] = useState('')",
  `const [transactionSearch, setTransactionSearch] = useState('')
 const [voidReceiptNo, setVoidReceiptNo] = useState('')
 const [voidReason, setVoidReason] = useState('')
 const [voidedBy, setVoidedBy] = useState('')
 const [voidAdminPin, setVoidAdminPin] = useState('')`
);

// 2. Add void sale function before saveShiftClosing
app = app.replace(
  "async function saveShiftClosing() {",
  `async function voidSaleWithAdminPin() {
  const receiptNo = String(voidReceiptNo || '').trim()
  const reason = String(voidReason || '').trim()
  const adminPin = String(voidAdminPin || '').trim()
  const userName = String(voidedBy || '').trim()

  if (!receiptNo) {
   alert('Please enter the receipt number to void.')
   return
  }

  if (!reason) {
   alert('Void reason is required.')
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
   alert('Receipt not found in the selected business date. Please check the date or receipt number.')
   return
  }

  if (String(sale.status || '').toLowerCase() === 'void') {
   alert('This receipt is already voided.')
   return
  }

  const confirmVoid = confirm('Void receipt ' + receiptNo + '? This will mark the sale as VOID and return sold inventory.')
  if (!confirmVoid) return

  try {
   const saleId = sale.id || sale.sale_id || receiptNo
   const originalTotal = safeNum(sale.net_total || sale.total || sale.total_amount, 0)

   const relatedItems = posItems.filter(item => String(item.receipt_no || '') === receiptNo || String(item.sale_id || '') === String(saleId))

   const { error: saleError } = await supabase
    .from('pos_sales')
    .update({
     status: 'void',
     voided_at: new Date().toISOString(),
     voided_by: userName,
     void_reason: reason
    })
    .eq('receipt_no', receiptNo)

   if (saleError) throw saleError

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

   if (relatedItems.length > 0) {
    const returnMovements = relatedItems.map(item => ({
     outlet_id: 'OUTLET-MALUED',
     product_id: item.product_id || '',
     sku: item.sku || '',
     barcode: item.barcode || '',
     product_name: item.product_name || item.name || '',
     movement_type: 'void_return',
     qty: safeNum(item.qty, 0),
     reference_no: 'VOID-' + receiptNo,
     remarks: 'Inventory returned from voided receipt ' + receiptNo + ' | Reason: ' + reason
    })).filter(move => move.qty > 0)

    if (returnMovements.length > 0) {
     const { error: movementError } = await supabase
      .from('pos_inventory_movements')
      .insert(returnMovements)

     if (movementError) throw movementError
    }
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

// 3. Make sales calculations exclude voided sales
app = app.replace(
  "const totalSales = posSales.reduce((sum,sale) => sum + safeNum(sale.net_total || sale.total || sale.total_amount, 0), 0)",
  "const activePosSales = posSales.filter(sale => String(sale.status || 'completed').toLowerCase() !== 'void')\n const totalSales = activePosSales.reduce((sum,sale) => sum + safeNum(sale.net_total || sale.total || sale.total_amount, 0), 0)"
);

app = app.replaceAll(
  "posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'cash')",
  "activePosSales.filter(s => String(s.payment_method || '').toLowerCase() === 'cash')"
);

app = app.replaceAll(
  "posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'gcash')",
  "activePosSales.filter(s => String(s.payment_method || '').toLowerCase() === 'gcash')"
);

app = app.replaceAll(
  "posSales.filter(s => String(s.payment_method || '').toLowerCase().includes('online'))",
  "activePosSales.filter(s => String(s.payment_method || '').toLowerCase().includes('online'))"
);

app = app.replaceAll(
  "posSales.reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)",
  "activePosSales.reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)"
);

app = app.replaceAll(
  "transaction_count: posSales.length",
  "transaction_count: activePosSales.length"
);

app = app.replaceAll(
  "{posSales.length}",
  "{activePosSales.length}"
);

// 4. Make search show all receipts but keep status visible
app = app.replace(
  "const searchedReceipts = posSales.filter(s => {",
  "const searchedReceipts = posSales.filter(s => {"
);

// 5. Insert Void Sale card before Recent Receipts
app = app.replace(
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>`,
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Void / Cancel Sale</h3>
    <p style={{ margin:'0 0 12px', color:'#777', fontSize:'13px' }}>Void a receipt with admin PIN. Inventory will be returned automatically.</p>

    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '1fr 2fr 1fr 1fr auto', gap:'10px', alignItems:'end' }}>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Receipt No.</label>
      <input value={voidReceiptNo} onChange={e=>setVoidReceiptNo(e.target.value)} placeholder="ROMA-..." style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Reason</label>
      <input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Wrong item / cancelled / encoding error" style={{...inputStyle, marginBottom:0}} />
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
      onClick={voidSaleWithAdminPin}
      style={{...btnRed, width:'auto', marginTop:0}}
     >
      Void Sale
     </button>
    </div>
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>`
);

// 6. Add status display inside receipt rows if there is receipt total text
app = app.replaceAll(
  `{sale.payment_method || 'Cash'}`,
  `{sale.payment_method || 'Cash'} {String(sale.status || 'completed').toLowerCase() === 'void' ? ' • VOID' : ''}`
);

fs.writeFileSync(file, app);
console.log("RUN 2 Void Sale with Admin PIN added.");
