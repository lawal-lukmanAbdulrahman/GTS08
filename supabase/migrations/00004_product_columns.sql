-- ============================================================
-- GTS Platform — Migration 00004
-- Add missing product columns used by the admin dashboard
-- ============================================================

-- products.has_transparent_bg
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN NOT NULL DEFAULT false;

-- products.brand
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- products.sub_category
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sub_category VARCHAR(150);

-- product_variants.has_transparent_bg
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN NOT NULL DEFAULT false;

-- product_variants.image_url
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- product_images.has_transparent_bg
ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN NOT NULL DEFAULT false;
