const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");

fs.writeFileSync(
  process.env.USERPROFILE + "\\Desktop\\App_backup_before_invoice_text_size_fix.jsx",
  text,
  "utf8"
);

// Remove auto-filled prepared by name. Keep the Prepared by row but leave it blank.
text = text.replace(
  /const preparedBy = cleanText\([\s\S]*?\);/,
  "const preparedBy = '';"
);

// Make invoice text larger and clearer.
const replacements = [
  [/font-size:\s*8\.4px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*8\.3px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*8\.2px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*8\.5px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*8\.6px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*8\.7px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*9px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*9\.3px\s*!important/g, "font-size: 12px !important"],
  [/font-size:\s*10px\s*!important/g, "font-size: 13px !important"],
  [/font-size:\s*10\.5px\s*!important/g, "font-size: 13px !important"],
  [/font-size:\s*11px\s*!important/g, "font-size: 14px !important"]
];

for (const [pattern, value] of replacements) {
  text = text.replace(pattern, value);
}

// Make total row more visible.
text = text.replace(
  /\.total-label\s*\{[\s\S]*?\}/,
  ".total-label { text-align: center !important; font-weight: 900 !important; font-size: 16px !important; }"
);

text = text.replace(
  /\.total-amount\s*\{[\s\S]*?\}/,
  ".total-amount { text-align: right !important; font-weight: 900 !important; background: #d9d9d9 !important; font-size: 18px !important; color: #000 !important; }"
);

// Slightly tighten rows so larger text still fits inside 4x6.
text = text.replace(/height:\s*0\.215in\s*!important/g, "height: 0.205in !important");
text = text.replace(/height:\s*0\.23in\s*!important/g, "height: 0.22in !important");
text = text.replace(/height:\s*0\.24in\s*!important/g, "height: 0.22in !important");

fs.writeFileSync(path, text, "utf8");

console.log("Invoice text size updated.");
console.log("Prepared by name removed:", text.includes("const preparedBy = '';"));
console.log("Large total amount applied:", text.includes("font-size: 18px !important"));
