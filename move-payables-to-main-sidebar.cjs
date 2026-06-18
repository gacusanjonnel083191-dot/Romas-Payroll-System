const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_payables_main_button.jsx", text, "utf8");

// 1) Add blinking CSS once, safely.
if (!text.includes("payablesSidebarBlink")) {
  const marker = "export default function App() {";
  text = text.replace(marker, marker + `
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('payables-sidebar-blink-style')) return
    const style = document.createElement('style')
    style.id = 'payables-sidebar-blink-style'
    style.textContent = '@keyframes payablesSidebarBlink{0%,100%{background:#ca1b1b;color:#fff;box-shadow:0 0 0 rgba(253,212,18,0)}50%{background:#fdd412;color:#1a1a2e;box-shadow:0 0 18px rgba(253,212,18,.95)}}'
    document.head.appendChild(style)
  }, [])
`);
}

// 2) Add state so blinking stops after clicking the Payables button.
if (!text.includes("payablesBlinkSeenKey")) {
  text = text.replace(
    "const [companyPayablesError, setCompanyPayablesError] = useState('')",
    "const [companyPayablesError, setCompanyPayablesError] = useState('')\n  const [payablesBlinkSeenKey, setPayablesBlinkSeenKey] = useState('')"
  );
}

// 3) Add Payables as a main sidebar button directly above Franchise.
if (!text.includes("key:'payablesMain'")) {
  text = text.replace(
    /(\n\s*)\{\s*key:'franchise'\s*,/,
    `$1{ key:'payablesMain', icon:'\\\\uD83D\\\\uDCC5', label:'Payables / PDC',
        tabs:[{key:'payablesMain',label:'Payables / PDC'}],
        roles:['owner'] },
$1{ key:'franchise',`
  );
}

// 4) Prepare warning key and blinking condition from existing payable deadline logic.
if (!text.includes("const payablesWarningKey =")) {
  text = text.replace(
    "const ownerDeadlineSummary = getOwnerPaymentDeadlineAlerts()",
    `const ownerDeadlineSummary = getOwnerPaymentDeadlineAlerts()
    const payablesWarningKey = (ownerDeadlineSummary.warningRows || [])
      .map(r => String(r.source || '') + ':' + String(r.id || '') + ':' + String(r.due_date_effective || r.due_date || ''))
      .sort()
      .join('|')
    const shouldBlinkPayablesMainButton = isOwnerRole && ownerDeadlineSummary.warningCount > 0 && payablesBlinkSeenKey !== payablesWarningKey`
  );
}

// 5) Make the Payables main button open the existing Payables / PDC screen and stop blinking after click.
if (!text.includes("if(key==='payablesMain')")) {
  text = text.replace(
    "const handleTabClick = (key) => {",
    `const handleTabClick = (key) => {
      if(key==='payablesMain') {
        setActiveTab('payablesMain')
        setSalesView('payables')
        setPayablesBlinkSeenKey(payablesWarningKey || 'seen')
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

// 6) Allow the Sales & Expenses screen to render when Payables main button is active.
text = text.replace(/activeTab==='sales'\s*&&\s*\(/g, "(activeTab==='sales'||activeTab==='payablesMain') && (");

// 7) Remove Payables / PDC from the Sales & Expenses sub-navigation because it is now a main sidebar button.
text = text.replace(/,\s*\['payables','[^']*Payables \/ PDC'\]/g, "");
text = text.replace(/\s*\.filter\(\(\[v\]\)=>v!=='payables'\|\|isOwnerRole\)/g, "");

// 8) Make only the new Payables main sidebar button blink when warning exists.
if (!text.includes("const shouldBlinkThisPayablesButton = section.key==='payablesMain'")) {
  text = text.replace(
    "const isActive = currentSection.key === section.key",
    "const isActive = currentSection.key === section.key\n                  const shouldBlinkThisPayablesButton = section.key==='payablesMain' && shouldBlinkPayablesMainButton"
  );
}

text = text.replace(
  "background:isActive?'#ca1b1b':'transparent', color:isActive?'white':'rgba(255,255,255,0.65)'",
  "background:shouldBlinkThisPayablesButton?'#fdd412':isActive?'#ca1b1b':'transparent', color:shouldBlinkThisPayablesButton?'#1a1a2e':isActive?'white':'rgba(255,255,255,0.65)', animation:shouldBlinkThisPayablesButton?'payablesSidebarBlink 0.8s ease-in-out infinite':'none', boxShadow:shouldBlinkThisPayablesButton?'0 0 16px rgba(253,212,18,0.9)':'none'"
);

text = text.replace(
  "(section.key==='sales' && ((pendingExpenses>0 && adminRole==='owner') || ownerDeadlineSummary.warningCount>0))",
  "(section.key==='sales' && (pendingExpenses>0 && adminRole==='owner')) || (section.key==='payablesMain' && ownerDeadlineSummary.warningCount>0)"
);

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
console.log("Payables main button added:", finalText.includes("key:'payablesMain'"));
console.log("Blink logic added:", finalText.includes("shouldBlinkPayablesMainButton"));
console.log("Payables removed from sales subnav:", !finalText.includes("['payables','"));
console.log("Sales content supports payablesMain:", finalText.includes("activeTab==='payablesMain'"));
