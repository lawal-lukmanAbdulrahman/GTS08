-- Migration: 00028_pickup_order_status_and_permissions.sql
-- Description: Transition from delivery-based to pickup-only order status model, separate payment status,
-- add granular order permissions to employee_permissions, and make pickup window configurable.

-- 1. Add new columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS paid_confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ;

-- Add check constraint on payment_status
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid'));

-- 2. Drop existing status constraint before migrating data
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Data Migration: Map existing orders
-- Derive payment_status from existing paid_at, transactions, or legacy statuses
UPDATE public.orders
SET payment_status = 'paid'
WHERE paid_at IS NOT NULL
   OR status IN ('paid', 'delivered', 'completed')
   OR EXISTS (
     SELECT 1 FROM public.transactions t
     WHERE t.order_id = orders.id AND t.payment_status = 'success'
   );

-- Map existing legacy statuses to the 4-step pickup model and off-track states
UPDATE public.orders SET status = 'placed' WHERE status = 'pending_payment';
UPDATE public.orders SET status = 'confirmed' WHERE status IN ('paid', 'processing');
UPDATE public.orders
SET status = 'ready_for_pickup',
    ready_for_pickup_at = COALESCE(shipped_at, updated_at, now())
WHERE status = 'shipped';
UPDATE public.orders SET status = 'collected' WHERE status IN ('delivered', 'completed');
-- 'confirmed', 'cancelled', 'voided' remain intact.

-- 3. Add new orders status check constraint and default
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('placed', 'confirmed', 'ready_for_pickup', 'collected', 'cancelled', 'expired', 'on_hold', 'voided', 'pending_payment'));

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'placed';

-- Indexes for performance & queue filtering
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_ready_unpaid ON public.orders(status, payment_status) WHERE status = 'ready_for_pickup';

-- 4. Update order stats trigger to fire on 'collected' instead of 'delivered'
CREATE OR REPLACE FUNCTION update_user_order_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'collected' AND (OLD.status IS NULL OR OLD.status <> 'collected') THEN
    UPDATE users u
    SET
      total_orders = total_orders + 1,
      total_spent  = total_spent + NEW.total,
      last_order_at = now()
    FROM customers c
    WHERE c.id = NEW.customer_id
      AND c.user_id = u.id
      AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Add configurable pickup window to settings (default 7 days)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS pickup_window_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pickup_window_days_check;
ALTER TABLE public.settings ADD CONSTRAINT settings_pickup_window_days_check CHECK (pickup_window_days BETWEEN 1 AND 90);

-- 6. Add granular order permissions to employee_permissions
ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS can_update_order_status BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_mark_orders_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_complete_pickup BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_cancel_orders BOOLEAN NOT NULL DEFAULT false;

-- Cashiers with POS access can also complete pickup and mark orders paid at counter
UPDATE public.employee_permissions
SET can_complete_pickup = true, can_mark_orders_paid = true
WHERE can_process_pos = true;
