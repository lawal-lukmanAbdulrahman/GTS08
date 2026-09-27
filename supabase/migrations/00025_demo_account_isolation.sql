-- Demo account isolation (Amendment 002, revised).
--
-- Which data a request sees now depends on WHO is signed in, not on a shop-wide
-- switch: an account marked is_demo sees the demo data (everything recorded
-- while the app was being built), and everyone else, including anonymous
-- storefront visitors, sees the live shop only.
--
-- 00024 split the business records (orders, customers, tickets, logs...). This
-- extends the split to the catalogue and storefront content, so the live shop
-- starts empty, and makes the mode per user. Nothing is deleted.

-- 1. Which accounts are demo accounts. Protected by guard_user_privileged_columns
--    (00013): a user can't flip their own flag, only the server can.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- 2. The mode of the signed-in user. Used by the RLS isolation policies and as the
--    default for new rows written with the public or signed-in key. The server
--    (service role, no auth.uid()) gets false and stamps demo rows explicitly.
CREATE OR REPLACE FUNCTION public.gts_is_test_mode()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.is_demo FROM public.users u WHERE u.id = auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.gts_is_test_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gts_is_test_mode() TO anon, authenticated, service_role;

-- settings.data_mode (00024) is no longer read; left in place so nothing breaks.

-- 3. The catalogue and storefront content become per-mode too. Existing rows are demo data.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'product_variants', 'product_images', 'inventory', 'categories', 'brands',
    'promos', 'product_flags', 'content_slots', 'size_guides', 'reviews', 'product_drafts',
    'hero_carousel'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT true', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN is_test SET DEFAULT public.gts_is_test_mode()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (is_test)', 'idx_' || t || '_is_test', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'gts_mode_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (is_test = (SELECT public.gts_is_test_mode())) WITH CHECK (is_test = (SELECT public.gts_is_test_mode()))',
      'gts_mode_isolation', t
    );
  END LOOP;
END $$;

-- 4. Names and codes only need to be unique within one mode: a real product may
--    use the same slug or SKU as a demo one. Replace each single-column unique
--    constraint with one on (column, is_test).
DO $$
DECLARE
  spec TEXT[];
  con RECORD;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['products', 'slug'], ARRAY['products', 'sku'],
    ARRAY['categories', 'slug'],
    ARRAY['brands', 'name'], ARRAY['brands', 'slug'],
    ARRAY['promos', 'code'],
    ARRAY['content_slots', 'slot_key']
  ]
  LOOP
    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.conrelid = ('public.' || spec[1])::regclass
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 1
        AND a.attname = spec[2]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec[1], con.conname);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', spec[1], 'uq_' || spec[1] || '_' || spec[2] || '_mode');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%I, is_test)', spec[1], 'uq_' || spec[1] || '_' || spec[2] || '_mode', spec[2]);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.idx_variant_sku;
DROP INDEX IF EXISTS public.idx_variant_barcode;
CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_sku_mode ON public.product_variants (sku, is_test) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_barcode_mode ON public.product_variants (barcode, is_test) WHERE barcode IS NOT NULL;

-- 5. Product search (00022) runs with the server key, which bypasses RLS, so it
--    takes the mode as a parameter. The old callers' named arguments still match
--    (the new parameter defaults to live).
DROP FUNCTION IF EXISTS public.search_products(TEXT, INT, INT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.search_products(
  search_query TEXT,
  result_limit INT DEFAULT 30,
  result_offset INT DEFAULT 0,
  category_filter TEXT DEFAULT NULL,
  active_only BOOLEAN DEFAULT TRUE,
  data_is_test BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  base_price NUMERIC,
  compare_at_price NUMERIC,
  status TEXT,
  is_featured BOOLEAN,
  total_sold INT,
  average_rating NUMERIC,
  review_count INT,
  category_id UUID,
  relevance REAL
) AS $$
DECLARE
  ts_query tsquery;
  clean_query TEXT;
  words TEXT[];
  prefix_query TEXT;
BEGIN
  clean_query := trim(regexp_replace(search_query, '[^\w\s]', ' ', 'g'));
  IF clean_query = '' THEN
    RETURN;
  END IF;

  words := regexp_split_to_array(lower(clean_query), '\s+');
  words := array_remove(words, '');
  prefix_query := array_to_string(
    ARRAY(SELECT w || ':*' FROM unnest(words) AS w WHERE length(w) >= 2),
    ' & '
  );

  BEGIN
    ts_query := to_tsquery('english', prefix_query);
  EXCEPTION WHEN OTHERS THEN
    ts_query := plainto_tsquery('english', clean_query);
  END;

  RETURN QUERY
    SELECT
      p.id, p.name::TEXT, p.slug::TEXT, p.base_price::NUMERIC, p.compare_at_price::NUMERIC,
      p.status::TEXT, p.is_featured, p.total_sold, p.average_rating::NUMERIC, p.review_count,
      p.category_id,
      (
        ts_rank_cd(p.fts, ts_query, 32) * 10.0 +
        CASE WHEN p.is_featured THEN 2.0 ELSE 0.0 END +
        LEAST(coalesce(p.total_sold, 0)::real / 100.0, 3.0) +
        LEAST(coalesce(p.average_rating, 0)::real / 2.0, 2.5)
      )::real AS relevance
    FROM products p
    WHERE p.fts @@ ts_query
      AND p.is_test = data_is_test
      AND (NOT active_only OR p.status = 'active')
      AND (category_filter IS NULL OR p.category_id::text = category_filter)
    ORDER BY relevance DESC
    LIMIT result_limit OFFSET result_offset;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT
        p.id, p.name::TEXT, p.slug::TEXT, p.base_price::NUMERIC, p.compare_at_price::NUMERIC,
        p.status::TEXT, p.is_featured, p.total_sold, p.average_rating::NUMERIC, p.review_count,
        p.category_id,
        (
          similarity(lower(p.name), lower(clean_query)) * 8.0 +
          CASE WHEN lower(p.name) ILIKE '%' || lower(clean_query) || '%' THEN 5.0 ELSE 0.0 END +
          CASE WHEN p.is_featured THEN 2.0 ELSE 0.0 END +
          LEAST(coalesce(p.total_sold, 0)::real / 100.0, 3.0) +
          LEAST(coalesce(p.average_rating, 0)::real / 2.0, 2.5)
        )::real AS relevance
      FROM products p
      WHERE p.is_test = data_is_test
        AND (NOT active_only OR p.status = 'active')
        AND (category_filter IS NULL OR p.category_id::text = category_filter)
        AND (
          similarity(lower(p.name), lower(clean_query)) > 0.15
          OR lower(p.name) ILIKE '%' || lower(clean_query) || '%'
          OR lower(coalesce(p.description, '')) ILIKE '%' || lower(clean_query) || '%'
          OR lower(coalesce(p.short_description, '')) ILIKE '%' || lower(clean_query) || '%'
          OR lower(coalesce(p.material, '')) ILIKE '%' || lower(clean_query) || '%'
        )
      ORDER BY relevance DESC
      LIMIT result_limit OFFSET result_offset;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
