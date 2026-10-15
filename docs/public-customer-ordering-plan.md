# Roma's Donuts public customer ordering — build plan

Status: requirements draft. No production deployment or database change is authorized by this document.

## Purpose and boundary

Build a customer-facing ordering app for anyone on the internet. Keep the existing reseller portal and its order, invoice, credit, and receivable rules separate. Connect accepted customer orders to the main business app through a narrow staff workflow; do not expose payroll, costing, reseller, or other internal data to public users.

## Confirmed business rules

- Fulfillment: pickup or delivery, with payment when the customer receives the order.
- Customer may choose a future order date. Same-day orders require at least one hour of lead time.
- Pickup and delivery time choices fall within 8:00 AM–5:00 PM, Asia/Manila.
- Delivery coverage: Binmaley, Calasiao, Dagupan City, Mangaldan, and Santa Barbara. The approved preview rate is ₱80 for the first 3 km plus ₱10 per additional started km; live road routing remains unconfigured.
- Pickup area names: Asingan, Binmaley, Calasiao, Dagupan City, Laoac, Mangaldan, Mapandan, San Carlos, San Fabian, San Jacinto, San Manuel, Santa Barbara, Santo Tomas, Sta Maria, Tayug, and Urdaneta (Nancalobasaan). These are not verified pickup points. Live ordering must show only places with confirmed addresses and active status.
- Customer sets an exact delivery pin, full address, landmark, and contact number. The app suggests a branch from the customer's location; staff can change the fulfilling branch when needed, with a revised delivery quote shown before confirmation.
- Delivery fee is a configurable minimum plus a distance-based addition. Show the fee and complete order total before submission. Do not take orders while a required fee rule or branch location is missing.
- Customer and seller can chat inside the app about an order. Only that customer and authorized staff can read or send its messages.

## Customer flow

1. Browse the public retail menu. Show only approved product names, images, availability, and retail prices; never expose the full `donut_variants` row or costing fields.
2. Choose products and quantities, fulfillment method, date, and an available time.
3. For delivery, set a map pin and enter the full address and landmark. Validate the coverage area and calculate road distance from the suggested branch. Show the delivery fee separately from the product subtotal.
4. Enter contact details and submit once. Return a unique order number and a `pending_confirmation` status. Prevent duplicate submissions, including retries after network errors.
5. View order status and order-specific chat through a secure customer identity or verified access method.

## Staff flow and main-system integration

1. A dedicated customer-order queue shows new requests, scheduled date/time, branch, item quantities, map pin, fee, total, and chat.
2. Staff accept, request a change, or decline an order. Acceptance records the exact products, price, fee, branch, and scheduled time. Changes that affect the customer total require customer acknowledgment.
3. Accepted order quantities appear once in the production plan for their scheduled fulfillment date. Pending, declined, and cancelled orders do not count as committed production. Reconcile any existing invoice-based forecast contribution so the same order is not counted twice.
4. Track preparation and fulfillment. Record a paid/completed sale once, with a source link to the customer order. Do not record a pending order as revenue and do not mix public customer sales with reseller receivables.
5. Preserve status, payment, branch, and fee history for auditability. Cancellation after production begins needs an explicit staff decision and remains visible in history.

## Scheduling and quote rules

- Store the requested fulfillment timestamp with Asia/Manila interpretation. Revalidate the date, one-hour lead time, branch availability, and 8:00 AM–5:00 PM service window on the server at submission and acceptance.
- Keep branch addresses, map coordinates, active status, delivery coverage, operating exceptions, and fee parameters in staff-managed settings.
- Calculate the nearest eligible branch using route distance where supported. Quote distance, fee, and route basis together; recheck the quote if the pin or branch changes.
- Never trust a client-supplied product price, fee, distance, or total as the final value.

## Access and operational safeguards

- Use a separate public storefront and narrow order/catalog interfaces. Apply database authorization to orders and messages, including staff role checks.
- Keep routing-service secrets off the browser where required, and set usage limits before public launch.
- Rate-limit public submissions and chat. Make order creation idempotent and log failures without customer personal details.
- Test desktop and mobile customer checkout, map pin adjustment, date/time boundary cases, offline/error states, duplicate taps, staff review, chat privacy, production inclusion, sales posting, and cancellation.

## Details needed before activation

- Exact address and map pin for each branch; which branches actually fulfill pickup, delivery, or both.
- Delivery fee minimum, included distance if any, charge per additional road kilometer, rounding, and any maximum delivery distance or fee.
- Time-slot interval and branch capacity; holiday or closed-day handling; how far ahead the calendar may be booked.
- Customer access method for order tracking and chat (for example, verified phone or email). Decide whether customers may cancel and until when.
- Decide whether one-hour notice is sufficient for every product and order size, or whether large orders need more time.
