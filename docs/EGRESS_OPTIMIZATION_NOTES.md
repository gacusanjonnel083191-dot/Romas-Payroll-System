# Roma's Donuts — Supabase egress optimization

Scope is intentionally limited to the two verified request storms.

## Behavioral changes

- Attendance Adjustment defaults to Pending Only.
- Attendance Adjustment is no longer loaded during every admin/owner login.
- Only pending OT / No Meal Break requests receive automatic DTR/payroll validation when the module is loaded. Approved/history rows remain available and can still be manually recalculated/reviewed.
- Owner Foundation/Command Center no longer downloads the full current-month + six-month dataset automatically at login.
- Foundation auto-refresh defaults OFF.
- If deliberately enabled, Foundation auto-refresh runs every 15 minutes and only while the Foundation module is open.
- Foundation reloads are protected against overlapping requests.
- Existing manual LOAD/REFRESH controls remain the path for fresh Command Center/Foundation data.

## Intentionally unchanged

Payroll formulas, OT/UT rules, meal-break policy, released-payroll handling, cash advances, invoice logic, reseller rules, inventory logic, POS sale logic, production logic and historical records are not altered.

## Database work

A separate index migration is prepared but must not be applied to production without approval. RLS hardening is deliberately gated behind a development-branch policy/test phase.
