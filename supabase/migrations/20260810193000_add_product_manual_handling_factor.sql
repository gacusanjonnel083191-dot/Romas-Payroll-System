-- Allow each product to override the reusable labor-profile multiplier while
-- keeping the company labor pool normalized across the full product mix.

alter table public.donut_variants
  add column if not exists labor_handling_factor numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.donut_variants'::regclass
      and conname = 'donut_variants_labor_handling_factor_check'
  ) then
    alter table public.donut_variants
      add constraint donut_variants_labor_handling_factor_check
      check (labor_handling_factor is null or (labor_handling_factor > 0 and labor_handling_factor <= 5));
  end if;
end $$;

comment on column public.donut_variants.labor_handling_factor is
  'Optional product-specific labor handling multiplier. NULL uses the assigned labor profile multiplier. It is normalized against the company labor pool and is separate from product size/EU.';

create or replace function public.save_variant_cost_setup(
  p_variant_id uuid,
  p_pieces_per_batch numeric,
  p_selling_price numeric,
  p_packaging_profile_id uuid default null,
  p_labor_profile_id uuid default null,
  p_labor_handling_factor numeric default null,
  p_delivery_profile_id uuid default null,
  p_packaging_cost_per_piece numeric default 0,
  p_labor_cost_per_batch numeric default 0,
  p_delivery_cost_per_piece numeric default 0,
  p_cost_override_notes text default null,
  p_normal_daily_pieces numeric default 0,
  p_equivalent_unit_factor numeric default 1,
  p_equivalent_unit_note text default null,
  p_packaging_override_enabled boolean default false,
  p_labor_override_enabled boolean default false,
  p_delivery_override_enabled boolean default false,
  p_is_manufactured boolean default true,
  p_requires_company_delivery boolean default true,
  p_updated_by text default null
)
returns public.donut_variants
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_saved public.donut_variants;
  v_labor public.cost_labor_profiles;
  v_delivery public.cost_delivery_profiles;
begin
  if p_variant_id is null then raise exception 'A product ID is required.'; end if;
  if coalesce(p_pieces_per_batch, 0) <= 0 then raise exception 'Actual sellable pieces per batch must be greater than zero.'; end if;
  if coalesce(p_selling_price, 0) < 0 or coalesce(p_normal_daily_pieces, 0) < 0 then
    raise exception 'Price and normal daily product-mix pieces cannot be negative.';
  end if;
  if coalesce(p_equivalent_unit_factor, 0) <= 0 or coalesce(p_equivalent_unit_factor, 0) > 10 then
    raise exception 'Equivalent-unit factor must be greater than zero and no more than 10.';
  end if;
  if p_labor_handling_factor is not null
     and (p_labor_handling_factor <= 0 or p_labor_handling_factor > 5) then
    raise exception 'Manual handling factor must be greater than zero and no more than 5.';
  end if;
  if coalesce(p_packaging_cost_per_piece, 0) < 0
     or coalesce(p_labor_cost_per_batch, 0) < 0
     or coalesce(p_delivery_cost_per_piece, 0) < 0 then
    raise exception 'Cost overrides cannot be negative.';
  end if;

  if p_packaging_profile_id is not null
     and not exists (select 1 from public.cost_packaging_profiles where id = p_packaging_profile_id and is_active = true) then
    raise exception 'The selected packaging profile is missing or inactive.';
  end if;
  if p_labor_profile_id is not null then
    select * into v_labor from public.cost_labor_profiles where id = p_labor_profile_id and is_active = true;
    if v_labor.id is null then raise exception 'The selected labor profile is missing or inactive.'; end if;
  end if;
  if p_delivery_profile_id is not null then
    select * into v_delivery from public.cost_delivery_profiles where id = p_delivery_profile_id and is_active = true;
    if v_delivery.id is null then raise exception 'The selected delivery profile is missing or inactive.'; end if;
  end if;
  if p_is_manufactured and v_labor.id is not null
     and v_labor.uses_company_allocation = false
     and coalesce(v_labor.fixed_cost_per_piece, 0) = 0
     and not p_labor_override_enabled then
    raise exception 'A manufactured product cannot use No Labor.';
  end if;
  if p_labor_handling_factor is not null
     and v_labor.id is not null
     and v_labor.uses_company_allocation = false then
    raise exception 'A manual handling factor requires a company-allocation labor profile.';
  end if;
  if p_requires_company_delivery and v_delivery.id is not null
     and v_delivery.uses_company_allocation = false
     and coalesce(v_delivery.fixed_cost_per_piece, 0) = 0
     and not p_delivery_override_enabled then
    raise exception 'A delivered product cannot use Commissary Pickup.';
  end if;
  if (p_packaging_override_enabled or p_labor_override_enabled or p_delivery_override_enabled)
     and length(btrim(coalesce(p_cost_override_notes, ''))) < 8 then
    raise exception 'Document the reason for every enabled cost override.';
  end if;

  update public.donut_variants
  set pieces_per_batch = p_pieces_per_batch,
      selling_price = p_selling_price,
      packaging_profile_id = p_packaging_profile_id,
      labor_profile_id = p_labor_profile_id,
      labor_handling_factor = p_labor_handling_factor,
      delivery_profile_id = p_delivery_profile_id,
      packaging_cost_per_piece = coalesce(p_packaging_cost_per_piece, 0),
      labor_cost_per_batch = coalesce(p_labor_cost_per_batch, 0),
      delivery_cost_per_piece = coalesce(p_delivery_cost_per_piece, 0),
      normal_daily_pieces = coalesce(p_normal_daily_pieces, 0),
      equivalent_unit_factor = coalesce(p_equivalent_unit_factor, 1),
      equivalent_unit_note = nullif(btrim(coalesce(p_equivalent_unit_note, '')), ''),
      packaging_override_enabled = coalesce(p_packaging_override_enabled, false),
      labor_override_enabled = coalesce(p_labor_override_enabled, false),
      delivery_override_enabled = coalesce(p_delivery_override_enabled, false),
      is_manufactured = coalesce(p_is_manufactured, true),
      requires_company_delivery = coalesce(p_requires_company_delivery, true),
      cost_override_notes = nullif(btrim(coalesce(p_cost_override_notes, '')), ''),
      cost_setup_updated_at = now(),
      cost_setup_updated_by = nullif(btrim(coalesce(p_updated_by, '')), '')
  where id = p_variant_id and is_active = true
  returning * into v_saved;

  if v_saved.id is null then raise exception 'The selected active product was not found.'; end if;
  return v_saved;
end;
$$;

revoke execute on function public.save_variant_cost_setup(
  uuid,numeric,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric,text,numeric,numeric,text,boolean,boolean,boolean,boolean,boolean,text
) from public;
grant execute on function public.save_variant_cost_setup(
  uuid,numeric,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric,text,numeric,numeric,text,boolean,boolean,boolean,boolean,boolean,text
) to anon, authenticated;

notify pgrst, 'reload schema';
