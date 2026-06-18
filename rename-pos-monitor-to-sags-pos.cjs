const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Rename POS Monitor menu/title to SAGS POS
app = app.replaceAll("label:'POS Monitor'", "label:'SAGS POS'");
app = app.replaceAll('label:"POS Monitor"', 'label:"SAGS POS"');
app = app.replaceAll(">POS Monitor<", ">SAGS POS<");
app = app.replaceAll("<h2 style={h2s}>POS Monitor</h2>", "<h2 style={h2s}>SAGS POS</h2>");
app = app.replaceAll("console.log(\"Clean POS Monitor patch applied safely.\");", "console.log(\"SAGS POS label applied safely.\");");

fs.writeFileSync(file, app);
console.log("POS Monitor renamed to SAGS POS.");
