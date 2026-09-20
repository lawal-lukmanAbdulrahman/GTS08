-- D005: a staff account created with a one-time password must choose its own
-- password before doing anything else. Cleared when they change it.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
