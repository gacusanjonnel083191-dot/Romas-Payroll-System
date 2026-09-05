const fs = require('fs')
const path = process.env.ROMAS_APP_PATH || 'src/App.jsx'
let src = fs.readFileSync(path,'utf8')
const snippetParts = Array.from({length:8},(_,i)=>`financial-statements-component/part-${String(i).padStart(2,'0')}.txt`)
const snippet = snippetParts.map(file=>fs.readFileSync(file,'utf8')).join('').trim()

function fail(message){ throw new Error(`Financial Statements patch aborted safely: ${message}`) }
function count(haystack,needle){ return haystack.split(needle).length-1 }

const dashboardMarker = '{/* DYNAMIC_OWNER_COMMAND_CENTER_V2 */}'
if(!src.includes(dashboardMarker)) fail('Owner Command Center V2 marker was not found. Run patch-dynamic-owner-dashboard.cjs before this patch.')

if(!src.includes('ROMAS_FINANCIAL_STATEMENTS_MODULE_V1')){
 const candidates=['export default function App','function App','const App =','const App=']
 let indices=candidates.map(x=>src.indexOf(x)).filter(x=>x>=0)
 if(!indices.length){
  const stateAnchor=src.indexOf("const [foundationLoading, setFoundationLoading] = useState(false)")
  if(stateAnchor<0) fail('App component declaration and Foundation state anchor were not found.')
  const prefix=src.slice(0,stateAnchor)
  const matches=[]
  const patterns=[/function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/g,/const\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g]
  for(const pattern of patterns){ let match; while((match=pattern.exec(prefix))) matches.push(match.index) }
  if(!matches.length) fail('Could not identify the app component enclosing the Foundation state.')
  indices=[Math.max(...matches)]
 }
 const appIndex=Math.min(...indices)
 src=src.slice(0,appIndex)+snippet+'\n\n'+src.slice(appIndex)
}

if(!src.includes("['FINANCIAL STATEMENTS','financialStatements']")){
 const quickLink="['FULL FOUNDATION REPORT','foundation'],"
 const idx=src.indexOf(quickLink)
 if(idx<0) fail('Owner Command Center quick-link anchor was not found.')
 src=src.slice(0,idx)+"['FINANCIAL STATEMENTS','financialStatements'],\n  "+src.slice(idx)
}

if(!src.includes('ROMAS_FINANCIAL_STATEMENTS_RENDER_V1')){
 const idx=src.indexOf(dashboardMarker)
 if(idx<0) fail('Dashboard render anchor was not found.')
 const render=`{/* ROMAS_FINANCIAL_STATEMENTS_RENDER_V1 */}\n{activeTab==='financialStatements' && isOwnerRole && (\n <RomasFinancialStatementsModule supabase={supabase} isOwnerRole={isOwnerRole} isMobile={isMobile} showToast={showToast} onClose={()=>handleTabClick('dashboard')} />\n)}\n\n`
 src=src.slice(0,idx)+render+src.slice(idx)
}

if(count(src,'ROMAS_FINANCIAL_STATEMENTS_MODULE_V1')!==1) fail('Module marker count is not exactly one after patch.')
if(count(src,'ROMAS_FINANCIAL_STATEMENTS_RENDER_V1')!==1) fail('Render marker count is not exactly one after patch.')
fs.writeFileSync(path,src,'utf8')
console.log('Financial Statements V1 patch applied safely (owner-only; no database writes or migrations).')
