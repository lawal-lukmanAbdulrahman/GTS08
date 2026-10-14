-- ============================================================
-- GTS Platform — Migration 00035: Bulk & Wholesale Tiered Pricing
-- Adds 4-tier pricing support:
-- 1. Base / Customer Price (existing base_price)
-- 2. Retailer Price (price_retailer: 1 - 4 pcs)
-- 3. Wholesaler Price (price_wholesaler: 5+ pcs)
-- 4. Distributor Price (price_distributor: 20+ pcs)
-- Also adds configurable threshold columns with defaults:
-- wholesale_min_qty (default 5), distributor_min_qty (default 20)
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_retailer INTEGER,
  ADD COLUMN IF NOT EXISTS price_wholesaler INTEGER,
  ADD COLUMN IF NOT EXISTS price_distributor INTEGER,
  ADD COLUMN IF NOT EXISTS wholesale_min_qty INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS distributor_min_qty INTEGER NOT NULL DEFAULT 20;

-- Backfill existing products so they have sensible defaults (equal to base_price)
UPDATE products
SET
  price_retailer = COALESCE(price_retailer, base_price),
  price_wholesaler = COALESCE(price_wholesaler, base_price),
  price_distributor = COALESCE(price_distributor, base_price)
WHERE price_retailer IS NULL OR price_wholesaler IS NULL OR price_distributor IS NULL;
