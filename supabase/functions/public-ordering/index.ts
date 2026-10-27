import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {createClient} from 'npm:@supabase/supabase-js@2.105.4'
import catalog from './catalog.json' with {type:'json'}
import {readLimitedBody} from './request-body.mjs'
import {consumeRateLimit, normalizePhoneForLimit} from './rate-limit.mjs'
import {
  cleanText, pricedItems, PICKUP_HOURS, validatePickupSchedule, validAccessToken,
  validPhone, validRequestId,
} from './rules.mjs'

const STAFF_ROLES = new Set(['owner', 'supervisor', 'asst_supervisor'])
const FORECAST_ROLES = new Set(['owner', 'manager', 'supervisor', 'asst_supervisor'])
const SUBMISSIONS_ENABLED = Deno.env.get('PUBLIC_ORDERING_SUBMISSIONS_ENABLED') === 'true'
const ORDER_FIELDS = 'id,order_code,customer_name,customer_phone,phone_verified_at,phone_verified_by,phone_verification_method,fulfillment_type,pickup_location,pickup_address_snapshot,delivery_municipality,delivery_address,delivery_landmark,delivery_latitude,delivery_longitude,scheduled_at,packaging,notes,status,payment_status,paid_at,refunded_at,subtotal,delivery_fee,total,quote_basis,distance_km,created_at,updated_at'
const MAX_BODY_BYTES = 32_000

type Client = ReturnType<typeof createClient<any>>
type Body = Record<string, unknown>

function headers(origin: string | null) {
  const allowed = (Deno.env.get('PUBLIC_ORDERING_ALLOWED_ORIGINS') || '')
    .split(',').map(value => value.trim()).filter(Boolean)
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }
}

function response(origin: string | null, status: number, body: Body) {
  return new Response(JSON.stringify(body), {
    status, headers: {...headers(origin), 'Content-Type': 'application/json'},
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value.toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function staffIdentity(admin: Client, request: Request, allowedRoles = STAFF_ROLES) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null
  const {data: userResult, error: userError} = await admin.auth.getUser(token)
  if (userError || !userResult.user) return null
  const {data: staff, error} = await admin.from('admin_users')
    .select('id,role').eq('auth_user_id', userResult.user.id).eq('is_active', true).maybeSingle()
  if (error || !staff || !allowedRoles.has(String(staff.role).toLowerCase())) return null
  return staff
}

async function orderDetail(admin: Client, orderId: string) {
  const [{data: order, error: orderError}, {data: items, error: itemError}, {data: messages, error: messageError}] = await Promise.all([
    admin.from('customer_orders').select(ORDER_FIELDS).eq('id', orderId).single(),
    admin.from('customer_order_items').select('product_id,product_name,quantity,unit_label,pieces_per_unit,unit_price,line_total').eq('order_id', orderId).order('id'),
    admin.from('customer_order_messages').select('id,sender,body,created_at').eq('order_id', orderId).order('created_at'),
  ])
  if (orderError || itemError || messageError || !order) return null
  let receipt = null
  if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
    const {data: sale, error: saleError} = await admin.from('daily_sales_online_payments')
      .select('id,payment_method,reference_number,amount,status')
      .eq('customer_order_id', orderId).maybeSingle()
    if (saleError) return null
    if (sale?.status === 'active' && Number(sale.amount) === Number(order.total)) {
      receipt = {sale_id:sale.id, payment_method:sale.payment_method,
        reference_number:sale.reference_number, amount:sale.amount}
      if (order.payment_status === 'refunded') {
        const {data: refund, error: refundError} = await admin.from('daily_sales_online_payments')
          .select('id,payment_method,reference_number,amount,status')
          .eq('refund_of_payment_id', sale.id).maybeSingle()
        if (refundError) return null
        receipt = refund?.status === 'active' && Number(refund.amount) === -Number(order.total)
          ? {...receipt, refund:{id:refund.id, payment_method:refund.payment_method,
            reference_number:refund.reference_number, amount:refund.amount}}
          : null
      }
    }
  }
  return {...order, items: items || [], messages: messages || [], receipt}
}

async function customerOrder(admin: Client, body: Body) {
  const code = cleanText(body.orderCode, 80)
  const accessToken = body.accessToken
  if (!/^RD-[0-9]{4}-[0-9A-F]{12}$/.test(code) || !validAccessToken(accessToken)) return null
  const {data: order} = await admin.from('customer_orders')
    .select('id,access_token_hash').eq('order_code', code).maybeSingle()
  if (!order || order.access_token_hash !== await sha256(accessToken as string)) return null
  return order
}

async function handle(admin: Client, request: Request, body: Body, rateSecret: string) {
  const origin = request.headers.get('origin')
  const reply = (status: number, payload: Body) => response(origin, status, payload)
  const action = cleanText(body.action, 40)

  if (action === 'config') {
    const {data, error} = await admin.from('customer_pickup_locations')
      .select('name,address').eq('is_active', true).order('name')
    if (error) return reply(503, {ok:false, message:'Ordering configuration is unavailable.'})
    const pickupLocations = (data || []).map(location => ({...location,
      hours:Object.hasOwn(PICKUP_HOURS, location.name) ? PICKUP_HOURS[location.name] : null}))
      .filter(location => location.hours)
    return reply(200, {ok:true, pickupLocations, deliveryAvailable:false,
      orderingEnabled:SUBMISSIONS_ENABLED, phoneVerificationMethod:'staff_call'})
  }

  if (action === 'submit') {
    if (!SUBMISSIONS_ENABLED) return reply(503, {ok:false, message:'Customer ordering is not open yet.'})
    const requestId = body.requestId
    const accessToken = body.accessToken
    if (!validRequestId(requestId) || !validAccessToken(accessToken)) return reply(400, {ok:false, message:'Invalid order request.'})
    if (body.fulfillmentType !== 'pickup') return reply(422, {ok:false, message:'Delivery orders are unavailable until routing and coverage are verified.'})
    const name = cleanText(body.name, 120)
    const phone = cleanText(body.phone, 20)
    const locationName = cleanText(body.pickupLocation, 120)
    const notes = cleanText(body.notes, 1000)
    const packaging = body.packaging === 'paper_bag' ? 'paper_bag' : 'box'
    const priced = pricedItems(body.items, catalog)
    if (!name || !validPhone(phone) || !priced) return reply(422, {ok:false, message:'Check the customer and order items.'})
    const submissionLimit = await consumeRateLimit(admin, rateSecret, 'submit', normalizePhoneForLimit(phone), 20, 3600)
    if (submissionLimit === 'unavailable') return reply(503, {ok:false, message:'Ordering is temporarily unavailable.'})
    if (submissionLimit === 'limited') return reply(429, {ok:false, message:'Too many order requests for this phone number. Please try again later.'})
    const {data: pickup, error: pickupError} = await admin.from('customer_pickup_locations')
      .select('name,address').eq('name', locationName).eq('is_active', true).maybeSingle()
    if (pickupError || !pickup?.address) return reply(422, {ok:false, message:'This pickup point is not available yet.'})
    const scheduledAt = validatePickupSchedule(pickup.name, body.date, body.time)
    if (!scheduledAt) return reply(422, {ok:false, message:'Choose a pickup time within this location’s open days and hours.'})
    const dateYear = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila', year:'numeric'}).format(new Date())
    const code = `RD-${dateYear}-${crypto.randomUUID().replaceAll('-', '').slice(0,12).toUpperCase()}`
    const {data, error} = await admin.rpc('customer_submit_pickup_order', {
      p_request_id:requestId, p_access_token_hash:await sha256(accessToken as string),
      p_order_code:code, p_customer_name:name, p_customer_phone:phone,
      p_pickup_location:pickup.name, p_pickup_address:pickup.address,
      p_scheduled_at:scheduledAt, p_packaging:packaging, p_notes:notes,
      p_subtotal:priced.subtotal, p_items:priced.lines,
    })
    if (error || !data?.[0]) return reply(409, {ok:false, message:'The order could not be saved. Please retry with the same request.'})
    const {data:saved} = await admin.from('customer_orders').select('subtotal,total')
      .eq('id',data[0].id).single()
    if (!saved) return reply(503, {ok:false, message:'Order receipt is temporarily unavailable.'})
    return reply(200, {ok:true, orderCode:data[0].order_code, subtotal:saved.subtotal, total:saved.total, reused:data[0].reused})
  }

  if (action === 'customer-get' || action === 'customer-message') {
    const order = await customerOrder(admin, body)
    if (!order) return reply(404, {ok:false, message:'Order not found.'})
    if (action === 'customer-get') {
      const detail = await orderDetail(admin, order.id)
      return detail ? reply(200, {ok:true, order:detail}) : reply(503, {ok:false, message:'Order is temporarily unavailable.'})
    }
    const message = cleanText(body.message, 500)
    if (!message) return reply(422, {ok:false, message:'Enter a message.'})
    const messageLimit = await consumeRateLimit(admin, rateSecret, 'customer-message', order.id, 20, 600)
    if (messageLimit === 'unavailable') return reply(503, {ok:false, message:'Messaging is temporarily unavailable.'})
    if (messageLimit === 'limited') return reply(429, {ok:false, message:'Too many messages for this order. Please try again later.'})
    const {error} = await admin.from('customer_order_messages').insert({order_id:order.id, sender:'customer', body:message})
    return error ? reply(503, {ok:false, message:'Message could not be saved.'}) : reply(200, {ok:true})
  }

  if (!['staff-list','staff-get','staff-status','staff-phone-confirm','staff-message','staff-pay','staff-refund','staff-forecast'].includes(action)) return reply(400, {ok:false, message:'Unknown action.'})
  const staff = await staffIdentity(admin, request, action === 'staff-forecast' ? FORECAST_ROLES : STAFF_ROLES)
  if (!staff) return reply(403, {ok:false, message:'Authorized ordering staff only.'})

  if (action === 'staff-forecast') {
    const date = cleanText(body.date, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) {
      return reply(400, {ok:false, message:'Choose a valid production date.'})
    }
    const nextDate = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0,10)
    const {data:orders, error:orderError} = await admin.from('customer_orders')
      .select('id,order_code,status,scheduled_at')
      .in('status', ['accepted','preparing','ready','out_for_delivery','completed'])
      .gte('scheduled_at', `${date}T00:00:00+08:00`)
      .lt('scheduled_at', `${nextDate}T00:00:00+08:00`)
      .order('id').limit(501)
    if (orderError || !orders || orders.length > 500) return reply(503, {ok:false, message:'Online forecast is unavailable or exceeds its safe order limit.'})
    const items = []
    for (let offset = 0; offset < orders.length; offset += 25) {
      const ids = orders.slice(offset, offset + 25).map(order => order.id)
      const {data:batch, error:itemError} = await admin.from('customer_order_items')
        .select('order_id,product_id,product_name,quantity,pieces_per_unit').in('order_id', ids).limit(1001)
      if (itemError || !batch || batch.length > 1000) return reply(503, {ok:false, message:'Online forecast items are unavailable or exceed their safe limit.'})
      items.push(...batch)
    }
    return reply(200, {ok:true, date, orders, items})
  }

  if (action === 'staff-list') {
    const {data, error} = await admin.from('customer_orders').select(ORDER_FIELDS)
      .order('created_at', {ascending:false}).limit(100)
    return error ? reply(503, {ok:false, message:'Order queue is unavailable.'}) : reply(200, {ok:true, orders:data || []})
  }
  const orderId = cleanText(body.orderId, 40)
  if (!validRequestId(orderId)) return reply(400, {ok:false, message:'Invalid order ID.'})
  if (action === 'staff-get') {
    const detail = await orderDetail(admin, orderId)
    return detail ? reply(200, {ok:true, order:detail}) : reply(404, {ok:false, message:'Order not found.'})
  }
  if (action === 'staff-phone-confirm') {
    const {data, error} = await admin.rpc('customer_confirm_order_phone', {
      p_order_id:orderId, p_actor_admin_user_id:staff.id,
    })
    return error || data !== true
      ? reply(409, {ok:false, message:'Phone confirmation was not saved. Refresh the order and check its status.'})
      : reply(200, {ok:true})
  }
  if (action === 'staff-status') {
    const expected = cleanText(body.expectedStatus, 40)
    const next = cleanText(body.status, 40)
    const note = cleanText(body.note, 500)
    const {data, error} = await admin.rpc('customer_set_order_status', {
      p_order_id:orderId, p_expected_status:expected, p_new_status:next,
      p_actor_admin_user_id:staff.id, p_note:note || null,
    })
    return error || data !== true
      ? reply(409, {ok:false, message:next === 'accepted'
        ? 'Call and confirm the customer’s phone number before accepting this order.'
        : 'Status changed or this transition is not allowed.'})
      : reply(200, {ok:true})
  }
  if (action === 'staff-pay') {
    const method = cleanText(body.paymentMethod, 40)
    const reference = cleanText(body.referenceNumber, 120)
    if (!['Cash','GCash','Maya','Bank Transfer','QR PH'].includes(method)
      || (method === 'Cash' && reference)
      || (method !== 'Cash' && !reference)) {
      return reply(422, {ok:false, message:'Choose a payment method and enter a digital payment reference when needed.'})
    }
    const {data, error} = await admin.rpc('customer_record_paid_sale', {
      p_order_id:orderId, p_method:method, p_reference:reference || null,
      p_actor_admin_user_id:staff.id,
    })
    return error || !data?.[0]
      ? reply(409, {ok:false, message:'Payment was not recorded. Refresh the order and check its status and payment details.'})
      : reply(200, {ok:true, saleId:data[0].sale_id, reused:data[0].reused})
  }
  if (action === 'staff-refund') {
    const method = cleanText(body.refundMethod, 40)
    const reference = cleanText(body.referenceNumber, 120)
    const reason = cleanText(body.reason, 500)
    if (!['Cash','GCash','Maya','Bank Transfer','QR PH'].includes(method)
      || (method === 'Cash' && reference)
      || (method !== 'Cash' && !reference)
      || reason.length < 10) {
      return reply(422, {ok:false, message:'Enter the full refund method, digital reference when needed, and a reason of at least 10 characters.'})
    }
    const {data, error} = await admin.rpc('customer_refund_paid_sale', {
      p_order_id:orderId, p_method:method, p_reference:reference || null,
      p_reason:reason, p_actor_admin_user_id:staff.id,
    })
    return error || !data?.[0]
      ? reply(409, {ok:false, message:'Refund was not recorded. Refresh the order and check its payment details.'})
      : reply(200, {ok:true, refundId:data[0].refund_id, reused:data[0].reused})
  }
  const message = cleanText(body.message, 500)
  if (!message) return reply(422, {ok:false, message:'Enter a message.'})
  const {error} = await admin.from('customer_order_messages')
    .insert({order_id:orderId, sender:'staff', sender_admin_user_id:staff.id, body:message})
  return error ? reply(503, {ok:false, message:'Message could not be saved.'}) : reply(200, {ok:true})
}

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  const allowed = (Deno.env.get('PUBLIC_ORDERING_ALLOWED_ORIGINS') || '')
    .split(',').map(value => value.trim()).filter(Boolean)
  if (origin && !allowed.includes(origin)) return response(origin, 403, {ok:false, message:'Origin not allowed.'})
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:headers(origin)})
  if (request.method !== 'POST') return response(origin, 405, {ok:false, message:'Method not allowed.'})
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !key) return response(origin, 503, {ok:false, message:'Ordering service is not configured.'})
  const admin = createClient<any>(url, key, {auth:{persistSession:false, autoRefreshToken:false}})
  let text: string | null
  try { text = await readLimitedBody(request, MAX_BODY_BYTES) }
  catch { return response(origin, 400, {ok:false, message:'Request body could not be read.'}) }
  if (text === null) return response(origin, 413, {ok:false, message:'Request too large.'})
  let body: Body
  try { body = JSON.parse(text) }
  catch { return response(origin, 400, {ok:false, message:'Invalid JSON.'}) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return response(origin, 400, {ok:false, message:'Invalid request.'})
  try { return await handle(admin, request, body, key) }
  catch { return response(origin, 503, {ok:false, message:'Ordering is temporarily unavailable.'}) }
})
