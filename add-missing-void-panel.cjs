const fs = require("fs");

const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");

const backup = "src/App.backup-add-missing-void-panel.jsx";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, app);
  console.log("Backup created:", backup);
}

if (app.includes("<h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Void / Cancel Sale</h3>")) {
  console.log("Void / Cancel Sale panel already exists.");
  process.exit(0);
}

const voidPanel = `
   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Void / Cancel Sale</h3>
    <p style={{ margin:'0 0 12px', color:'#777', fontSize:'13px' }}>
     Void a receipt using admin PIN. The sale will be marked as void and inventory will be returned.
    </p>

    <div style={{ display:'grid', gridTemplateColumns:isMobile ? '1fr' : '1fr 2fr 1fr 1fr auto', gap:'10px', alignItems:'end' }}>
     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Receipt No.</label>
      <input value={voidReceiptNo} onChange={e=>setVoidReceiptNo(e.target.value)} placeholder="ROMA-..." style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Reason</label>
      <input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Wrong item / cancelled / test void" style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Voided By</label>
      <input value={voidedBy} onChange={e=>setVoidedBy(e.target.value)} placeholder="Name" style={{...inputStyle, marginBottom:0}} />
     </div>

     <div>
      <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>Admin PIN</label>
      <input type="password" value={voidAdminPin} onChange={e=>setVoidAdminPin(e.target.value)} placeholder="PIN" style={{...inputStyle, marginBottom:0}} />
     </div>

     <button
      onClick={cleanVoidSaleWithAdminPin}
      style={{
       background:'#ca1b1b',
       color:'white',
       border:'none',
       borderRadius:'10px',
       padding:'12px 16px',
       fontWeight:'bold',
       cursor:'pointer',
       whiteSpace:'nowrap'
      }}
     >
      Void Sale
     </button>
    </div>
   </div>
`;

// Insert before Low Stock Alert Dashboard
app = app.replace(
  `<div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Low Stock Alert Dashboard</h3>`,
  `${voidPanel}

   <div style={{ background:'white', border:'1px solid #eee', borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
    <h3 style={{ margin:'0 0 10px', color:'#ca1b1b' }}>Low Stock Alert Dashboard</h3>`
);

fs.writeFileSync(file, app);
console.log("Missing Void / Cancel Sale panel inserted before Low Stock Alert Dashboard.");
