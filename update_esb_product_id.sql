-- Update product_id di tabel esb_harian berdasarkan lookup dari nama_product (case insensitive)
UPDATE public.esb_harian 
SET product_id = np.id_product
FROM public.nama_product np
WHERE LOWER(esb_harian.product) = LOWER(np.product_name)
  AND esb_harian.product_id IS NULL;

-- Verifikasi hasil update
SELECT 
  sales_date,
  branch,
  product,
  product_id,
  qty_total
FROM public.esb_harian 
WHERE product_id IS NOT NULL
ORDER BY sales_date DESC, branch, product
LIMIT 10;