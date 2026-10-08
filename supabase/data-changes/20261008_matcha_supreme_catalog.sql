-- Prepared production data migration; intentionally NOT executed by GitHub push.
-- Add Matcha Supreme at PHP 30 and archive retired variants without erasing history.
-- Shells and Rings have the SAME dry-premix rate (27 g/piece), but different batch yields.
-- Shells' active batch yield is used provisionally pending actual Matcha Supreme measurements.
BEGIN;
DO $catalog$
DECLARE
  v_matcha uuid;
  v_shells_yield numeric;
BEGIN
  IF (SELECT count(*) FROM public.donut_variants WHERE lower(btrim(name)) = 'matcha supreme') > 1 THEN
    RAISE EXCEPTION 'Duplicate Matcha Supreme master products already exist.';
  END IF;
  SELECT pieces_per_batch INTO v_shells_yield
  FROM public.donut_variants WHERE lower(btrim(name))='shells' AND is_active IS TRUE;
  IF v_shells_yield IS NULL OR v_shells_yield <= 0 THEN
    RAISE EXCEPTION 'Active Shells yield unavailable; refusing guessed value.';
  END IF;
  SELECT id INTO v_matcha FROM public.donut_variants WHERE lower(btrim(name)) = 'matcha supreme';
  IF v_matcha IS NULL THEN
    INSERT INTO public.donut_variants
      (name, category, selling_price, pieces_per_batch, is_active,
       equivalent_unit_factor, equivalent_unit_note, normal_daily_pieces,
       is_manufactured, requires_company_delivery)
    VALUES
      ('Matcha Supreme','Premium',30,v_shells_yield,TRUE,1,
       '27g dry premix per piece; Shells batch yield is provisional until measured.',0,TRUE,TRUE)
    RETURNING id INTO v_matcha;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.donut_variants WHERE id=v_matcha AND selling_price=30 AND is_active IS TRUE) THEN
      RAISE EXCEPTION 'Unexpected existing Matcha Supreme price/status. Review required.';
    END IF;
  END IF;

  -- Preserve all historical invoices, recipe cost items, and production transactions.
  UPDATE public.donut_variants SET is_active=FALSE
  WHERE lower(btrim(name)) IN ('cinnamon rolls','biscoreo') AND is_active IS DISTINCT FROM FALSE;
  UPDATE public.recipe_vault SET status='archived',updated_at=NOW()
  WHERE lower(btrim(product_name)) IN ('cinnamon rolls','biscoreo') AND status IS DISTINCT FROM 'archived';
  UPDATE public.pos_products SET is_active=FALSE,updated_at=NOW()
  WHERE lower(btrim(product_name)) IN ('cinnamon rolls','biscoreo') AND is_active IS DISTINCT FROM FALSE;

  -- Draft only: owner must supply actual finishing ingredients, unit costs, and instructions.
  IF NOT EXISTS (SELECT 1 FROM public.recipe_vault WHERE linked_variant_id=v_matcha OR lower(btrim(product_name))='matcha supreme') THEN
    INSERT INTO public.recipe_vault
      (recipe_code,product_name,product_category,linked_variant_id,selling_price,
       reseller_price,batch_yield_pieces,batch_size_label,status,procedure,notes,created_by,updated_by)
    VALUES
      ('MATCHA-SUPREME-DRAFT-20261008','Matcha Supreme','Premium',v_matcha,30,24,
       v_shells_yield,'Provisional Shells-size reference batch','test',
       'DRAFT: owner-approved ingredients and procedure required before activation.',
       '27g dry premix/piece. Finish ingredients, yield, costs, labor, packaging and quality controls require verification.',
       'system','system');
  END IF;

  -- Separate POS outlet product: no invented stock or material cost.
  INSERT INTO public.pos_products
    (id,product_name,category,selling_price,cost,stock,min_stock,is_active,
     outlet_id,daily_tracking_mode,standard_daily_qty)
  SELECT 'MSUP-'||replace(coalesce(r.outlet_id,'DEFAULT'),'OUTLET-',''),
         'Matcha Supreme',r.category,30,NULL,0,0,TRUE,r.outlet_id,r.daily_tracking_mode,0
  FROM public.pos_products r
  WHERE lower(btrim(r.product_name))='rings' AND r.outlet_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pos_products existing WHERE existing.outlet_id=r.outlet_id
      AND lower(btrim(existing.product_name))='matcha supreme'
  );
END $catalog$;
COMMIT;
-- Verify after separately authorized execution:
-- SELECT name,selling_price,pieces_per_batch,is_active FROM public.donut_variants
--  WHERE lower(btrim(name)) IN ('matcha supreme','cinnamon rolls','biscoreo');
