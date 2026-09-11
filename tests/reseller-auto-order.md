Reseller automatic ordering verification
========================================

Current cutoff policy:

- Automatic ordering: **1:00 PM Asia/Manila** for the next delivery day.
- Manual ordering: **1:00 PM Asia/Manila**.
- The temporary 10:00 AM automatic-order release was reversed by `supabase/migrations/20260911035607_restore_reseller_auto_order_1pm_ph.sql`.

Run the original isolated database regression with Node and `@electric-sql/pglite` installed in a temporary directory:

```sh
npm install --prefix /tmp/romas-auto-order-test @electric-sql/pglite
PGLITE_MODULE=/tmp/romas-auto-order-test/node_modules/@electric-sql/pglite/dist/index.js node tests/reseller-auto-order.mjs
```

That regression validates the automatic-ordering foundation: credential rejection, direct-write protection, staff approval, rollback after failed invoice-line insertion, zero-quantity removals, repeat approvals, holds, notification preferences, disabled schedules, skips, duplicates, overdue balances, and the original schedule behavior.

Production scheduling uses 05:00 UTC, which is 1:00 PM Asia/Manila. The recommendation formula remains unchanged: average delivered pieces minus recorded returns over the last four matching delivery weekdays, plus the selected safety allowance, clamped to the template's minimum/maximum. It is estimated sell-through, not independently recorded POS sales. With no history, the template quantity is used within the limits. Returns are not subtracted twice from outstanding invoice balances.

Reseller location: Dashboard > Automatic Ordering. Staff location: Sales & Expenses > Deliveries > Pending Orders. Auto-order approval creates the invoice and audit events in one transaction. Staff access follows owner/manager/HR roles and the existing invoice-requester delegation.

Manual ordering also provides **COPY FROM LAST ORDER**. It copies only the latest valid order for the currently selected branch/outlet into the quantity form, does not submit anything automatically, ignores cancelled/voided/rejected/deleted orders, and lets the reseller review or edit quantities before submitting.

Release verification: confirm the production cron job is `0 5 * * *`, all automatic-order schedule rows use `13:00`, the manual-order write guard remains `13:00`, the reseller manual copy button loads the selected branch's latest valid order, and staff approval/invoice totals remain unchanged.
