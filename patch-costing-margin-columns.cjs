const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const diagnosticTerms = ['displayedRecipeCost.statusLabel', 'recipeCost.statusLabel', 'statusLabel}', "'BASE'", '>BASE<']
for (const term of diagnosticTerms) {
  let from = 0
  let count = 0
  while (count < 6) {
    const i = src.indexOf(term, from)
    if (i < 0) break
    console.log(`COSTING_RENDER_SNIPPET_${term.replace(/[^A-Za-z0-9]+/g, '_')}_${count + 1}: ${src.slice(Math.max(0, i - 1000), i + 1800).replace(/\s+/g, ' ')}`)
    from = i + term.length
    count += 1
  }
  if (!count) console.log(`COSTING_RENDER_TERM_NOT_FOUND_${term.replace(/[^A-Za-z0-9]+/g, '_')}`)
}

const marker = 'COMPANY GROSS MARGIN'
if (src.includes(marker)) {
  console.log('Costing margin columns already present; no patch needed.')
  process.exit(0)
}

const oldGrid = "gridTemplateColumns:isMobile?'1fr':'minmax(220px,1.5fr) repeat(5,minmax(82px,0.7fr)) auto'"
const newGrid = "gridTemplateColumns:isMobile?'1fr':'minmax(220px,1.5fr) repeat(6,minmax(82px,0.7fr)) auto'"

if (!src.includes(oldGrid)) {
  throw new Error('Could not find the product-cost row grid layout. The costing UI may have changed; patch aborted safely.')
}
src = src.replace(oldGrid, newGrid)

const currentSrpLine = /^([ \t]*<div[^\n]*>CURRENT SRP<\/p>[^\n]*<\/div>)$/m
const match = src.match(currentSrpLine)
if (!match) {
  throw new Error('Could not find the CURRENT SRP cell in the product costing list. Patch aborted safely.')
}

const indent = (match[1].match(/^[ \t]*/) || [''])[0]
const marginCell = `${indent}<div style={{ textAlign:isMobile?'left':'right' }}><p style={{ color:'#999', fontSize:'8px', margin:'0 0 2px' }}>COMPANY GROSS MARGIN</p><div style={{ display:'flex', flexDirection:'column', gap:'1px', alignItems:isMobile?'flex-start':'flex-end' }}><strong style={{ color:displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentResellerPrice,0)>0&&safeNum(displayedRecipeCost.currentResellerPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', whiteSpace:'nowrap' }}>Reseller {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentResellerPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentResellerPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentResellerPrice,0))*100).toFixed(1)}%\`:'—'}</strong><strong style={{ color:displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentRetailPrice,0)>0&&safeNum(displayedRecipeCost.currentRetailPrice,0)>=safeNum(displayedRecipeCost.totalCost,0)?'#2d8a4e':'#ca1b1b', fontSize:'9px', whiteSpace:'nowrap' }}>Retail {displayedRecipeCost.isCostReady&&safeNum(displayedRecipeCost.currentRetailPrice,0)>0?\`${'${'}(((safeNum(displayedRecipeCost.currentRetailPrice,0)-safeNum(displayedRecipeCost.totalCost,0))/safeNum(displayedRecipeCost.currentRetailPrice,0))*100).toFixed(1)}%\`:'—'}</strong></div></div>`

src = src.replace(currentSrpLine, `${match[1]}\n${marginCell}`)
fs.writeFileSync(path, src, 'utf8')
console.log('Added reseller-sale and retail-sale gross margin percentages to every product costing row.')
