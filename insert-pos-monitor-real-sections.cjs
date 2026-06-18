const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

if (!app.includes("function PosMonitorPanel()")) {
  throw new Error("PosMonitorPanel component is missing. Stop and tell buddy.");
}

const posSection = `
 { key:'posMonitor', icon:'??', label:'POS Monitor',
 tabs:[{key:'posMonitor',label:'Outlet POS Monitor'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },
`;

const sectionsStart = app.indexOf("const SECTIONS = [");
const visibleStart = app.indexOf("const visibleSections", sectionsStart);

if (sectionsStart === -1 || visibleStart === -1) {
  throw new Error("Could not find real SECTIONS array.");
}

const beforeSections = app.slice(0, sectionsStart);
let sectionsBlock = app.slice(sectionsStart, visibleStart);
const afterSections = app.slice(visibleStart);

// Remove POS Monitor only inside the real SECTIONS block, then insert fresh after opening bracket
sectionsBlock = sectionsBlock.replace(
  /\s*\{ key:'posMonitor'[\s\S]*?roles:\[[\s\S]*?\] \},\s*/g,
  "\n"
);

sectionsBlock = sectionsBlock.replace(
  "const SECTIONS = [",
  "const SECTIONS = [" + posSection
);

app = beforeSections + sectionsBlock + afterSections;

// Ensure render block exists
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
console.log("POS Monitor inserted at top of the real Admin SECTIONS array.");
