-- pgTAP: RLS for product_flags (migration 00010). Run with `pnpm test:rls`
-- against a local Supabase (`supabase start`).
BEGIN;
SELECT plan(6);

GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tests_run(
  as_role text,
  jwt_claims text,
  statement text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF jwt_claims IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', jwt_claims, true);
  ELSE
    PERFORM set_config('request.jwt.claims', '', true);
  END IF;
  PERFORM set_config('search_path', 'public, extensions', true);

  EXECUTE format('SET LOCAL ROLE %I', as_role);
  EXECUTE statement;

  RESET ROLE;
  RESET search_path;
  PERFORM set_config('request.jwt.claims', '', true);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RESET search_path;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION tests_eval(
  as_role text,
  jwt_claims text,
  query text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result text;
BEGIN
  IF jwt_claims IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', jwt_claims, true);
  ELSE
    PERFORM set_config('request.jwt.claims', '', true);
  END IF;
  PERFORM set_config('search_path', 'public, extensions', true);

  EXECUTE format('SET LOCAL ROLE %I', as_role);
  EXECUTE query INTO result;

  RESET ROLE;
  RESET search_path;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RESET search_path;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE;
END;
$$;

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
SELECT lives_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"cashier"}}',
    $q$INSERT INTO product_flags (product_id, raised_by, reason)
       VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'wrong_price')$q$
  )$$,
  'cashier can raise a flag as themselves'
);

-- 2. ...but not as someone else
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"cashier"}}',
    $q$INSERT INTO product_flags (product_id, raised_by, reason)
       VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'damaged')$q$
  )$$,
  '42501', NULL, 'cashier cannot raise a flag in another user''s name'
);

-- 3. the same open flag twice is rejected
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"cashier"}}',
    $q$INSERT INTO product_flags (product_id, raised_by, reason)
       VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'wrong_price')$q$
  )$$,
  '23505', NULL, 'duplicate open flag is rejected'
);

-- 4. a cashier sees only their own flags
SELECT is(
  tests_eval(
    'authenticated',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"cashier"}}',
    $q$SELECT count(*)::text FROM product_flags$q$
  ),
  '0',
  'another cashier cannot read it'
);

-- 5. staff without POS access cannot raise flags
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"role":"cashier"}}',
    $q$INSERT INTO product_flags (product_id, raised_by, reason)
       VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'other')$q$
  )$$,
  '42501', NULL, 'staff without can_process_pos cannot raise a flag'
);

-- 6. an admin can read everything
SELECT is(
  tests_eval(
    'authenticated',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000009","role":"authenticated","app_metadata":{"role":"admin"}}',
    $q$SELECT count(*)::text FROM product_flags$q$
  ),
  '1',
  'admin can read all flags'
);

SELECT * FROM finish();
ROLLBACK;
