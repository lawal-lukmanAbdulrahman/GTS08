-- ============================================================
-- GTS Platform — Migration 00005: Dedicated Product Drafts
-- Consolidates missing product columns and creates product_drafts table
-- ============================================================

-- 1. Ensure missing product columns exist
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sub_category VARCHAR(150);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN NOT NULL DEFAULT false;

-- 2. Dedicated Product Drafts Table
CREATE TABLE IF NOT EXISTS product_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Draft',
  draft_type VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (draft_type IN ('new', 'revision')),
  draft_data JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_drafts_product_id ON product_drafts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_drafts_updated_at ON product_drafts(updated_at DESC);
