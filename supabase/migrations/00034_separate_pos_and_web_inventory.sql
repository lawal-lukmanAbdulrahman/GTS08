-- ============================================================
-- GTS Platform — Migration 00034: Separate POS and Web Inventory
-- 1. Adds 'channel' column to products ('pos' vs 'web')
-- 2. Wipes products, inventory, and orders for clean slate
-- ============================================================

-- 1. Add channel column to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'web'
  CHECK (channel IN ('pos', 'web'));

CREATE INDEX IF NOT EXISTS idx_products_channel ON products(channel);

-- 2. Clear out existing orders, inventory, and products for clean separate start
-- (As requested: "just clear the db for the products available , and the orders too")
DO $$
BEGIN
  -- Clear order verifications and transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_pickup_verifications') THEN
    DELETE FROM order_pickup_verifications;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    DELETE FROM transactions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
    DELETE FROM order_items;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    DELETE FROM orders;
  END IF;

  -- Clear stock movements and inventory
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
    DELETE FROM stock_movements;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items') THEN
    DELETE FROM cart_items;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_sessions') THEN
    DELETE FROM cart_sessions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    DELETE FROM inventory;
  END IF;

  -- Clear product relations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hero_carousel') THEN
    DELETE FROM hero_carousel;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlists') THEN
    DELETE FROM wishlists;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    DELETE FROM reviews;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_views') THEN
    DELETE FROM product_views;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_flags') THEN
    DELETE FROM product_flags;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_drafts') THEN
    DELETE FROM product_drafts;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_images') THEN
    DELETE FROM product_images;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') THEN
    DELETE FROM product_variants;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    DELETE FROM products;
  END IF;
END $$;
