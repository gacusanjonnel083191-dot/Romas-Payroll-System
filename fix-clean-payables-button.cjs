const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_clean_payables_button.jsx", text, "utf8");

// Fix wrong literal unicode text in Payables button.
text = text.replace(/icon:'\\\\uD83D\\\\uDCC5', label:'Payables \/ PDC'/g, "icon:'', label:'Payables / PDC'");
text = text.replace(/icon:'\\uD83D\\uDCC5', label:'Payables \/ PDC'/g, "icon:'', label:'Payables / PDC'");
text = text.replace(/icon:'PDC', label:'Payables \/ PDC'/g, "icon:'', label:'Payables / PDC'");

// Clean any visible unicode code that may have entered the label.
text = text.replace(/\\\\uD83D\\\\uDCC5\s*Payables \/ PDC/g, "Payables / PDC");
text = text.replace(/\\uD83D\\uDCC5\s*Payables \/ PDC/g, "Payables / PDC");

// Make the button label align cleanly when there is no icon.
text = text.replace(
  /<span style=\{\{ marginRight:'10px' \}\}>\{section\.icon\}<\/span>\s*\{section\.label\}/g,
  "{section.icon ? <span style={{ marginRight:'10px' }}>{section.icon}</span> : null}{section.label}"
);

// Make Payables button blink only when there is an approaching payable deadline.
text = text.replace(
  /section\.key==='payablesMain' && shouldBlinkPayablesButton/g,
  "section.key==='payablesMain' && shouldBlinkPayablesButton"
);

// Make sure Payables stays above Franchise.
if (text.includes("key:'payablesMain'") && text.includes("key:'franchise'")) {
  const payablesBlockMatch = text.match(/\n\s*\{\s*key:'payablesMain'[\s\S]*?roles:\['owner'\]\s*\},/);
  if (payablesBlockMatch) {
    const payablesBlock = payablesBlockMatch[0];
    text = text.replace(payablesBlock, "");
    text = text.replace(
      /(\n\s*)\{\s*key:'franchise'\s*,/,
      payablesBlock + "$1{ key:'franchise',"
    );
  }
}

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
console.log("Broken unicode payables text removed:", !finalText.includes("\\\\uD83D\\\\uDCC5") && !finalText.includes("\\uD83D\\uDCC5"));
console.log("Payables main button exists:", finalText.includes("key:'payablesMain'"));
console.log("Payables button label clean:", finalText.includes("label:'Payables / PDC'"));
console.log("Payables is above Franchise:", finalText.indexOf("key:'payablesMain'") < finalText.indexOf("key:'franchise'"));
