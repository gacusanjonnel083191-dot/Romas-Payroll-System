export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const candidates = [
    ['SUPABASE_PUBLISHABLE_KEY', process.env.SUPABASE_PUBLISHABLE_KEY],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', process.env.VITE_SUPABASE_PUBLISHABLE_KEY],
    ['VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY],
    ['SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY],
    ['VITE_SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY],
    ['VITE_SUPABASE_KEY', process.env.VITE_SUPABASE_KEY]
  ].filter(([,value]) => Boolean(value))
  const checks = []
  for (const [name,key] of candidates) {
    let status = 0
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers:{ apikey:key }, cache:'no-store' })
      status = r.status
    } catch { status = -1 }
    checks.push({ name, status, valid: status >= 200 && status < 300 })
  }
  res.setHeader('Cache-Control','no-store')
  return res.status(200).json({ ok:true, urlConfigured:Boolean(url), candidateCount:candidates.length, checks })
}
