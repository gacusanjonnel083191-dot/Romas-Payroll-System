# POS same-day shift closing fix

Status: implemented and tested locally; no push, deployment, migration, or production record changes.

## Confirmed cause

Read-only inspection of Roma's Supabase project `hebbunlnzklavkkugtzs` on October 15, 2026 confirmed a zero-sales shift closed at 08:59 Asia/Manila and another shift opened at 09:00. `pos_close_shift_atomic` correctly writes by shift ID, but an additional unique index on outlet/date rejects the second closing. The transaction rolls back and the active shift stays open.

## Change

- Migration `20261015133003_allow_multiple_pos_shifts_per_day.sql` limits outlet/date uniqueness to daily summaries (`shift_id IS NULL`). The existing unique shift ID index continues to protect cashier snapshots.
- The admin finalizer uses the matching partial conflict target; it does not overwrite cashier snapshots.
- The integrity audit excludes daily summaries when shift details exist, avoiding duplicate cash exposure. It fails safely if the expected live audit definition has changed.
- `src/posClosingSummary.js`, `src/App.jsx`, and `src/ownerDailyReceipts.js` aggregate cashier shifts for the daily monitor and avoid counting both summaries and details as receipts.
- No saved cash, sales, inventory, closing, or variance records are changed by the migration. Cashiers close their own shifts through the existing POS workflow after activation.

## Validation

Seven focused tests passed, including a local PostgreSQL reproduction using the actual live closing function definitions: the second closing fails before the migration, succeeds afterward, leaves the first closing unchanged, and preserves the shortage. Duplicate shift IDs remain rejected. Repeated admin saves retain one daily summary and one linked Daily Sales row. Unauthorized admin finalization remains rejected. Audit totals and owner receipts count details once. Existing monitor pagination and failure handling pass.

`npm run build` passed. Its existing prebuild scripts also modify unrelated COE code; those generated changes were excluded from this patch. A direct `npx vite build` of the final narrow source also passed. Existing bundle-size and mixed-import warnings remain.

No live closing write or cashier-device end-to-end test has been performed. The separate cashier POS source is not in this repository; the verified live database function is included as a test fixture.

## Activation requires explicit authorization

1. Apply the migration to the confirmed Roma's Supabase project.
2. Push the reporting patch to `gacusanjonnel083191-dot/Romas-Payroll-System`, branch `main`, and verify the existing deployment target before deployment verification.
3. On the cashier device, refresh totals, recheck counted cash and notes, and use **Confirm, Close Shift & Log Out**. Verify the persisted closing, shift status, logout, daily monitor, and receipts.

Do not silently auto-close the shift or alter the cash amount.

## Rollback

Before any additional same-day closing exists, `pos-multiple-shifts-rollback.sql` restores the old index/finalizer. It refuses rollback after multiple rows exist, to preserve financial history. At that point use a forward correction. The audit deduplication remains compatible with the old one-row layout.

Baseline repository commit: `cdaf96e`. Baseline `App.jsx`: 51,361 lines, 3,129,428 bytes, SHA-256 `b92d2213c2caa83349aeb87718d812e3da0987468bdf0663705245080d17bc85`.
