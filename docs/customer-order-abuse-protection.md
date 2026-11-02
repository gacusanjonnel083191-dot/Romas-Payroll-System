# Customer order abuse protection

Customer checkout stays account-free. Staff still calls the customer before accepting a request.

## Controls

- The public order endpoint validates prices, dates, pickup points, delivery area, and item quantities on the server.
- A configured Cloudflare Turnstile widget runs in checkout. The Edge Function verifies its single-use token, action, and storefront hostname with Cloudflare before saving an order. A missing or failed check blocks submission.
- The Edge Function limits submissions to 30 per forwarded IP per hour, 4 per phone per hour, and 10 per phone per day. The existing database rate-limit function stores only keyed hashes, not raw phone or IP values.
- Rate-limit storage failures block submissions. The IP counter runs before Turnstile verification so repeated invalid challenges cannot call the verification service without limit.
- Staff must call and record customer confirmation before accepting an order. Delivery quotes and fees must also be confirmed.

## Turnstile setup

Create a Managed Cloudflare Turnstile widget for `rd-business-system.vercel.app`. In the intended Supabase project, save its public site key as `PUBLIC_ORDERING_TURNSTILE_SITE_KEY` and its private secret key as `PUBLIC_ORDERING_TURNSTILE_SECRET_KEY`. Do not put the secret key in Vite variables, source code, or chat. The function exposes only the site key to the storefront.

Set both keys together. If only one is set, checkout fails closed with a configuration error. When neither is set, the existing checkout remains available with the tighter rate limits and staff call requirement; Turnstile is not active. Deploy the updated storefront and Edge Function after the keys are saved, then verify the live configuration before taking a real order.

Test a normal pickup and delivery request, an expired or invalid Turnstile token, an incorrect hostname, and a rate-limited request in staging before production rollout. Keep the production ordering switch available to close submissions if the security provider has an outage.
