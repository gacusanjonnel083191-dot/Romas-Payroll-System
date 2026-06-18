const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_payables_icon_fix.jsx", text, "utf8");

// Fix Payables / PDC sidebar icon safely.
// Uses String.fromCodePoint so the source file stays encoding-safe,
// but the browser still displays the calendar icon.
text = text.replace(
  /icon:'', label:'Payables \/ PDC'/g,
  "icon:String.fromCodePoint(0x1F4C5), label:'Payables / PDC'"
);

text = text.replace(
  /icon:'PDC', label:'Payables \/ PDC'/g,
  "icon:String.fromCodePoint(0x1F4C5), label:'Payables / PDC'"
);

text = text.replace(
  /icon:'\\\\uD83D\\\\uDCC5', label:'Payables \/ PDC'/g,
  "icon:String.fromCodePoint(0x1F4C5), label:'Payables / PDC'"
);

text = text.replace(
  /icon:'\\uD83D\\uDCC5', label:'Payables \/ PDC'/g,
  "icon:String.fromCodePoint(0x1F4C5), label:'Payables / PDC'"
);

// Make sure sidebar icon rendering works whether section.icon is text or generated icon.
text = text.replace(
  /<span style=\{\{ marginRight:'10px' \}\}>\{section\.icon\}<\/span>\s*\{section\.label\}/g,
  "{section.icon ? <span style={{ marginRight:'10px' }}>{section.icon}</span> : null}{section.label}"
);

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
console.log("Payables icon fixed:", finalText.includes("icon:String.fromCodePoint(0x1F4C5), label:'Payables / PDC'"));
console.log("No broken unicode text:", !finalText.includes("\\\\uD83D\\\\uDCC5"));
