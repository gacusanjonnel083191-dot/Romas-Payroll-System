const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Add search state after stockInProductId state
app = app.replace(
  "const [stockInProductId, setStockInProductId] = useState('')",
  "const [stockInProductId, setStockInProductId] = useState('')\n const [stockInSearch, setStockInSearch] = useState('')"
);

// Add filtered stock-in product list before outletBalances
app = app.replace(
  "const outletBalances = posProducts.map(product => {",
  `const filteredStockInProducts = posProducts.filter(p => {
  const text = [
   p.product_name,
   p.name,
   p.sku,
   p.barcode,
   p.category
  ].join(' ').toLowerCase()
  return text.includes(stockInSearch.toLowerCase())
 })

 const outletBalances = posProducts.map(product => {`
);

// Replace Stock In Product select block with search + filtered dropdown
app = app.replace(
`<label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Product</label>
      <select value={stockInProductId} onChange={e=>setStockInProductId(e.target.value)} style={{...inputStyle, marginBottom:0}}>
       <option value="">Select product</option>
       {posProducts.map(p => (
        <option key={p.id} value={p.id}>{p.product_name || p.name}</option>
       ))}
      </select>`,
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
      </select>`
);

// Clear search after successful stock in
app = app.replace(
  "setStockInProductId('')\n   setStockInQty('')",
  "setStockInProductId('')\n   setStockInSearch('')\n   setStockInQty('')"
);

fs.writeFileSync(file, app);
console.log("Stock In product search added.");
