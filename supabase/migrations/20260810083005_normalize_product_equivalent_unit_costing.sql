-- Normalize shared product costs with equivalent production units.
-- Direct ingredients and packaging remain product-specific. Shared labor,
-- utilities, overhead, depreciation, delivery, and admin pools are allocated
-- against the normalized daily product mix.

alter table public.donut_variants
  add column if not exists equivalent_unit_factor numeric not null default 1,
  add column if not exists equivalent_unit_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.donut_variants'::regclass
      and conname = 'donut_variants_equivalent_unit_factor_check'
  ) then
    alter table public.donut_variants
      add constraint donut_variants_equivalent_unit_factor_check
      check (equivalent_unit_factor > 0 and equivalent_unit_factor <= 10);
  end if;
end $$;

comment on column public.donut_variants.equivalent_unit_factor is
  'Shared-cost weight relative to one standard large donut. This is based on size/resource use, never selling price.';
comment on column public.donut_variants.normal_daily_pieces is
  'Normal product-mix quantity used as a relative weight. The costing engine normalizes the mix to cost_settings.total_daily_pieces.';

-- Starting operational factors approved for this rollout. They remain editable
-- per product and should be replaced by verified finished-weight studies.
update public.donut_variants
set equivalent_unit_factor = case
      when category = 'Bites' then 0.25
      when category = 'Glaze Circlet' then 0.75
      else 1.00
    end,
    equivalent_unit_note = case
      when category = 'Bites' then 'Initial bite-size factor; verify using actual finished weight versus a standard large donut.'
      when category = 'Glaze Circlet' then 'Initial smaller-piece factor; verify using actual finished weight versus a standard large donut.'
      else 'Standard large-donut baseline; verify if this product is materially smaller or larger.'
    end
where equivalent_unit_note is null;

-- Use the recent delivered product mix as the initial allocation mix, scaled
-- to the company's saved normal daily output. This does not change sales,
-- invoices, recipes, yields, or prices.
with daily_variant as (
  select
    dii.variant_id,
    di.delivery_date,
    sum(greatest(coalesce(dii.quantity, 0), 0))::numeric as pieces
  from public.delivery_invoice_items dii
  join public.delivery_invoices di on di.id = dii.invoice_id
  where di.delivery_date between current_date - interval '60 days' and current_date
    and coalesce(lower(di.status), '') not in ('cancelled', 'canceled', 'void', 'deleted')
  group by dii.variant_id, di.delivery_date
), normal_mix as (
  select variant_id, avg(pieces)::numeric as avg_daily_pieces
  from daily_variant
  group by variant_id
), mix_total as (
  select sum(avg_daily_pieces)::numeric as total_avg_daily_pieces
  from normal_mix
), company_output as (
  select greatest(coalesce(max(total_daily_pieces), 0), 0)::numeric as total_daily_pieces
  from public.cost_settings
)
update public.donut_variants dv
set normal_daily_pieces = round(
  nm.avg_daily_pieces
  * case
      when mt.total_avg_daily_pieces > 0 and co.total_daily_pieces > 0
        then co.total_daily_pieces / mt.total_avg_daily_pieces
      else 1
    end,
  2
)
from normal_mix nm
cross join mix_total mt
cross join company_output co
where dv.id = nm.variant_id
  and coalesce(dv.normal_daily_pieces, 0) = 0;

-- Repair the reusable profiles that were accidentally changed to fixed zero.
update public.cost_labor_profiles
set uses_company_allocation = true,
    allocation_multiplier = case profile_name
      when 'Light Handling' then 0.85
      when 'Heavy Handling' then 1.25
      else 1.00
    end,
    fixed_cost_per_piece = 0,
    is_default = (profile_name = 'Standard Handling'),
    updated_by = 'Equivalent-unit costing migration',
    updated_at = now()
where profile_name in ('Light Handling', 'Standard Handling', 'Heavy Handling');

update public.cost_labor_profiles
set uses_company_allocation = false,
    allocation_multiplier = 1,
    fixed_cost_per_piece = 0,
    is_default = false,
    updated_by = 'Equivalent-unit costing migration',
    updated_at = now()
where profile_name = 'No Labor';

update public.cost_delivery_profiles
set uses_company_allocation = true,
    allocation_multiplier = case profile_name
      when 'Far Route' then 1.25
      else 1.00
    end,
    fixed_cost_per_piece = 0,
    is_default = (profile_name = 'Standard Route'),
    updated_by = 'Equivalent-unit costing migration',
    updated_at = now()
where profile_name in ('Standard Route', 'Far Route');

update public.cost_delivery_profiles
set uses_company_allocation = false,
    allocation_multiplier = 1,
    fixed_cost_per_piece = 0,
    is_default = false,
    updated_by = 'Equivalent-unit costing migration',
    updated_at = now()
where profile_name = 'Commissary Pickup';

-- New overload used by the normalized frontend. The previous signature remains
-- available temporarily so an older open browser tab does not stop saving.
create or replace function public.save_variant_cost_setup(
  p_variant_id uuid,
  p_pieces_per_batch numeric,
  p_selling_price numeric,
  p_packaging_profile_id uuid default null,
  p_labor_profile_id uuid default null,
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
  uuid,numeric,numeric,uuid,uuid,uuid,numeric,numeric,numeric,text,numeric,numeric,text,boolean,boolean,boolean,boolean,boolean,text
) from public;
grant execute on function public.save_variant_cost_setup(
  uuid,numeric,numeric,uuid,uuid,uuid,numeric,numeric,numeric,text,numeric,numeric,text,boolean,boolean,boolean,boolean,boolean,text
) to anon, authenticated;

notify pgrst, 'reload schema';
