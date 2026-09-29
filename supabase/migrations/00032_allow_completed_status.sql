-- Migration: 00032_allow_completed_status.sql
-- Description: Expand orders_status_check constraint to include 'completed' alongside 'collected'
-- for seamless compatibility between pickup-model and legacy/till completion events.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('placed', 'confirmed', 'ready_for_pickup', 'collected', 'completed', 'cancelled', 'expired', 'on_hold', 'voided', 'pending_payment'));
