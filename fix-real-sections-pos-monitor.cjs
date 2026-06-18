const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const posSection = ` { key:'posMonitor', icon:'??', label:'POS Monitor',
 tabs:[{key:'posMonitor',label:'Outlet POS Monitor'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },
`;

// Insert POS Monitor directly inside the Admin Render SECTIONS array.
// Do not rely on old "key:'posMonitor'" checks because earlier failed patches may already contain it elsewhere.
const sectionsStart = app.indexOf("const SECTIONS = [");
const visibleStart = app.indexOf("const visibleSections", sectionsStart);

if (sectionsStart === -1 || visibleStart === -1) {
  throw new Error("Could not find the real Admin SECTIONS array.");
}

const beforeSections = app.slice(0, sectionsStart);
let sectionsBlock = app.slice(sectionsStart, visibleStart);
const afterSections = app.slice(visibleStart);

// Remove any POS Monitor section already inside this SECTIONS block only, then insert fresh after dashboard.
sectionsBlock = sectionsBlock.replace(
  /\s*\{ key:'posMonitor'[\s\S]*?roles:\[[\s\S]*?\] \},\s*/g,
  "\n"
);

const dashboardBlock = `{ key:'dashboard', icon:'??', label:'Dashboard',
 tabs:[{key:'dashboard',label:'Overview'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },`;

if (!sectionsBlock.includes(dashboardBlock)) {
  throw new Error("Dashboard block not found inside SECTIONS. Stop and send screenshot.");
}

sectionsBlock = sectionsBlock.replace(dashboardBlock, dashboardBlock + "\n" + posSection);

app = beforeSections + sectionsBlock + afterSections;

// Add render block directly before Audit Trail if missing.
if (!app.includes("activeTab==='posMonitor' &&")) {
  app = app.replace(
`{/* AUDIT TRAIL */}
 {activeTab==='auditTrail' && (`,
`{/* POS MONITOR */}
 {activeTab==='posMonitor' && (
  <PosMonitorPanel />
 )}

 {/* AUDIT TRAIL */}
 {activeTab==='auditTrail' && (`
  );
}

fs.writeFileSync(file, app);
console.log("POS Monitor inserted inside the real Admin SECTIONS array.");
