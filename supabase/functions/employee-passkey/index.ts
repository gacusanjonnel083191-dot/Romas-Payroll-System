import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@13.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUILT_IN_ALLOWED_ORIGINS = [
  'https://romas-payroll-system.vercel.app',
  'https://rd-business-system.vercel.app',
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function toBase64URL(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64URLToUint8Array(base64url: string) {
  const base64 = String(base64url || '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function normalizeOrigin(value: string) {
  try {
    return new URL(String(value || '').trim()).origin
  } catch (_) {
    throw new Error('Invalid app origin.')
  }
}

function getOriginHost(origin: string) {
  try {
    return new URL(origin).hostname
  } catch (_) {
    throw new Error('Invalid app origin.')
  }
}

function validateOrigin(rawOrigin: string) {
  if (!rawOrigin) throw new Error('Missing app origin.')

  const origin = normalizeOrigin(rawOrigin)
  const configuredAllowed = (Deno.env.get('PASSKEY_ALLOWED_ORIGINS') || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => normalizeOrigin(v))

  const allowed = new Set([...BUILT_IN_ALLOWED_ORIGINS, ...configuredAllowed])
  const parsed = new URL(origin)
  const isLocal = (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.protocol === 'http:'
  const isVercel = /^https:\/\/[-a-zA-Z0-9]+(?:[-a-zA-Z0-9.]+)?\.vercel\.app$/.test(origin)

  if (isLocal) return origin
  if (allowed.has(origin)) return origin
  if (configuredAllowed.length === 0 && isVercel) return origin

  throw new Error('This app URL is not allowed for fingerprint/passkey login. Add it to PASSKEY_ALLOWED_ORIGINS in Supabase Function secrets.')
}

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getEmployeeByCodeAndPin(supabase: ReturnType<typeof createClient>, employeeCode: string, pin: string) {
  const code = String(employeeCode || '').trim()
  const cleanPin = String(pin || '').trim()
  if (!code || !cleanPin) throw new Error('Employee code and PIN are required.')

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('employee_code', code)
    .eq('pin', cleanPin)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Invalid Employee ID or PIN.')
  return data
}

async function cleanExpiredChallenges(supabase: ReturnType<typeof createClient>) {
  await supabase
    .from('passkey_challenges')
    .delete()
    .lt('expires_at', new Date().toISOString())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let action = 'unknown'
  try {
    const body = await req.json()
    action = String(body.action || '')
    const origin = validateOrigin(String(body.origin || req.headers.get('origin') || ''))

    const rpName = Deno.env.get('PASSKEY_RP_NAME') || "Roma's Donuts Attendance"
    const rpID = getOriginHost(origin)
    const supabase = getSupabaseAdmin()
    await cleanExpiredChallenges(supabase)

    if (action === 'register-options') {
      const employee = await getEmployeeByCodeAndPin(supabase, body.employee_code, body.pin)

      const { data: existingPasskeys, error: passkeyError } = await supabase
        .from('employee_passkeys')
        .select('credential_id, transports')
        .eq('employee_id', String(employee.id))
        .eq('is_active', true)

      if (passkeyError) throw passkeyError

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(String(employee.id)),
        userName: String(employee.employee_code || employee.id),
        userDisplayName: String(employee.full_name || employee.employee_code || 'Roma Employee'),
        attestationType: 'none',
        excludeCredentials: (existingPasskeys || []).map((p: any) => ({
          id: p.credential_id,
          transports: p.transports || undefined,
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'required',
        },
        supportedAlgorithmIDs: [-7, -257],
        timeout: 60000,
      })

      const { data: challenge, error: challengeError } = await supabase
        .from('passkey_challenges')
        .insert({
          employee_id: String(employee.id),
          employee_code: employee.employee_code,
          ceremony: 'registration',
          challenge: options.challenge,
          webauthn_user_id: options.user.id,
          origin,
          rp_id: rpID,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()

      if (challengeError) throw challengeError
      return json({ options, challenge_id: challenge.id })
    }

    if (action === 'register-verify') {
      const employee = await getEmployeeByCodeAndPin(supabase, body.employee_code, body.pin)

      const { data: challenge, error: challengeError } = await supabase
        .from('passkey_challenges')
        .select('*')
        .eq('id', body.challenge_id)
        .eq('ceremony', 'registration')
        .is('used_at', null)
        .maybeSingle()

      if (challengeError) throw challengeError
      if (!challenge) throw new Error('Fingerprint setup expired. Please try again.')
      if (challenge.employee_id !== String(employee.id)) throw new Error('Fingerprint setup does not match this employee.')
      if (new Date(challenge.expires_at).getTime() < Date.now()) throw new Error('Fingerprint setup expired. Please try again.')

      const verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
      })

      if (!verification.verified || !verification.registrationInfo) {
        throw new Error('Fingerprint setup could not be verified.')
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

      const { error: insertError } = await supabase
        .from('employee_passkeys')
        .upsert({
          employee_id: String(employee.id),
          employee_code: employee.employee_code,
          employee_name: employee.full_name,
          credential_id: credential.id,
          public_key: toBase64URL(credential.publicKey),
          webauthn_user_id: challenge.webauthn_user_id,
          counter: credential.counter || 0,
          transports: credential.transports || body.credential?.response?.transports || [],
          device_type: credentialDeviceType || null,
          backed_up: credentialBackedUp || false,
          rp_id: challenge.rp_id,
          origin: challenge.origin,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'credential_id' })

      if (insertError) throw insertError

      await supabase
        .from('passkey_challenges')
        .update({ used_at: new Date().toISOString() })
        .eq('id', challenge.id)

      return json({ verified: true })
    }

    if (action === 'login-options') {
      const { data: passkeys, error: passkeyError } = await supabase
        .from('employee_passkeys')
        .select('credential_id, transports')
        .eq('is_active', true)
        .eq('rp_id', rpID)

      if (passkeyError) throw passkeyError
      if (!passkeys || passkeys.length === 0) throw new Error('No fingerprint/passkey login is registered yet for this app URL.')

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: passkeys.map((p: any) => ({
          id: p.credential_id,
          transports: p.transports || undefined,
        })),
        userVerification: 'required',
        timeout: 60000,
      })

      const { data: challenge, error: challengeError } = await supabase
        .from('passkey_challenges')
        .insert({
          employee_id: null,
          employee_code: null,
          ceremony: 'authentication',
          challenge: options.challenge,
          origin,
          rp_id: rpID,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()

      if (challengeError) throw challengeError
      return json({ options, challenge_id: challenge.id })
    }

    if (action === 'login-verify') {
      const { data: challenge, error: challengeError } = await supabase
        .from('passkey_challenges')
        .select('*')
        .eq('id', body.challenge_id)
        .eq('ceremony', 'authentication')
        .is('used_at', null)
        .maybeSingle()

      if (challengeError) throw challengeError
      if (!challenge) throw new Error('Fingerprint login expired. Please try again.')
      if (new Date(challenge.expires_at).getTime() < Date.now()) throw new Error('Fingerprint login expired. Please try again.')

      const credentialID = body.credential?.id
      if (!credentialID) throw new Error('Missing passkey credential.')

      const { data: passkey, error: passkeyError } = await supabase
        .from('employee_passkeys')
        .select('*')
        .eq('credential_id', credentialID)
        .eq('is_active', true)
        .maybeSingle()

      if (passkeyError) throw passkeyError
      if (!passkey) throw new Error('This fingerprint/passkey is not registered.')

      const verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        credential: {
          id: passkey.credential_id,
          publicKey: base64URLToUint8Array(passkey.public_key),
          counter: Number(passkey.counter || 0),
          transports: passkey.transports || undefined,
        },
      })

      if (!verification.verified) throw new Error('Fingerprint login could not be verified.')

      const newCounter = verification.authenticationInfo?.newCounter ?? passkey.counter ?? 0
      await supabase
        .from('employee_passkeys')
        .update({ counter: newCounter, last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', passkey.id)

      await supabase
        .from('passkey_challenges')
        .update({ used_at: new Date().toISOString(), employee_id: passkey.employee_id, employee_code: passkey.employee_code })
        .eq('id', challenge.id)

      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', passkey.employee_id)
        .eq('is_active', true)
        .maybeSingle()

      if (employeeError) throw employeeError
      if (!employee) throw new Error('Employee account is inactive or not found.')

      const { data: cashAdvanceSessionToken, error: cashAdvanceSessionError } = await supabase.rpc(
        'issue_employee_cash_advance_session',
        { p_employee_id: employee.id },
      )

      if (cashAdvanceSessionError || !cashAdvanceSessionToken) {
        throw new Error(cashAdvanceSessionError?.message || 'Secure employee cash-advance session could not be created.')
      }

      const { pin: _pin, ...safeEmployee } = employee
      return json({
        verified: true,
        employee: safeEmployee,
        cash_advance_session_token: cashAdvanceSessionToken,
      })
    }

    if (action === 'delete-my-passkeys') {
      const employee = await getEmployeeByCodeAndPin(supabase, body.employee_code, body.pin)

      const { error } = await supabase
        .from('employee_passkeys')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('employee_id', String(employee.id))

      if (error) throw error
      return json({ success: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fingerprint/passkey request failed.'
    console.error('employee-passkey error:', { action, message })
    return json({ error: message }, 400)
  }
})

