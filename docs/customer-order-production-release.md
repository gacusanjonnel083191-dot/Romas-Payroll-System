# Customer ordering connection to the main system

## Release boundary

The first release is **pickup only** at four verified Dagupan points. Delivery
stays unavailable until road routing, branch pins, and fee reconciliation are
implemented and checked. Pending requests are not sales or production demand.
Accepted requests enter the production forecast once for their requested Manila
date. A separate online sale and customer receipt appear only after staff
records full payment. Reseller invoices remain separate.

This document prepares a production release; it does not authorize one.

## Verified state on 28 October 2026

- Main Supabase project: `hebbunlnzklavkkugtzs`. It has the existing
  `daily_sales_online_payments` ledger (14 rows at precheck) and three active,
  Auth-linked owner/supervisor/assistant-supervisor profiles. It does not yet
  have customer-order tables or a `public-ordering` Edge Function.
- Staging project: `hybzaqztsyhqjjyfpeis`. The customer-order migrations and
  Edge Function are installed. A synthetic browser checkout, simulated staff
  phone confirmation, acceptance, and cleanup passed. Submissions are off.
- Main Vercel project: `romas-payroll-system`, project ID
  `prj_mppefkxMbGTsZLGQxnQ6sAogjZYN`. Its production domain is
  `rd-business-system.vercel.app`; the other Vercel domain redirects there.
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist for production.
  `VITE_PUBLIC_ORDERING_ENABLED` is absent.
- The standard `npm run build` passes. The customer-order, forecast, ledger,
  refund, staff-call, and pickup-release tests pass locally. The main admin
  navigation now includes a role-limited link to the staff order queue when
  the ordering feature flag is enabled.
- The current main ledger has a permissive `public` policy. The prepared
  `secure_online_payment_ledger` migration replaces it with authenticated
  owner/manager/HR read and insert policies. Verify the existing sales screens
  after this change. Do not revert to anonymous ledger access as a shortcut.
- The production dashboard shows a scheduled physical database backup from
  27 October 2026 21:06:52 UTC with a Restore action. Point-in-time recovery is
  **not enabled**. A daily backup may omit orders and financial entries created
  afterward; confirm a sufficiently recent recovery point immediately before
  any production migration. No restore has been attempted.

## Controlled rollout sequence

1. Confirm a recent, restorable production database backup and record the
   baseline counts for the online-payment ledger. Confirm the production
   project, Vercel project, domain, and current deployment at action time.
2. Review and apply **only** these customer-order migrations to the main
   Supabase project in this order. Do not run a blanket `supabase db push` from
   this worktree because it contains unrelated migrations:

   - `20261015074848_public_customer_order_foundation.sql`
   - `20261024002147_customer_order_paid_sales.sql`
   - `20261024042701_secure_online_payment_ledger.sql`
   - `20261026004529_customer_order_refunds.sql`
   - `20261027122644_customer_order_public_rate_limits.sql`
   - `20261027132531_customer_order_staff_phone_confirmation.sql`

3. Verify the new tables, row-level security, server-only functions, and the
   unchanged count and totals of the pre-existing online-payment rows. Test
   main-app ledger read/insert with an authorized signed-in role and rejection
   for anonymous access. Keep customer submissions off throughout this step.
4. Apply `supabase/customer-ordering-verified-pickup-locations.sql` to activate
   the four approved Dagupan points. Confirm their customer-facing addresses
   and pins before applying it. The other 16 area names stay inactive.
5. Deploy only the `public-ordering` Edge Function to the main Supabase
   project, with JWT verification disabled in the gateway because the function
   verifies staff tokens itself. Set `PUBLIC_ORDERING_ALLOWED_ORIGINS` to the
   exact storefront origin `https://rd-business-system.vercel.app` and set
   `PUBLIC_ORDERING_SUBMISSIONS_ENABLED=false`. Verify anonymous forecast and
   staff actions are denied, while the public configuration returns four
   pickup points and `orderingEnabled: false`.
6. Review and deliver this branch to the main Vercel project. Add production
   `VITE_PUBLIC_ORDERING_ENABLED=true` while retaining its existing production
   Supabase URL and publishable key. The Vite build includes the customer page
   and staff queue. Verify the admin Customer Orders link, authorized staff
   sign-in, the accepted-order production forecast, and existing sales screens.
   Keep customer submissions disabled during this verification.
7. After a final owner review of the customer page, pickup details, staff
   staffing, and receipt, enable production submissions. Place one clearly
   labeled, controlled test order, confirm it in the staff queue, check its
   forecast contribution, and leave it unpaid unless real money is received.
   Close submissions immediately if a critical check fails.

## Stop and recovery

The fastest operational stop is setting
`PUBLIC_ORDERING_SUBMISSIONS_ENABLED=false` on the main Supabase project and
verifying the public configuration reports `false`. A Vercel rollback or a
build with `VITE_PUBLIC_ORDERING_ENABLED=false` removes the live main-app
integration. The new order tables are additive; do not drop them or delete
financial rows as a routine rollback. Preserve the tightened ledger security
policy. Use the verified backup and a reviewed recovery plan for a database
failure.

Production migration, pickup activation, Edge Function deployment, Vercel
configuration, code push/merge, and submission enablement each require explicit
target-specific authorization under `AGENTS.md`.
