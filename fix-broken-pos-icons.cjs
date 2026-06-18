const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Clean bad POS icon replacements in dashboard/stat objects
app = app.replace(/icon:\s*'POS'/g, "icon: '•'");
app = app.replace(/icon:\s*"POS"/g, 'icon: "•"');

// Specifically clean the Business Health stat line if it was damaged
app = app.replace(
  /\{ label:'Business Health'[\s\S]*?\},/,
  "{ label:'Business Health', value:`${safeNum(d.healthScore,0).toFixed(0)}/100`, note:d.businessHealthGrade || 'Overall score', color:getBusinessHealthColor(safeNum(d.healthScore,0)), icon: '•' },"
);

fs.writeFileSync(file, app);
console.log("Cleaned broken POS icon strings.");
