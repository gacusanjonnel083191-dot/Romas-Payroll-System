const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Make POS Monitor query safer: fetch latest rows first, then filter by business_date in the app.
// This avoids date/time/query mismatch issues.
app = app.replace(
`const [salesRes, itemsRes, movementsRes] = await Promise.all([
    supabase.from('pos_sales').select('*').eq('business_date', posDate).order('created_at', { ascending:false }),
    supabase.from('pos_sale_items').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending:false }),
    supabase.from('pos_inventory_movements').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending:false }).limit(200)
   ])

   if (salesRes.error) throw salesRes.error
   if (itemsRes.error) throw itemsRes.error
   if (movementsRes.error) throw movementsRes.error

   setPosSales(salesRes.data || [])
   setPosItems(itemsRes.data || [])
   setPosMovements(movementsRes.data || [])`,
`const [salesRes, itemsRes, movementsRes] = await Promise.all([
    supabase.from('pos_sales').select('*').order('created_at', { ascending:false }).limit(300),
    supabase.from('pos_sale_items').select('*').order('created_at', { ascending:false }).limit(500),
    supabase.from('pos_inventory_movements').select('*').order('created_at', { ascending:false }).limit(500)
   ])

   if (salesRes.error) throw salesRes.error
   if (itemsRes.error) throw itemsRes.error
   if (movementsRes.error) throw movementsRes.error

   const salesData = salesRes.data || []
   const filteredSales = salesData.filter(row => String(row.business_date || '').slice(0,10) === posDate)
   const receiptSet = new Set(filteredSales.map(row => row.receipt_no))

   const filteredItems = (itemsRes.data || []).filter(row =>
    receiptSet.has(row.receipt_no) || String(row.created_at || '').slice(0,10) === posDate
   )

   const filteredMovements = (movementsRes.data || []).filter(row =>
    receiptSet.has(row.reference_no) || String(row.created_at || '').slice(0,10) === posDate
   )

   console.log('POS Monitor debug:', {
    posDate,
    totalSalesRows: salesData.length,
    filteredSales: filteredSales.length,
    filteredItems: filteredItems.length,
    filteredMovements: filteredMovements.length
   })

   setPosSales(filteredSales)
   setPosItems(filteredItems)
   setPosMovements(filteredMovements)`
);

fs.writeFileSync(file, app);
console.log("POS Monitor query made safer.");
