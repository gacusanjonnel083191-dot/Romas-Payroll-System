const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_inventory_polish.jsx", text, "utf8");

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let state = "code";
  let quote = "";
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === "line") {
      if (ch === "\n") state = "code";
      continue;
    }

    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i++;
      }
      continue;
    }

    if (state === "string") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) state = "code";
      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "`") state = "code";
      continue;
    }

    if (ch === "/" && next === "/") {
      state = "line";
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      state = "string";
      quote = ch;
      continue;
    }

    if (ch === "`") {
      state = "template";
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function replaceFunction(source, functionName, replacement) {
  const start = source.indexOf("async function " + functionName);
  const normalStart = source.indexOf("function " + functionName);
  const realStart = start >= 0 ? start : normalStart;
  if (realStart === -1) throw new Error("Cannot find " + functionName);

  const openIndex = source.indexOf("{", realStart);
  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex === -1) throw new Error("Cannot find closing brace for " + functionName);

  return source.slice(0, realStart) + replacement + "\n" + source.slice(closeIndex + 1);
}

/* 1) Make inventory loading also load today's stock movement so Used/Sold Today and Added Today show immediately. */
const newLoadInventoryItems = `
async function loadInventoryItems() {
    setInventoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name')

      if (error) throw error
      setInventoryItems(data || [])

      const todayDate = getTodayDate()
      const { data: todayTx } = await supabase
        .from('inventory_transactions')
        .select('*')
        .gte('created_at', todayDate + 'T00:00:00')
        .lte('created_at', todayDate + 'T23:59:59')
        .order('created_at', { ascending:false })

      if (todayTx) {
        setInventoryTransactions(prev => {
          const map = new Map()
          ;(todayTx || []).forEach(t => map.set(String(t.id), t))
          ;(prev || []).forEach(t => { if (!map.has(String(t.id))) map.set(String(t.id), t) })
          return Array.from(map.values())
        })
      }
    } catch(err) {
      console.error('Inventory load error:', err)
      showToast('Failed to load inventory: ' + err.message, 'red')
    }
    setInventoryLoading(false)
  }`;

text = replaceFunction(text, "loadInventoryItems", newLoadInventoryItems);

/* 2) Upgrade edit save logic:
      - Keep manual Current Stock edit
      - Add Additional Stock today
      - Add Used/Sold today
      - Auto-record stock in/out transaction rows
      - Update final current stock safely
*/
const newSaveInventoryItemEdit = `
async function saveInventoryItemEdit(item) {
    const f = editItemFields || {}
    const stockBefore = Number(item.current_stock || 0)
    const manualCurrentStock = f.current_stock !== undefined && f.current_stock !== '' ? Number(f.current_stock) : stockBefore
    const additionalStock = Math.max(0, Number(f.additional_stock_today || 0))
    const usedSoldToday = Math.max(0, Number(f.used_sold_today || 0))
    const stockAfterAdditional = manualCurrentStock + additionalStock
    const finalStock = stockAfterAdditional - usedSoldToday

    if (!Number.isFinite(finalStock) || finalStock < 0) {
      showToast('Invalid stock update. Final stock cannot be negative.', 'red')
      return
    }

    const updatedItem = {
      name: f.name || item.name,
      category: f.category || item.category,
      unit: f.unit || item.unit,
      current_stock: finalStock,
      min_stock: Number(f.min_stock ?? item.min_stock ?? 0),
      cost_per_unit: Number(f.cost_per_unit ?? item.cost_per_unit ?? 0),
      selling_price: Number(f.selling_price ?? item.selling_price ?? 0),
      supplier_id: f.supplier_id !== undefined ? (f.supplier_id || null) : (item.supplier_id || null)
    }

    try {
      const txRows = []

      if (additionalStock > 0) {
        txRows.push({
          item_id: item.id,
          item_name: updatedItem.name,
          category: updatedItem.category,
          transaction_type: 'in',
          quantity: additionalStock,
          unit: updatedItem.unit,
          stock_before: manualCurrentStock,
          stock_after: stockAfterAdditional,
          reference: 'Manual inventory edit',
          notes: 'Additional stock entered from inventory edit screen',
          performed_by: \`Admin (\${adminRole || 'owner'})\`
        })
      }

      if (usedSoldToday > 0) {
        txRows.push({
          item_id: item.id,
          item_name: updatedItem.name,
          category: updatedItem.category,
          transaction_type: 'out',
          quantity: usedSoldToday,
          unit: updatedItem.unit,
          stock_before: stockAfterAdditional,
          stock_after: finalStock,
          reference: 'Manual inventory edit',
          notes: 'Used/Sold today entered from inventory edit screen',
          performed_by: \`Admin (\${adminRole || 'owner'})\`
        })
      }

      if (txRows.length > 0) {
        const { error: txError } = await supabase.from('inventory_transactions').insert(txRows)
        if (txError) throw txError
      }

      const { error } = await supabase
        .from('inventory_items')
        .update(updatedItem)
        .eq('id', item.id)

      if (error) throw error

      await logAudit(
        'INVENTORY ITEM UPDATED',
        'Admin',
        updatedItem.name,
        \`Stock: \${stockBefore} -> \${finalStock} \${updatedItem.unit} | Added: \${additionalStock} | Used/Sold: \${usedSoldToday}\`
      )

      showToast('Inventory item updated.')
      setEditingItemId(null)
      setEditItemFields({})
      await loadInventoryItems()
    } catch(err) {
      showToast('Failed: ' + err.message, 'red')
    }
  }`;

text = replaceFunction(text, "saveInventoryItemEdit", newSaveInventoryItemEdit);

/* 3) Replace scattered inventory item list with clean categorized inventory control table. */
const startMarker = "                {/* Items List by Category */}";
const endMarker = "                {/* Transaction History */}";
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Cannot find inventory item list block.");
}

const newInventoryListBlock = `
                {/* Items List by Category */}
                {inventoryLoading && <p style={{ color:'#888', textAlign:'center', padding:'20px' }}>Loading inventory...</p>}

                {!inventoryLoading && (() => {
                  const todayDate = getTodayDate()
                  const searchTerm = String(inventorySearch || '').trim().toLowerCase()

                  const movementByItem = {}
                  ;(inventoryTransactions || [])
                    .filter(tx => String(tx.created_at || '').slice(0,10) === todayDate)
                    .forEach(tx => {
                      const id = String(tx.item_id || '')
                      if (!id) return
                      if (!movementByItem[id]) movementByItem[id] = { inQty:0, outQty:0 }
                      const qty = Number(tx.quantity || 0)
                      const type = String(tx.transaction_type || '').toLowerCase()
                      if (type.includes('in')) movementByItem[id].inQty += qty
                      if (type.includes('out')) movementByItem[id].outQty += qty
                    })

                  const filtered = inventoryItems
                    .filter(i => {
                      const name = String(i.name || '').toLowerCase()
                      const category = String(i.category || '').toLowerCase()
                      const supplierName = suppliers.find(s => s.id === i.supplier_id)?.name || ''
                      const matchSearch = !searchTerm || name.includes(searchTerm) || category.includes(searchTerm) || supplierName.toLowerCase().includes(searchTerm)
                      const matchCat = inventoryCategoryFilter === 'all' || i.category === inventoryCategoryFilter
                      return matchSearch && matchCat
                    })
                    .sort((a,b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || '')))

                  if (filtered.length === 0) {
                    return (
                      <div style={{ background:'white', border:'1px solid #eee', borderRadius:'16px', padding:'28px', textAlign:'center', color:'#888' }}>
                        <p style={{ fontSize:'16px', fontWeight:'800', margin:'0 0 6px' }}>No inventory items found</p>
                        <p style={{ fontSize:'13px', margin:0 }}>Try a different search keyword or category filter.</p>
                      </div>
                    )
                  }

                  const grouped = INVENTORY_CATEGORIES
                    .map(cat => ({ cat, items: filtered.filter(i => i.category === cat) }))
                    .filter(g => g.items.length > 0)

                  const uncategorized = filtered.filter(i => !INVENTORY_CATEGORIES.includes(i.category))
                  if (uncategorized.length > 0) grouped.push({ cat:'Uncategorized', items:uncategorized })

                  return (
                    <div style={{ display:'grid', gap:'16px' }}>
                      <div style={{ background:'white', border:'1px solid #eee', borderRadius:'16px', padding:'14px', boxShadow:'0 2px 10px rgba(0,0,0,0.04)' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:'10px' }}>
                          <div>
                            <label style={lblS}>Search Items</label>
                            <input
                              placeholder="Search by item, category, or supplier..."
                              value={inventorySearch}
                              onChange={e=>setInventorySearch(e.target.value)}
                              style={{ ...inputStyle, marginBottom:0 }}
                            />
                          </div>
                          <div>
                            <label style={lblS}>Category</label>
                            <select value={inventoryCategoryFilter} onChange={e=>setInventoryCategoryFilter(e.target.value)} style={{ ...inputStyle, marginBottom:0 }}>
                              <option value="all">All Categories</option>
                              {INVENTORY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div style={{ background:'#fff8dc', border:'1px solid #fdd412', borderRadius:'12px', padding:'10px' }}>
                            <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#777', fontWeight:'800' }}>Showing</p>
                            <p style={{ margin:0, fontSize:'20px', fontWeight:'900', color:'#ca1b1b' }}>{filtered.length}</p>
                          </div>
                          <div style={{ background:'#f0fff4', border:'1px solid #c8e6c9', borderRadius:'12px', padding:'10px' }}>
                            <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#777', fontWeight:'800' }}>Low Stock</p>
                            <p style={{ margin:0, fontSize:'20px', fontWeight:'900', color:'#2d8a4e' }}>
                              {filtered.filter(i=>Number(i.current_stock||0)<=Number(i.min_stock||0)&&Number(i.min_stock||0)>0).length}
                            </p>
                          </div>
                        </div>
                      </div>

                      {grouped.map(group => (
                        <div key={group.cat} style={{ background:'white', border:'1px solid #eee', borderRadius:'16px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                          <div style={{ background:'#ca1b1b', color:'white', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ fontWeight:'900', fontSize:'14px' }}>{group.cat}</div>
                            <div style={{ fontSize:'12px', opacity:0.9 }}>{group.items.length} item{group.items.length>1?'s':''}</div>
                          </div>

                          <div style={{ overflowX:'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'980px' }}>
                              <thead>
                                <tr style={{ background:'#fff8dc' }}>
                                  <th style={{ padding:'10px', textAlign:'left', fontSize:'11px', color:'#555' }}>Item</th>
                                  <th style={{ padding:'10px', textAlign:'center', fontSize:'11px', color:'#555' }}>Unit</th>
                                  <th style={{ padding:'10px', textAlign:'right', fontSize:'11px', color:'#555' }}>Stock on Hand</th>
                                  <th style={{ padding:'10px', textAlign:'right', fontSize:'11px', color:'#555' }}>Used/Sold Today</th>
                                  <th style={{ padding:'10px', textAlign:'right', fontSize:'11px', color:'#555' }}>Additional Stock</th>
                                  <th style={{ padding:'10px', textAlign:'right', fontSize:'11px', color:'#555' }}>Min Level</th>
                                  <th style={{ padding:'10px', textAlign:'right', fontSize:'11px', color:'#555' }}>Cost/Unit</th>
                                  <th style={{ padding:'10px', textAlign:'center', fontSize:'11px', color:'#555' }}>Status</th>
                                  <th style={{ padding:'10px', textAlign:'right', fontSize:'11px', color:'#555' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map(item => {
                                  const isLow = Number(item.current_stock||0) <= Number(item.min_stock||0) && Number(item.min_stock||0) > 0
                                  const isEditing = editingItemId === item.id
                                  const movement = movementByItem[String(item.id)] || { inQty:0, outQty:0 }
                                  const manualCurrent = editItemFields.current_stock !== undefined && editItemFields.current_stock !== '' ? Number(editItemFields.current_stock) : Number(item.current_stock || 0)
                                  const addQty = Number(editItemFields.additional_stock_today || 0)
                                  const usedQty = Number(editItemFields.used_sold_today || 0)
                                  const finalPreview = manualCurrent + Math.max(0, addQty) - Math.max(0, usedQty)

                                  return (
                                    <tr key={item.id} style={{ borderTop:'1px solid #eee', background:isLow?'#fff5f5':'white' }}>
                                      <td style={{ padding:'10px', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <div style={{ display:'grid', gap:'6px' }}>
                                            <input value={editItemFields.name ?? item.name} onChange={e=>setEditItemFields(p=>({...p,name:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }} />
                                            <select value={editItemFields.category ?? item.category} onChange={e=>setEditItemFields(p=>({...p,category:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>
                                              {INVENTORY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <select value={editItemFields.supplier_id ?? item.supplier_id ?? ''} onChange={e=>setEditItemFields(p=>({...p,supplier_id:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>
                                              <option value="">No supplier</option>
                                              {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                          </div>
                                        ) : (
                                          <div>
                                            <div style={{ fontWeight:'900', color:'#1a1a2e' }}>{item.name}</div>
                                            <div style={{ fontSize:'11px', color:'#777', marginTop:'3px' }}>
                                              {suppliers.find(s=>s.id===item.supplier_id)?.name || 'No supplier'}
                                            </div>
                                          </div>
                                        )}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'center', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <select value={editItemFields.unit ?? item.unit} onChange={e=>setEditItemFields(p=>({...p,unit:e.target.value}))} style={{ ...inputStyle, marginBottom:0 }}>
                                            {['kg','g','L','mL','pcs','boxes','bags','sacks','bottles','rolls','pairs','sets'].map(u=><option key={u} value={u}>{u}</option>)}
                                          </select>
                                        ) : item.unit}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'right', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <input type="number" value={editItemFields.current_stock ?? item.current_stock} onChange={e=>setEditItemFields(p=>({...p,current_stock:e.target.value}))} style={{ ...inputStyle, marginBottom:0, textAlign:'right' }} min="0" step="0.01" />
                                        ) : (
                                          <strong style={{ color:isLow?'#ca1b1b':'#2d8a4e' }}>{Number(item.current_stock||0).toFixed(2)}</strong>
                                        )}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'right', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <input type="number" placeholder="0" value={editItemFields.used_sold_today ?? ''} onChange={e=>setEditItemFields(p=>({...p,used_sold_today:e.target.value}))} style={{ ...inputStyle, marginBottom:0, textAlign:'right', border:'1.5px solid #ca1b1b' }} min="0" step="0.01" />
                                        ) : (
                                          <span style={{ color:'#ca1b1b', fontWeight:'800' }}>{Number(movement.outQty||0).toFixed(2)}</span>
                                        )}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'right', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <input type="number" placeholder="0" value={editItemFields.additional_stock_today ?? ''} onChange={e=>setEditItemFields(p=>({...p,additional_stock_today:e.target.value}))} style={{ ...inputStyle, marginBottom:0, textAlign:'right', border:'1.5px solid #2d8a4e' }} min="0" step="0.01" />
                                        ) : (
                                          <span style={{ color:'#2d8a4e', fontWeight:'800' }}>{Number(movement.inQty||0).toFixed(2)}</span>
                                        )}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'right', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <input type="number" value={editItemFields.min_stock ?? item.min_stock} onChange={e=>setEditItemFields(p=>({...p,min_stock:e.target.value}))} style={{ ...inputStyle, marginBottom:0, textAlign:'right' }} min="0" step="0.01" />
                                        ) : Number(item.min_stock||0).toFixed(2)}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'right', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <input type="number" value={editItemFields.cost_per_unit ?? item.cost_per_unit} onChange={e=>setEditItemFields(p=>({...p,cost_per_unit:e.target.value}))} style={{ ...inputStyle, marginBottom:0, textAlign:'right' }} min="0" step="0.01" />
                                        ) : php(item.cost_per_unit || 0)}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'center', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <div style={{ fontSize:'11px', fontWeight:'900', color:finalPreview<0?'#ca1b1b':'#2d8a4e' }}>
                                            Final: {Number(finalPreview||0).toFixed(2)}
                                          </div>
                                        ) : (
                                          <span style={{
                                            display:'inline-block',
                                            padding:'4px 8px',
                                            borderRadius:'999px',
                                            fontSize:'10px',
                                            fontWeight:'900',
                                            background:isLow?'#ffe8e8':'#e8f5e9',
                                            color:isLow?'#ca1b1b':'#2d8a4e'
                                          }}>
                                            {isLow ? 'REORDER' : 'OK'}
                                          </span>
                                        )}
                                      </td>

                                      <td style={{ padding:'10px', textAlign:'right', verticalAlign:'top' }}>
                                        {isEditing ? (
                                          <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end', flexWrap:'wrap' }}>
                                            <button style={{ ...btnGreen, width:'auto', padding:'7px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>saveInventoryItemEdit(item)}>SAVE</button>
                                            <button style={{ ...btnGray, width:'auto', padding:'7px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setEditingItemId(null); setEditItemFields({}) }}>CANCEL</button>
                                          </div>
                                        ) : (
                                          <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end', flexWrap:'wrap' }}>
                                            {isLow && item.supplier_id && (
                                              <button style={{ ...btnGreen, background:'#2d6a4f', width:'auto', padding:'7px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>{ setPOSupplierId(item.supplier_id); buildPO(item.supplier_id); setShowPOSection(true); setShowPOBuilder(true) }}>GEN PO</button>
                                            )}
                                            <button style={{ ...btnYellow, padding:'7px 10px', fontSize:'11px' }} onClick={()=>{ setEditingItemId(item.id); setEditItemFields({}) }}>EDIT</button>
                                            <button style={{ ...btnRed, width:'auto', padding:'7px 10px', marginTop:0, fontSize:'11px' }} onClick={()=>deleteInventoryItem(item)}>DELETE</button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

`;

text = text.slice(0, start) + newInventoryListBlock + text.slice(end);

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
console.log("Inventory category table applied:", finalText.includes("Stock on Hand") && finalText.includes("Used/Sold Today") && finalText.includes("Additional Stock"));
console.log("Inventory save logic upgraded:", finalText.includes("additional_stock_today") && finalText.includes("used_sold_today"));
console.log("Inventory search box present:", finalText.includes("Search by item, category, or supplier"));
