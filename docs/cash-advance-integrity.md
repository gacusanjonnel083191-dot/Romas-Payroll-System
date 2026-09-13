# Cash-advance payroll integrity

The former login recovery loop could replay historical payroll deductions. Its
audit lookup failed open, balance writes were separate requests, and allocation
ignored saved loan IDs and cutoff dates. This change removes that loop and moves
release/reopen into one database transaction.

The migration starts with a **payroll release hold**. It does not correct any
existing loan balance. A separately authorized, reviewed incident reconciliation
must clear the hold and set `reconciled_at`. Every existing unreleased draft must
then be rebuilt and sent for review again. Do not clear the hold merely to get a
release through. Do not import private employee incident reports into this public
repository.

Deployment sequence, after explicit authorization:

1. Verify production project and current main branch. Apply the versioned migration.
2. Reconcile and approve the private correction manifest, then apply its guarded
   transaction. Preserve the resulting private before/after backup.
3. Publish this app version. Refresh admin and employee devices. Old browser
   repayment writes are rejected by the database guards.
4. Undo/recompute unreleased drafts and repeat employee review before release.
5. Verify corrected loan rows, their private audit events, receipt totals and
   production employee/admin displays. Never click release as a test on live payroll.

Behavior:

- Opening admin or refreshing performs no cash-advance repayment writes.
- A secure owner/payroll session is required for the RPC. HR and employee sessions
  cannot invoke it. RPC failures have no browser write fallback.
- PostgreSQL serializes payroll settlement operations with a transaction advisory
  lock and records a unique period/generation receipt and exact loan allocations.
- Snapshot totals must equal the saved deduction; each allocation is capped by
  its installment and outstanding balance and must belong to the same employee.
  Loans after the cutoff or created after draft computation cannot be consumed.
- A repeated release returns the existing receipt. It does not run downstream
  expense posting again. If an expense step failed previously, use the existing
  explicit expense-posting action after checking the record.
- Reopen reverses only that receipt's allocations and clears all release flags
  in the same transaction. Legacy periods without exact receipts require manual
  reconciliation; no newest-loan reversal is inferred.
- Cash-advance repayments and their audit events either both commit or neither
  does. Direct balance/paid changes from cached browser versions are rejected.
- Owner changes to unpaid plans remain supported. Resetting all repayments to
  zero is blocked because that would erase genuine payments.

Tests:

```bash
node --test tests/cash-advance-integrity.test.js tests/cash-advance-reproduction.test.js tests/attendance-undertime-policy.test.js
PGLITE_MODULE_PATH=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/cash-advance-database.test.js
npm run build
```

Database tests use PGlite 0.3.14 with an isolated schema fixture and synthetic data;
they never connect to Supabase. The test engine is not an app dependency. These
tests cover SQL execution, roles, rollback and retry semantics; they do not claim
production browser verification or a multi-session network contention test.

Rollback: keep database safeguards installed. Reverting the frontend alone
restores a client that cannot write repayments through the new guards. Do not
remove the guards or receipt tables to restore the old recovery routine. A data
correction rollback requires its own authorization and exact unchanged-row checks.
