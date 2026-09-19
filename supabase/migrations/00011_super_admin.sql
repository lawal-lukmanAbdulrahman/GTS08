-- D004: a super admin is the one admin who can create other staff accounts
-- (cashier, inventory staff, or further admins). Every other admin keeps full
-- admin access but cannot add people.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Start with the earliest-created admin as the super admin, so the current
-- owner isn't locked out of adding staff. Change it with:
--   UPDATE users SET is_super_admin = (email = 'you@example.com') WHERE role = 'admin';
UPDATE users SET is_super_admin = true
WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_super_admin);

-- Only admins can be super admins.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_super_admin_is_admin;
ALTER TABLE users
  ADD CONSTRAINT users_super_admin_is_admin CHECK (NOT is_super_admin OR role = 'admin');
