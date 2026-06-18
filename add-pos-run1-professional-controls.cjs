const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-before-pos-run1.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

// 1. Add RUN 1 states
app = app.replace(
  "const [stockInNote, setStockInNote] = useState('')",
  `const [stockInNote, setStockInNote] = useState('')
 const [stockInTransferNo, setStockInTransferNo] = useState('')
 const [stockInTransferredBy, setStockInTransferredBy] = useState('')
 const [stockInReceivedBy, setStockInReceivedBy] = useState('')
 const [transactionSearch, setTransactionSearch] = useState('')
 const [closingOpeningCash, setClosingOpeningCash] = useState('')
 const [closingActualCash, setClosingActualCash] = useState('')
 const [closingClosedBy, setClosingClosedBy] = useState('')
 const [closingRemarks, setClosingRemarks] = useState('')`
);

// 2. Upgrade stock-in reference number
app = app.replace(
  "const referenceNo = 'STOCKIN-' + Date.now()",
  "const referenceNo = stockInTransferNo.trim() || ('STOCKIN-' + Date.now())"
);

// 3. Upgrade stock-in remarks
app = app.replace(
  "remarks: stockInNote || 'Stock in to outlet'",
  "remarks: [stockInNote || 'Stock in to outlet', stockInTransferredBy ? 'Transferred by: ' + stockInTransferredBy : '', stockInReceivedBy ? 'Received by: ' + stockInReceivedBy : ''].filter(Boolean).join(' | ')"
);

// 4. Clear new stock-in fields after save
app = app.replace(
  "setStockInNote('')",
  "setStockInNote('')\n   setStockInTransferNo('')\n   setStockInTransferredBy('')\n   setStockInReceivedBy('')"
);

// 5. Add shift closing function before useEffect
app = app.replace(
  "useEffect(() => { loadPosMonitor() }, [posDate])",
  `async function saveShiftClosing() {
  const openingCash = safeNum(closingOpeningCash, 0)
  const actualCash = safeNum(closingActualCash, 0)
  const cashSales = posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'cash').reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
  const gcashSales = posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'gcash').reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
  const onlineSales = posSales.filter(s => String(s.payment_method || '').toLowerCase().includes('online')).reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
  const totalSales = posSales.reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
  const expectedCash = openingCash + cashSales
  const variance = actualCash - expectedCash

  if (!closingClosedBy.trim()) {
   alert('Please enter who closed the shift.')
   return
  }

  try {
   const { error } = await supabase.from('pos_shift_closings').insert([{
    outlet_id: 'OUTLET-MALUED',
    business_date: posDate,
    opening_cash: openingCash,
    cash_sales: cashSales,
    gcash_sales: gcashSales,
    online_sales: onlineSales,
    total_sales: totalSales,
    expected_cash: expectedCash,
    actual_cash: actualCash,
    cash_variance: variance,
    transaction_count: posSales.length,
    closed_by: closingClosedBy,
    remarks: closingRemarks
   }])

   if (error) throw error

   alert('Shift closing saved successfully.')
   setClosingOpeningCash('')
   setClosingActualCash('')
   setClosingClosedBy('')
   setClosingRemarks('')
  } catch (err) {
   console.error('Shift closing failed:', err)
   alert('Shift closing failed: ' + (err?.message || String(err)))
  }
 }

 useEffect(() => { loadPosMonitor() }, [posDate])`
);

// 6. Add RUN 1 calculated reports before outletBalances
app = app.replace(
  "const outletBalances = posProducts.map(product => {",
  `const lowStockProducts = posProducts.map(product => {
  const key = product.id || product.product_name
  const movementQty = safeNum(movementMap[key], 0)
  const remainingStock = safeNum(product.stock, 0) + movementQty
  const minStock = safeNum(product.min_stock, 10)
  return {
   id: product.id,
   product_name: product.product_name || product.name || 'Unnamed Product',
   category: product.category || '',
   remainingStock,
   minStock,
   status: remainingStock <= 0 ? 'Out of Stock' : remainingStock <= minStock ? 'Low Stock' : 'OK'
  }
 }).filter(p => p.status !== 'OK').sort((a,b) => a.remainingStock - b.remainingStock)

 const movementSummaryMap = {}
 posMovements.forEach(move => {
  const type = move.movement_type || 'movement'
  if (!movementSummaryMap[type]) movementSummaryMap[type] = { type, qty: 0, count: 0 }
  movementSummaryMap[type].qty += safeNum(move.qty, 0)
  movementSummaryMap[type].count += 1
 })
 const movementSummary = Object.values(movementSummaryMap).sort((a,b) => String(a.type).localeCompare(String(b.type)))

 const searchedReceipts = posSales.filter(s => {
  const text = [
   s.receipt_no,
   s.cashier_name,
   s.payment_method,
   s.customer_name,
   s.net_total,
   s.total,
   s.total_amount
  ].join(' ').toLowerCase()
  return !transactionSearch.trim() || text.includes(transactionSearch.toLowerCase())
 })

 const closingCashSales = posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'cash').reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
 const closingGcashSales = posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'gcash').reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
 const closingOnlineSales = posSales.filter(s => String(s.payment_method || '').toLowerCase().includes('online')).reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
 const closingTotalSales = posSales.reduce((sum, s) => sum + safeNum(s.net_total || s.total || s.total_amount, 0), 0)
 const closingExpectedCash = safeNum(closingOpeningCash, 0) + closingCashSales
 const closingVariance = safeNum(closingActualCash, 0) - closingExpectedCash

 const outletBalances = posProducts.map(product => {`
);

// 7. Add transfer reference inputs inside Stock In card
app = app.replace(
  `<div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '2fr 1fr 2fr auto', gap:'10px', alignItems:'end' }}>`,
  `<div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Transfer No.</label>
      <input value={stockInTransferNo} onChange={e=>setStockInTransferNo(e.target.value)} placeholder="Example: TR-MALUED-001" style={{...inputStyle, marginBottom:0}} />
     </div>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Transferred By</label>
      <input value={stockInTransferredBy} onChange={e=>setStockInTransferredBy(e.target.value)} placeholder="Sender name" style={{...inputStyle, marginBottom:0}} />
     </div>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Received By</label>
      <input value={stockInReceivedBy} onChange={e=>setStockInReceivedBy(e.target.value)} placeholder="Receiver name" style={{...inputStyle, marginBottom:0}} />
     </div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '2fr 1fr 2fr auto', gap:'10px', alignItems:'end' }}>`
);

// 8. Insert Low Stock Alert + Shift Closing before Stock In to Outlet
app = app.replace(
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Stock In to Outlet</h3>`,
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Low Stock Alert Dashboard</h3>
    {lowStockProducts.length === 0 ? (
     <p style={{ color:'#2d8a4e', fontSize:'13px', margin:0 }}>No low stock alerts for this outlet.</p>
    ) : (
     <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : 'repeat(3, 1fr)', gap:'10px' }}>
      {lowStockProducts.slice(0, 12).map(p => (
       <div key={p.id || p.product_name} style={{ border:'1px solid #ffd4d4', background:'#fff7f7', borderRadius:'12px', padding:'10px' }}>
        <strong style={{ color:'#ca1b1b', display:'block' }}>{p.product_name}</strong>
        <span style={{ fontSize:'12px', color:'#777' }}>{p.category}</span><br/>
        <span style={{ fontSize:'12px' }}>Remaining: <strong>{p.remainingStock}</strong> / Min: {p.minStock}</span><br/>
        <span style={{ fontSize:'12px', color:'#ca1b1b', fontWeight:'bold' }}>{p.status}</span>
       </div>
      ))}
     </div>
    )}
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Shift Closing Report</h3>
    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : 'repeat(4, 1fr)', gap:'10px', marginBottom:'12px' }}>
     <div style={{ background:'#fff8e8', border:'1px solid #ffe0a3', borderRadius:'12px', padding:'10px' }}>
      <small>Cash Sales</small><br/><strong>?{closingCashSales.toLocaleString()}</strong>
     </div>
     <div style={{ background:'#fff8e8', border:'1px solid #ffe0a3', borderRadius:'12px', padding:'10px' }}>
      <small>GCash Sales</small><br/><strong>?{closingGcashSales.toLocaleString()}</strong>
     </div>
     <div style={{ background:'#fff8e8', border:'1px solid #ffe0a3', borderRadius:'12px', padding:'10px' }}>
      <small>Total POS Sales</small><br/><strong>?{closingTotalSales.toLocaleString()}</strong>
     </div>
     <div style={{ background:'#fff8e8', border:'1px solid #ffe0a3', borderRadius:'12px', padding:'10px' }}>
      <small>Transactions</small><br/><strong>{posSales.length}</strong>
     </div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : 'repeat(4, 1fr)', gap:'10px', alignItems:'end' }}>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Opening Cash</label>
      <input type="number" value={closingOpeningCash} onChange={e=>setClosingOpeningCash(e.target.value)} placeholder="0" style={{...inputStyle, marginBottom:0}} />
     </div>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Actual Cash Counted</label>
      <input type="number" value={closingActualCash} onChange={e=>setClosingActualCash(e.target.value)} placeholder="0" style={{...inputStyle, marginBottom:0}} />
     </div>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Closed By</label>
      <input value={closingClosedBy} onChange={e=>setClosingClosedBy(e.target.value)} placeholder="Cashier / manager" style={{...inputStyle, marginBottom:0}} />
     </div>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Remarks</label>
      <input value={closingRemarks} onChange={e=>setClosingRemarks(e.target.value)} placeholder="Optional" style={{...inputStyle, marginBottom:0}} />
     </div>
    </div>

    <div style={{ marginTop:'12px', padding:'10px', borderRadius:'12px', background:'#f8f8f8', fontSize:'13px' }}>
     Expected Cash: <strong>?{closingExpectedCash.toLocaleString()}</strong> | 
     Variance: <strong style={{ color:closingVariance === 0 ? '#2d8a4e' : '#ca1b1b' }}>?{closingVariance.toLocaleString()}</strong>
    </div>

    <button onClick={saveShiftClosing} style={{...btnGreen, marginTop:'12px'}}>Save Shift Closing</button>
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Stock In to Outlet</h3>`
);

// 9. Insert Product Movement Summary before Inventory Movements
app = app.replace(
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Inventory Movements</h3>`,
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Product Movement Summary</h3>
    {movementSummary.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No movement summary found.</p> : (
     <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'500px' }}>
       <thead>
        <tr style={{ background:'#f8f8f8' }}>
         <th style={{ textAlign:'left', padding:'8px' }}>Movement Type</th>
         <th style={{ textAlign:'right', padding:'8px' }}>Total Qty</th>
         <th style={{ textAlign:'right', padding:'8px' }}>Records</th>
        </tr>
       </thead>
       <tbody>
        {movementSummary.map(row => (
         <tr key={row.type}>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', fontWeight:'bold' }}>{row.type}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right' }}>{row.qty}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right' }}>{row.count}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Inventory Movements</h3>`
);

// 10. Upgrade Recent Receipts with transaction search if exact card exists
app = app.replace(
  `<h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>`,
  `<h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>
    <input value={transactionSearch} onChange={e=>setTransactionSearch(e.target.value)} placeholder="Search receipt, cashier, payment method..." style={{...inputStyle, marginBottom:'10px'}} />`
);

app = app.replace(
  /posSales\.slice\(0,\s*20\)\.map/g,
  "searchedReceipts.slice(0, 20).map"
);

fs.writeFileSync(file, app);
console.log("RUN 1 Professional POS Controls added.");
