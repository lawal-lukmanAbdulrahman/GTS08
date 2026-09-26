-- Test / Live data isolation.
--
-- Every record that comes from running the business (orders, customers, tickets,
-- campaigns, logs...) carries an is_test flag. Everything that exists today is
-- test data. settings.data_mode says which side the app is showing; the shop
-- starts in 'live' mode, so it starts clean, and flipping to 'test' brings the
-- old data back. Nothing is deleted.
--
-- Shared on purpose: the catalogue (products, variants, images, categories,
-- brands, inventory levels, promos, content), staff accounts and permissions,
-- carts and wishlists (per-visitor state keyed by session/user), reviews,
-- webhook de-duplication, and settings.

-- 1. Which mode the app is in.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS data_mode VARCHAR(4) NOT NULL DEFAULT 'live';
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_data_mode_check;
ALTER TABLE settings ADD CONSTRAINT settings_data_mode_check CHECK (data_mode IN ('test', 'live'));

-- SECURITY DEFINER so signed-in and anonymous requests can evaluate it without reading settings themselves.
CREATE OR REPLACE FUNCTION public.gts_is_test_mode()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT data_mode = 'test' FROM settings WHERE id = '00000000-0000-0000-0000-000000000001'), false);
$$;

REVOKE ALL ON FUNCTION public.gts_is_test_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gts_is_test_mode() TO anon, authenticated, service_role;

-- 2. Tag the business-data tables. Existing rows become test data; new rows take the current mode.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'order_items', 'transactions', 'checkout_reservations', 'promo_code_uses',
    'customers', 'addresses',
    'support_tickets', 'ticket_messages', 'admin_notifications', 'email_campaigns',
    'activity_logs', 'stock_movements'
  ]
  LOOP
    -- A constant default backfills every existing row as test data without rewriting the table...
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT true', t);
    -- ...then new rows follow whichever mode is active when they are written.
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN is_test SET DEFAULT public.gts_is_test_mode()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (is_test)', 'idx_' || t || '_is_test', t);

    -- The public and signed-in keys only ever see the current mode. (The server key bypasses RLS and is scoped in the app.)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'gts_mode_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (is_test = (SELECT public.gts_is_test_mode())) WITH CHECK (is_test = (SELECT public.gts_is_test_mode()))',
      'gts_mode_isolation', t
    );
  END LOOP;
END $$;
