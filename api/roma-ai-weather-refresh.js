const WEATHER_EDGE = 'pagasa-region1-weather-v6'

function json(res,status,payload){res.status(status).setHeader('Cache-Control','no-store').json(payload)}
function bearer(req){const raw=req.headers?.authorization||'';return raw.startsWith('Bearer ')?raw.slice(7).trim():''}
function supabaseConfig(){
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
  const anonKey=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_KEY||''
  return{url:url.replace(/\/$/,''),anonKey}
}

async function rpc(token,name,args={}){
  const{url,anonKey}=supabaseConfig()
  if(!url||!anonKey)throw Object.assign(new Error('supabase_server_config_unavailable'),{status:503})
  const response=await fetch(`${url}/rest/v1/rpc/${encodeURIComponent(name)}`,{
    method:'POST',
    headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify(args)
  })
  const raw=await response.text();let payload=null
  try{payload=raw?JSON.parse(raw):null}catch{payload=raw}
  if(!response.ok)throw Object.assign(new Error(payload?.message||payload?.hint||`Supabase RPC ${name} failed`),{status:response.status})
  return payload
}

export default async function handler(req,res){
  if(req.method==='GET')return json(res,200,{ok:true,service:'roma-ai-weather',version:'2026.08.13.2-weather',edge:WEATHER_EDGE})
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'})

  const token=bearer(req)
  if(!token)return json(res,401,{ok:false,error:'missing_session'})
  const message=String(req.body?.message||'').trim().slice(0,12000)
  if(!message)return json(res,400,{ok:false,error:'message_required'})

  try{
    const session=await rpc(token,'roma_ai_session_context',{})
    if(!session?.enabled)return json(res,403,{ok:false,error:'roma_ai_access_denied'})

    const{url,anonKey}=supabaseConfig()
    if(!url||!anonKey)return json(res,503,{ok:false,error:'supabase_server_config_unavailable'})

    let refresh={ok:false,refreshed:false,error:null}
    try{
      const response=await fetch(`${url}/functions/v1/${WEATHER_EDGE}`,{
        method:'POST',
        headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({force:true})
      })
      const raw=await response.text();let payload={}
      try{payload=raw?JSON.parse(raw):{}}catch{payload={error:raw.slice(0,800)}}
      refresh=response.ok?{
        ok:true,
        refreshed:payload?.cached!==true,
        cached:Boolean(payload?.cached),
        stale:Boolean(payload?.stale),
        fetchedAt:payload?.fetched_at||null,
        cacheAgeMinutes:payload?.cache_age_minutes??null,
        liveError:payload?.live_error||null,
        accessGateway:payload?.access_gateway||WEATHER_EDGE
      }:{
        ok:false,
        refreshed:false,
        upstreamStatus:response.status,
        error:payload?.error||'pagasa_live_refresh_failed',
        message:payload?.details||payload?.live_error||'Live PAGASA refresh failed; using the last verified cache.'
      }
    }catch(error){
      refresh={ok:false,refreshed:false,error:error?.message||'pagasa_live_refresh_failed'}
    }

    const answer=await rpc(token,'roma_ai_weather_read_v1',{p_message:message})
    const reply=String(answer?.reply||'I could not read the PAGASA weather data.').trim()
    return json(res,200,{
      ok:true,
      reply,
      providerMode:'verified-live-weather',
      provider:'DOST-PAGASA',
      model:'pagasa-semantic-weather-v1',
      threadId:typeof req.body?.threadId==='string'?req.body.threadId:null,
      ownerApprovalRequired:true,
      refresh,
      evidence:answer?.evidence||{},
      period:answer?.period||null,
      intent:'weather'
    })
  }catch(error){
    console.error('Roma AI weather answer error',{status:error.status,message:error.message})
    return json(res,error.status||500,{ok:false,error:error.message||'weather_answer_failed',fallbackAvailable:true})
  }
}
