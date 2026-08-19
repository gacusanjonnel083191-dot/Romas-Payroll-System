const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

function replaceAt(source, start, oldText, newText, label) {
  if (start < 0 || source.slice(start, start + oldText.length) !== oldText) {
    throw new Error(`Could not replace ${label}. Patch aborted safely.`)
  }
  return source.slice(0, start) + newText + source.slice(start + oldText.length)
}

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

// 2) Convert Product Recipe & Unit Cost products into compact cards:
//    2 cards per row on desktop, 1 card per row on mobile.
const cardLayoutMarker = 'COSTING_TWO_COLUMN_CARDS_V2'
if (!src.includes(cardLayoutMarker)) {
  const sectionIndex = src.indexOf('Product Recipe & Unit Cost')
  if (sectionIndex < 0) throw new Error('Could not find Product Recipe & Unit Cost section. Patch aborted safely.')

  const mapExpr = '{catVariants.map((v,index)=>{'
  let mapExprIndex = src.indexOf(mapExpr, sectionIndex)
  if (mapExprIndex < 0) throw new Error('Could not find category product mapping in Product Recipe section. Patch aborted safely.')

  const wrapperStart = src.lastIndexOf('<div style={{', mapExprIndex)
  if (wrapperStart < 0) throw new Error('Could not locate Product Recipe category wrapper start. Patch aborted safely.')

  const oldWrapperPrefix = src.slice(wrapperStart, mapExprIndex)
  if (oldWrapperPrefix.length > 500 || !oldWrapperPrefix.includes('catColor') || !oldWrapperPrefix.includes("borderTop:'none'")) {
    throw new Error('Located an unexpected category wrapper. Patch aborted safely.')
  }

  const newWrapperPrefix = `<div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(2,minmax(0,1fr))', gap:'9px', padding:'9px', background:'#f7f8fa', border:\`1px solid \${catColor}33\`, borderTop:'none', borderRadius:'0 0 9px 9px', overflow:'visible' }}>{/* COSTING_TWO_COLUMN_CARDS_V2 */} `
  src = src.slice(0, wrapperStart) + newWrapperPrefix + src.slice(mapExprIndex)

  // Re-resolve the mapping position after wrapper replacement.
  mapExprIndex = src.indexOf(mapExpr, sectionIndex)

  const oldProductCard = `return <div key={v.id} style={{ background:index%2===0?'white':'#fcfcfc', borderTop:index===0?'none':'1px solid #eee', padding:'10px 12px' }}>`
  const newProductCard = `return <div key={v.id} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'8px 9px', minWidth:0, boxShadow:'0 1px 2px rgba(0,0,0,0.04)', alignSelf:'start' }}>`
  const productCardIndex = src.indexOf(oldProductCard, mapExprIndex)
  if (productCardIndex < 0) throw new Error('Could not find Product Recipe product row style. Patch aborted safely.')
  src = replaceAt(src, productCardIndex, oldProductCard, newProductCard, 'Product Recipe product card')

  const oldMetricsGrid = `gridTemplateColumns:isMobile?'1fr':'minmax(220px,1.5fr) repeat(5,minmax(82px,0.7fr)) auto'`
  const newMetricsGrid = `gridTemplateColumns:isMobile?'1fr':'minmax(155px,1.2fr) repeat(2,minmax(68px,0.8fr))'`
  const metricsIndex = src.indexOf(oldMetricsGrid, productCardIndex)
  if (metricsIndex < 0) throw new Error('Could not find Product Recipe metrics grid. Patch aborted safely.')
  src = replaceAt(src, metricsIndex, oldMetricsGrid, newMetricsGrid, 'Product Recipe metrics grid')

  const oldActions = `<div style={{ display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:isMobile?'flex-start':'flex-end' }}>`
  const newActions = `<div style={{ display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:isMobile?'flex-start':'flex-end', gridColumn:isMobile?'auto':'1 / -1', paddingTop:isMobile?0:'2px' }}>`
  const actionsIndex = src.indexOf(oldActions, metricsIndex)
  if (actionsIndex < 0) throw new Error('Could not find Product Recipe action buttons row. Patch aborted safely.')
  src = replaceAt(src, actionsIndex, oldActions, newActions, 'Product Recipe action buttons')
}

// Temporary build-time diagnostics for the two shared recipe panels.
for (const anchor of ['Base Dough Recipe','Powder Base Recipe']) {
  const i = src.indexOf(anchor)
  console.log(`\n--- ${anchor} SOURCE CONTEXT ---\n${i >= 0 ? src.slice(Math.max(0,i-1800), i+4200) : 'NOT FOUND'}\n--- END ${anchor} ---\n`)
}

fs.writeFileSync(path, src, 'utf8')
console.log('Costing UI patched: compact two-card desktop grid, one card per row on mobile, smaller spacing, and margins beside product names.')
