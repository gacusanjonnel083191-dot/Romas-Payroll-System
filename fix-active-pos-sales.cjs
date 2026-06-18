const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-fix-active-pos-sales.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

// Add activePosSales safely after movementSummary
if (!app.includes("const activePosSales = posSales.filter(sale => String(sale.status || 'completed').toLowerCase() !== 'void')")) {
  app = app.replace(
`const movementSummary = Object.values(movementSummaryMap).sort((a,b) => String(a.type).localeCompare(String(b.type)))`,
`const movementSummary = Object.values(movementSummaryMap).sort((a,b) => String(a.type).localeCompare(String(b.type)))

 const activePosSales = posSales.filter(sale => String(sale.status || 'completed').toLowerCase() !== 'void')`
  );
}

// If patch accidentally created duplicate badly elsewhere, keep it safe by replacing broken standalone usage patterns
app = app.replace(
  /const totalSales = activePosSales\.reduce\(\(sum,sale\) => sum \+ safeNum\(sale\.net_total \|\| sale\.total \|\| sale\.total_amount, 0\), 0\)/g,
  "const totalSales = activePosSales.reduce((sum,sale) => sum + safeNum(sale.net_total || sale.total || sale.total_amount, 0), 0)"
);

fs.writeFileSync(file, app);
console.log("Fixed activePosSales variable.");
