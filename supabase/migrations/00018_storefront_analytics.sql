-- Phase 1: Storefront analytics & content management tables
-- ==========================================================

-- 1. Track product page views & deep engagement (dwell time, details reading)
CREATE TABLE IF NOT EXISTS product_views (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id        TEXT,
  duration_seconds  INT DEFAULT 0,
  scroll_depth      INT DEFAULT 0,
  event_type        TEXT DEFAULT 'view',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE product_views ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0;
ALTER TABLE product_views ADD COLUMN IF NOT EXISTS scroll_depth INT DEFAULT 0;
ALTER TABLE product_views ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'view';

CREATE INDEX idx_product_views_product_id ON product_views(product_id);
CREATE INDEX idx_product_views_created_at ON product_views(created_at);
CREATE INDEX idx_product_views_event_type ON product_views(event_type);

-- 2. Track search queries (for "Trending" + "For You" sections)
CREATE TABLE IF NOT EXISTS search_queries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id     TEXT,
  query          TEXT NOT NULL,
  results_count  INT DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);

-- 3. Admin-curated hero carousel products
CREATE TABLE IF NOT EXISTS hero_carousel (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

-- 4. Storefront section configuration
CREATE TABLE IF NOT EXISTS storefront_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  config      JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default section configuration (Trending placed before Bestselling)
INSERT INTO storefront_sections (section_key, title, sort_order, is_active) VALUES
  ('hero',          'Hero Carousel',       0,  true),
  ('trending',      'Trending',            1,  true),
  ('bestselling',   'Bestselling',         2,  true),
  ('new-arrivals',  'New Arrivals',        3,  true),
  ('for-you',       'For You',             4,  true),
  ('crazy-deals',   'Crazy Deals',         5,  true),
  ('beauty',        'Beauty & Hygiene',    6,  true),
  ('categories',    'Categories',          7,  true),
  ('faq',           'FAQ',                 8,  true),
  ('footer',        'Footer',              9,  true)
ON CONFLICT (section_key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order;

-- 5. RLS policies
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_carousel ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_sections ENABLE ROW LEVEL SECURITY;

-- Public read for hero_carousel and storefront_sections
CREATE POLICY "hero_carousel_public_read" ON hero_carousel FOR SELECT USING (true);
CREATE POLICY "storefront_sections_public_read" ON storefront_sections FOR SELECT USING (true);

-- Service role can do everything (API routes use service client)
CREATE POLICY "product_views_service_all" ON product_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "search_queries_service_all" ON search_queries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "hero_carousel_service_all" ON hero_carousel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "storefront_sections_service_all" ON storefront_sections FOR ALL USING (true) WITH CHECK (true);
