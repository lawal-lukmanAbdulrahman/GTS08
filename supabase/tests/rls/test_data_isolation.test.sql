-- Business data is split into test and live (migration 00017).
BEGIN;
SELECT plan(9);

SELECT is((SELECT data_mode FROM settings WHERE id = '00000000-0000-0000-0000-000000000001'), 'live', 'the shop starts in live mode');
SELECT is(public.gts_is_test_mode(), false, 'live mode is not test mode');

SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'is_test'), 13, 'thirteen business tables carry is_test');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND policyname = 'gts_mode_isolation' AND permissive = 'RESTRICTIVE'), 13, 'each has a restrictive isolation policy for the public and signed-in keys');

INSERT INTO activity_logs (action, target_type) VALUES ('test.live', 'test');
SELECT is((SELECT is_test FROM activity_logs WHERE action = 'test.live'), false, 'a record written in live mode is live');

UPDATE settings SET data_mode = 'test' WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT is(public.gts_is_test_mode(), true, 'switching the mode is seen by the function');
INSERT INTO activity_logs (action, target_type) VALUES ('test.test', 'test');
SELECT is((SELECT is_test FROM activity_logs WHERE action = 'test.test'), true, 'a record written in test mode is test data');

SELECT throws_ok($$UPDATE settings SET data_mode = 'demo'$$, '23514', NULL, 'only test or live are accepted');
SELECT ok(NOT has_column_privilege('anon', 'public.settings', 'data_mode', 'SELECT'), 'the public key cannot read the mode setting');

SELECT * FROM finish();
ROLLBACK;
