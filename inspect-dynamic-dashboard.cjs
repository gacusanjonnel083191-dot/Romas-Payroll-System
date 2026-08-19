const fs = require('fs');
const src = fs.readFileSync('src/App.jsx','utf8');

function contexts(label, needle, limit=5, radius=3000, startAt=0) {
  let from = startAt, count = 0;
  console.log(`\n===== ${label} | ${needle} =====`);
  while (count < limit) {
    const i = src.indexOf(needle, from);
    if (i < 0) break;
    console.log(`\n--- occurrence ${count+1} @ ${i} ---\n` + src.slice(Math.max(0,i-radius), Math.min(src.length,i+needle.length+radius)) + '\n--- end occurrence ---');
    from = i + needle.length;
    count++;
  }
  if (!count) console.log('NO MATCH');
}

contexts('dashboard render class','romas-executive-dashboard',5,5000,100000);
contexts('dashboard header render','romas-dashboard-header',5,4500,100000);
contexts('dashboard active tab expression',"activeTab === 'dashboard'",6,4500,250000);
contexts('dashboard active tab compact',"activeTab==='dashboard'",6,4500,250000);
contexts('dashboard data setter','setDashboardData',8,3500,250000);
contexts('dashboard loader','loadDashboard',8,4000,250000);
contexts('owner briefing table','business_owner_briefings',5,3500,250000);
contexts('integrity exceptions table','business_integrity_exceptions',5,3500,250000);
contexts('analytics invoice source','const allInvoices = deliveryInvoices',3,3000,250000);
console.log('\n===== END FOCUSED DASHBOARD INSPECTION =====');
