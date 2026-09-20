-- The public and signed-in roles must not be able to read private columns (migration 00015).
BEGIN;
SELECT plan(8);

SELECT ok(NOT has_column_privilege('anon', 'public.products', 'cost_price', 'SELECT'), 'anon cannot read products.cost_price');
SELECT ok(NOT has_column_privilege('authenticated', 'public.products', 'cost_price', 'SELECT'), 'signed-in users cannot read products.cost_price');
SELECT ok(has_column_privilege('anon', 'public.products', 'name', 'SELECT'), 'anon can still read products.name');
SELECT ok(has_column_privilege('anon', 'public.products', 'base_price', 'SELECT'), 'anon can still read products.base_price');

SELECT ok(NOT has_column_privilege('anon', 'public.settings', 'tax_rate', 'SELECT'), 'anon cannot read settings.tax_rate');
SELECT ok(NOT has_column_privilege('authenticated', 'public.settings', 'tax_rate', 'SELECT'), 'signed-in users cannot read settings.tax_rate');
SELECT ok(has_column_privilege('anon', 'public.settings', 'store_name', 'SELECT'), 'anon can still read settings.store_name');
SELECT ok(has_column_privilege('service_role', 'public.products', 'cost_price', 'SELECT'), 'the server (service role) can still read products.cost_price');

SELECT * FROM finish();
ROLLBACK;
