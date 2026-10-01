-- Prepared only. Apply after explicit approval to change the live product catalog.
-- No recipe, batch yield, or packaging/labor costs were supplied by the owner.
-- The 170g forecast rate is configured in src/App.jsx, independently of costing.
BEGIN;
LOCK TABLE public.donut_variants IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.donut_variants WHERE lower(btrim(name)) = 'giant donut') THEN
    RAISE EXCEPTION 'Giant Donut already exists; review it instead of overwriting or duplicating it.';
  END IF;
END $$;
INSERT INTO public.donut_variants (name, category, selling_price, pieces_per_batch, is_active)
VALUES ('Giant Donut', 'Giant', 219, NULL, true);
COMMIT;

-- Verification after an approved apply:
SELECT id, name, category, selling_price, pieces_per_batch, is_active
FROM public.donut_variants WHERE lower(btrim(name)) = 'giant donut';
