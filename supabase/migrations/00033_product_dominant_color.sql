-- Migration: 00033_product_dominant_color.sql
-- Description: Adds dominant_color column to products and product_images tables for dynamic harmonic hero gradient palettes.
-- Also ensures has_transparent_bg is present on all relevant tables.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dominant_color VARCHAR(10);

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS dominant_color VARCHAR(10);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN DEFAULT false;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN DEFAULT false;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS has_transparent_bg BOOLEAN DEFAULT false;

ALTER TABLE public.product_drafts
  ADD COLUMN IF NOT EXISTS dominant_color VARCHAR(10);
