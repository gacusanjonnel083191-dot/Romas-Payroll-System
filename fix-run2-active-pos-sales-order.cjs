const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-fix-run2-tdz.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

// Remove every existing activePosSales declaration to avoid duplicate / wrong order
app = app.replace(
  /\n\s*const activePosSales = posSales\.filter\(sale => String\(sale\.status \|\| 'completed'\)\.toLowerCase\(\) !== 'void'\)/g,
  ""
);

// Insert one correct activePosSales declaration before first totalSales calculation
app = app.replace(
  /(\n\s*)const totalSales = activePosSales\.reduce\(\(sum,sale\) => sum \+ safeNum\(sale\.net_total \|\| sale\.total \|\| sale\.total_amount, 0\), 0\)/,
  `$1const activePosSales = posSales.filter(sale => String(sale.status || 'completed').toLowerCase() !== 'void')
$1const totalSales = activePosSales.reduce((sum,sale) => sum + safeNum(sale.net_total || sale.total || sale.total_amount, 0), 0)`
);

// If no totalSales insertion point was found, insert before searchedReceipts as fallback
if (!app.includes("const activePosSales = posSales.filter(sale => String(sale.status || 'completed').toLowerCase() !== 'void')")) {
  app = app.replace(
    "const searchedReceipts = posSales.filter(s => {",
    "const activePosSales = posSales.filter(sale => String(sale.status || 'completed').toLowerCase() !== 'void')\n\n const searchedReceipts = posSales.filter(s => {"
  );
}

fs.writeFileSync(file, app);
console.log("Fixed RUN 2 activePosSales initialization order.");
