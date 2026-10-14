-- Migration 00037: Customer Management (Account Disabling, Soft Deletion, Reinstatement, and Customer Notifications)

-- 1. Add account status fields to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_notified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reinstated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reinstatement_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON public.users(is_disabled);

-- 2. Add account status fields to public.customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_notified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reinstated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reinstatement_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_is_disabled ON public.customers(is_disabled);

-- 3. Create customer_notifications table for permanent database-backed inbox
CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_id ON public.customer_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id ON public.customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON public.customer_notifications(created_at DESC);

-- Enable RLS on customer_notifications
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own notifications
DROP POLICY IF EXISTS customer_notifications_user_select ON public.customer_notifications;
CREATE POLICY customer_notifications_user_select ON public.customer_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow service role full access
DROP POLICY IF EXISTS customer_notifications_service_all ON public.customer_notifications;
CREATE POLICY customer_notifications_service_all ON public.customer_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable Supabase Realtime publication on customer_notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'customer_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_notifications;
  END IF;
END $$;
