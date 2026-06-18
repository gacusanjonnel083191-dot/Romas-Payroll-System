const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const posPanel = `
function PosMonitorPanel() {
 const [posDate, setPosDate] = useState(getTodayDate())
 const [posLoading, setPosLoading] = useState(false)
 const [posSales, setPosSales] = useState([])
 const [posItems, setPosItems] = useState([])
 const [posMovements, setPosMovements] = useState([])
 const [posError, setPosError] = useState('')

 async function loadPosMonitor() {
  setPosLoading(true)
  setPosError('')
  try {
   const start = posDate + 'T00:00:00'
   const end = posDate + 'T23:59:59'

   const [salesRes, itemsRes, movementsRes] = await Promise.all([
    supabase.from('pos_sales').select('*').eq('business_date', posDate).order('created_at', { ascending:false }),
    supabase.from('pos_sale_items').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending:false }),
    supabase.from('pos_inventory_movements').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending:false }).limit(200)
   ])

   if (salesRes.error) throw salesRes.error
   if (itemsRes.error) throw itemsRes.error
   if (movementsRes.error) throw movementsRes.error

   setPosSales(salesRes.data || [])
   setPosItems(itemsRes.data || [])
   setPosMovements(movementsRes.data || [])
  } catch (err) {
   console.error('POS monitor error:', err)
   setPosError(err?.message || String(err))
  } finally {
   setPosLoading(false)
  }
 }

 useEffect(() => { loadPosMonitor() }, [posDate])

 const totalSales = posSales.reduce((sum, s) => sum + safeNum(s.net_total, 0), 0)
 const cashSales = posSales.filter(s => String(s.payment_method || '').toLowerCase() === 'cash').reduce((sum, s) => sum + safeNum(s.net_total, 0), 0)
 const gcashSales = posSales.filter(s => String(s.payment_method || '').toLowerCase().includes('gcash')).reduce((sum, s) => sum + safeNum(s.net_total, 0), 0)
 const onlineSales = posSales.filter(s => String(s.payment_method || '').toLowerCase().includes('online')).reduce((sum, s) => sum + safeNum(s.net_total, 0), 0)
 const avgSale = posSales.length ? totalSales / posSales.length : 0

 const productMap = {}
 posItems.forEach(item => {
  const key = item.product_id || item.product_name
  if (!productMap[key]) productMap[key] = { product_name:item.product_name || 'Unnamed', category:item.category || '', qty:0, total:0 }
  productMap[key].qty += safeNum(item.qty, 0)
  productMap[key].total += safeNum(item.line_total, 0)
 })
 const topProducts = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 20)

 const card = (label, value, note, color) => (
  <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
   <p style={{ margin:'0 0 6px', color:'#777', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:'bold' }}>{label}</p>
   <h3 style={{ margin:'0 0 4px', color:color || '#ca1b1b', fontSize:'22px' }}>{value}</h3>
   <p style={{ margin:0, color:'#999', fontSize:'11px' }}>{note}</p>
  </div>
 )

 return (
  <div>
   <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'16px' }}>
    <div>
     <h2 style={h2s}>POS Monitor</h2>
     <p style={{ margin:0, color:'#777', fontSize:'13px' }}>Outlet POS sales, payment breakdown, product movement, and inventory deductions.</p>
    </div>
    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
     <input type="date" value={posDate} onChange={e=>setPosDate(e.target.value)} style={{...inputStyle, width:'auto', marginBottom:0}} />
     <button style={{...btnGreen, width:'auto', marginTop:0}} onClick={loadPosMonitor} disabled={posLoading}>{posLoading ? 'Loading...' : 'Refresh'}</button>
    </div>
   </div>

   {posError && <div style={{ background:'#fff5f5', border:'1px solid #ffd0d0', color:'#8b0000', borderRadius:'12px', padding:'12px', marginBottom:'14px', fontSize:'12px' }}>POS Monitor error: {posError}</div>}

   <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : 'repeat(5, 1fr)', gap:'12px', marginBottom:'16px' }}>
    {card('Total POS Sales', php(totalSales), posDate, '#ca1b1b')}
    {card('Cash Sales', php(cashSales), 'Cash collected', '#2d8a4e')}
    {card('GCash Sales', php(gcashSales), 'Digital payment', '#4a90d9')}
    {card('Online Sales', php(onlineSales), 'Other online payments', '#1a1a2e')}
    {card('Transactions', posSales.length, 'Avg: ' + php(avgSale), '#ca1b1b')}
   </div>

   <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '1.2fr 1fr', gap:'14px', marginBottom:'14px' }}>
    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
     <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Top Selling Products</h3>
     {topProducts.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No POS items found for this date.</p> : (
      <div style={{ overflowX:'auto' }}>
       <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
        <thead><tr style={{ background:'#f8f8f8' }}><th style={{ textAlign:'left', padding:'8px' }}>Product</th><th style={{ textAlign:'right', padding:'8px' }}>Qty</th><th style={{ textAlign:'right', padding:'8px' }}>Sales</th></tr></thead>
        <tbody>{topProducts.map((p,i)=>(
         <tr key={p.product_name + i}>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}><strong>{p.product_name}</strong><br/><span style={{ color:'#999', fontSize:'10px' }}>{p.category}</span></td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold' }}>{p.qty}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold', color:'#ca1b1b' }}>{php(p.total)}</td>
         </tr>
        ))}</tbody>
       </table>
      </div>
     )}
    </div>

    <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
     <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Recent Receipts</h3>
     {posSales.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No POS receipts found for this date.</p> : (
      <div style={{ display:'grid', gap:'8px' }}>
       {posSales.slice(0,12).map(s=>(
        <div key={s.id} style={{ border:'1px solid #f0f0f0', borderRadius:'10px', padding:'10px', background:'#fafafa' }}>
         <div style={{ display:'flex', justifyContent:'space-between', gap:'8px' }}><strong style={{ fontSize:'12px' }}>{s.receipt_no}</strong><strong style={{ color:'#ca1b1b', fontSize:'12px' }}>{php(s.net_total)}</strong></div>
         <p style={{ margin:'4px 0 0', color:'#777', fontSize:'11px' }}>{s.outlet_name || 'Outlet'} | {s.cashier_name || 'Cashier'} | {s.payment_method || '-'}</p>
        </div>
       ))}
      </div>
     )}
    </div>
   </div>

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Inventory Movements</h3>
    {posMovements.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No POS inventory movement found for this date.</p> : (
     <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'680px' }}>
       <thead><tr style={{ background:'#f8f8f8' }}><th style={{ textAlign:'left', padding:'8px' }}>Product</th><th style={{ textAlign:'left', padding:'8px' }}>Movement</th><th style={{ textAlign:'right', padding:'8px' }}>Qty</th><th style={{ textAlign:'left', padding:'8px' }}>Reference</th></tr></thead>
       <tbody>{posMovements.slice(0,100).map(m=>(
        <tr key={m.id}>
         <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}><strong>{m.product_name}</strong><br/><span style={{ color:'#999', fontSize:'10px' }}>{m.sku || ''}</span></td>
         <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}>{m.movement_type}</td>
         <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold', color:safeNum(m.qty,0) < 0 ? '#ca1b1b' : '#2d8a4e' }}>{m.qty}</td>
         <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', color:'#777' }}>{m.reference_no || '-'}</td>
        </tr>
       ))}</tbody>
      </table>
     </div>
    )}
   </div>
  </div>
 )
}
`;

if (!app.includes("function PosMonitorPanel()")) {
 app = app.replace("// Camera Screen", posPanel + "\n// Camera Screen");
}

if (!app.includes("key:'posMonitor'")) {
 app = app.replace(
  "const SECTIONS = [",
  "const SECTIONS = [\n { key:'posMonitor', icon:'P', label:'POS Monitor', tabs:[{key:'posMonitor',label:'Outlet POS Monitor'}], roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },"
 );
}

if (!app.includes("activeTab==='posMonitor'")) {
 app = app.replace(
  "{/* DASHBOARD */}",
  "{/* POS MONITOR */}\n {activeTab==='posMonitor' && <PosMonitorPanel />}\n\n {/* DASHBOARD */}"
 );
}

fs.writeFileSync(file, app);
console.log("Clean POS Monitor patch applied safely.");
