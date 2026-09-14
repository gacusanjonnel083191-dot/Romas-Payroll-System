-- Remove only the 1 PM manual-order lock; preserve the existing trigger,
-- privileges, automatic-order staff-review guard, and all other validations.
-- Rollback: restore private.guard_reseller_order_write() from
-- 20260909050000_reseller_automatic_ordering.sql (function body only).
do $remove_manual_order_cutoff$
declare
  old_definition text;
  new_definition text;
  cutoff_block text := $cutoff$  if current_user='anon' and v_local::time >= time '13:00' and (v_local::date+1)=any(v_dates) then
    raise exception 'Tomorrow''s reseller order is locked after 1:00 PM Philippine time.';
  end if;
$cutoff$;
begin
  old_definition := pg_get_functiondef('private.guard_reseller_order_write()'::regprocedure);
  if (length(old_definition) - length(replace(old_definition, cutoff_block, ''))) <> length(cutoff_block) then
    raise exception 'Manual order cutoff migration stopped: expected exactly one known cutoff block. Review the current function before applying.';
  end if;
  new_definition := replace(old_definition, cutoff_block, '');
  execute new_definition;
end;
$remove_manual_order_cutoff$;
