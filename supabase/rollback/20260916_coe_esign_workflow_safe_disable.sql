-- Safe-disable rollback for Roma's Donuts COE e-signature workflow.
-- Intentionally preserves signature/audit tables and stored files for evidence retention.
-- Run only with explicit rollback authorization and after the app code has been rolled back.

begin;

drop policy if exists coe_signatures_select on storage.objects;
drop policy if exists coe_signatures_insert on storage.objects;
drop policy if exists coe_signatures_update_profile on storage.objects;
drop policy if exists coe_signatures_delete on storage.objects;

revoke execute on function public.get_my_coe_signatory_profile() from authenticated;
revoke execute on function public.list_active_coe_signatories() from authenticated;
revoke execute on function public.list_coe_signatory_candidates() from authenticated;
revoke execute on function public.set_coe_authorized_signatory(uuid,boolean,text) from authenticated;
revoke execute on function public.set_my_coe_signature_profile(text) from authenticated;
revoke execute on function public.request_coe_signature(uuid,uuid,text) from authenticated;
revoke execute on function public.get_coe_signature_state(uuid) from authenticated;
revoke execute on function public.list_my_coe_signature_inbox() from authenticated;
revoke execute on function public.return_coe_signature_request(uuid,text) from authenticated;
revoke execute on function public.approve_coe_signature_request(uuid,text,text) from authenticated;
revoke execute on function public.invalidate_coe_signature_if_changed(uuid,text) from authenticated;
revoke execute on function public.log_coe_signature_output(uuid,text) from authenticated;
revoke execute on function public.coe_signature_storage_can_read(text) from authenticated;
revoke execute on function public.coe_signature_storage_can_write(text,text) from authenticated;

commit;
