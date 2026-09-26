-- GTS Search Infrastructure: PostgreSQL Full-Text Search + Trigram Fuzzy
-- ======================================================================

-- 1. Enable pg_trgm extension for fuzzy/typo-tolerant matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add a tsvector column for full-text search on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS fts tsvector;

-- 3. Populate the fts column with weighted fields
--    A = name (highest), B = brand/sku, C = category/tags, D = description
UPDATE products SET fts = (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(sku, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(material, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(short_description, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'D')
);

-- 4. GIN index for fast full-text queries
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(fts);

-- 5. Trigram index on name for fuzzy/typo-tolerant searching
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- 6. Trigger to auto-update fts column on INSERT/UPDATE
CREATE OR REPLACE FUNCTION products_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts := (
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.sku, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.material, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_fts ON products;
CREATE TRIGGER trg_products_fts
  BEFORE INSERT OR UPDATE OF name, sku, material, short_description, description
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_fts_trigger();

-- 7. Unified search function: FTS first, trigram fallback, popularity boost
--    Returns products ranked by relevance with typo tolerance
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT,
  result_limit INT DEFAULT 30,
  result_offset INT DEFAULT 0,
  category_filter TEXT DEFAULT NULL,
  active_only BOOLEAN DEFAULT TRUE
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
  -- Clean the input
  clean_query := trim(regexp_replace(search_query, '[^\w\s]', ' ', 'g'));
  IF clean_query = '' THEN
    RETURN;
  END IF;

  -- Build prefix tsquery: each word becomes prefix search (e.g., "hood" matches "hoodie")
  words := regexp_split_to_array(lower(clean_query), '\s+');
  words := array_remove(words, '');

  -- Build prefix query string: word1:* & word2:*
  prefix_query := array_to_string(
    ARRAY(SELECT w || ':*' FROM unnest(words) AS w WHERE length(w) >= 2),
    ' & '
  );

  BEGIN
    ts_query := to_tsquery('english', prefix_query);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: use plainto_tsquery if prefix parsing fails
    ts_query := plainto_tsquery('english', clean_query);
  END;

  -- Phase 1: Full-text search with prefix matching
  RETURN QUERY
    SELECT
      p.id, p.name, p.slug, p.base_price, p.compare_at_price,
      p.status, p.is_featured, p.total_sold, p.average_rating, p.review_count,
      p.category_id,
      (
        ts_rank_cd(p.fts, ts_query, 32) * 10.0 +           -- FTS relevance
        CASE WHEN p.is_featured THEN 2.0 ELSE 0.0 END +     -- Featured boost
        LEAST(coalesce(p.total_sold, 0)::real / 100.0, 3.0) + -- Popularity boost (capped)
        LEAST(coalesce(p.average_rating, 0)::real / 2.0, 2.5)  -- Rating boost (capped)
      )::real AS relevance
    FROM products p
    WHERE p.fts @@ ts_query
      AND (NOT active_only OR p.status = 'active')
      AND (category_filter IS NULL OR p.category_id::text = category_filter)
    ORDER BY relevance DESC
    LIMIT result_limit OFFSET result_offset;

  -- Phase 2: If FTS returned 0 results, use trigram similarity fallback
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT
        p.id, p.name, p.slug, p.base_price, p.compare_at_price,
        p.status, p.is_featured, p.total_sold, p.average_rating, p.review_count,
        p.category_id,
        (
          similarity(lower(p.name), lower(clean_query)) * 8.0 +
          CASE WHEN lower(p.name) ILIKE '%' || lower(clean_query) || '%' THEN 5.0 ELSE 0.0 END +
          CASE WHEN p.is_featured THEN 2.0 ELSE 0.0 END +
          LEAST(coalesce(p.total_sold, 0)::real / 100.0, 3.0) +
          LEAST(coalesce(p.average_rating, 0)::real / 2.0, 2.5)
        )::real AS relevance
      FROM products p
      WHERE (NOT active_only OR p.status = 'active')
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

-- 8. Index for trending search queries aggregation (used by suggestions API)
CREATE INDEX IF NOT EXISTS idx_search_queries_query_trgm ON search_queries USING gin(query gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_queries_results ON search_queries(results_count);
