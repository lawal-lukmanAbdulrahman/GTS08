-- Migration 00038: Enhanced Promo Codes Center (Targeting, Scope, Limits, and Audit Trail)

-- 1. Add targeting and scoping fields to public.promos
ALTER TABLE public.promos
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(30) NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS customer_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_scope VARCHAR(30) NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS product_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_uses_per_customer INTEGER DEFAULT 1;

-- Index for customer and product filtering
CREATE INDEX IF NOT EXISTS idx_promos_target_type ON public.promos(target_type);
CREATE INDEX IF NOT EXISTS idx_promos_product_scope ON public.promos(product_scope);

-- 2. Add audit and customer info fields to public.promo_code_uses
ALTER TABLE public.promo_code_uses
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS discount_applied_kobo INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_promo_id ON public.promo_code_uses(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user_id ON public.promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_customer_email ON public.promo_code_uses(customer_email);
