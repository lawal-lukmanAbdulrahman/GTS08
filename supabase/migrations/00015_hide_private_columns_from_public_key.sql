-- The public (anon) API key is in every browser. With it, anyone could ask Supabase's own REST API for
-- products.cost_price (our margin) and every settings column (tax rate, thresholds). The row policies
-- allow reading a product or the settings row; nothing stopped them reading every COLUMN of it.
--
-- This limits what the public and signed-in roles may SELECT to the columns the storefront actually
-- shows. The server (service role) is unaffected: it bypasses these grants, and the app reads costs
-- and settings only through it.
--
-- NOTE for future migrations: a column added to `products` later is NOT readable by the public key until
-- it is granted here on purpose. That is the safe default for a private table.

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name <> 'cost_price';

  REVOKE SELECT ON public.products FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon, authenticated', cols);
END $$;

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'settings'
    AND column_name IN ('id', 'store_name', 'store_address', 'support_phone', 'whatsapp_number', 'support_email', 'store_website');

  REVOKE SELECT ON public.settings FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.settings TO anon, authenticated', cols);
END $$;
