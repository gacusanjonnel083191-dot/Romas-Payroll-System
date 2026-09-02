-- Link an employee charge to the document that authorized it.
-- The unique index makes the owner action idempotent: one charge slip can
-- create at most one employee charge, even after refreshes or repeated taps.

alter table public.employee_charges
  add column if not exists company_document_record_id uuid
  references public.company_document_records(id) on delete set null;

create unique index if not exists employee_charges_company_document_record_uidx
  on public.employee_charges(company_document_record_id)
  where company_document_record_id is not null;

create index if not exists employee_charges_status_created_at_idx
  on public.employee_charges(status, created_at desc);

comment on column public.employee_charges.company_document_record_id is
  'Source company document record. Unique when present to prevent duplicate employee charges from one charge slip.';
