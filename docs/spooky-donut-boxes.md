# Spooky Donuts seasonal boxes

Owner-approved on October 26, 2026. Existing order approval, discount, invoice and collection rules remain in force.

| Sales unit | Retail per box | Shells | Rings | Donuts | Dry premix at 27 g/donut |
|---|---:|---:|---:|---:|---:|
| 6-piece box | PHP 160 | 3 | 3 | 6 | 162 g |
| 12-piece box | PHP 315 | 5 | 7 | 12 | 324 g |

Enter whole BOXES in orders, invoices, returns, POS stock and sales. The product name identifies the unit. Individual Halloween pieces are not orderable products. Existing invoice discount selection applies to the box price; for example 20% gives PHP 128 and PHP 252 per box.

Production planning expands boxes into the existing Shells and Rings master products and combines those pieces with ordinary production demand. The HALLOWEEN PACKING panel and production order print identify the seasonal allocation, already included in the variety totals. Log the component donuts once; do not log the sales boxes as extra manufactured output. Production reports also use expanded physical pieces. Approved orders/invoices and internal transfers retain their current eligibility rules.

POS catalogs receive only the two boxed products, with zero initial stock and unknown cost. Receive finished boxes through the existing outlet stock receiving workflow. Selling one box deducts one box, not the component Rings and Shells again. Where SAGS Internal Transfers is installed, transfer quantities for these products are boxes. Its existing missing-schema fallback is preserved.

Costing > Product Cost lists a Seasonal Boxes category. Recipe Vault contains two TEST recipes with the approved assortment. Exact Halloween toppings, fillings, packaging/liner quantities and labor have not been supplied; these recipes must remain incomplete. Do not interpret a zero/default recipe cost as a verified cost or margin. These products are assembly/sales units; the physical donut output is logged on their components.

No seasonal end date was supplied. There is no automatic date cutoff. Catalog availability follows the existing is_active flags; archive the seasonal master/POS products after the campaign, preserving historical records.

## Data change

Apply `supabase/data-changes/20261026_spooky_donut_boxes.sql` once after publishing the compatible application. It validates the existing components, inserts missing named master/POS products and draft recipes, and refuses conflicting existing setups. A rerun does not reset stock, prices, or historical transactions. No schema or permission changes.

## Rollback

Revert this code release and make the two named seasonal donut variants and their POS rows inactive; archive their recipe records. Preserve any orders, invoices, payments and sales. Do not delete records or reset stock. Before reverting code after orders exist, finish or cancel pending seasonal fulfillment through the normal owner-approved process: older code does not expand boxes into physical production pieces.
