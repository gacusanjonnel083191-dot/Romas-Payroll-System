const REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
const REALTIME_MODEL = process.env.ROMA_AI_REALTIME_MODEL || 'gpt-realtime'

export const config = { api: { bodyParser: false } }

function json(res,status,payload){res.status(status).setHeader('Cache-Control','no-store').json(payload)}
function bearer(req){const raw=req.headers?.authorization||'';return raw.startsWith('Bearer ')?raw.slice(7).trim():''}
function supabaseConfig(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const anonKey=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_KEY||'';return{url:url.replace(/\/$/,''),anonKey}}
async function rpc(token,name,args={}){const{url,anonKey}=supabaseConfig();if(!url||!anonKey)throw Object.assign(new Error('supabase_server_config_unavailable'),{status:503});const r=await fetch(`${url}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(args)});const raw=await r.text();let p=null;try{p=raw?JSON.parse(raw):null}catch{p=raw};if(!r.ok)throw Object.assign(new Error(p?.message||'session_validation_failed'),{status:r.status});return p}
async function rawBody(req){const chunks=[];for await(const c of req)chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));return Buffer.concat(chunks).toString('utf8')}

export default async function handler(req,res){
  if(req.method==='GET')return json(res,200,{ok:true,service:'roma-ai-realtime',version:'2026.08.12.20-agent',configured:Boolean(process.env.OPENAI_API_KEY),model:REALTIME_MODEL,note:'Business-tool voice continues to use speech-to-text plus Roma AI Responses orchestration; native realtime is available when direct OpenAI API is configured.'})
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'})
  const key=process.env.OPENAI_API_KEY||''
  if(!key)return json(res,503,{ok:false,error:'openai_api_key_required'})
  const token=bearer(req);if(!token)return json(res,401,{ok:false,error:'missing_session'})
  let session;try{session=await rpc(token,'roma_ai_session_context',{})}catch(error){return json(res,error.status||403,{ok:false,error:error.message})}
  if(!session?.enabled||session?.voice_enabled===false)return json(res,403,{ok:false,error:'voice_access_denied'})
  const sdp=await rawBody(req)
  if(!sdp||sdp.length>100000)return json(res,400,{ok:false,error:'invalid_sdp'})
  const role=String(session?.actor?.role||'unknown')
  const form=new FormData()
  form.set('sdp',new Blob([sdp],{type:'application/sdp'}),'offer.sdp')
  form.set('session',new Blob([JSON.stringify({type:'realtime',model:REALTIME_MODEL,output_modalities:['audio'],audio:{output:{voice:'marin'}},instructions:`You are Roma AI voice mode inside Roma's Main Business App. Understand English, Filipino, and Taglish. Logged-in role: ${role}. Keep spoken answers concise. Do not claim to change business records or code. For questions that require live business records, tell the client to use the verified Roma AI business-tool turn.`})],{type:'application/json'}),'session.json')
  const r=await fetch(REALTIME_URL,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form})
  const answer=await r.text()
  if(!r.ok){console.error('Roma AI realtime error',{status:r.status,answer:answer.slice(0,400)});return json(res,r.status,{ok:false,error:'realtime_provider_failed'})}
  res.status(201).setHeader('Content-Type','application/sdp').setHeader('Cache-Control','no-store').send(answer)
}
