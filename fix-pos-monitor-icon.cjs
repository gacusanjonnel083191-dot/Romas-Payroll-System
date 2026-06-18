const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Replace receipt emoji icon with safe text icon
app = app.replace(/icon:'??'/g, "icon:'POS'");
app = app.replace(/icon:"??"/g, 'icon:"POS"');

fs.writeFileSync(file, app);
console.log("POS Monitor icon fixed.");
