const fs = require('fs');
const src = fs.readFileSync('src/App.jsx','utf8');

function contexts(label, needle, limit=5, radius=1800) {
  let from = 0, count = 0;
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

contexts('Dashboard label','Dashboard',8,2400);
contexts('lower dashboard','dashboard',10,1600);
contexts('owner briefing table','business_owner_briefings',5,1800);
contexts('integrity exceptions','business_integrity_exceptions',5,1800);
contexts('delivery invoice state','deliveryInvoices',6,1500);
contexts('analytics invoice source','const allInvoices = deliveryInvoices',3,1400);
contexts('inventory state','inventoryItems',5,1300);
contexts('attendance state','attendanceLogs',5,1300);
contexts('payroll state','payrollRecords',5,1300);
contexts('production state','productionLogs',5,1300);
console.log('\n===== END DASHBOARD INSPECTION =====');
