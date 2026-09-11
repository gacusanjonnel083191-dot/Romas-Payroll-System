Reseller automatic ordering verification
========================================

Automatic ordering and manual ordering now have separate cutoffs:

- Automatic ordering: **10:00 AM Asia/Manila** for the next delivery day.
- Manual ordering: **1:00 PM Asia/Manila** remains unchanged.

Run the original isolated database regression with Node and `@electric-sql/pglite` installed in a temporary directory:

```sh
npm install --prefix /tmp/romas-auto-order-test @electric-sql/pglite
PGLITE_MODULE=/tmp/romas-auto-order-test/node_modules/@electric-sql/pglite/dist/index.js node tests/reseller-auto-order.mjs
```

That original test validates the 2026-09-09 automatic-ordering foundation migration in isolation: credential rejection, direct-write protection, staff approval, rollback after failed invoice-line insertion, zero-quantity removals, repeat approvals, holds, notification preferences, disabled schedules, skips, duplicates, overdue balances, and the original migration's schedule.

Run the 10:00 AM cutoff regression for the current release:

```sh
node tests/reseller-auto-order-10am.test.mjs
```

The cutoff regression verifies that the production build changes only automatic-order controls and copy to 10:00 AM while preserving the manual-order `ORDER_CUTOFF_TIME = '13:00'` and `ORDER_CUTOFF_LABEL = '1:00 PM'`. It also validates the versioned migration contract and the 02:00 UTC pg_cron schedule (10:00 AM Asia/Manila).

The recommendation formula remains unchanged: average delivered pieces minus recorded returns over the last four matching delivery weekdays, plus the selected safety allowance, clamped to the template's minimum/maximum. It is estimated sell-through, not independently recorded POS sales. With no history, the template quantity is used within the limits. Returns are not subtracted twice from outstanding invoice balances.

Reseller location: Dashboard > Automatic Ordering. Staff location: Sales & Expenses > Deliveries > Pending Orders. Auto-order approval creates the invoice and audit events in one transaction. Staff access follows owner/manager/HR roles and the existing invoice-requester delegation.

Release order: apply `supabase/migrations/20260911033000_reseller_auto_order_10am_ph.sql`, publish the frontend build, then verify the live cron job, schedule rows, manual 1:00 PM guard, authenticated reseller/staff flows, and persisted order/invoice totals. The app build includes a strict Vite invariant that fails if the automatic-order UI can no longer be safely converted to the approved 10:00 AM wording.
