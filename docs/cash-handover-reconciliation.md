# Cash Handover & Reconciliation

Prepared locally on `codex/cash-handover`, based on GitHub main `b80530e463f385af789cfe12e5683d9256500379`. The original reseller-credit working tree was preserved.

## Diagnosis and source of truth

The newer Sales & Resellers Dashboard uses `OwnerDailyReceipts`, `owner_daily_receipts`, and `owner_cash_expenses_for_day`. Expected cash is confirmed cash receipts less owner-classified cash expenses paid on the selected date and deposits marked deposited. GCash/online receipts, unpaid deliveries, pending deposits, and expenses classified unpaid or online do not contribute to cash. POS daily-sales mirror entries are deduplicated. Opening drawer floats and prior-day cash are excluded: this is a daily movement, not an opening-plus-closing balance.

The older Expenses reconciliation instead uses invoice paid totals, walk-in/messenger sales, and all approved expenses. Its date upsert cannot model declared handover versus owner count or preserve correction revisions. Read-only live inspection confirmed zero legacy reconciliation rows, no unique date constraint (required by the upsert), and RLS disabled on that legacy table. Those legacy database objects and the Expenses workflow are unchanged. The security issue should be reviewed separately.

## Workflow

Find the new section directly beneath **Cash expected from this day’s recorded activity** in **Sales & Resellers → Dashboard → Owner daily receipts**.

The signed-in owner records the amount Myra declares, her name, handover time in Asia/Manila, and notes. Owner physical count can be submitted with the handover or later. Receiver name is derived from the authenticated active admin account; actor UUID and timestamps remain recorded. This version uses the existing owner-only Dashboard; Myra does not gain new access.

Amounts use cents. Collection variance = handed − expected; counting variance = counted − handed; final variance = counted − expected. Final variance determines BALANCED / SHORTAGE / OVERAGE; absent count shows AWAITING OWNER COUNT. Zero is a valid count. The Dashboard count card uses the latest revision, including zero, and does not reuse a superseded count when the latest correction awaits a count. Legacy counts are a fallback only when no new handover exists.

History is append-only, with revision numbers and predecessor IDs. Corrections require a reason. The server calculates expected cash independently from the current Dashboard source functions and saves their source snapshot; owner counts retain the handover snapshot. Changes to later source activity show a review notice. Unknown payment methods, ambiguous legacy online tracking, and unclassified approved expenses prevent final handover submission.

One initial company handover is permitted per business date. Day-level transaction locks, unique predecessor links, optimistic latest-ID checks, and request-token idempotency prevent duplicate submissions and competing revisions. A lost network response can be retried with the same token. Direct inserts/updates/deletes are denied to frontend roles; updates/deletes also have an immutability trigger. Privileged write logic lives in the private schema with an explicit active-owner check, exposed through an invoker RPC.

## Changed files and database objects

- `src/CashHandover.jsx`: handover/count form, result and revision history.
- `src/cashHandover.js`: cents-based variances, input validation, readiness check.
- `src/OwnerDailyReceipts.jsx`: load history, insert workflow, reload after save; disable workflow if history load fails.
- `src/ownerDailyReceipts.js`: latest owner count card.
- `supabase/migrations/20261005170522_cash_handover_reconciliation.sql`: new `cash_handover_events` table, owner read policy, immutability trigger, private calculation/write functions, public `owner_save_cash_handover` RPC. No existing data is rewritten.
- `tests/cash-handover.test.js`: calculation and isolated PostgreSQL integration tests.
- `tests/fixtures/cash-handover-preview.{html,jsx}`: local synthetic browser fixture, without any Supabase connection.

## Validation

`node --test tests/cash-handover.test.js tests/owner-daily-receipts.test.js` covers calculation parity, tender methods, expenses/deposits, unpaid exclusions, POS deduplication, snapshots, zero counts, append/reload, corrections, idempotent retries, stale submissions, owner/staff/anonymous/inactive permissions, and immutable history.

Targeted ESLint covers the four affected source files. Browser testing uses the real Dashboard component with synthetic local fixtures: handover → pending count → shortage → correction → balanced, card update, reload, history, non-owner hiding, and history-load failure. Desktop, 390px mobile and 768px tablet layouts are inspected; no horizontal page overflow at mobile/tablet widths. No production submissions are used.

`npx vite build` produces the production bundle after temporarily normalizing App.jsx to LF. Windows CRLF breaks existing egress and payroll-invariant build anchors. Even with LF, the repository's full `npm run build` command has a pre-existing failure in `patch-coe-esign-workflow.cjs`: the active-signatories anchor is missing. Build-script-generated App changes and temporary normalization were removed. These unrelated patches were not changed. Existing large-bundle warnings remain. A full standard build is therefore not verified as passing.

Live save/reload, device-installed PWA behavior, and post-deployment behavior remain unverified because the new migration has not been applied and deployment is not authorized.

## Rollout and rollback

No push, production migration, deployment, or production data change was performed. Explicit authorization is required for each external scope. Review and apply the migration to the confirmed Roma Supabase project (`hebbunlnzklavkkugtzs`) before deploying the UI. Until then, unavailable history displays a clear error while existing receipts and expenses remain usable.

Rollback the frontend changes to remove the workflow. Preserve the new audit table and its rows; do not drop or rewrite reconciliation history. If disabling writes is required, revoke authenticated execute on the public RPC and private save function under explicit database authorization. Existing payment, expense, invoice, and balance records need no rollback.
