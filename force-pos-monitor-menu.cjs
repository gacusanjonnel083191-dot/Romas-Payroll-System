const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Confirm POS Monitor component exists
if (!app.includes("function PosMonitorPanel()")) {
  throw new Error("PosMonitorPanel component is missing. Stop and tell buddy.");
}

// Force-add POS Monitor section inside the real SECTIONS list after Dashboard
if (!app.includes("key:'posMonitor'")) {
  app = app.replace(
`{ key:'dashboard', icon:'??', label:'Dashboard',
 tabs:[{key:'dashboard',label:'Overview'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },`,
`{ key:'dashboard', icon:'??', label:'Dashboard',
 tabs:[{key:'dashboard',label:'Overview'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },
 { key:'posMonitor', icon:'??', label:'POS Monitor',
 tabs:[{key:'posMonitor',label:'Outlet POS Monitor'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },`
  );
}

// If emoji exact match failed, use fallback insertion before HR section
if (!app.includes("key:'posMonitor'")) {
  app = app.replace(
`{ key:'hr', icon:'??', label:'HR & Attendance',`,
`{ key:'posMonitor', icon:'??', label:'POS Monitor',
 tabs:[{key:'posMonitor',label:'Outlet POS Monitor'}],
 roles:['owner','manager','hr','payroll','supervisor','asst_supervisor'] },
 { key:'hr', icon:'??', label:'HR & Attendance',`
  );
}

// Force-add render block before Audit Trail if missing
if (!app.includes("activeTab==='posMonitor'")) {
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
console.log("POS Monitor sidebar menu forced into main app.");
