-- Owner authorized the two fixed seasonal boxes. No historical transactions change.
-- Main-app quantities and POS stock for these products are BOXES, never loose donuts.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('romas_spooky_donut_boxes_20261026'));
DO $catalog$
DECLARE
  box record;
  variant_id uuid;
  outlet record;
BEGIN
  IF (SELECT count(*) FROM public.donut_variants WHERE name IN ('Shells','Rings') AND is_active IS TRUE) <> 2
    OR (SELECT count(DISTINCT name) FROM public.donut_variants WHERE name IN ('Shells','Rings') AND is_active IS TRUE) <> 2 THEN
    RAISE EXCEPTION 'Exactly one active Shells and Rings master product is required.';
  END IF;
  FOR box IN SELECT * FROM (VALUES
    ('Spooky Donuts - 6-piece box','SPOOKY-6',160,6,3,3),
    ('Spooky Donuts - 12-piece box','SPOOKY-12',315,12,5,7)
  ) AS b(name,code,price,pieces,shells,rings)
  LOOP
    IF (SELECT count(*) FROM public.donut_variants WHERE lower(btrim(name))=lower(box.name)) > 1 THEN
      RAISE EXCEPTION 'Duplicate seasonal product: %',box.name;
    END IF;
    SELECT id INTO variant_id FROM public.donut_variants WHERE lower(btrim(name))=lower(box.name);
    IF variant_id IS NULL THEN
      INSERT INTO public.donut_variants
        (name,category,selling_price,pieces_per_batch,is_active,normal_daily_pieces,
         is_manufactured,requires_company_delivery,equivalent_unit_factor,equivalent_unit_note,cost_override_notes)
      VALUES (box.name,'Seasonal Boxes',box.price,1,TRUE,0,FALSE,FALSE,1,
        format('Sales/packing unit: 1 box = %s Shells + %s Rings (%s donuts). Forecast expands components once.',box.shells,box.rings,box.pieces),
        'INCOMPLETE COST: exact Halloween decorations and box/liner quantities and prices require owner input. Do not use as a verified margin.')
      RETURNING id INTO variant_id;
    ELSIF NOT EXISTS (SELECT 1 FROM public.donut_variants WHERE id=variant_id AND selling_price=box.price AND category='Seasonal Boxes' AND pieces_per_batch=1 AND is_active IS TRUE) THEN
      RAISE EXCEPTION 'Existing seasonal product differs from approved setup: %',box.name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.recipe_vault WHERE linked_variant_id=variant_id OR recipe_code=box.code||'-2026') THEN
      INSERT INTO public.recipe_vault
        (recipe_code,product_name,product_category,linked_variant_id,batch_size_label,batch_yield_pieces,
         selling_price,reseller_price,status,procedure,finishing_instructions,notes,created_by,updated_by)
      VALUES (box.code||'-2026',box.name,'Seasonal Boxes',variant_id,'1 finished box',1,
        box.price,box.price*0.8,'test',
        format('Pack %s Halloween Shells and %s Halloween Rings per box. Log the component donuts in production once; do not log the sales box as extra donut output.',box.shells,box.rings),
        'Use approved Halloween designs. Exact finishing ingredients, amounts, packaging and labor must be verified before costing approval.',
        'Owner-approved assortment and retail price. Draft recipe: costs are incomplete; invoice discounts follow existing system flow. No automatic end date has been supplied.',
        'Owner-authorized seasonal setup 2026-10-26','Owner-authorized seasonal setup 2026-10-26');
    END IF;

    FOR outlet IN SELECT DISTINCT outlet_id,category,daily_tracking_mode FROM public.pos_products
      WHERE lower(btrim(product_name))='rings' AND is_active IS TRUE AND outlet_id IS NOT NULL
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.pos_products WHERE outlet_id=outlet.outlet_id AND lower(btrim(product_name))=lower(box.name)) THEN
        INSERT INTO public.pos_products
          (id,sku,product_name,category,selling_price,cost,stock,min_stock,is_active,outlet_id,daily_tracking_mode,standard_daily_qty)
        VALUES (box.code||'-'||outlet.outlet_id,box.code,box.name,outlet.category,box.price,NULL,0,0,TRUE,outlet.outlet_id,coalesce(outlet.daily_tracking_mode,'none'),0);
      ELSIF NOT EXISTS (SELECT 1 FROM public.pos_products WHERE outlet_id=outlet.outlet_id AND lower(btrim(product_name))=lower(box.name) AND selling_price=box.price AND is_active IS TRUE) THEN
        RAISE EXCEPTION 'Existing POS box differs from approved setup: %',box.name;
      END IF;
    END LOOP;
  END LOOP;
END $catalog$;
COMMIT;
