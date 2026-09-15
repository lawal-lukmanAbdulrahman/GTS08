-- =============================================================================
-- Migration: 00007_idempotency_keys
-- Description: Creates the idempotency_keys table to ensure reliable, deduplicated
--              execution of mutating API actions across Storefront and Admin.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key             TEXT PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    endpoint        TEXT NOT NULL,
    request_hash    TEXT NOT NULL,
    status_code     INTEGER,
    response_headers JSONB,
    response_body   JSONB,
    locked_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '24 hours')
);

-- Index for fast lookup and TTL expiration cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup ON public.idempotency_keys (key, request_hash);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON public.idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user ON public.idempotency_keys (user_id);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to idempotency_keys"
    ON public.idempotency_keys
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read their own idempotency records
CREATE POLICY "Users can read own idempotency keys"
    ON public.idempotency_keys
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

COMMENT ON TABLE public.idempotency_keys IS 'Stores IETF/Stripe-standard idempotency keys, in-flight locks, and cached response payloads to prevent duplicate actions.';
