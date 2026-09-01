create or replace function public.sync_resolved_payslip_dispute_acknowledgement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if lower(btrim(coalesce(new.status, ''))) = 'resolved'
     and lower(btrim(coalesce(old.status, ''))) is distinct from 'resolved'
     and nullif(btrim(coalesce(new.payroll_record_id, '')), '') is not null then
    update public.payroll_records
    set employee_acknowledgement = 'pending'
    where id::text = btrim(new.payroll_record_id)
      and lower(btrim(coalesce(employee_acknowledgement, ''))) = 'disputed'
      and coalesce(payroll_approved, false) = false
      and approved_at is null;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_resolved_payslip_dispute_acknowledgement() from public, anon, authenticated;

drop trigger if exists sync_resolved_payslip_dispute_acknowledgement
on public.payslip_disputes;

create trigger sync_resolved_payslip_dispute_acknowledgement
after update of status on public.payslip_disputes
for each row
execute function public.sync_resolved_payslip_dispute_acknowledgement();
