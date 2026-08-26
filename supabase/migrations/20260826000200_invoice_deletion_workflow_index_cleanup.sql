begin;

-- Existing composite indexes already cover invoice_id as their leading column.
-- Keep only the indexes that add a new lookup path for the approval workflow.
drop index if exists public.delivery_invoice_items_invoice_id_idx;
drop index if exists public.reseller_payments_invoice_id_idx;
drop index if exists public.reseller_returns_invoice_id_idx;

notify pgrst, 'reload schema';

commit;
