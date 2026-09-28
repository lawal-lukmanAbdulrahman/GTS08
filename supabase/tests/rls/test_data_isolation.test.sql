-- Demo / live isolation (migrations 00024 and 00025): which rows a request sees follows the signed-in account.
BEGIN;
SELECT plan(14);

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

INSERT INTO auth.users (id, email) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'demo@test.gts'),
  ('dddddddd-0000-0000-0000-000000000002', 'real@test.gts');
UPDATE users SET role = 'admin', is_demo = true WHERE id = 'dddddddd-0000-0000-0000-000000000001';

SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'is_test'), 28, 'twenty-eight tables carry is_test');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND policyname = 'gts_mode_isolation' AND permissive = 'RESTRICTIVE'), 28, 'each has a restrictive isolation policy');
SELECT is(public.gts_is_test_mode(), false, 'with no signed-in user the mode is live');

-- One demo and one live product and order, written by the server.
INSERT INTO products (id, name, slug, base_price, status, is_test) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'Demo Shirt', 'shirt', 1000, 'active', true),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Real Shirt', 'shirt', 1000, 'active', false);
SELECT pass('the same slug can exist once in demo and once in live');
SELECT throws_ok($$INSERT INTO products (name, slug, base_price, status, is_test) VALUES ('Dup', 'shirt', 1000, 'active', false)$$, '23505', NULL, 'but not twice in the same data set');
INSERT INTO products (name, slug, base_price, status) VALUES ('Server default', 'server-default', 1000, 'active');
SELECT is((SELECT is_test FROM products WHERE slug = 'server-default'), false, 'the server writes live rows by default');

SELECT is(tests_eval('anon', NULL, $q$SELECT count(*)::text FROM products WHERE slug = 'shirt'$q$), '1', 'an anonymous visitor sees one shirt...');
SELECT is(tests_eval('anon', NULL, $q$SELECT name FROM products WHERE slug = 'shirt'$q$), 'Real Shirt', '...the live one');

SELECT is(tests_eval('authenticated', '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}', $q$SELECT name FROM products WHERE slug = 'shirt'$q$), 'Real Shirt', 'a real signed-in user sees the live shirt');

SELECT is(tests_eval('authenticated', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', $q$SELECT public.gts_is_test_mode()::text$q$), 'true', 'the demo account is in demo mode');
SELECT is(tests_eval('authenticated', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', $q$SELECT name FROM products WHERE slug = 'shirt'$q$), 'Demo Shirt', 'the demo account sees the demo shirt only');
SELECT throws_ok($$SELECT tests_run('authenticated', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', $q$INSERT INTO reviews (product_id, user_id, rating, is_test) VALUES ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 5, false)$q$)$$, '42501', NULL, 'the demo account cannot write into live data');
SELECT throws_ok($$SELECT tests_run('authenticated', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', $q$UPDATE users SET is_demo = false WHERE id = 'dddddddd-0000-0000-0000-000000000001'$q$)$$, '42501', NULL, 'the demo account cannot switch itself to live');

SELECT is((SELECT count(*)::int FROM search_products('shirt', 10, 0, NULL, false, false)), 1, 'search finds the live shirt for the live shop');

SELECT * FROM finish();
ROLLBACK;
