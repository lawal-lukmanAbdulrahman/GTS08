-- pgTAP: RLS for product_flags (migration 00010). Run with `pnpm test:rls`
-- against a local Supabase (`supabase start`).
BEGIN;
SELECT plan(6);

-- fixtures
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cashier1@test.gts'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'cashier2@test.gts'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'nopos@test.gts');
UPDATE users SET role = 'cashier' WHERE id IN
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003');
INSERT INTO employee_permissions (user_id, can_process_pos) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', false);
INSERT INTO products (id, name, slug, base_price, status)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'RLS Product', 'rls-product', 100000, 'active');

-- 1. a POS cashier can flag a product as themselves
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"cashier"}}';
SELECT lives_ok(
  $$INSERT INTO product_flags (product_id, raised_by, reason)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'wrong_price')$$,
  'cashier can raise a flag as themselves'
);

-- 2. ...but not as someone else
SELECT throws_ok(
  $$INSERT INTO product_flags (product_id, raised_by, reason)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'damaged')$$,
  '42501', NULL, 'cashier cannot raise a flag in another user''s name'
);

-- 3. the same open flag twice is rejected
SELECT throws_ok(
  $$INSERT INTO product_flags (product_id, raised_by, reason)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'wrong_price')$$,
  '23505', NULL, 'duplicate open flag is rejected'
);

-- 4. a cashier sees only their own flags
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"cashier"}}';
SELECT is((SELECT count(*)::int FROM product_flags), 0, 'another cashier cannot read it');

-- 5. staff without POS access cannot raise flags
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"cashier"}}';
SELECT throws_ok(
  $$INSERT INTO product_flags (product_id, raised_by, reason)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'other')$$,
  '42501', NULL, 'staff without can_process_pos cannot raise a flag'
);

-- 6. an admin can read everything
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000009","role":"authenticated","app_metadata":{"role":"admin"}}';
SELECT is((SELECT count(*)::int FROM product_flags), 1, 'admin can read all flags');

SELECT * FROM finish();
ROLLBACK;
