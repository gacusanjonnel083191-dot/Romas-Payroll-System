const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Replace every single-quoted icon value safely.
// This fixes broken emoji/text icons that caused unterminated string build errors.
app = app.replace(/icon:\s*'[^'\r\n]*'/g, "icon: '•'");

// Replace every double-quoted icon value safely.
app = app.replace(/icon:\s*"[^"\r\n]*"/g, 'icon: "•"');

fs.writeFileSync(file, app);
console.log("All object icon values cleaned safely.");
