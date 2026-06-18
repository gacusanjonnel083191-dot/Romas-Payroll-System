const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Add POS products state
app = app.replace(
  "const [posMovements, setPosMovements] = useState([])",
  "const [posMovements, setPosMovements] = useState([])\n const [posProducts, setPosProducts] = useState([])"
);

// Upgrade query to also load POS products
app = app.replace(
`const [salesRes, itemsRes, movementsRes] = await Promise.all([
    supabase.from('pos_sales').select('*').order('created_at', { ascending:false }).limit(300),
    supabase.from('pos_sale_items').select('*').order('created_at', { ascending:false }).limit(500),
    supabase.from('pos_inventory_movements').select('*').order('created_at', { ascending:false }).limit(500)
   ])

   if (salesRes.error) throw salesRes.error
   if (itemsRes.error) throw itemsRes.error
   if (movementsRes.error) throw movementsRes.error`,
`const [salesRes, itemsRes, movementsRes, productsRes] = await Promise.all([
    supabase.from('pos_sales').select('*').order('created_at', { ascending:false }).limit(300),
    supabase.from('pos_sale_items').select('*').order('created_at', { ascending:false }).limit(500),
    supabase.from('pos_inventory_movements').select('*').order('created_at', { ascending:false }).limit(1000),
    supabase.from('pos_products').select('*').order('product_name', { ascending:true })
   ])

   if (salesRes.error) throw salesRes.error
   if (itemsRes.error) throw itemsRes.error
   if (movementsRes.error) throw movementsRes.error
   if (productsRes.error) throw productsRes.error`
);

// Save products to state
app = app.replace(
  "setPosMovements(filteredMovements)",
  "setPosMovements(filteredMovements)\n   setPosProducts(productsRes.data || [])"
);

// Add balance calculation after topProducts
app = app.replace(
`const topProducts = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 20)`,
`const topProducts = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 20)

 const soldMap = {}
 posItems.forEach(item => {
  const key = item.product_id || item.product_name
  soldMap[key] = (soldMap[key] || 0) + safeNum(item.qty, 0)
 })

 const movementMap = {}
 posMovements.forEach(move => {
  const key = move.product_id || move.product_name
  movementMap[key] = (movementMap[key] || 0) + safeNum(move.qty, 0)
 })

 const outletBalances = posProducts.map(product => {
  const key = product.id || product.product_name
  const startingStock = safeNum(product.stock, 0)
  const soldQty = safeNum(soldMap[key], 0)
  const movementQty = safeNum(movementMap[key], 0)
  const remainingStock = startingStock + movementQty
  const minStock = safeNum(product.min_stock, 10)
  const status = remainingStock <= 0 ? 'Out of Stock' : remainingStock <= minStock ? 'Low Stock' : 'OK'
  return {
   id: product.id,
   product_name: product.product_name || product.name || 'Unnamed Product',
   category: product.category || '',
   startingStock,
   soldQty,
   movementQty,
   remainingStock,
   minStock,
   status
  }
 }).sort((a,b) => a.remainingStock - b.remainingStock)`
);

// Insert Outlet Inventory Balance before Inventory Movements
app = app.replace(
`<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Inventory Movements</h3>`,
`<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Outlet Inventory Balance</h3>
    {outletBalances.length === 0 ? <p style={{ color:'#888', fontSize:'13px' }}>No outlet product balance found.</p> : (
     <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'760px' }}>
       <thead>
        <tr style={{ background:'#f8f8f8' }}>
         <th style={{ textAlign:'left', padding:'8px' }}>Product</th>
         <th style={{ textAlign:'right', padding:'8px' }}>Starting</th>
         <th style={{ textAlign:'right', padding:'8px' }}>Sold</th>
         <th style={{ textAlign:'right', padding:'8px' }}>Movement</th>
         <th style={{ textAlign:'right', padding:'8px' }}>Remaining</th>
         <th style={{ textAlign:'left', padding:'8px' }}>Status</th>
        </tr>
       </thead>
       <tbody>
        {outletBalances.map(row => (
         <tr key={row.id || row.product_name}>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0' }}>
           <strong>{row.product_name}</strong><br/>
           <span style={{ color:'#999', fontSize:'10px' }}>{row.category}</span>
          </td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right' }}>{row.startingStock}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', color:'#ca1b1b', fontWeight:'bold' }}>{row.soldQty}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right' }}>{row.movementQty}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', textAlign:'right', fontWeight:'bold' }}>{row.remainingStock}</td>
          <td style={{ padding:'8px', borderBottom:'1px solid #f0f0f0', color:row.status === 'OK' ? '#2d8a4e' : '#ca1b1b', fontWeight:'bold' }}>{row.status}</td>
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

fs.writeFileSync(file, app);
console.log("Outlet Inventory Balance added to POS Monitor.");
