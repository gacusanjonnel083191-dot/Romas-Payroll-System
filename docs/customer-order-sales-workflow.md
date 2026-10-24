# Customer order sales workflow

An online pickup request is not revenue. After staff accepts it and confirms
receipt of the full amount, the staff queue records one separate online sale.
It does not create an outlet POS receipt or a reseller receivable.

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
A refund and reversal workflow is still required before paid cancellations
can be offered. Staff must also reconcile cash collected at pickup with the
location's cash handover; the online sale is separate from that location's POS.

The migration and Edge Function were tested in the separate staging project.
Customer submissions remain disabled. Neither the migration nor the function
has been applied to production; GitHub and Vercel have not been updated.
