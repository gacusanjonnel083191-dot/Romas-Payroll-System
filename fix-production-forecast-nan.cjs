const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-forecast-nan-fix-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

let changes = 0;

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    console.log('NOT FOUND:', label);
    return false;
  }
  if (src.includes(to)) {
    console.log('ALREADY EXISTS:', label);
    return false;
  }
  src = src.replace(from, to);
  changes++;
  console.log('UPDATED:', label);
  return true;
}

const marker = "forecastRows = (forecastRows || []).sort(compareDonutVariantRowsByGuide);";
const helper = `forecastRows = (forecastRows || []).sort(compareDonutVariantRowsByGuide);

const getForecastRowTotal = (row) => {
 const raw = row?.total ?? row?.totalPieces ?? row?.forecast_qty ?? row?.quantity ?? row?.qty ?? 0
 const n = safeNum(raw, 0)
 return Number.isFinite(n) ? n : 0
}

const getDryPremixGramsPerPiece = (variantName) => {
 const direct = DRY_PREMIX_GRAMS[variantName]
 const normalized = typeof normalizeDonutVariantName === 'function'
  ? DRY_PREMIX_GRAMS[normalizeDonutVariantName(variantName)]
  : undefined
 const n = safeNum(direct ?? normalized ?? 0, 0)
 return Number.isFinite(n) ? n : 0
}`;

replaceOnce(marker, helper, 'add safe forecast total helpers');

replaceOnce(
"const totalPieces = forecastRows.reduce((s,r)=>s+r.total,0)",
"const totalPieces = forecastRows.reduce((s,r)=>s+getForecastRowTotal(r),0)",
"safe total pieces"
);

replaceOnce(
"const totalDryPremixG = forecastRows.reduce((s,r)=>s+(DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total, 0)",
"const totalDryPremixG = forecastRows.reduce((s,r)=>s+(getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)), 0)",
"safe total dry premix"
);

src = src.replaceAll(
"const grams = (DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total",
"const pieces = getForecastRowTotal(r)\nconst grams = getDryPremixGramsPerPiece(r.variant_name)*pieces"
);
changes++;

src = src.replaceAll("r.total.toLocaleString()", "getForecastRowTotal(r).toLocaleString()");
src = src.replaceAll("{r.total}", "{getForecastRowTotal(r)}");
changes++;

fs.writeFileSync(path, src, 'utf8');

console.log('');
console.log('DONE. Backup:', backup);
console.log('Total change groups:', changes);
