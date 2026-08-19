const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const marker = 'COSTING_INLINE_MARGIN'
if (src.includes(marker)) {
  console.log('Inline costing margins already present; no patch needed.')
  process.exit(0)
}

const productHeaderPattern = /<div\s+style=\{\{\s*display:'flex',\s*gap:'6px',\s*flexWrap:'wrap',\s*alignItems:'center'\s*\}\}>\s*<strong\s+style=\{\{\s*color:'#333',\s*fontSize:'12px'\s*\}\}>\{v\.name\}<\/strong>\s*<Badge\s+label=\{cost\.statusLabel\}\s+color=\{statusColor\}\/>\s*\{hasBaseLink&&<Badge\s+label="BASE"\s+color="green"\/>\}\s*\{hasPowderLink&&<Badge\s+label="POWDER"\s+color="blue"\/>\}\s*<\/div>/m

if (!productHeaderPattern.test(src)) {
  throw new Error('Could not find the product-name badge row in Costing. Patch aborted safely.')
}

const inlineMarginHeader = `<div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>{/* COSTING_INLINE_MARGIN */}<strong style={{ color:'#333', fontSize:'12px' }}>{v.name}</strong>{(cost.statusCode==='incomplete'||cost.statusCode==='review')&&<Badge label={cost.statusLabel} color={statusColor}/>} {hasPowderLink&&<Badge label="POWDER" color="blue"/>}<span style={{ color:!displayedRecipeCost.isCostReady?'#999':safeNum(displayedRecipeCost.currentResellerPrice,0)>0&&safeNum(displayedRecipeCost.currentResellerPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', fontWeight:'900', whiteSpace:'nowrap' }}>Reseller {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentResellerPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentResellerPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentResellerPrice,0))*100).toFixed(1)}%\`:'—'}</span><span style={{ color:!displayedRecipeCost.isCostReady?'#999':safeNum(displayedRecipeCost.currentRetailPrice,0)>0&&safeNum(displayedRecipeCost.currentRetailPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', fontWeight:'900', whiteSpace:'nowrap' }}>Retail {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentRetailPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentRetailPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentRetailPrice,0))*100).toFixed(1)}%\`:'—'}</span></div>`

src = src.replace(productHeaderPattern, inlineMarginHeader)
fs.writeFileSync(path, src, 'utf8')
console.log('Moved reseller and retail gross margins beside each product name; removed SELLING AT LOSS, BELOW TARGET, READY, and BASE badges from product rows while preserving INCOMPLETE/REVIEW COST warnings.')
