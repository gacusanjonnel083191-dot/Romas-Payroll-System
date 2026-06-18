const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_payables_sidebar_final.jsx", text, "utf8");

// 1. Fix visible broken refresh text.
text = text.replace(/\\u21BB\s*REFRESH/g, "REFRESH");
text = text.replace(/\\\\u21BB\s*REFRESH/g, "REFRESH");

// 2. Add blinking CSS inside App only once.
if (!text.includes("payables-main-blink-style")) {
  text = text.replace(
    "export default function App() {",
    `export default function App() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('payables-main-blink-style')) return
    const style = document.createElement('style')
    style.id = 'payables-main-blink-style'
    style.textContent = '@keyframes payablesMainBlink{0%,100%{background:#ca1b1b;color:#fff;box-shadow:0 0 0 rgba(253,212,18,0)}50%{background:#fdd412;color:#1a1a2e;box-shadow:0 0 18px rgba(253,212,18,.95)}}'
    document.head.appendChild(style)
  }, [])`
  );
}

// 3. Add state so blinking stops after clicking Payables.
if (!text.includes("payablesAlertSeenKey")) {
  text = text.replace(
    "const [companyPayablesError, setCompanyPayablesError] = useState('')",
    "const [companyPayablesError, setCompanyPayablesError] = useState('')\n  const [payablesAlertSeenKey, setPayablesAlertSeenKey] = useState('')"
  );
}

// 4. Add Payables / PDC as main sidebar item above Franchise.
if (!text.includes("key:'payablesMain'")) {
  text = text.replace(
    /(\n\s*)\{\s*key:'franchise'\s*,/,
    `$1{ key:'payablesMain', icon:'PDC', label:'Payables / PDC',
        tabs:[{key:'payablesMain',label:'Payables / PDC'}],
        roles:['owner'] },
$1{ key:'franchise',`
  );
}

// 5. Add warning key and blinking condition after ownerDeadlineSummary.
if (!text.includes("const payablesDeadlineKey =")) {
  text = text.replace(
    "const ownerDeadlineSummary = getOwnerPaymentDeadlineAlerts()",
    `const ownerDeadlineSummary = getOwnerPaymentDeadlineAlerts()
    const payablesDeadlineKey = (ownerDeadlineSummary.warningRows || [])
      .map(r => String(r.source || '') + ':' + String(r.id || '') + ':' + String(r.due_date_effective || r.due_date || ''))
      .sort()
      .join('|')
    const shouldBlinkPayablesButton = ownerDeadlineSummary.warningCount > 0 && payablesAlertSeenKey !== payablesDeadlineKey`
  );
}

// 6. Make Payables sidebar button open the existing Payables / PDC screen.
if (!text.includes("if(key==='payablesMain')")) {
  text = text.replace(
    "const handleTabClick = (key) => {",
    `const handleTabClick = (key) => {
      if(key==='payablesMain') {
        setActiveTab('payablesMain')
        setSalesView('payables')
        setPayablesAlertSeenKey(payablesDeadlineKey || 'seen')
        setSidebarOpen(false)
        loadResellers()
        loadResellerAccounts({ silent:true })
        loadDeliveryInvoices()
        loadDailyExpenses()
        loadCompanyPayables()
        loadFinancialData()
        return
      }`
  );
}

// 7. Let Sales & Expenses content render when Payables main sidebar is selected.
text = text.replace(/activeTab==='sales'\s*&&\s*\(/g, "(activeTab==='sales'||activeTab==='payablesMain') && (");

// 8. Remove Payables / PDC from Sales & Expenses sub-tabs if present.
text = text.replace(/,\s*\['payables','[^']*Payables \/ PDC'\]/g, "");
text = text.replace(/\s*\.filter\(\(\[v\]\)=>v!=='payables'\|\|isOwnerRole\)/g, "");

// 9. Add per-button blink variable in sidebar map.
if (!text.includes("const shouldBlinkThisPayablesButton = section.key==='payablesMain'")) {
  text = text.replace(
    "const isActive = currentSection.key === section.key",
    "const isActive = currentSection.key === section.key\n                  const shouldBlinkThisPayablesButton = section.key==='payablesMain' && shouldBlinkPayablesButton"
  );
}

// 10. Apply blinking style to the Payables main button.
text = text.replace(
  "background:isActive?'#ca1b1b':'transparent', color:isActive?'white':'rgba(255,255,255,0.65)'",
  "background:shouldBlinkThisPayablesButton?'#fdd412':isActive?'#ca1b1b':'transparent', color:shouldBlinkThisPayablesButton?'#1a1a2e':isActive?'white':'rgba(255,255,255,0.65)', animation:shouldBlinkThisPayablesButton?'payablesMainBlink 0.8s ease-in-out infinite':'none', boxShadow:shouldBlinkThisPayablesButton?'0 0 16px rgba(253,212,18,0.9)':'none'"
);

// 11. Move payable warning badge away from Sales & Expenses and into Payables / PDC.
text = text.replace(
  "(section.key==='sales' && ((pendingExpenses>0 && adminRole==='owner') || ownerDeadlineSummary.warningCount>0))",
  "((section.key==='sales' && pendingExpenses>0 && adminRole==='owner') || (section.key==='payablesMain' && ownerDeadlineSummary.warningCount>0))"
);

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");

console.log("Payables main sidebar exists:", finalText.includes("key:'payablesMain'"));
console.log("Blink logic exists:", finalText.includes("shouldBlinkPayablesButton"));
console.log("Refresh text fixed:", !finalText.includes("\\u21BB REFRESH"));
console.log("Payables main can render sales content:", finalText.includes("activeTab==='payablesMain'"));
