# Employee offboarding and access-control staging (2026-10-08)

Status: **PREPRODUCTION / NOT DEPLOYED.** No live data changes or employee deletions.

## Verified root cause
- The application Deactivate handler (`src/App.jsx`) sets `employees.is_active=false`.
- Active employee rows remain in Supabase by design because historical foreign keys reference them.
- Direct deletion currently conflicts with `daily_schedules`, `attendance_logs`, `cash_advances`, and `payroll_records`, among others.
- Several employee sessions have a 12-hour lifespan. The two cash-advance read RPCs were missing an active-employee check.
- `daily_schedules` is currently RLS-disabled with anonymous write grants.

## Staged migration
`20261008150000_offboarding_session_and_schedule_security.sql`:
- Revokes employee-portal sessions and marks linked admin accounts inactive when an employee is deactivated.
- Protects linked company-owner identities from accidental employee deactivation.
- Uses `private.employee_portal_session_employee` to validate both the session and active employment on cash-advance reads.
- Enables schedule RLS and restricts schedule writes to authenticated authorized admin roles; keeps anonymous reads temporarily to avoid breaking the employee-portal and attendance/scheduling UI.
- Restricts employee deletion policy to owner access. FK safeguards continue to block destructive history loss.

## Tests and deployment gates
1. Run `node --test tests/employee-offboarding-security.test.js`. These are static guard tests, NOT database integration tests.
2. Restore a recent production backup into an isolated project; apply the migration only to that nonproduction copy.
3. Test owner, supervisor, normal employee, and already deactivated credentials.
4. Verify no active employee loses attendance, time-in/out, My Schedule, or admin scheduling.
5. Test a deactivation with prior payroll, attendance, schedules, and a cash advance.
6. Compare row counts and payroll/cash-advance totals before and after.
7. Specifically test old token behavior and ensure anonymous schedule write attempts are rejected.
8. Owner to explicitly approve production migration and deployment after the above evidence is reviewed.

## Work not yet safe to deploy
- Permanent physical removal from `public.employees` **requires** a protected historical identity/archive migration and reworking all foreign keys, joins, payroll/attendance reports, and rehire handling. Deletion remains blocked until that design is implemented and tested.
- Anonymous schedule SELECT remains temporarily allowed; a session-scoped read API plus updates to `EmployeeSchedule.jsx`, employee attendance time-in, and any historical reports must land before anonymous SELECT can be revoked.
- Employee portal still uses plaintext `pin`; hash migration requires updating creation, reset, login, and preexisting records in a single carefully tested rollout.
- Existing anonymous employee profile/attendance writes require a separate server-validated RPC migration to avoid breaking routine staff actions.
