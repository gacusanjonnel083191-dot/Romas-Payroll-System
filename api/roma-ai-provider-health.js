export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'})
  const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||''
  if(!token) return res.status(200).json({ok:false,providerConfigured:false})
  try{
    const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Title':"Roma AI Provider Health"},
      body:JSON.stringify({model:'openai/gpt-5.6-luna',input:'Reply with OK only.',max_output_tokens:16})
    })
    const raw=await r.text(); let payload={}; try{payload=JSON.parse(raw)}catch{payload={}}
    const message=payload?.error?.message||payload?.error?.code||payload?.error?.type||null
    res.setHeader('Cache-Control','no-store')
    return res.status(200).json({ok:r.ok,providerConfigured:true,status:r.status,error:message,hasOutput:Boolean(payload?.output||payload?.output_text)})
  }catch(error){return res.status(200).json({ok:false,providerConfigured:true,status:0,error:error?.message||'provider_fetch_failed'})}
}
