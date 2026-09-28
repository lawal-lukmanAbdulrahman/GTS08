-- The storefront content and shopper-activity tables are for the server only (migration 00023).
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

SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('product_views', 'search_queries', 'hero_carousel', 'storefront_sections') AND policyname LIKE '%_service_all'), 0, 'the open-to-everyone policies are gone');

SELECT throws_ok($$SELECT tests_run('anon', NULL, $q$SELECT count(*) FROM product_views$q$)$$, '42501', NULL, 'the public key cannot read shopper activity');
SELECT throws_ok($$SELECT tests_run('anon', NULL, $q$SELECT count(*) FROM search_queries$q$)$$, '42501', NULL, 'the public key cannot read search history');
SELECT lives_ok($$SELECT tests_run('anon', NULL, $q$SELECT count(*) FROM storefront_sections$q$)$$, 'the public key can still read storefront sections');
SELECT lives_ok($$SELECT tests_run('anon', NULL, $q$SELECT count(*) FROM hero_carousel$q$)$$, 'the public key can still read the hero carousel');
SELECT throws_ok($$SELECT tests_run('anon', NULL, $q$INSERT INTO storefront_sections DEFAULT VALUES$q$)$$, '42501', NULL, 'the public key cannot add a storefront section');
SELECT throws_ok($$SELECT tests_run('anon', NULL, $q$INSERT INTO hero_carousel DEFAULT VALUES$q$)$$, '42501', NULL, 'the public key cannot add a hero slide');
SELECT throws_ok($$SELECT tests_run('anon', NULL, $q$INSERT INTO product_views DEFAULT VALUES$q$)$$, '42501', NULL, 'the public key cannot write shopper activity');

SELECT throws_ok($$SELECT tests_run('authenticated', NULL, $q$SELECT count(*) FROM product_views$q$)$$, '42501', NULL, 'a signed-in shopper cannot read everyone''s activity');
SELECT throws_ok($$SELECT tests_run('authenticated', NULL, $q$INSERT INTO storefront_sections DEFAULT VALUES$q$)$$, '42501', NULL, 'a signed-in shopper cannot add a storefront section');

SELECT * FROM finish();
ROLLBACK;
