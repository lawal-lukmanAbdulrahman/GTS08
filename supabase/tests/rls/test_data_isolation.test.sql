-- Demo / live isolation (migrations 00024 and 00025): which rows a request sees follows the signed-in account.
BEGIN;
SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'demo@test.gts'),
  ('dddddddd-0000-0000-0000-000000000002', 'real@test.gts');
UPDATE users SET role = 'admin', is_demo = true WHERE id = 'dddddddd-0000-0000-0000-000000000001';

SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'is_test'), 28, 'twenty-eight tables carry is_test');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND policyname = 'gts_mode_isolation' AND permissive = 'RESTRICTIVE'), 28, 'each has a restrictive isolation policy');
SELECT is(public.gts_is_test_mode(), false, 'with no signed-in user the mode is live');

-- One demo and one live product and order, written by the server.
INSERT INTO products (id, name, slug, base_price, is_test) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'Demo Shirt', 'shirt', 1000, true),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Real Shirt', 'shirt', 1000, false);
SELECT pass('the same slug can exist once in demo and once in live');
SELECT throws_ok($$INSERT INTO products (name, slug, base_price, is_test) VALUES ('Dup', 'shirt', 1000, false)$$, '23505', NULL, 'but not twice in the same data set');
INSERT INTO products (name, slug, base_price) VALUES ('Server default', 'server-default', 1000);
SELECT is((SELECT is_test FROM products WHERE slug = 'server-default'), false, 'the server writes live rows by default');

SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM products WHERE slug = 'shirt'), 1, 'an anonymous visitor sees one shirt...');
SELECT is((SELECT name FROM products WHERE slug = 'shirt'), 'Real Shirt', '...the live one');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is((SELECT name FROM products WHERE slug = 'shirt'), 'Real Shirt', 'a real signed-in user sees the live shirt');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(public.gts_is_test_mode(), true, 'the demo account is in demo mode');
SELECT is((SELECT name FROM products WHERE slug = 'shirt'), 'Demo Shirt', 'the demo account sees the demo shirt only');
SELECT throws_ok($$INSERT INTO reviews (product_id, user_id, rating, is_test) VALUES ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 5, false)$$, '42501', NULL, 'the demo account cannot write into live data');
SELECT throws_ok($$UPDATE users SET is_demo = false WHERE id = 'dddddddd-0000-0000-0000-000000000001'$$, '42501', NULL, 'the demo account cannot switch itself to live');
RESET ROLE;

SELECT is((SELECT count(*)::int FROM search_products('shirt', 10, 0, NULL, false, false)), 1, 'search finds the live shirt for the live shop');

SELECT * FROM finish();
ROLLBACK;
