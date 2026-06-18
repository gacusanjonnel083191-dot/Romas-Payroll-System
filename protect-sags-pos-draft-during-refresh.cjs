const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-before-sags-draft-persistence.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

if (app.includes("SAGS_POS_DRAFT_KEY")) {
  console.log("SAGS POS draft persistence already installed.");
  process.exit(0);
}

// Add draft helper after PosMonitorPanel function starts
app = app.replace(
  "function PosMonitorPanel() {",
  `function PosMonitorPanel() {
 const SAGS_POS_DRAFT_KEY = 'romas_sags_pos_working_draft_v1'
 const readSagsDraft = (key, fallback = '') => {
  try {
   const saved = JSON.parse(localStorage.getItem(SAGS_POS_DRAFT_KEY) || '{}')
   return saved[key] ?? fallback
  } catch {
   return fallback
  }
 }`
);

// Upgrade existing text states to restore from draft
const stateReplacements = [
  ["const [stockInProductId, setStockInProductId] = useState('')", "const [stockInProductId, setStockInProductId] = useState(() => readSagsDraft('stockInProductId', ''))"],
  ["const [stockInSearch, setStockInSearch] = useState('')", "const [stockInSearch, setStockInSearch] = useState(() => readSagsDraft('stockInSearch', ''))"],
  ["const [stockInQty, setStockInQty] = useState('')", "const [stockInQty, setStockInQty] = useState(() => readSagsDraft('stockInQty', ''))"],
  ["const [stockInNote, setStockInNote] = useState('')", "const [stockInNote, setStockInNote] = useState(() => readSagsDraft('stockInNote', ''))"],
  ["const [stockInTransferNo, setStockInTransferNo] = useState('')", "const [stockInTransferNo, setStockInTransferNo] = useState(() => readSagsDraft('stockInTransferNo', ''))"],
  ["const [stockInTransferredBy, setStockInTransferredBy] = useState('')", "const [stockInTransferredBy, setStockInTransferredBy] = useState(() => readSagsDraft('stockInTransferredBy', ''))"],
  ["const [stockInReceivedBy, setStockInReceivedBy] = useState('')", "const [stockInReceivedBy, setStockInReceivedBy] = useState(() => readSagsDraft('stockInReceivedBy', ''))"],
  ["const [transactionSearch, setTransactionSearch] = useState('')", "const [transactionSearch, setTransactionSearch] = useState(() => readSagsDraft('transactionSearch', ''))"],
  ["const [closingOpeningCash, setClosingOpeningCash] = useState('')", "const [closingOpeningCash, setClosingOpeningCash] = useState(() => readSagsDraft('closingOpeningCash', ''))"],
  ["const [closingActualCash, setClosingActualCash] = useState('')", "const [closingActualCash, setClosingActualCash] = useState(() => readSagsDraft('closingActualCash', ''))"],
  ["const [closingClosedBy, setClosingClosedBy] = useState('')", "const [closingClosedBy, setClosingClosedBy] = useState(() => readSagsDraft('closingClosedBy', ''))"],
  ["const [closingRemarks, setClosingRemarks] = useState('')", "const [closingRemarks, setClosingRemarks] = useState(() => readSagsDraft('closingRemarks', ''))"],
  ["const [voidReceiptNo, setVoidReceiptNo] = useState('')", "const [voidReceiptNo, setVoidReceiptNo] = useState(() => readSagsDraft('voidReceiptNo', ''))"],
  ["const [voidReason, setVoidReason] = useState('')", "const [voidReason, setVoidReason] = useState(() => readSagsDraft('voidReason', ''))"],
  ["const [voidedBy, setVoidedBy] = useState('')", "const [voidedBy, setVoidedBy] = useState(() => readSagsDraft('voidedBy', ''))"],
  ["const [voidAdminPin, setVoidAdminPin] = useState('')", "const [voidAdminPin, setVoidAdminPin] = useState(() => readSagsDraft('voidAdminPin', ''))"]
];

for (const [from, to] of stateReplacements) {
  app = app.replace(from, to);
}

// Add auto-save draft effect before loadPosMonitor useEffect
app = app.replace(
  "useEffect(() => { loadPosMonitor() }, [posDate])",
  `useEffect(() => {
  try {
   localStorage.setItem(SAGS_POS_DRAFT_KEY, JSON.stringify({
    stockInProductId,
    stockInSearch,
    stockInQty,
    stockInNote,
    stockInTransferNo,
    stockInTransferredBy,
    stockInReceivedBy,
    transactionSearch,
    closingOpeningCash,
    closingActualCash,
    closingClosedBy,
    closingRemarks,
    voidReceiptNo,
    voidReason,
    voidedBy,
    voidAdminPin
   }))
  } catch {}
 }, [
  stockInProductId,
  stockInSearch,
  stockInQty,
  stockInNote,
  stockInTransferNo,
  stockInTransferredBy,
  stockInReceivedBy,
  transactionSearch,
  closingOpeningCash,
  closingActualCash,
  closingClosedBy,
  closingRemarks,
  voidReceiptNo,
  voidReason,
  voidedBy,
  voidAdminPin
 ])

 useEffect(() => { loadPosMonitor({ silent:true }) }, [posDate])`
);

// Make any refresh button silent again
app = app.replaceAll(
  "onClick={loadPosMonitor}",
  "onClick={() => loadPosMonitor({ silent:true })}"
);

app = app.replaceAll(
  "onClick={() => loadPosMonitor()}",
  "onClick={() => loadPosMonitor({ silent:true })}"
);

fs.writeFileSync(file, app);
console.log("SAGS POS working draft is now protected during refresh.");
