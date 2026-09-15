# Roma's Donuts — Supabase security hardening gate

This document intentionally does **not** enable RLS in production. The 2026-09-15 audit found a large number of exposed `public` tables without RLS and several `SECURITY DEFINER` functions with broad execution grants. Enabling RLS wholesale would be unsafe because the current React application, Employee portal, Reseller portal and SAGS POS use direct Supabase calls.

## Production-safe rollout order

1. Inventory every browser/API path by actor: Owner, Manager, Payroll, HR, Supervisor, Employee portal, Reseller portal and SAGS POS.
2. Classify each table/RPC as read-only, own-row, outlet-scoped, role-scoped or owner-only.
3. Create policies first on a Supabase development branch, never directly on production.
4. Add explicit tests for login, attendance punches, payroll reads, cash advances, invoices/returns/orders, inventory, POS sales/voids, reseller access and owner-only actions.
5. Review `SECURITY DEFINER` RPCs individually. Do not revoke anon/authenticated access merely because the linter flags it; several portal authentication RPCs may intentionally need controlled public execution.
6. Only after branch tests pass, schedule a separate production migration with rollback SQL and immediate smoke tests.

## High-priority exposed data groups

- payroll / employee / attendance / break data
- daily sales and expenses
- inventory and stock movements
- reseller accounts, orders, payments, returns and invoices
- production records and recipes
- cash reconciliations and bank deposits
- POS products, sales and inventory movements

## Guardrail

No RLS or grant change is bundled with the egress patch. This prevents a performance fix from becoming an authorization outage.
