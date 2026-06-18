const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Add selected product helper after filteredStockInProducts
app = app.replace(
`const filteredStockInProducts = posProducts.filter(p => {
  const text = [
   p.product_name,
   p.name,
   p.sku,
   p.barcode,
   p.category
  ].join(' ').toLowerCase()
  return text.includes(stockInSearch.toLowerCase())
 })`,
`const filteredStockInProducts = posProducts.filter(p => {
  const text = [
   p.product_name,
   p.name,
   p.sku,
   p.barcode,
   p.category
  ].join(' ').toLowerCase()
  return stockInSearch.trim() && text.includes(stockInSearch.toLowerCase())
 }).slice(0, 12)

 const selectedStockInProduct = posProducts.find(p => String(p.id) === String(stockInProductId))`
);

// Replace search + dropdown UI with live clickable results
app = app.replace(
`<label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Search Product</label>
      <input
       value={stockInSearch}
       onChange={e=>setStockInSearch(e.target.value)}
       placeholder="Search product, SKU, barcode..."
       style={{...inputStyle, marginBottom:'6px'}}
      />
      <select value={stockInProductId} onChange={e=>setStockInProductId(e.target.value)} style={{...inputStyle, marginBottom:0}}>
       <option value="">Select product</option>
       {filteredStockInProducts.map(p => (
        <option key={p.id} value={p.id}>{p.product_name || p.name} {p.sku ? '- ' + p.sku : ''}</option>
       ))}
      </select>`,
`<label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Search Product</label>
      <input
       value={stockInSearch}
       onChange={e=>{
        setStockInSearch(e.target.value)
        setStockInProductId('')
       }}
       placeholder="Search product, SKU, barcode..."
       style={{...inputStyle, marginBottom:'6px'}}
      />

      {selectedStockInProduct && (
       <div style={{ border:'1px solid #d9f2e3', background:'#f0fff6', borderRadius:'10px', padding:'8px 10px', marginBottom:'6px', fontSize:'12px' }}>
        <strong style={{ color:'#2d8a4e' }}>Selected:</strong> {selectedStockInProduct.product_name || selectedStockInProduct.name}
       </div>
      )}

      {stockInSearch.trim() && !stockInProductId && (
       <div style={{ border:'1px solid #eee', borderRadius:'12px', background:'white', maxHeight:'220px', overflowY:'auto', boxShadow:'0 6px 18px rgba(0,0,0,0.08)' }}>
        {filteredStockInProducts.length === 0 ? (
         <div style={{ padding:'10px', color:'#999', fontSize:'12px' }}>No product found.</div>
        ) : (
         filteredStockInProducts.map(p => (
          <button
           key={p.id}
           type="button"
           onClick={()=>{
            setStockInProductId(p.id)
            setStockInSearch(p.product_name || p.name || '')
           }}
           style={{
            width:'100%',
            textAlign:'left',
            border:'none',
            borderBottom:'1px solid #f2f2f2',
            background:'white',
            padding:'10px',
            cursor:'pointer',
            fontFamily:'inherit'
           }}
          >
           <strong style={{ display:'block', color:'#222', fontSize:'13px' }}>{p.product_name || p.name}</strong>
           <span style={{ color:'#888', fontSize:'11px' }}>{p.category || ''} {p.sku ? '• ' + p.sku : ''} {p.barcode ? '• ' + p.barcode : ''}</span>
          </button>
         ))
        )}
       </div>
      )}`
);

fs.writeFileSync(file, app);
console.log("Stock In live search results added.");
