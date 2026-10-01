-- Restore the Supervisor's ability to prepare their own Charge Slip drafts.
-- The September 23 document policies intentionally protect payroll/COE records,
-- but also blocked the Charge Slip draft available in the Documents Center.
-- NTE (DISC-NTE) access is already covered by the existing staff policies.
-- Keep those policies intact; add only authenticated, own, unapproved draft access.
-- No employee charge, payroll deduction, approval or historical record is changed.
-- Rollback: drop the three company_documents_supervisor_charge_draft_* policies.
drop policy if exists company_documents_supervisor_charge_draft_read on public.company_document_records;
create policy company_documents_supervisor_charge_draft_read
  on public.company_document_records for select to authenticated
  using (
    form_key = 'FIN-CHARGE-SLIP'
    and status = 'draft'
    and owner_approved_by is null
    and owner_approved_at is null
    and private.cash_advance_admin_has_role(array['supervisor'])
    and exists (
      select 1 from public.admin_users au
      where au.auth_user_id = (select auth.uid())
        and au.is_active = true
        and company_document_records.created_by = au.full_name
    )
  );

drop policy if exists company_documents_supervisor_charge_draft_insert on public.company_document_records;
create policy company_documents_supervisor_charge_draft_insert
  on public.company_document_records for insert to authenticated
  with check (
    form_key = 'FIN-CHARGE-SLIP'
    and status = 'draft'
    and owner_approved_by is null
    and owner_approved_at is null
    and private.cash_advance_admin_has_role(array['supervisor'])
    and exists (
      select 1 from public.admin_users au
      where au.auth_user_id = (select auth.uid())
        and au.is_active = true
        and company_document_records.created_by = au.full_name
    )
  );

drop policy if exists company_documents_supervisor_charge_draft_update on public.company_document_records;
create policy company_documents_supervisor_charge_draft_update
  on public.company_document_records for update to authenticated
  using (
    form_key = 'FIN-CHARGE-SLIP'
    and status = 'draft'
    and owner_approved_by is null
    and owner_approved_at is null
    and private.cash_advance_admin_has_role(array['supervisor'])
    and exists (
      select 1 from public.admin_users au
      where au.auth_user_id = (select auth.uid())
        and au.is_active = true
        and company_document_records.created_by = au.full_name
    )
  )
  with check (
    form_key = 'FIN-CHARGE-SLIP'
    and status = 'draft'
    and owner_approved_by is null
    and owner_approved_at is null
    and private.cash_advance_admin_has_role(array['supervisor'])
    and exists (
      select 1 from public.admin_users au
      where au.auth_user_id = (select auth.uid())
        and au.is_active = true
        and company_document_records.created_by = au.full_name
    )
  );

notify pgrst, 'reload schema';
