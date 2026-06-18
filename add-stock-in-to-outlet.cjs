const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Add stock-in form state after posProducts state
app = app.replace(
  "const [posProducts, setPosProducts] = useState([])",
  `const [posProducts, setPosProducts] = useState([])
 const [stockInProductId, setStockInProductId] = useState('')
 const [stockInQty, setStockInQty] = useState('')
 const [stockInNote, setStockInNote] = useState('')`
);

// Add stock-in function before useEffect inside PosMonitorPanel
app = app.replace(
  "useEffect(() => { loadPosMonitor() }, [posDate])",
  `async function saveOutletStockIn() {
  if (!stockInProductId) {
   alert('Please select a product.')
   return
  }

  const qty = safeNum(stockInQty, 0)
  if (qty <= 0) {
   alert('Please enter a valid stock-in quantity.')
   return
  }

  const product = posProducts.find(p => String(p.id) === String(stockInProductId))
  if (!product) {
   alert('Selected product not found.')
   return
  }

  const referenceNo = 'STOCKIN-' + Date.now()

  try {
   const { error } = await supabase.from('pos_inventory_movements').insert([{
    outlet_id: 'OUTLET-MALUED',
    product_id: product.id,
    sku: product.sku || '',
    barcode: product.barcode || '',
    product_name: product.product_name || product.name || '',
    movement_type: 'stock_in',
    qty: qty,
    reference_no: referenceNo,
    remarks: stockInNote || 'Stock in to outlet'
   }])

   if (error) throw error

   alert('Stock in saved successfully.')
   setStockInProductId('')
   setStockInQty('')
   setStockInNote('')
   await loadPosMonitor()
  } catch (err) {
   console.error('Stock in failed:', err)
   alert('Stock in failed: ' + (err?.message || String(err)))
  }
 }

 useEffect(() => { loadPosMonitor() }, [posDate])`
);

// Insert Stock In card before Outlet Inventory Balance
app = app.replace(
`<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Outlet Inventory Balance</h3>`,
`<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Stock In to Outlet</h3>
    <p style={{ margin:'0 0 12px', color:'#777', fontSize:'13px' }}>Record products delivered or transferred to Roma’s Donuts - Malued.</p>

    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '2fr 1fr 2fr auto', gap:'10px', alignItems:'end' }}>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Product</label>
      <select value={stockInProductId} onChange={e=>setStockInProductId(e.target.value)} style={{...inputStyle, marginBottom:0}}>
       <option value="">Select product</option>
       {posProducts.map(p => (
        <option key={p.id} value={p.id}>{p.product_name || p.name}</option>
       ))}
      </select>
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Qty</label>
      <input type="number" min="1" value={stockInQty} onChange={e=>setStockInQty(e.target.value)} placeholder="0" style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Remarks</label>
      <input value={stockInNote} onChange={e=>setStockInNote(e.target.value)} placeholder="Delivery / transfer note" style={{...inputStyle, marginBottom:0}} />
     </div>

     <button onClick={saveOutletStockIn} style={{...btnGreen, width:'auto', marginTop:0}}>Save Stock In</button>
    </div>
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Outlet Inventory Balance</h3>`
);

fs.writeFileSync(file, app);
console.log("Stock In to Outlet added to SAGS POS.");
