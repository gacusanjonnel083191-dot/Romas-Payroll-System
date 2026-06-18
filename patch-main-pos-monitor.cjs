const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const posMonitorComponent = `

function PosMonitorPanel() {
 const [date, setDate] = useState(getTodayDate())
 const [loading, setLoading] = useState(false)
 const [sales, setSales] = useState([])
 const [items, setItems] = useState([])
 const [movements, setMovements] = useState([])
 const [error, setError] = useState('')

 async function loadPOSMonitor() {
  setLoading(true)
  setError('')
  try {
   const [salesRes, itemsRes, moveRes] = await Promise.all([
    supabase
     .from('pos_sales')
     .select('*')
     .eq('business_date', date)
     .order('created_at', { ascending:false }),
    supabase
     .from('pos_sale_items')
     .select('*')
     .gte('created_at', date + 'T00:00:00')
     .lte('created_at', date + 'T23:59:59')
     .order('created_at', { ascending:false }),
    supabase
     .from('pos_inventory_movements')
     .select('*')
     .gte('created_at', date + 'T00:00:00')
     .lte('created_at', date + 'T23:59:59')
     .order('created_at', { ascending:false })
     .limit(200)
   ])

   if (salesRes.error) throw salesRes.error
   if (itemsRes.error) throw itemsRes.error
   if (moveRes.error) throw moveRes.error

   setSales(salesRes.data || [])
   setItems(itemsRes.data || [])
   setMovements(moveRes.data || [])
  } catch(err) {
   console.error('POS Monitor load failed:', err)
   setError(err?.message || String(err))
   setSales([])
   setItems([])
   setMovements([])
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  loadPOSMonitor()
 }, [date])

 const totalSales = sales.reduce((sum, row) => sum + safeNum(row.net_total, 0), 0)
 const cashSales = sales.filter(row => String(row.payment_method || '').toLowerCase() === 'cash').reduce((sum, row) => sum + safeNum(row.net_total, 0), 0)
 const gcashSales = sales.filter(row => String(row.payment_method || '').toLowerCase().includes('gcash')).reduce((sum, row) => sum + safeNum(row.net_total, 0), 0)
 const onlineSales = sales.filter(row => String(row.payment_method || '').toLowerCase().includes('online')).reduce((sum, row) => sum + safeNum(row.net_total, 0), 0)
 const transactionCount = sales.length
 const avgTransaction = transactionCount > 0 ? totalSales / transactionCount : 0

 const productMap = {}
 items.forEach(item => {
  const key = item.product_id || item.product_name
  if (!productMap[key]) {
   productMap[key] = {
    product_name:item.product_name || 'Unnamed Product',
    category:item.category || '',
    qty:0,
    total:0
   }
  }
  productMap[key].qty += safeNum(item.qty, 0)
  productMap[key].total += safeNum(item.line_total, 0)
 })
 const topProducts = Object.values(productMap).sort((a,b) => safeNum(b.qty,0) - safeNum(a.qty,0)).slice(0, 20)

 const statCard = (label, value, note, color = '#ca1b1b') => (
  <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
   <p style={{ margin:'0 0 6px', color:'#777', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:'bold' }}>{label}</p>
   <h3 style={{ margin:'0 0 4px', color, fontSize:'22px' }}>{value}</h3>
   {note && <p style={{ margin:0, color:'#999', fontSize:'11px' }}>{note}</p>}
  </div>
 )

 return (
  <div>
   <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px', flexWrap:'wrap', marginBottom:'16px' }}>
    <div>
     <h2 style={{...h2s, marginBottom:'4px' }}>Outlet POS Monitor</h2>
     <p style={{ color:'#777', fontSize:'13px', margin:0 }}>Real-time monitoring for Roma’s Donuts outlet POS sales, payments, product movement, and inventory deductions.</p>
    </div>
    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
     <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inputStyle, marginBottom:0, width:'auto' }} />
     <button style={{...btnGreen, width:'auto', marginTop:0 }} onClick={loadPOSMonitor} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
    </div>
   </div>

   {error && (
    <div style={{ background:'#fff5f5', border:'1px solid #ffd0d0', color:'#8b0000', borderRadius:'12px', padding:'12px', marginBottom:'14px', fontSize:'12px' }}>
     POS Monitor failed to load: {error}
    </div>
   )}

   <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(5, 1fr)', gap:'12px', marginBottom:'16px' }}>
    {statCard('Total POS Sales', php(totalSales), date)}
    {statCard('Cash Sales', php(cashSales), 'Cash collected', '#2d8a4e')}
    {statCard('GCash Sales', php(gcashSales), 'Digital payment', '#4a90d9')}
    {statCard('Online Sales', php(onlineSales), 'Other online payments', '#1a1a2e')}
    {statCard('Transactions', transactionCount, 'Avg: ' + php(avgTransaction), '#ca1b1b')}
   </div>

   <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1.2fr 1fr', gap:'14px', marginBottom:'14px' }}>
    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
     <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Top Selling Products</h3>
     {topProducts.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No POS items found for this date.</p> : (
      <div style={{ overflowX:'auto' }}>
       <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
        <thead>
         <tr style={{ background:'#f8f8f8' }}>
          <th style={{ textAlign:'left', padding:'8px', borderBottom:'1px solid #eee' }}>Product</th>
          <th style={{ textAlign:'right', padding:'8px', borderBottom:'1px solid #eee' }}>Qty</th>
          <th style={{ textAlign:'right', padding:'8px', borderBottom:'1px solid #eee' }}>Sales</th>
         </tr>
        </thead>
        <tbody>
         {topProducts.map((row, i) => (
          <tr key={row.product_name + i}>
           <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}>
            <strong>{row.product_name}</strong>
            <p style={{ margin:'2px 0 0', color:'#999', fontSize:'10px' }}>{row.category}</p>
           </td>
           <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold' }}>{row.qty}</td>
           <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold', color:'#ca1b1b' }}>{php(row.total)}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </div>

    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
     <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>
     {sales.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No POS receipts found for this date.</p> : (
      <div style={{ display:'grid', gap:'8px' }}>
       {sales.slice(0, 12).map(sale => (
        <div key={sale.id} style={{ border:'1px solid #f0f0f0', borderRadius:'10px', padding:'10px', background:'#fafafa' }}>
         <div style={{ display:'flex', justifyContent:'space-between', gap:'8px' }}>
          <strong style={{ color:'#1a1a2e', fontSize:'12px' }}>{sale.receipt_no}</strong>
          <strong style={{ color:'#ca1b1b', fontSize:'12px' }}>{php(sale.net_total)}</strong>
         </div>
         <p style={{ margin:'4px 0 0', color:'#777', fontSize:'11px' }}>{sale.outlet_name || 'Outlet'} • {sale.cashier_name || 'Cashier'} • {sale.payment_method || '-'}</p>
         <p style={{ margin:'2px 0 0', color:'#aaa', fontSize:'10px' }}>{formatDateTimeForAdmin(sale.created_at)}</p>
        </div>
       ))}
      </div>
     )}
    </div>
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Inventory Movements</h3>
    {movements.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No POS inventory movement found for this date.</p> : (
     <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'760px' }}>
       <thead>
        <tr style={{ background:'#f8f8f8' }}>
         <th style={{ textAlign:'left', padding:'8px', borderBottom:'1px solid #eee' }}>Time</th>
         <th style={{ textAlign:'left', padding:'8px', borderBottom:'1px solid #eee' }}>Product</th>
         <th style={{ textAlign:'left', padding:'8px', borderBottom:'1px solid #eee' }}>Movement</th>
         <th style={{ textAlign:'right', padding:'8px', borderBottom:'1px solid #eee' }}>Qty</th>
         <th style={{ textAlign:'left', padding:'8px', borderBottom:'1px solid #eee' }}>Reference</th>
        </tr>
       </thead>
       <tbody>
        {movements.slice(0, 100).map(move => (
         <tr key={move.id}>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', color:'#777' }}>{formatDateTimeForAdmin(move.created_at)}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}>
           <strong>{move.product_name}</strong>
           <p style={{ margin:'2px 0 0', color:'#999', fontSize:'10px' }}>{move.sku || ''} {move.barcode ? '• ' + move.barcode : ''}</p>
          </td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}>{move.movement_type}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold', color:safeNum(move.qty,0) < 0 ? '#ca1b1b' : '#2d8a4e' }}>{move.qty}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', color:'#777' }}>{move.reference_no || '-'}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </div>
  </div>
 )
}
`;

if (!app.includes("function PosMonitorPanel()")) {
 app = app.replace("function Badge({ label, color }) {", posMonitorComponent + "\nfunction Badge({ label, color }) {");
}

// Add POS section to admin navigation after dashboard section.
if (!app.includes("key:'posMonitor'")) {
 app = app.replace(
`{ key:'dashboard', icon:'??', label:'Dashboard',
 tabs:[{key:'dashboard',label:'Overview'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },`,
`{ key:'dashboard', icon:'??', label:'Dashboard',
 tabs:[{key:'dashboard',label:'Overview'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },
 { key:'posMonitor', icon:'??', label:'POS Monitor',
 tabs:[{key:'posMonitor',label:'Outlet POS Monitor'}],
 roles:['owner','manager'] },`
 );
}

// Add render block before Audit Trail, a stable insertion point in the admin content area.
if (!app.includes("{/* POS MONITOR */}")) {
 app = app.replace(
`{/* AUDIT TRAIL */}
 {activeTab==='auditTrail' && (`,
`{/* POS MONITOR */}
 {activeTab==='posMonitor' && canAccess('posMonitor') && (
  <PosMonitorPanel />
 )}

 {/* AUDIT TRAIL */}
 {activeTab==='auditTrail' && (`
 );
}

fs.writeFileSync(file, app);
console.log("Outlet POS Monitor added to main Roma's Donuts app.");
