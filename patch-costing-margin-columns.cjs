const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

// 1) Keep reseller and retail gross margins directly beside the product name.
const inlineMarginMarker = 'COSTING_INLINE_MARGIN'
if (!src.includes(inlineMarginMarker)) {
  const productHeaderPattern = /<div\s+style=\{\{\s*display:'flex',\s*gap:'6px',\s*flexWrap:'wrap',\s*alignItems:'center'\s*\}\}>\s*<strong\s+style=\{\{\s*color:'#333',\s*fontSize:'12px'\s*\}\}>\{v\.name\}<\/strong>\s*<Badge\s+label=\{cost\.statusLabel\}\s+color=\{statusColor\}\/>\s*\{hasBaseLink&&<Badge\s+label="BASE"\s+color="green"\/>\}\s*\{hasPowderLink&&<Badge\s+label="POWDER"\s+color="blue"\/>\}\s*<\/div>/m

  if (!productHeaderPattern.test(src)) {
    throw new Error('Could not find the product-name badge row in Costing. Patch aborted safely.')
  }

  const inlineMarginHeader = `<div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>{/* COSTING_INLINE_MARGIN */}<strong style={{ color:'#333', fontSize:'12px' }}>{v.name}</strong>{(cost.statusCode==='incomplete'||cost.statusCode==='review')&&<Badge label={cost.statusLabel} color={statusColor}/>} {hasPowderLink&&<Badge label="POWDER" color="blue"/>}<span style={{ color:!displayedRecipeCost.isCostReady?'#999':safeNum(displayedRecipeCost.currentResellerPrice,0)>0&&safeNum(displayedRecipeCost.currentResellerPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', fontWeight:'900', whiteSpace:'nowrap' }}>Reseller {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentResellerPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentResellerPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentResellerPrice,0))*100).toFixed(1)}%\`:'—'}</span><span style={{ color:!displayedRecipeCost.isCostReady?'#999':safeNum(displayedRecipeCost.currentRetailPrice,0)>0&&safeNum(displayedRecipeCost.currentRetailPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', fontWeight:'900', whiteSpace:'nowrap' }}>Retail {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentRetailPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentRetailPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentRetailPrice,0))*100).toFixed(1)}%\`:'—'}</span></div>`

  src = src.replace(productHeaderPattern, inlineMarginHeader)
}

// 2) Convert every Product Recipe & Unit Cost category into a compact two-card desktop grid.
const cardLayoutMarker = 'COSTING_TWO_COLUMN_CARDS_V1'
if (!src.includes(cardLayoutMarker)) {
  const oldCategoryWrapper = `<div style={{ border:\`1px solid \${catColor}33\`, borderTop:'none', borderRadius:'0 0 9px 9px', overflow:'hidden' }}> {catVariants.map((v,index)=>{`
  const newCategoryWrapper = `<div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(2,minmax(0,1fr))', gap:'10px', padding:'10px', background:'#f7f8fa', border:\`1px solid \${catColor}33\`, borderTop:'none', borderRadius:'0 0 9px 9px', overflow:'visible' }}>{/* COSTING_TWO_COLUMN_CARDS_V1 */} {catVariants.map((v,index)=>{`

  if (!src.includes(oldCategoryWrapper)) {
    throw new Error('Could not find the Product Recipe category wrapper. Two-card layout patch aborted safely.')
  }
  src = src.replace(oldCategoryWrapper, newCategoryWrapper)

  const oldProductCard = `return <div key={v.id} style={{ background:index%2===0?'white':'#fcfcfc', borderTop:index===0?'none':'1px solid #eee', padding:'10px 12px' }}>`
  const newProductCard = `return <div key={v.id} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'9px 10px', minWidth:0, boxShadow:'0 1px 2px rgba(0,0,0,0.04)', alignSelf:'start' }}>`
  if (!src.includes(oldProductCard)) {
    throw new Error('Could not find the Product Recipe product row. Card styling patch aborted safely.')
  }
  src = src.replace(oldProductCard, newProductCard)

  const oldMetricsGrid = `gridTemplateColumns:isMobile?'1fr':'minmax(220px,1.5fr) repeat(5,minmax(82px,0.7fr)) auto'`
  const newMetricsGrid = `gridTemplateColumns:isMobile?'1fr':'minmax(170px,1.25fr) repeat(2,minmax(72px,0.75fr))'`
  if (!src.includes(oldMetricsGrid)) {
    throw new Error('Could not find the Product Recipe metrics grid. Compact card patch aborted safely.')
  }
  src = src.replace(oldMetricsGrid, newMetricsGrid)

  const oldActions = `<div style={{ display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:isMobile?'flex-start':'flex-end' }}>`
  const newActions = `<div style={{ display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:isMobile?'flex-start':'flex-end', gridColumn:isMobile?'auto':'1 / -1', paddingTop:isMobile?0:'2px' }}>`
  if (!src.includes(oldActions)) {
    throw new Error('Could not find the Product Recipe actions row. Compact card action patch aborted safely.')
  }
  src = src.replace(oldActions, newActions)
}

fs.writeFileSync(path, src, 'utf8')
console.log('Costing UI patched: margins beside product names and Product Recipe products compressed into a two-card desktop grid with one card per row on mobile.')
