-- Migration: Add pickup_pin to orders for 6-digit anti-theft collection verification
-- Used for customer collection handover verification (Storefront pickup & WhatsApp orders)

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_pin VARCHAR(10);

COMMENT ON COLUMN public.orders.pickup_pin IS '6-digit unique collection verification PIN for anti-theft handover';
