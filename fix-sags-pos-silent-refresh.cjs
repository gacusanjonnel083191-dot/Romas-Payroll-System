const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-before-silent-sags-refresh.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

// Add non-blocking refresh state if not present
if (!app.includes("const [posRefreshing, setPosRefreshing] = useState(false)")) {
  app = app.replace(
    "const [posProducts, setPosProducts] = useState([])",
    "const [posProducts, setPosProducts] = useState([])\n const [posRefreshing, setPosRefreshing] = useState(false)"
  );
}

// Upgrade loadPosMonitor to support silent refresh
app = app.replace(
  /async function loadPosMonitor\(\) \{/,
  "async function loadPosMonitor(options = {}) {\n  const silent = options && options.silent"
);

// Make loading non-blocking during silent refresh
app = app.replaceAll(
  "setPosLoading(true)",
  "silent ? setPosRefreshing(true) : setPosLoading(true)"
);

app = app.replaceAll(
  "setPosLoading(false)",
  "silent ? setPosRefreshing(false) : setPosLoading(false)"
);

// Make Refresh button silent where possible
app = app.replaceAll(
  "onClick={loadPosMonitor}",
  "onClick={() => loadPosMonitor({ silent:true })}"
);

app = app.replaceAll(
  "onClick={() => loadPosMonitor()}",
  "onClick={() => loadPosMonitor({ silent:true })}"
);

// Change Refresh button text to show it is refreshing without blocking the screen
app = app.replaceAll(
  ">Refresh</button>",
  ">{posRefreshing ? 'Refreshing...' : 'Refresh'}</button>"
);

fs.writeFileSync(file, app);
console.log("SAGS POS refresh is now silent and non-disruptive.");
