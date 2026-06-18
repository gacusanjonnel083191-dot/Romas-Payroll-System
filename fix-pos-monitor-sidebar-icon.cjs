const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Change POS Monitor sidebar icon from P to POS
app = app.replace(
  "key:'posMonitor', icon:'P', label:'POS Monitor'",
  "key:'posMonitor', icon:'POS', label:'POS Monitor'"
);

fs.writeFileSync(file, app);
console.log("POS Monitor sidebar icon changed to POS.");
