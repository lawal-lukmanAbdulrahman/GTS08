-- pgTAP: privileged user columns can't be changed from the public REST API (migration 00013).
-- Run with `pnpm test:rls` against a local Supabase (`supabase start`).
BEGIN;
SELECT plan(10);

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

INSERT INTO auth.users (id, email) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'customer@test.gts'),
  ('cccccccc-0000-0000-0000-000000000002', 'boss@test.gts');
UPDATE users SET role = 'admin', is_super_admin = true WHERE id = 'cccccccc-0000-0000-0000-000000000002';

-- A customer editing themselves, as the REST API would
SELECT lives_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET full_name = 'New Name' WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  'a user can still edit their own name'
);
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET role = 'admin' WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'a customer cannot make themselves an admin'
);
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET role = 'cashier' WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'nor a cashier'
);
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET is_super_admin = true WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'nor a super admin'
);
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET total_spent = 0, total_orders = 0 WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'nor edit their order statistics'
);
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET is_blocked = true WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'nor change their own blocked status'
);
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"customer"}}',
    $q$UPDATE users SET email_verified_at = now() WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'nor mark their own email verified'
);

-- Even an admin's token can't change privileged columns through the REST API; that goes through the server
SELECT throws_ok(
  $$SELECT tests_run(
    'authenticated',
    '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}',
    $q$UPDATE users SET role = 'cashier' WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  '42501', NULL, 'an admin token cannot change roles directly either'
);

-- The server (service role) can
SELECT lives_ok(
  $$SELECT tests_run(
    'service_role',
    '{"role":"service_role"}',
    $q$UPDATE users SET role = 'cashier' WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$
  )$$,
  'the service role can change a role'
);

SELECT is(
  (SELECT role FROM users WHERE id = 'cccccccc-0000-0000-0000-000000000001'),
  'cashier',
  'and the change stuck'
);

SELECT * FROM finish();
ROLLBACK;
