const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const startText = "const allMovements = [";
const endText = "].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())";

const start = app.indexOf(startText);
const end = app.indexOf(endText, start);

if (start === -1 || end === -1) {
  throw new Error("Could not find broken allMovements block.");
}

const cleanBlock = `const allMovements = [
      ...(txs.data || []).map(t => ({
        ...t,
        movementType: t.transaction_type === 'in' ? 'Stock In' : 'Stock Out',
        color: t.transaction_type === 'in' ? '#2d8a4e' : '#ca1b1b',
        icon: 'POS'
      })),
      ...(wastage.data || []).map(w => ({
        ...w,
        movementType: 'Wastage',
        quantity: -(w.quantity || 0),
        color: '#f57c00',
        icon: 'POS',
        created_at: w.created_at || w.wastage_date
      })),
      ...(adjs.data || []).map(a => ({
        ...a,
        movementType: 'Adjustment',
        quantity: a.adjustment_qty,
        color: Number(a.adjustment_qty) >= 0 ? '#4a90d9' : '#ca1b1b',
        icon: 'POS'
      }))
    ].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())`;

app = app.slice(0, start) + cleanBlock + app.slice(end + endText.length);

fs.writeFileSync(file, app);
console.log("Fixed broken allMovements string block.");
