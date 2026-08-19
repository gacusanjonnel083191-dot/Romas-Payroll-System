const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

function replaceAt(source, start, oldText, newText, label) {
  if (start < 0 || source.slice(start, start + oldText.length) !== oldText) {
    throw new Error(`Could not replace ${label}. Patch aborted safely.`)
  }
  return source.slice(0, start) + newText + source.slice(start + oldText.length)
}

function replaceAfter(anchor, oldText, newText, label, maxDistance = 12000) {
  const anchorIndex = src.indexOf(anchor)
  if (anchorIndex < 0) throw new Error(`Could not find ${label} anchor. Patch aborted safely.`)
  const targetIndex = src.indexOf(oldText, anchorIndex)
  if (targetIndex < 0 || targetIndex - anchorIndex > maxDistance) {
    throw new Error(`Could not find ${label}. Patch aborted safely.`)
  }
  src = replaceAt(src, targetIndex, oldText, newText, label)
}

// 1) Keep reseller and retail gross margins directly beside the product name.
const inlineMarginMarker = 'COSTING_INLINE_MARGIN'
if (!src.includes(inlineMarginMarker)) {
  const productHeaderPattern = /<div\s+style=\{\{\s*display:'flex',\s*gap:'6px',\s*flexWrap:'wrap',\s*alignItems:'center'\s*\}\}>\s*<strong\s+style=\{\{\s*color:'#333',\s*fontSize:'12px'\s*\}\}>\{v\.name\}<\/strong>\s*<Badge\s+label=\{cost\.statusLabel\}\s+color=\{statusColor\}\/>\s*\{hasBaseLink&&<Badge\s+label="BASE"\s+color="green"\/>\}\s*\{hasPowderLink&&<Badge\s+label="POWDER"\s+color="blue"\/>\}\s*<\/div>/m
  if (!productHeaderPattern.test(src)) throw new Error('Could not find the product-name badge row in Costing. Patch aborted safely.')
  const inlineMarginHeader = `<div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>{/* COSTING_INLINE_MARGIN */}<strong style={{ color:'#333', fontSize:'12px' }}>{v.name}</strong>{(cost.statusCode==='incomplete'||cost.statusCode==='review')&&<Badge label={cost.statusLabel} color={statusColor}/>} {hasPowderLink&&<Badge label="POWDER" color="blue"/>}<span style={{ color:!displayedRecipeCost.isCostReady?'#999':safeNum(displayedRecipeCost.currentResellerPrice,0)>0&&safeNum(displayedRecipeCost.currentResellerPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', fontWeight:'900', whiteSpace:'nowrap' }}>Reseller {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentResellerPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentResellerPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentResellerPrice,0))*100).toFixed(1)}%\`:'—'}</span><span style={{ color:!displayedRecipeCost.isCostReady?'#999':safeNum(displayedRecipeCost.currentRetailPrice,0)>0&&safeNum(displayedRecipeCost.currentRetailPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', fontWeight:'900', whiteSpace:'nowrap' }}>Retail {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentRetailPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentRetailPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentRetailPrice,0))*100).toFixed(1)}%\`:'—'}</span></div>`
  src = src.replace(productHeaderPattern, inlineMarginHeader)
}

// 2) Convert Product Recipe & Unit Cost products into compact cards.
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
  if (oldWrapperPrefix.length > 500 || !oldWrapperPrefix.includes('catColor') || !oldWrapperPrefix.includes("borderTop:'none'")) throw new Error('Located an unexpected category wrapper. Patch aborted safely.')
  const newWrapperPrefix = `<div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(2,minmax(0,1fr))', gap:'9px', padding:'9px', background:'#f7f8fa', border:\`1px solid \${catColor}33\`, borderTop:'none', borderRadius:'0 0 9px 9px', overflow:'visible' }}>{/* COSTING_TWO_COLUMN_CARDS_V2 */} `
  src = src.slice(0, wrapperStart) + newWrapperPrefix + src.slice(mapExprIndex)
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

// 3) Include the Base Dough and Powder Base shared formulas in the compact resize.
//    Desktop: two panels side by side. Mobile: one panel per row.
const sharedRecipeMarker = 'COSTING_SHARED_RECIPE_GRID_V1'
if (!src.includes(sharedRecipeMarker)) {
  const baseComment = '{/* BASE DOUGH RECIPE */}'
  const powderComment = '{/* POWDER BASE RECIPE */}'
  const baseIndex = src.indexOf(baseComment)
  const powderIndex = src.indexOf(powderComment, baseIndex)
  if (baseIndex < 0 || powderIndex < 0) throw new Error('Could not find shared recipe panels. Patch aborted safely.')

  const sharedGridOpen = `<div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(2,minmax(0,1fr))', gap:'12px', alignItems:'start', marginBottom:'16px' }}>{/* COSTING_SHARED_RECIPE_GRID_V1 */}\n  `
  src = src.slice(0, baseIndex) + sharedGridOpen + src.slice(baseIndex)

  replaceAfter(baseComment,
    `<div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>`,
    `<div style={{ background:'white', border:'2px solid #ca1b1b', borderRadius:'12px', padding:'12px', marginBottom:0, minWidth:0 }}>`,
    'Base Dough compact panel')
  replaceAfter(powderComment,
    `<div style={{ background:'white', border:'2px solid #7b4f9e', borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>`,
    `<div style={{ background:'white', border:'2px solid #7b4f9e', borderRadius:'12px', padding:'12px', marginBottom:0, minWidth:0 }}>`,
    'Powder Base compact panel')

  for (const anchor of [baseComment, powderComment]) {
    replaceAfter(anchor,
      `<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>`,
      `<div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px', flexWrap:'wrap', gap:'6px' }}>`,
      `${anchor} compact header`, 3000)
    replaceAfter(anchor,
      `<p style={{ color:'#888', fontSize:'12px', margin:'0 0 6px' }}>Reusable shared formula. Products must explicitly link the exact grams used; this recipe is never auto-counted. Enter all quantities in grams (g) per batch.</p>`,
      `<p style={{ color:'#888', fontSize:'10px', margin:'0 0 5px', lineHeight:1.35 }}>Reusable shared formula. Products must explicitly link the exact grams used; this recipe is never auto-counted. Enter all quantities in grams (g) per batch.</p>`,
      `${anchor} compact description`, 2500)
    replaceAfter(anchor,
      `<div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'12px', fontWeight:'800' }}>`,
      `<div style={{ display:'flex', gap:'7px 10px', flexWrap:'wrap', fontSize:'10px', fontWeight:'800' }}>`,
      `${anchor} compact totals`, 3500)
  }

  replaceAfter(baseComment,
    `<button style={{...btnRed, width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px' }}`,
    `<button style={{...btnRed, width:'auto', padding:'7px 11px', marginTop:0, fontSize:'10px' }}`,
    'Base Dough compact edit button', 4500)
  replaceAfter(powderComment,
    `<button style={{...btnBlack, background:'#7b4f9e', width:'auto', padding:'8px 16px', marginTop:0, fontSize:'12px' }}`,
    `<button style={{...btnBlack, background:'#7b4f9e', width:'auto', padding:'7px 11px', marginTop:0, fontSize:'10px' }}`,
    'Powder Base compact edit button', 4500)

  for (const anchor of [baseComment, powderComment]) {
    replaceAfter(anchor,
      `<div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden' }}>`,
      `<div style={{ border:'1px solid #eee', borderRadius:'8px', overflow:'hidden', minWidth:0 }}>`,
      `${anchor} compact table`, 9000)
    replaceAfter(anchor,
      `<div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#f9f9f9', padding:'6px 10px', fontSize:'10px', fontWeight:'bold', color:'#888' }}>`,
      `<div style={{ display:'grid', gridTemplateColumns:'minmax(120px,2fr) .85fr .55fr .9fr', background:'#f9f9f9', padding:'5px 7px', fontSize:'9px', fontWeight:'bold', color:'#888', gap:'4px' }}>`,
      `${anchor} compact table header`, 9500)
    replaceAfter(anchor,
      `<div key={r.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'7px 10px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0' }}>`,
      `<div key={r.id} style={{ display:'grid', gridTemplateColumns:'minmax(120px,2fr) .85fr .55fr .9fr', padding:'5px 7px', background:i%2===0?'white':'#fafafa', borderTop:'1px solid #f0f0f0', gap:'4px', alignItems:'center' }}>`,
      `${anchor} compact table row`, 10500)
  }

  const refreshedPowderIndex = src.indexOf(powderComment)
  const productTitleIndex = src.indexOf('Product Recipe & Unit Cost', refreshedPowderIndex)
  if (productTitleIndex < 0) throw new Error('Could not find Product Recipe section after shared recipes. Patch aborted safely.')
  const productCommentIndex = src.lastIndexOf('{/*', productTitleIndex)
  if (productCommentIndex < refreshedPowderIndex || productTitleIndex - productCommentIndex > 800) {
    throw new Error('Could not safely close shared recipe grid before Product Recipe section.')
  }
  src = src.slice(0, productCommentIndex) + `</div>\n  ` + src.slice(productCommentIndex)
}

fs.writeFileSync(path, src, 'utf8')
console.log('Costing UI patched: compact shared Base Dough/Powder Base grid plus compact two-card Product Recipe layout and inline margins.')
