const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_icons_restore.jsx", text, "utf8");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const sectionIcons = {
  dashboard: "\\uD83C\\uDFE0",
  hr: "\\uD83D\\uDC65",
  payroll: "\\uD83D\\uDCB0",
  inventory: "\\uD83D\\uDCE6",
  costing: "\\uD83C\\uDF69",
  sales: "\\uD83D\\uDCC8",
  analytics: "\\uD83D\\uDCCA",
  foundation: "\\uD83E\\uDDF1",
  franchise: "\\uD83C\\uDFEA",
  reminders: "\\uD83D\\uDD14"
};

for (const [key, icon] of Object.entries(sectionIcons)) {
  const re = new RegExp("(\\{\\s*key:'" + escapeRegex(key) + "'\\s*,\\s*icon:)\\s*'[^']*'", "g");
  text = text.replace(re, "$1'" + icon + "'");
}

const salesTabs = {
  dashboard: "\\uD83D\\uDCCA Dashboard",
  deliveries: "\\uD83D\\uDE9A Deliveries",
  adjustments: "\\uD83E\\uDDFE Adjustments",
  receivables: "\\uD83D\\uDCB5 Receivables",
  sales: "\\uD83D\\uDCCA Daily Sales",
  expenses: "\\uD83D\\uDCB8 Expenses",
  payables: "\\uD83D\\uDCC5 Payables / PDC",
  resellers: "\\uD83C\\uDFEA Resellers",
  disputes: "\\u26A0\\uFE0F Disputes"
};

for (const [key, label] of Object.entries(salesTabs)) {
  const re = new RegExp("\\['" + escapeRegex(key) + "','[^']*'\\]", "g");
  text = text.replace(re, "['" + key + "','" + label + "']");
}

text = text.replace(/label:'Leave\s*'/g, "label:'Leave \\uD83D\\uDD14'");
text = text.replace(/label:'Cash Adv\s*'/g, "label:'Cash Adv \\uD83D\\uDD14'");
text = text.replace(/label:'Disputes\s*'/g, "label:'Disputes \\uD83D\\uDD14'");

text = text.replace(/>\s*REFRESH</g, ">\\u21BB REFRESH<");
text = text.replace(/>\s*SUBMIT</g, ">\\u2713 SUBMIT<");
text = text.replace(/>\s*CANCEL</g, ">\\u2715 CANCEL<");
text = text.replace(/>\s*SAVE</g, ">\\uD83D\\uDCBE SAVE<");
text = text.replace(/>\s*HISTORY</g, ">\\uD83D\\uDCCB HISTORY<");
text = text.replace(/>\s*RECORD DEPOSIT</g, ">\\uD83D\\uDCB0 RECORD DEPOSIT<");

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
console.log("Remaining raw special characters:", (finalText.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length);
console.log("Dashboard icon escape exists:", finalText.includes("\\uD83C\\uDFE0"));
console.log("Sales tab icon escape exists:", finalText.includes("\\uD83D\\uDCCA Dashboard"));
