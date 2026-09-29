-- Migration: 00029_pickup_stations.sql
-- Description: Add pickup_stations table for multi-location pickup management,
-- link pickup_station_id on orders, and seed default station from settings.

-- 1. Create pickup_stations table
CREATE TABLE IF NOT EXISTS public.pickup_stations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(150) NOT NULL,
  address_line1    VARCHAR(255) NOT NULL,
  address_line2    VARCHAR(255),
  city             VARCHAR(100) NOT NULL,
  state            VARCHAR(100) NOT NULL DEFAULT 'Lagos',
  phone            VARCHAR(50),
  operating_hours  VARCHAR(255),
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active stations lookup
CREATE INDEX IF NOT EXISTS idx_pickup_stations_active ON public.pickup_stations(is_active);

-- 2. Add pickup_station_id to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_station_id UUID REFERENCES public.pickup_stations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pickup_station_id ON public.orders(pickup_station_id);

-- 3. Pickup stations table starts empty. Admin must add physical pickup stations via /admin/pickup-stations.


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.pickup_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active pickup stations" ON public.pickup_stations;
DROP POLICY IF EXISTS "Staff can view all pickup stations" ON public.pickup_stations;
DROP POLICY IF EXISTS "Admins can insert pickup stations" ON public.pickup_stations;
DROP POLICY IF EXISTS "Admins can update pickup stations" ON public.pickup_stations;
DROP POLICY IF EXISTS "Admins can delete pickup stations" ON public.pickup_stations;
DROP POLICY IF EXISTS "Admins can manage pickup stations" ON public.pickup_stations;

-- Allow public read access to active stations
CREATE POLICY "Public can view active pickup stations"
  ON public.pickup_stations
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Allow authenticated staff/admins to view all pickup stations
CREATE POLICY "Staff can view all pickup stations"
  ON public.pickup_stations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager', 'cashier', 'inventory_staff')
    )
  );

-- Allow admins to manage pickup stations (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage pickup stations"
  ON public.pickup_stations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Table permissions
GRANT SELECT ON public.pickup_stations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_stations TO authenticated, service_role;
