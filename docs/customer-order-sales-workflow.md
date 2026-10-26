# Customer order sales workflow

An online pickup request is not revenue. After staff accepts it and confirms
receipt of the full amount, the staff queue records one separate online sale.
It does not create an outlet POS receipt or a reseller receivable.

The customer-facing My orders page uses the order code as an unpaid order
reference. After staff records full payment, it offers a printable customer
payment receipt with the server-recorded items, total, paid time, and pickup
details. The Edge Function checks the linked active online sale and returns
its sale ID, amount, payment method, and digital reference to the holder of
the private order token. It refuses to print when there is no matching sale,
the payment status is unpaid, or the item totals do not match. This receipt does not create or change a
reseller invoice. The receipt UI is local only and has not been deployed.

The payment screen supports cash, GCash, Maya, bank transfer, and QR PH. Staff
must enter a transaction reference for digital payments. The sale uses the
order's server-calculated total and the date of confirmation in Asia/Manila;
staff cannot edit the sale amount in the ordering queue.

`customer_record_paid_sale` updates the order and inserts its linked row in
`daily_sales_online_payments` in one database transaction. A unique order link
and row lock make retries idempotent. A unique digital reference protects
against posting the same transfer to two customer orders. Linked sales cannot
be edited through the main app's general online-payment form. The ledger row
is marked `count_as_revenue = true`, appears under the `Website Order` source,
and is included in the existing online revenue reports.

Staff cannot cancel a paid order through the ordinary cancellation action.
The local full-refund workflow requires ordering staff to confirm that the
money was already returned, choose the refund method, provide a digital
transaction reference when applicable, and record a reason. It does not
transfer money. One database transaction preserves the original paid sale,
adds a linked negative revenue entry dated in Asia/Manila, marks the order
refunded, and cancels an unfulfilled order. A completed order stays completed
so its fulfillment history remains intact. The unique reversal link and
order lock prevent duplicate refunds. The customer sees a separate refund
confirmation rather than a still-paid receipt. The main online-sales ledger
labels reversal rows and nets their negative amount into the refund date's
revenue. Staff must still reconcile cash returned at pickup with that
location's cash handover.

The refund migration, function action, staff form, customer confirmation,
and main-app refund labels are local only. They have passed local database,
receipt, and build checks, but have not been applied or deployed to staging
or production. Staging still runs the prior paid-sale workflow.

The migration and Edge Function were tested in the separate staging project.
Customer submissions remain disabled. Neither the migration nor the function
has been applied to production; GitHub and Vercel have not been updated.

## Production forecast connection (local implementation)

When `VITE_PUBLIC_ORDERING_ENABLED=true`, the main app asks the authenticated
`public-ordering` Edge Function for orders scheduled on the selected Manila
production date. The function returns only accepted, preparing, ready,
out-for-delivery, and completed orders, plus item snapshots; it does not return
customer contact details. The main app adds `quantity × pieces_per_unit` to
the existing reseller invoice quantities. Assorted Rings and Assorted
Circlets are shown as separate **unallocated** piece lines rather than
assigned to a flavor. Their existing base-dough premix rates are 27 g and
11.7 g per piece, respectively. The screen shows invoice and online source
counts separately and blocks printing when the online count cannot be
verified. Print rechecks the current online quantities; if they changed,
staff must review the updated forecast before printing. The connection does
not create a reseller invoice from an online order.

The weather and route guard below the production baseline still plans
reseller deliveries only. Pickup orders are represented in the variant
production baseline, not in reseller dispatch routes. Staff should avoid
manually duplicating a website order on a reseller invoice. This forecast
Edge Function forecast action is deployed to staging as version 10. The main
app UI is still local and has not been pushed or deployed. The anonymous
forecast request returned HTTP 403 in staging. A signed-in staging staff
request for 26 October 2026 returned zero orders and zero items, matching the
empty staging database. A labeled, unpaid accepted staging order with one
six-piece Assorted Rings box and one 30-piece Choco Balls box then returned
one order, two items, and 36 pieces. Its unit prices were ₱150 and ₱180,
giving a ₱330 subtotal; this was never recorded as a sale. The exact test
order and its two items were removed, and the same staff action returned zero
orders and zero pieces again. The temporary test control was removed from
the staff page. Production customer ordering remains disabled.
