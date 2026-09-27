-- The storefront content and shopper-activity tables are for the server only (migration 00023).
BEGIN;
SELECT plan(10);

SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('product_views', 'search_queries', 'hero_carousel', 'storefront_sections') AND policyname LIKE '%_service_all'), 0, 'the open-to-everyone policies are gone');

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM product_views$$, '42501', NULL, 'the public key cannot read shopper activity');
SELECT throws_ok($$SELECT count(*) FROM search_queries$$, '42501', NULL, 'the public key cannot read search history');
SELECT lives_ok($$SELECT count(*) FROM storefront_sections$$, 'the public key can still read storefront sections');
SELECT lives_ok($$SELECT count(*) FROM hero_carousel$$, 'the public key can still read the hero carousel');
SELECT throws_ok($$INSERT INTO storefront_sections DEFAULT VALUES$$, '42501', NULL, 'the public key cannot add a storefront section');
SELECT throws_ok($$INSERT INTO hero_carousel DEFAULT VALUES$$, '42501', NULL, 'the public key cannot add a hero slide');
SELECT throws_ok($$INSERT INTO product_views DEFAULT VALUES$$, '42501', NULL, 'the public key cannot write shopper activity');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT count(*) FROM product_views$$, '42501', NULL, 'a signed-in shopper cannot read everyone''s activity');
SELECT throws_ok($$INSERT INTO storefront_sections DEFAULT VALUES$$, '42501', NULL, 'a signed-in shopper cannot add a storefront section');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
