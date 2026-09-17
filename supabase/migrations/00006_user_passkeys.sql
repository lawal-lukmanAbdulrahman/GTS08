-- 00006_user_passkeys.sql
-- Table to store WebAuthn / Passkey credentials for users

CREATE TABLE IF NOT EXISTS user_passkeys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id  TEXT NOT NULL UNIQUE,
  public_key     TEXT NOT NULL, -- Base64URL encoded public key
  counter        BIGINT NOT NULL DEFAULT 0,
  device_name    TEXT NOT NULL DEFAULT 'Passkey Device',
  aaguid         TEXT,
  transports     TEXT[] DEFAULT ARRAY['internal'],
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON user_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_credential ON user_passkeys(credential_id);

-- Enable Row Level Security
ALTER TABLE user_passkeys ENABLE ROW LEVEL SECURITY;

-- Policies: users can view and delete their own passkeys
DROP POLICY IF EXISTS "Users can view own passkeys" ON user_passkeys;
CREATE POLICY "Users can view own passkeys"
  ON user_passkeys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own passkeys" ON user_passkeys;
CREATE POLICY "Users can insert own passkeys"
  ON user_passkeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own passkeys" ON user_passkeys;
CREATE POLICY "Users can update own passkeys"
  ON user_passkeys FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own passkeys" ON user_passkeys;
CREATE POLICY "Users can delete own passkeys"
  ON user_passkeys FOR DELETE
  USING (auth.uid() = user_id);
