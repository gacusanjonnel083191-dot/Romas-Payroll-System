# Roma's Donuts — Employee Offboarding / October 8, 2026

## Deployment state
Source code and migrations are staged on a GitHub review branch pending merge to main.
**Production Supabase schema is not changed by merging a GitHub pull request.**
No real employees have been removed. An owner must approve a separate controlled migration release after production backup verification.

## Existing issues verified in production
- React Deactivate handler only sets `employees.is_active=false`; historical foreign keys block hard deletion.
- Employee session tokens may last 12 hours without automatic deactivation revocation.
- Two employee cash-advance read RPCs did not verify active employment.
- Staff schedule table was not RLS protected; anonymous writes were allowed.
- The `employees.pin` column contains legacy plaintext PINs, though anonymous users cannot read that column.

## Implemented on branch
1. `20261008150000_offboarding_session_and_schedule_security.sql` — revoke tokens and linked admin access at deactivation; block revoking owner; validate employee tokens; owner-only DELETE RLS and RLS-protected schedule writes. Anonymous schedule SELECT remains temporarily allowed to preserve legacy employee time-in/portal.
2. `20261008150100_employee_registry_and_owner_removal.sql` — historic identity registry, reparent historical foreign keys from active account table to registry, owner-only permanent removal RPC with confirmation code, checks outstanding cash advances, revokes credentials and passkeys, preserves financially relevant records and audit receipts. Notice: Supabase Auth admin user itself is not deleted, but linked admin access is revoked. Transient notifications linked to the profile may cascade on removal.
3. `20261008150200_hash_employee_pins.sql` — one-time bcrypt conversion of existing PINs, hashing trigger on new/reset PINs, and bcrypt-aware login RPC.
4. `src/App.jsx` — owner-only Deactivated Employees management list with reactivation/removal, and compatibility changes avoiding historical FK embeddings that would break after migration.

## Tests actually performed
Isolated Supabase development branch was created without production data. **Automatic historical migration replay failed**; a focused, synthetic schema was therefore created in that branch, so this is NOT a full clone of production.
- All three offboarding migrations applied successfully to the isolated test schema.
- Permanent removal of synthetic resigned employee succeeded; account deleted, one payroll, one attendance, one schedule, one medical history, one settled cash advance record retained.
- Linked admin and chat access disabled; passkeys removed.
- Inactive employee deactivation revoked all synthetic sessions and linked admin access.
- Anonymous schedule write grants absent; RLS active.
- Active employee removal rejected; nonowner removal rejected.
- Hash migration made synthetic PIN bcrypt (60 characters); correct login succeeded; wrong PIN rejected.
- Vercel GitHub branch preview reported READY for the modified App.jsx build.
- File-level Node invariant tests are staged but **were not executed in CI**.

## Remaining preproduction gates
1. Verify actual production schema against every FK and dependent query/function and arrange a recoverable backup.
2. Apply migrations to a **full-fidelity** nonproduction clone and test the real schema, not only the simplified fixture; do not assume this QA branch proves compatibility for every module.
3. Check signed-in owner, supervisor, HR, payroll, employee, attendance time-in/time-out, staff schedule creation/reading, cash advances, final pay, payslips, employee rehire and POS access end-to-end.
4. Baseline and reconcile historical payroll/attendance/cash-advance row counts and totals before/after the production migration, with rollback plan.
5. Only after successful tests, separately authorize applying these migrations to production; deploy code and schema in coordinated release, with app pointing to the new RPCs. No bulk hard deletion of the existing 11 deactivated employees is authorized.
6. Schedule read permissions still expose shift data to anonymous read for compatibility. Design session-scoped read paths and revoke anonymous SELECT in follow-up.
7. Staff attendance anon write RLS remains a separate security project requiring a nonbreaking verified RPC migration.
8. Review the tracked `src/.env` file in the public GitHub repository for secrets without exposing them.

This change intentionally does **not** merge or run migrations automatically from the source code. Push to `main` may cause an automatic Vercel application deployment depending on configured Git integration.
