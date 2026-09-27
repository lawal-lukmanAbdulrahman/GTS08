-- Migration 00018 gave product_views, search_queries, hero_carousel and storefront_sections a policy
-- "FOR ALL USING (true) WITH CHECK (true)" with no role. That applies to everyone, so the public key
-- that ships in every browser could read all shopper activity and add, change or delete the storefront's
-- sections and hero slides.
--
-- Every route that uses these tables runs on the server with the service role, which bypasses row-level
-- security, so those policies were never needed. Drop them. The storefront content stays publicly
-- readable (it is shown to every visitor); shopper activity becomes server-only.

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_carousel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_views_service_all" ON public.product_views;
DROP POLICY IF EXISTS "search_queries_service_all" ON public.search_queries;
DROP POLICY IF EXISTS "hero_carousel_service_all" ON public.hero_carousel;
DROP POLICY IF EXISTS "storefront_sections_service_all" ON public.storefront_sections;

-- Belt and braces: the public and signed-in roles may only read the two content tables, and nothing else.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_views, public.search_queries, public.hero_carousel, public.storefront_sections FROM anon, authenticated;
REVOKE SELECT ON public.product_views, public.search_queries FROM anon, authenticated;
