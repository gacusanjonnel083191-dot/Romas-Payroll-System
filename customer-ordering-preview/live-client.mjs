import {normalizePhilippineMobile} from './phone-number.mjs';

const environment = import.meta.env || {};
const url = environment.VITE_SUPABASE_URL || '';
const key = environment.VITE_SUPABASE_ANON_KEY || '';
export const LIVE_ORDERING = environment.VITE_PUBLIC_ORDERING_ENABLED === 'true' && Boolean(url && key);
const endpoint = `${url.replace(/\/$/, '')}/functions/v1/public-ordering`;
let phoneAuthClientPromise;

async function phoneAuthClient() {
  if (!LIVE_ORDERING) throw new Error('Live ordering is not configured.');
  phoneAuthClientPromise ||= import('@supabase/supabase-js').then(({createClient}) =>
    createClient(url, key, {auth:{persistSession:true, autoRefreshToken:true,
      storageKey:'romas-customer-phone-auth'}}));
  return phoneAuthClientPromise;
}

export async function customerPhoneSession(value) {
  const phone = normalizePhilippineMobile(value);
  if (!phone || !LIVE_ORDERING) return null;
  const client = await phoneAuthClient();
  const {data:{user}, error} = await client.auth.getUser();
  if (error || !user?.phone_confirmed_at || normalizePhilippineMobile(user.phone) !== phone) return null;
  const {data:{session}} = await client.auth.getSession();
  return session?.access_token ? session : null;
}

export async function sendPhoneCode(value) {
  const phone = normalizePhilippineMobile(value);
  if (!phone) throw new Error('Enter a valid Philippine mobile number.');
  const client = await phoneAuthClient();
  const {error} = await client.auth.signInWithOtp({phone});
  if (error) throw new Error('The verification code could not be sent. Please try again later.');
  return phone;
}

export async function verifyPhoneCode(value, code) {
  const phone = normalizePhilippineMobile(value);
  if (!phone || !/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code sent to your phone.');
  const client = await phoneAuthClient();
  const {error} = await client.auth.verifyOtp({phone, token:code, type:'sms'});
  if (error || !await customerPhoneSession(phone)) throw new Error('The code is invalid or expired. Please request a new code.');
  return phone;
}

export async function liveCall(action, payload = {}) {
  if (!LIVE_ORDERING) throw new Error('Live ordering is not configured.');
  const headers = {'Content-Type':'application/json', apikey:key};
  if (action === 'submit') {
    const session = await customerPhoneSession(payload.phone);
    if (!session) throw new Error('Verify your mobile number before sending the order.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const response = await fetch(endpoint, {
    method:'POST',
    headers,
    body:JSON.stringify({action,...payload}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'Ordering is temporarily unavailable.');
  return result;
}

export function newOrderCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const accessToken = [...bytes].map(byte => byte.toString(16).padStart(2,'0')).join('');
  return {requestId:crypto.randomUUID(),accessToken};
}

export function normalizeLiveOrder(order) {
  const at = new Date(order.scheduled_at);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23',
  }).formatToParts(at).map(part => [part.type,part.value]));
  return {
    id:order.id, orderCode:order.order_code, name:order.customer_name, phone:order.customer_phone,
    date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}`,
    type:order.fulfillment_type, branch:order.pickup_location, town:order.delivery_municipality,
    address:order.delivery_address, landmark:order.delivery_landmark, pin:null,
    packaging:order.packaging, status:order.status, paymentStatus:order.payment_status,
    paidAt:order.paid_at, refundedAt:order.refunded_at,
    pickupAddress:order.pickup_address_snapshot,
    receipt:order.receipt ? {
      saleId:order.receipt.sale_id, paymentMethod:order.receipt.payment_method,
      referenceNumber:order.receipt.reference_number, amount:Number(order.receipt.amount),
      refund:order.receipt.refund ? {
        id:order.receipt.refund.id, paymentMethod:order.receipt.refund.payment_method,
        referenceNumber:order.receipt.refund.reference_number,
        amount:Number(order.receipt.refund.amount),
      } : null,
    } : null,
    subtotal:Number(order.subtotal),
    deliveryFee:Number(order.delivery_fee), total:Number(order.total),
    items:order.items.map(item=>({id:item.product_id,name:item.product_name,quantity:item.quantity,
      unitLabel:item.unit_label,unitPrice:Number(item.unit_price),lineTotal:Number(item.line_total)})),
    messages:order.messages.map(item=>({id:item.id,from:item.sender,text:item.body,at:item.created_at})),
  };
}
