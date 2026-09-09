Reseller automatic ordering verification
========================================

Run the isolated database tests with Node and `@electric-sql/pglite` installed in a temporary directory:

```sh
npm install --prefix /tmp/romas-auto-order-test @electric-sql/pglite
PGLITE_MODULE=/tmp/romas-auto-order-test/node_modules/@electric-sql/pglite/dist/index.js node tests/reseller-auto-order.mjs
```

The test runs the migration twice against a synthetic PostgreSQL-compatible database. Only pg_cron's extension installation and scheduling functions are stubbed. It exercises generation, credential rejection, direct-write protection, staff approval, rollback after failed invoice-line insertion, zero-quantity removals, repeat approvals, holds, notification preferences, disabled schedules, skips, duplicates, and overdue balances. The app's actual time helpers are checked before/at the 1 PM Asia/Manila boundary and after midnight.

The recommendation is the average of delivered pieces minus recorded returns over the last four matching delivery weekdays, plus the selected safety allowance, clamped to the template's minimum/maximum. It is estimated sell-through, not independently recorded POS sales. With no history, the template quantity is used within the limits. Returns are not subtracted twice from outstanding invoice balances.

Daily generation is scheduled at 05:00 UTC (1 PM Asia/Manila) for tomorrow's delivery. Resellers must create an active day template and opt in. A Saturday template submits Friday at 1 PM. Existing submissions remain for staff review if automatic ordering is later disabled.

Reseller location: Dashboard > Automatic Ordering. Staff location: Sales & Expenses > Deliveries > Pending Orders. Auto-order approval creates the invoice and audit events in one transaction. Staff access follows owner/manager/HR roles and the existing invoice-requester delegation.

Release requires applying `supabase/migrations/20260909050000_reseller_automatic_ordering.sql` before publishing the frontend. Validate the real cron job, authenticated staff/reseller flows, and persisted invoice totals after an authorized release. Isolated tests do not prove production cron execution or browser behavior. Run the full `npm run build` in an isolated worktree because existing build hooks patch invoice branding and HR access in App.jsx.

All new auto-order settings default to disabled. No production migration or deployment is performed by these tests.
