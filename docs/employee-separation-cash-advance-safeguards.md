# Employee separation cash-advance safeguards

## Purpose

An employee with an outstanding cash advance must not be silently removed from the active employee list. Deactivation must leave one of two documented outcomes:

1. A stated amount is settled from final pay, backed by a signed authorization reference; or
2. The unpaid amount remains a former-employee receivable with a collection owner and note.

No cash advance is marked paid merely because the employee is deactivated. A final-pay settlement is capped at the actual gross final pay, and each settlement is allocated to the affected cash-advance record(s).

## User workflow

- **Deactivate** is for employees with no outstanding cash advance.
- If a balance exists, the app opens **Final Pay** instead.
- The owner either records a signed authorization and settles up to the available final pay, or leaves all/part of the balance as a documented receivable.
- The final-pay record, allocation ledger, cash-advance updates, audit log, and employee deactivation are committed as one database transaction.
- Cash Advance Coverage labels any outstanding balance of an inactive employee as **FORMER EMPLOYEE RECEIVABLE**.

## Existing inactive employees

This safeguard intentionally does not modify historical employee, cash-advance, payroll, or final-pay data. For an already inactive employee such as Rodilyn Maceda, the outstanding amount remains a receivable until payroll/final-pay evidence supports a separately documented reconciliation. Do not mark it paid or create a retroactive final-pay deduction without that evidence and authorization.

## Rollout order

1. Apply the database migration.
2. Verify the trigger and `employee_separation_command` RPC are present.
3. Deploy the application release.
4. Test one zero-balance deactivation and one outstanding-balance attempt in a non-production environment before using the workflow in production.

The migration is intentionally first: an outdated browser client will receive a blocking error instead of being able to hide an unpaid cash advance.
