const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-forecast-missing-variants-${stamp}`;

let text = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

if (text.includes('FORECAST ZERO-QTY ACTIVE VARIANTS PATCH')) {
  console.log('Patch already exists. No duplicate patch added.');
  process.exit(0);
}

const lines = text.split(/\r?\n/);

let bestIndex = -1;
let bestScore = -1;
let bestVar = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/\bconst\s+(\w+)\s*=\s*Object\.values\((\w*forecast\w*Map\w*)\)/i);
  if (!m) continue;

  const context = lines.slice(Math.max(0, i - 80), Math.min(lines.length, i + 120)).join('\n');
  let score = 0;
  if (context.includes('Production Forecast')) score += 5;
  if (context.includes('Dry Premix') || context.includes('dryPremix')) score += 4;
  if (context.includes('totalPieces')) score += 3;
  if (context.includes('deliveryDateToForecast')) score += 3;
  if (context.includes('donutVariants')) score += 2;

  if (score > bestScore) {
    bestScore = score;
    bestIndex = i;
    bestVar = m[1];
  }
}

if (bestIndex < 0 || bestScore < 5) {
  throw new Error('Could not safely find the Production Forecast rows. No changes saved.');
}

lines[bestIndex] = lines[bestIndex].replace(/\bconst\s+/, 'let ');

const indent = (lines[bestIndex].match(/^\s*/) || [''])[0];

const patch = `
${indent}// FORECAST ZERO-QTY ACTIVE VARIANTS PATCH
${indent}// Include active variants that have no invoice quantity yet, without changing totals.
${indent}{
${indent}  const forecastVariantKey = (value) => {
${indent}    try {
${indent}      return normalizeProductCostKey(value);
${indent}    } catch (_) {
${indent}      return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
${indent}    }
${indent}  };
${indent}  const existingForecastKeys = new Set((${bestVar} || []).map((row) =>
${indent}    forecastVariantKey(row.variant_name || row.variant || row.product_name || row.name || row.product || '')
${indent}  ));
${indent}  (donutVariants || []).forEach((variant) => {
${indent}    const variantName = variant?.name || variant?.variant_name || variant?.product_name || '';
${indent}    const variantKey = forecastVariantKey(variantName);
${indent}    if (!variantName || existingForecastKeys.has(variantKey)) return;
${indent}    ${bestVar}.push({
${indent}      id: variant?.id || variant?.variant_id || \`zero-\${variantKey}\`,
${indent}      variant_id: variant?.id || variant?.variant_id || \`zero-\${variantKey}\`,
${indent}      variant_name: variantName,
${indent}      variant: variantName,
${indent}      product_name: variantName,
${indent}      name: variantName,
${indent}      product: variantName,
${indent}      totalPieces: 0,
${indent}      total_pieces: 0,
${indent}      pieces: 0,
${indent}      quantity: 0,
${indent}      qty: 0,
${indent}      forecast_qty: 0,
${indent}      dryPremix: 0,
${indent}      dry_premix: 0,
${indent}      dryPremixKg: 0,
${indent}      dryPremixGrams: 0
${indent}    });
${indent}    existingForecastKeys.add(variantKey);
${indent}  });
${indent}  ${bestVar} = (${bestVar} || []).sort((a, b) =>
${indent}    String(a.variant_name || a.variant || a.product_name || a.name || '').localeCompare(
${indent}      String(b.variant_name || b.variant || b.product_name || b.name || '')
${indent}    )
${indent}  );
${indent}}
`;

lines.splice(bestIndex + 1, 0, patch);

fs.writeFileSync(path, lines.join('\n'), 'utf8');

console.log('DONE: Production Forecast will now include missing active variants as 0-piece rows.');
console.log('Patched row variable:', bestVar);
console.log('Backup created:', backup);
