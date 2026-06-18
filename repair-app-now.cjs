const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_final_repair.jsx", text, "utf8");

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let state = "code";
  let quote = null;
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === "line") {
      if (ch === "\n") state = "code";
      continue;
    }

    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i++;
      }
      continue;
    }

    if (state === "string") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) state = "code";
      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "`") state = "code";
      continue;
    }

    if (ch === "/" && next === "/") {
      state = "line";
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      state = "string";
      quote = ch;
      continue;
    }

    if (ch === "`") {
      state = "template";
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function removeFunction(source, functionName) {
  const marker = "function " + functionName;
  const start = source.indexOf(marker);
  if (start === -1) return source;

  const parenClose = source.indexOf(")", start);
  if (parenClose === -1) return source;

  const bodyStart = source.indexOf("{", parenClose);
  if (bodyStart === -1) return source;

  const bodyEnd = findMatchingBrace(source, bodyStart);
  if (bodyEnd === -1) return source;

  return source.slice(0, start) + "\n" + source.slice(bodyEnd + 1);
}

// Remove old destructive payable banner function and rendered calls
text = removeFunction(text, "renderOwnerPaymentDeadlineWarning");
text = text.replace(/\s*\{renderOwnerPaymentDeadlineWarning\([^)]*\)\}/g, "");

// Repair accidental spread/operator damage from previous cleanup attempts
text = text.replace(/\[\s*\.\s*openCompanyPayables\s*,\s*\.\s*pendingExpenseRows\s*\]/g, "[...openCompanyPayables, ...pendingExpenseRows]");
text = text.replace(/style=\{\{\s*\.btn/g, "style={{ ...btn");
text = text.replace(/\{\s*\.btn/g, "{ ...btn");
text = text.replace(/\[\s*\.([A-Za-z_$][A-Za-z0-9_$]*)/g, "[...$1");
text = text.replace(/,\s*\.([A-Za-z_$][A-Za-z0-9_$]*)/g, ", ...$1");

// Keep file safe ASCII after previous encoding issue
text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
const specialCount = (finalText.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
const bannerCount = (finalText.match(/renderOwnerPaymentDeadlineWarning|Company payables approaching|Owner payable warning/g) || []).length;
const damagedSpreadCount = (finalText.match(/[\[\{,]\s*\.[A-Za-z_$]/g) || []).length;

console.log("Remaining broken/special characters:", specialCount);
console.log("Remaining payable banner references:", bannerCount);
console.log("Remaining damaged spread patterns:", damagedSpreadCount);
