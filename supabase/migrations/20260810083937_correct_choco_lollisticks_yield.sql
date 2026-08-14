-- Persist the verified Choco Lollisticks sellable batch yield entered in the
-- product editor. This correction is deliberately narrow and does not alter
-- its recipe, retail price, profiles, or product-mix allocation.

update public.donut_variants
set pieces_per_batch = 136,
    cost_setup_updated_at = now(),
    cost_setup_updated_by = 'Verified costing normalization migration'
where name = 'Choco Lollisticks'
  and is_active = true
  and pieces_per_batch = 30;
