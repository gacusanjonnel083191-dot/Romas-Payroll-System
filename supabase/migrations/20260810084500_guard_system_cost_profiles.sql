-- Keep the canonical labor and delivery profiles from being accidentally
-- converted back to fixed-zero profiles or renamed.

create or replace function public.enforce_system_cost_profile_invariants()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := case
    when tg_op = 'UPDATE' and tg_table_name = 'cost_labor_profiles'
         and old.profile_name in ('Light Handling','Standard Handling','Heavy Handling','No Labor')
      then old.profile_name
    when tg_op = 'UPDATE' and tg_table_name = 'cost_delivery_profiles'
         and old.profile_name in ('Standard Route','Far Route','Commissary Pickup')
      then old.profile_name
    else new.profile_name
  end;

  new.profile_name := v_name;

  if tg_table_name = 'cost_labor_profiles' then
    if v_name = 'Light Handling' then
      new.uses_company_allocation := true;
      new.allocation_multiplier := 0.85;
      new.fixed_cost_per_piece := 0;
    elsif v_name = 'Standard Handling' then
      new.uses_company_allocation := true;
      new.allocation_multiplier := 1;
      new.fixed_cost_per_piece := 0;
    elsif v_name = 'Heavy Handling' then
      new.uses_company_allocation := true;
      new.allocation_multiplier := 1.25;
      new.fixed_cost_per_piece := 0;
    elsif v_name = 'No Labor' then
      new.uses_company_allocation := false;
      new.allocation_multiplier := 1;
      new.fixed_cost_per_piece := 0;
      new.is_default := false;
    end if;
  elsif tg_table_name = 'cost_delivery_profiles' then
    if v_name = 'Standard Route' then
      new.uses_company_allocation := true;
      new.allocation_multiplier := 1;
      new.fixed_cost_per_piece := 0;
    elsif v_name = 'Far Route' then
      new.uses_company_allocation := true;
      new.allocation_multiplier := 1.25;
      new.fixed_cost_per_piece := 0;
    elsif v_name = 'Commissary Pickup' then
      new.uses_company_allocation := false;
      new.allocation_multiplier := 1;
      new.fixed_cost_per_piece := 0;
      new.is_default := false;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_system_cost_profile_invariants() from public, anon, authenticated;

drop trigger if exists trg_guard_system_labor_profiles on public.cost_labor_profiles;
create trigger trg_guard_system_labor_profiles
before insert or update on public.cost_labor_profiles
for each row execute function public.enforce_system_cost_profile_invariants();

drop trigger if exists trg_guard_system_delivery_profiles on public.cost_delivery_profiles;
create trigger trg_guard_system_delivery_profiles
before insert or update on public.cost_delivery_profiles
for each row execute function public.enforce_system_cost_profile_invariants();

-- Pass existing canonical rows through the new guard once.
update public.cost_labor_profiles
set profile_name = profile_name
where profile_name in ('Light Handling','Standard Handling','Heavy Handling','No Labor');

update public.cost_delivery_profiles
set profile_name = profile_name
where profile_name in ('Standard Route','Far Route','Commissary Pickup');

notify pgrst, 'reload schema';
