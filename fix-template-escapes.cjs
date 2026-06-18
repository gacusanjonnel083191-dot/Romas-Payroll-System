const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");

fs.writeFileSync(
  process.env.USERPROFILE + "\\Desktop\\App_backup_before_template_escape_fix.jsx",
  text,
  "utf8"
);

// Fix escaped template literals accidentally inserted by the invoice patch
text = text.replace(/\\`/g, "`");

// Fix escaped template placeholders so invoice data can print correctly
text = text.replace(/\\\$\{/g, "${");

// Fix double-escaped unicode sequences like \\u20B1 into valid JS unicode escapes
text = text.replace(/\\\\u([0-9A-Fa-f]{4})/g, "\\u$1");

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");

console.log("Remaining escaped backticks:", (finalText.match(/\\`/g) || []).length);
console.log("Remaining escaped placeholders:", (finalText.match(/\\\$\{/g) || []).length);
console.log("Template escape repair done.");
