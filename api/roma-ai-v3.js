import romaAiV2 from './roma-ai-v2.js'

const SUPABASE_PROJECT_URL = 'https://hebbunlnzklavkkugtzs.supabase.co'
let validatedPublicKey = ''

function header(req, name) {
  const value = req.headers?.[name]
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

async function validatePublicKey(key) {
  if (!key || key.length > 2048) return false
  if (key === validatedPublicKey) return true
  try {
    const response = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey:key },
      cache: 'no-store'
    })
    if (!response.ok) return false
    validatedPublicKey = key
    return true
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  // The application already runs with a browser-safe Supabase publishable/anon key.
  // Vercel serverless did not have the equivalent public configuration, which made
  // every authenticated Roma AI POST fail before GPT execution. If server env vars
  // are absent, accept that same PUBLIC key from the app, validate it against the
  // fixed Roma Supabase project, and keep the user's JWT as the authorization layer.
  if (req.method === 'POST') {
    const configuredUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const configuredKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_KEY || ''

    if (!configuredUrl || !configuredKey) {
      const publicKey = header(req, 'x-roma-supabase-key')
      if (!publicKey) {
        res.setHeader('Cache-Control','no-store')
        return res.status(503).json({
          ok:false,
          error:'supabase_public_config_missing',
          message:'Roma AI could not initialize its verified system tools.',
          fallbackAvailable:true
        })
      }
      if (!(await validatePublicKey(publicKey))) {
        res.setHeader('Cache-Control','no-store')
        return res.status(403).json({
          ok:false,
          error:'invalid_supabase_public_config',
          message:'Roma AI rejected the supplied public database configuration.',
          fallbackAvailable:true
        })
      }
      process.env.SUPABASE_URL = SUPABASE_PROJECT_URL
      process.env.SUPABASE_ANON_KEY = publicKey
    }
  }

  return romaAiV2(req, res)
}
