const fs = require('fs');
const src = fs.readFileSync('src/App.jsx','utf8');
function one(label, needle, radius=6000, startAt=0) {
  const i = src.indexOf(needle,startAt);
  console.log(`\n===== ${label} @ ${i} =====`);
  if (i<0) return console.log('NO MATCH');
  console.log(src.slice(Math.max(0,i-radius),Math.min(src.length,i+needle.length+radius)));
}
function many(label, needle, limit=10, radius=1800, startAt=0){let at=startAt;console.log(`\n===== ${label} =====`);for(let n=0;n<limit;n++){const i=src.indexOf(needle,at);if(i<0)break;console.log(`\n--- ${n+1} @ ${i} ---\n${src.slice(Math.max(0,i-radius),Math.min(src.length,i+needle.length+radius))}`);at=i+needle.length;}}
one('LOAD DASHBOARD','async function loadDashboard()',11000,1000000);
one('SET DASHBOARD OBJECT','setDashboardData({',7500,1000000);
many('DASHBOARD DATA RENDER OCCURRENCES','dashboardData',14,2200,1700000);
one('DASHBOARD KPI CLASS','romas-dashboard-kpis',6500,1700000);
one('DASHBOARD ALERT GRID','romas-dashboard-alert-grid',7500,1700000);
one('ANALYTICS FUTURE FILTER SOURCE','const allInvoices = deliveryInvoices',3500,1000000);
one('OWNER BRIEFING SOURCE','business_owner_briefings',4500,1000000);
one('INTEGRITY SOURCE','business_integrity_exceptions',4500,1000000);
console.log('\n===== END DASHBOARD INSPECTION =====');
