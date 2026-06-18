const fs = require("fs");
const path = require("path");

const iconDir = "public/icons";
if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="10" y="24" width="44" height="30" rx="6" fill="#ca1b1b"/>
  <rect x="16" y="6" width="32" height="24" rx="4" fill="#ffffff" stroke="#ca1b1b" stroke-width="4"/>
  <rect x="21" y="12" width="22" height="10" rx="2" fill="#fdd412"/>
  <circle cx="20" cy="38" r="3" fill="#ffffff"/>
  <circle cx="32" cy="38" r="3" fill="#ffffff"/>
  <circle cx="44" cy="38" r="3" fill="#ffffff"/>
  <rect x="18" y="46" width="28" height="4" rx="2" fill="#ffffff"/>
</svg>`;

fs.writeFileSync(path.join(iconDir, "pos-machine.svg"), svg);

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

// Replace existing POS Monitor text icon with local POS machine SVG image
app = app.replace(
  /key:'posMonitor', icon:'[^']*', label:'POS Monitor'/g,
  `key:'posMonitor', icon:<img src="/icons/pos-machine.svg" alt="" style={{width:18,height:18,objectFit:'contain'}} />, label:'POS Monitor'`
);

fs.writeFileSync(file, app);
console.log("POS Monitor icon changed to local POS machine SVG.");
