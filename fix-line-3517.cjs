const fs = require("fs");

const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_line_3517_fix.jsx", text, "utf8");

const startMarker = "function getPaymentDeadlineLabel(row)";
const endMarker = "async function autoMarkTodayDelivered";

const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker);

if (start === -1) {
  throw new Error("Cannot find getPaymentDeadlineLabel section.");
}

if (end === -1) {
  throw new Error("Cannot find autoMarkTodayDelivered section.");
}

const cleanSection = [
"function getPaymentDeadlineLabel(row) {",
"  if (row?.days_until_due === null || row?.days_until_due === undefined) return 'No due date'",
"  if (row.days_until_due < 0) return `${Math.abs(row.days_until_due)} day(s) overdue`",
"  if (row.days_until_due === 0) return 'Due today'",
"  if (row.days_until_due === 1) return 'Due tomorrow'",
"  return `Due in ${row.days_until_due} days`",
"}",
"",
"  "
].join("\n");

text = text.slice(0, start) + cleanSection + text.slice(end);

text = text.replace(/\s*\{renderOwnerPaymentDeadlineWarning\([^)]*\)\}/g, "");
text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");

console.log("Remaining banner references:", (finalText.match(/renderOwnerPaymentDeadlineWarning|Company payables approaching|Owner payable warning/g) || []).length);
console.log("Remaining broken special characters:", (finalText.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length);
console.log("Line 3517 area repaired.");
