const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-forecast-row-sanitize-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

let changes = 0;

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    console.log('NOT FOUND:', label);
    return false;
  }
  src = src.replace(from, to);
  changes++;
  console.log('UPDATED:', label);
  return true;
}

replaceOnce(
"forecastRows = (forecastRows || []).sort(compareDonutVariantRowsByGuide);",
`forecastRows = (forecastRows || [])
 .map((row) => {
  const rawTotal = row?.total ?? row?.totalPieces ?? row?.forecast_qty ?? row?.quantity ?? row?.qty ?? 0
  const totalNum = safeNum(rawTotal, 0)
  const cleanTotal = Number.isFinite(totalNum) ? totalNum : 0
  const forecastQtyNum = safeNum(row?.forecast_qty ?? cleanTotal, cleanTotal)

  return {
   ...row,
   total: cleanTotal,
   totalPieces: cleanTotal,
   forecast_qty: Number.isFinite(forecastQtyNum) ? forecastQtyNum : cleanTotal
  }
 })
 .sort(compareDonutVariantRowsByGuide);`,
"sanitize forecastRows totals before display"
);

// Make sure total pieces cannot become NaN anywhere in the forecast block.
src = src.replace(
"const totalPieces = forecastRows.reduce((s,r)=>s+getForecastRowTotal(r),0)",
"const totalPieces = safeNum(forecastRows.reduce((s,r)=>s+safeNum(r.total,0),0),0)"
);

src = src.replace(
"const totalPieces = forecastRows.reduce((s,r)=>s+r.total,0)",
"const totalPieces = safeNum(forecastRows.reduce((s,r)=>s+safeNum(r.total,0),0),0)"
);

// Make sure dry premix cannot become NaN.
src = src.replace(
"const totalDryPremixG = forecastRows.reduce((s,r)=>s+(getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)), 0)",
"const totalDryPremixG = safeNum(forecastRows.reduce((s,r)=>s+(safeNum(getDryPremixGramsPerPiece(r.variant_name),0)*safeNum(r.total,0)), 0),0)"
);

src = src.replace(
"const totalDryPremixG = forecastRows.reduce((s,r)=>s+(DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total, 0)",
"const totalDryPremixG = safeNum(forecastRows.reduce((s,r)=>s+(safeNum(DRY_PREMIX_GRAMS[r.variant_name],0)*safeNum(r.total,0)), 0),0)"
);

// Make every displayed grams value safe.
src = src.replaceAll(
"const grams = getDryPremixGramsPerPiece(r.variant_name)*pieces",
"const grams = safeNum(getDryPremixGramsPerPiece(r.variant_name),0)*safeNum(r.total,0)"
);

src = src.replaceAll(
"const grams = (DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total",
"const grams = safeNum(DRY_PREMIX_GRAMS[r.variant_name],0)*safeNum(r.total,0)"
);

fs.writeFileSync(path, src, 'utf8');

console.log('');
console.log('DONE. Backup:', backup);
console.log('Total changes:', changes);
