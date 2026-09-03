import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.105.4"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
}

const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
])
const MAX_FILE_BYTES = 10 * 1024 * 1024

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

function validDate(value: unknown) {
  const text = String(value || "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function credentials(source: Record<string, unknown>) {
  return {
    employeeCode: String(source.employee_code || "").trim().slice(0, 80),
    pin: String(source.pin || "").trim().slice(0, 120),
    employeeId: String(source.employee_id || "").trim().slice(0, 80),
    sessionToken: String(source.session_token || "").trim().slice(0, 120),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return reply(405, { ok: false, message: "Method not allowed." })

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  if (!supabaseUrl || !serviceRoleKey) return reply(503, { ok: false, message: "Secure attendance service is unavailable." })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const contentType = req.headers.get("content-type") || ""
    let action = "check"
    let employeeCode = ""
    let pin = ""
    let employeeId = ""
    let sessionToken = ""
    let referenceDate = ""
    let file: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      action = String(form.get("action") || "upload").trim().toLowerCase()
      ;({ employeeCode, pin, employeeId, sessionToken } = credentials({
        employee_code: form.get("employee_code"),
        pin: form.get("pin"),
        employee_id: form.get("employee_id"),
        session_token: form.get("session_token"),
      }))
      referenceDate = validDate(form.get("reference_date"))
      const candidate = form.get("file")
      file = candidate instanceof File ? candidate : null
    } else {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      action = String(body.action || "check").trim().toLowerCase()
      ;({ employeeCode, pin, employeeId, sessionToken } = credentials(body))
      referenceDate = validDate(body.reference_date)
    }

    let employee: { id: string; employee_code: string; full_name: string; is_active: boolean } | null = null
    if (employeeId && sessionToken) {
      const { data: sessionEmployee, error: sessionError } = await admin.rpc("employee_attendance_session_identity", {
        p_session_token: sessionToken,
        p_employee_id: employeeId,
      })
      if (!sessionError && sessionEmployee?.id) employee = sessionEmployee
    } else if (employeeCode && pin) {
      const { data: pinEmployee, error: employeeError } = await admin
        .from("employees")
        .select("id,employee_code,full_name,is_active")
        .eq("employee_code", employeeCode)
        .eq("pin", pin)
        .eq("is_active", true)
        .maybeSingle()
      if (!employeeError && pinEmployee?.id) employee = pinEmployee
    }
    if (!employee?.id) return reply(401, { ok: false, message: "Employee verification failed." })

    const loadLock = async () => {
      const { data, error } = await admin.rpc("employee_medical_lock_secure", {
        p_employee_id: employee.id,
        p_reference_date: referenceDate,
      })
      if (error || !data || typeof data !== "object") throw new Error(error?.message || "Attendance lock verification failed.")
      return data as Record<string, unknown>
    }

    const lock = await loadLock()
    if (action === "check") return reply(200, { ok: true, lock })
    if (action !== "upload") return reply(400, { ok: false, message: "Unsupported attendance action." })
    if (!lock.locked) return reply(409, { ok: false, message: "No medical certificate lock is active." })
    if (!file || file.size <= 0) return reply(400, { ok: false, message: "Choose a medical certificate file." })
    if (file.size > MAX_FILE_BYTES) return reply(413, { ok: false, message: "Medical certificate file is too large. Maximum is 10MB." })

    const originalExtension = String(file.name || "").split(".").pop()?.toLowerCase() || ""
    const inferredType = file.type || ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<string, string>)[originalExtension] || ""
    const extension = ALLOWED_TYPES.get(inferredType)
    if (!extension) return reply(415, { ok: false, message: "Upload PDF, JPG, PNG, or WEBP only." })

    const absenceStart = String(lock.absenceStart || "").slice(0, 10)
    const absenceEnd = String(lock.absenceEnd || "").slice(0, 10)
    if (!absenceStart || !absenceEnd) throw new Error("The locked absence range could not be verified.")

    const objectPath = `${employee.id}/${absenceStart}_to_${absenceEnd}/${crypto.randomUUID()}.${extension}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from("medical-certificates")
      .upload(objectPath, bytes, { contentType: inferredType, upsert: false, cacheControl: "0" })
    if (uploadError) throw new Error(uploadError.message)

    const safeOriginalName = String(file.name || `medical-certificate.${extension}`).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240)
    const { error: insertError } = await admin.from("employee_medical_certificates").insert({
      employee_id: employee.id,
      employee_code: employee.employee_code,
      employee_name: employee.full_name,
      absence_start: absenceStart,
      absence_end: absenceEnd,
      absent_days: Number(lock.absentDays || 2),
      file_name: safeOriginalName,
      file_path: objectPath,
      file_url: null,
      status: "uploaded",
    })
    if (insertError) {
      await admin.storage.from("medical-certificates").remove([objectPath])
      throw new Error(insertError.message)
    }

    const verifiedLock = await loadLock()
    return reply(200, { ok: true, message: "Medical certificate uploaded securely.", lock: verifiedLock })
  } catch (error) {
    console.error("attendance-medical-guard", error)
    return reply(500, { ok: false, message: "Secure attendance verification failed. Please try again." })
  }
})
