# GTS Platform — Central Backend Specification

**Version:** 2.1  
**Date:** June 2026  
**Audience:** Backend engineers, coding agents, technical architects  
**Scope:** Complete definition of the database schema, API surface, auth system, business logic, security rules, and cron jobs that power all four user portals — across all phases of the product.

> **Agent instruction:** This document is self-contained. Every table, every field, every API route, every RLS policy, every business rule is defined here. Do not invent anything not in this spec. If something is labelled `[Phase 2]` or `[Phase 3]`, include the column or table in the migration now (cheap to add upfront, expensive to migrate later), but do not build the API route until the spec says to.
>
> **Note on scope:** This build has no in-house delivery driver system. Online order fulfillment is via third-party couriers. Admin marks orders `shipped` with a manually-entered tracking number and carrier name — there is no driver app, GPS tracking, or proof-of-delivery photo capture in this product.

---

## Part 1: Architecture

The backend runs as **Next.js 15 Route Handlers** inside `apps/web/app/api/v1/`. All business logic lives in Route Handlers only — never in any frontend component file. The dashboard app is a pure frontend that calls these routes.

**API base URL:** `https://gts.ng/api/v1`  
**All requests/responses:** `Content-Type: application/json`  
**Auth header:** `Authorization: Bearer <supabase_jwt>` on all authenticated routes  

**Standard error shape:**
```json
{
  "error": "Human-readable message for display",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

**Standard success shape (list):**
```json
{ "data": [...], "meta": { "total": 0, "page": 1, "limit": 24, "pages": 1 } }
```

**Standard success shape (single resource):**
```json
{ "data": { ... } }
```

---

## Part 2: Supabase Configuration Requirements

These settings must be applied in the Supabase dashboard before any code runs.

### 2.1 Auth Settings
- **Anonymous sign-ins:** Enable (required for guest checkout)
- **Email/password:** Enable
- **Magic links:** Enable (for staff invites)
- **Session duration:** Access token: 3600s (1hr). Refresh token: 604800s (7 days).
- **Custom SMTP:** Point to Resend SMTP for all Supabase-generated auth emails (confirm email, reset password). Use `hello@gts.ng` as the `from` address.
- **Email confirmation:** Enable for customer registrations. Disable for staff invitations (magic link flow handles it).
- **Allowed redirect URLs:** `https://gts.ng/**`, `https://dashboard.gts.ng/**`, `http://localhost:3000/**`, `http://localhost:3001/**`

### 2.2 Custom JWT Claims Hook

This hook runs on every access token generation. It embeds the user's `role` into the JWT payload as `app_metadata.role` so that Next.js middleware can read the role without a database query.

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = (event ->> 'user_id')::UUID;

  claims := event -> 'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      jsonb_set(
        COALESCE(claims -> 'app_metadata', '{}'),
        '{role}',
        to_jsonb(user_role)
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Register the hook in Supabase Dashboard:
-- Auth > Hooks > Custom Access Token > select this function
```

### 2.3 Auto-enable RLS Event Trigger

```sql
CREATE OR REPLACE FUNCTION enable_rls_on_new_tables()
RETURNS event_trigger AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE EVENT TRIGGER auto_enable_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION enable_rls_on_new_tables();
```

### 2.4 Order Number Sequence

```sql
CREATE SEQUENCE order_number_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'GTS-' ||
    TO_CHAR(NOW(), 'YYYYMM') || '-' ||
    LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

### 2.5 pg_cron Extension

Enable in Supabase dashboard: Database > Extensions > pg_cron → Enable.

---

## Part 3: Complete Database Schema

All tables in the `public` schema. UUID v4 for all PKs. RLS enabled on every table (enforced by event trigger). TIMESTAMPTZ for all timestamps. RLS policies listed per table.

---

### 3.1 `users`

Extends `auth.users`. Auto-created by trigger on `auth.users` insert.

```sql
CREATE TABLE users (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   VARCHAR(255) UNIQUE,           -- NULL for anonymous sessions
  full_name               VARCHAR(255),
  phone                   VARCHAR(20),
  role                    VARCHAR(30) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'cashier', 'inventory_staff', 'admin')),
  avatar_cloudinary_id    TEXT,
  is_anonymous            BOOLEAN NOT NULL DEFAULT false,
  is_blocked              BOOLEAN NOT NULL DEFAULT false,
  email_marketing_opt_out BOOLEAN NOT NULL DEFAULT false,
  email_verified_at       TIMESTAMPTZ,
  -- Cached order stats (updated by trigger on order fulfillment)
  total_orders            INTEGER NOT NULL DEFAULT 0,
  total_spent             INTEGER NOT NULL DEFAULT 0,    -- kobo
  last_order_at           TIMESTAMPTZ,
  -- Timestamps
  last_sign_in_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Trigger: auto-create users row on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_anonymous)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_app_meta_data->>'provider' = 'anonymous')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: update cached stats after order fulfilled
CREATE OR REPLACE FUNCTION update_user_order_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status <> 'delivered') THEN
    UPDATE users u
    SET
      total_orders = total_orders + 1,
      total_spent  = total_spent + NEW.total,
      last_order_at = now()
    FROM customers c
    WHERE c.id = NEW.customer_id
      AND c.user_id = u.id
      AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_stats_update
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_order_stats();
```

**RLS:**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Users cannot change their own role or blocked status
    role = (SELECT role FROM users WHERE id = auth.uid())
    AND is_blocked = (SELECT is_blocked FROM users WHERE id = auth.uid())
  );

CREATE POLICY "admin_read_all_users" ON users FOR SELECT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "admin_update_all_users" ON users FOR UPDATE
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
```

---

### 3.2 `employee_permissions`

```sql
CREATE TABLE employee_permissions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  can_process_pos        BOOLEAN NOT NULL DEFAULT false,
  can_manage_inventory   BOOLEAN NOT NULL DEFAULT false,
  can_view_all_orders    BOOLEAN NOT NULL DEFAULT false,
  can_manage_products    BOOLEAN NOT NULL DEFAULT false,
  can_handle_tickets     BOOLEAN NOT NULL DEFAULT false,
  granted_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS:**
```sql
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emp_perms_read_own" ON employee_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admin_full_emp_perms" ON employee_permissions FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
```

---

### 3.3 `categories`

```sql
CREATE TABLE categories (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL,
  slug                  VARCHAR(100) NOT NULL UNIQUE,
  description           TEXT,
  banner_cloudinary_id  TEXT,
  mobile_banner_cloudinary_id TEXT,          -- separate mobile crop
  parent_id             UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  seo_title             VARCHAR(70),
  seo_description       VARCHAR(160),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = true;
```

**RLS:**
```sql
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_cats" ON categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "staff_read_all_cats" ON categories FOR SELECT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff', 'cashier'));

CREATE POLICY "admin_manage_cats" ON categories FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
```

---

### 3.4 `products`

```sql
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(255) NOT NULL UNIQUE,
  sku                   VARCHAR(100) UNIQUE,             -- master SKU prefix; optional
  short_description     VARCHAR(300),                    -- for product cards, social sharing
  description           TEXT,
  fit_notes             TEXT,                            -- "Slim fit. Model is 6'1" wearing L."
  fabric_care           TEXT,                            -- care instructions
  material              VARCHAR(255),                    -- e.g., "100% Egyptian Cotton"
  category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
  base_price            INTEGER NOT NULL CHECK (base_price > 0),  -- kobo
  compare_at_price      INTEGER,                         -- kobo; NULL if no discount active
  cost_price            INTEGER,                         -- kobo; [admin only] for margin calc
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'archived')),
  is_featured            BOOLEAN NOT NULL DEFAULT false,
  tags                  TEXT[] DEFAULT '{}',
  -- Cached stats (updated by triggers/crons)
  total_sold            INTEGER NOT NULL DEFAULT 0,
  average_rating        DECIMAL(3,2),                   -- NULL until first approved review
  review_count          INTEGER NOT NULL DEFAULT 0,
  -- SEO
  seo_title             VARCHAR(70),
  seo_description       VARCHAR(160),
  -- Meta
  weight_grams          INTEGER,                         -- for delivery cost calculation
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_total_sold ON products(total_sold DESC);

-- Full-text search index
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(name, '') || ' ' ||
                              coalesce(short_description, '') || ' ' ||
                              coalesce(material, '') || ' ' ||
                              coalesce(array_to_string(tags, ' '), ''))
    ) STORED;
CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- Trigger: update average_rating when a review is approved
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    average_rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();
```

**RLS:**
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active" ON products FOR SELECT
  USING (status = 'active');

CREATE POLICY "staff_read_all" ON products FOR SELECT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN
    ('admin', 'cashier', 'inventory_staff'));

CREATE POLICY "admin_inv_write" ON products FOR INSERT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));

CREATE POLICY "admin_inv_update" ON products FOR UPDATE
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));

CREATE POLICY "admin_delete" ON products FOR DELETE
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
```

---

### 3.5 `product_variants`

```sql
CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size            VARCHAR(20),                           -- 'XS'|'S'|'M'|'L'|'XL'|'XXL'|'38'|'40' etc.
  color           VARCHAR(50),                           -- display name e.g. 'Midnight Blue'
  color_hex       VARCHAR(7),                            -- e.g. '#1a2b3c'
  sku             VARCHAR(150),                          -- full variant SKU; NULL allowed for simple products
  barcode         VARCHAR(100),                          -- [Phase 2] for POS barcode scanner
  price_modifier  INTEGER NOT NULL DEFAULT 0,            -- kobo; added to product.base_price
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique SKU only when explicitly set (NULL is not unique)
CREATE UNIQUE INDEX idx_variant_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_variant_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_variants_product ON product_variants(product_id);
```

**Computed price:** `products.base_price + product_variants.price_modifier`

**RLS:** (inherits product access logic)
```sql
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_variants" ON product_variants FOR SELECT
  USING (
    is_active = true AND
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.status = 'active')
  );

CREATE POLICY "staff_read_all_variants" ON product_variants FOR SELECT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN
    ('admin', 'cashier', 'inventory_staff'));

CREATE POLICY "admin_inv_manage_variants" ON product_variants FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));
```

---

### 3.6 `product_images`

```sql
CREATE TABLE product_images (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id            UUID REFERENCES product_variants(id) ON DELETE SET NULL,  -- NULL = all variants
  cloudinary_public_id  TEXT NOT NULL,
  alt_text              VARCHAR(255),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_primary            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);
-- Only one primary per product
CREATE UNIQUE INDEX idx_one_primary_per_product ON product_images(product_id) WHERE is_primary = true;
```

**RLS:**
```sql
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "admin_inv_manage_images" ON product_images FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));
```

---

### 3.7 `inventory`

Single source of truth for stock. One row per variant.

```sql
CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id          UUID NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  -- available = quantity - reserved_quantity (what storefront shows)
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  last_restocked_at   TIMESTAMPTZ,
  last_sold_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index for fast low-stock queries
CREATE INDEX idx_inventory_low_stock ON inventory(variant_id)
  WHERE quantity - reserved_quantity <= low_stock_threshold;
```

**RLS:**
```sql
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Public can read stock levels (needed to show availability on storefront)
CREATE POLICY "public_read_inventory" ON inventory FOR SELECT USING (true);

CREATE POLICY "staff_manage_inventory" ON inventory FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));
-- Online order fulfillment uses service_role (bypasses RLS -- appropriate here)
```

---

### 3.8 `stock_movements`

Immutable audit log. Never delete rows.

```sql
CREATE TABLE stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  delta       INTEGER NOT NULL,       -- positive = added; negative = removed
  reason      VARCHAR(30) NOT NULL
    CHECK (reason IN (
      'sale_online', 'sale_pos', 'restock', 'adjustment',
      'return', 'reservation', 'release', 'void', 'write_off', 'correction'
    )),
  order_id    UUID,                   -- FK set in app layer (not DB FK to avoid circular)
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system/webhook
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_mv_variant ON stock_movements(variant_id);
CREATE INDEX idx_stock_mv_order ON stock_movements(order_id);
CREATE INDEX idx_stock_mv_created ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_mv_reason ON stock_movements(reason);
```

**RLS:** Service role and admin can insert. Admin/inventory_staff can read.
```sql
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_movements" ON stock_movements FOR SELECT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));
-- Inserts always via service role in Route Handlers
```

---

### 3.9 `cart_sessions`

```sql
CREATE TABLE cart_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  VARCHAR(255) NOT NULL UNIQUE,  -- client-generated UUID stored in localStorage
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX idx_cart_sessions_user ON cart_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_cart_sessions_expiry ON cart_sessions(expires_at);
```

---

### 3.10 `cart_items`

```sql
CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  VARCHAR(255) NOT NULL REFERENCES cart_sessions(session_id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, variant_id)
);

CREATE INDEX idx_cart_items_session ON cart_items(session_id);
```

**RLS:** No RLS — cart session is anonymous. Route Handler validates `session_id` only.
```sql
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
-- No policies: Route Handlers use service_role for all cart operations
-- session_id is the access control mechanism here (UUID, not guessable)
```

---

### 3.11 `checkout_reservations`

Soft stock hold during active checkout flow.

```sql
CREATE TABLE checkout_reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   VARCHAR(255) NOT NULL,
  variant_id   UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  reserved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '20 minutes'),
  released     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (session_id, variant_id)  -- one reservation per variant per session
);

CREATE INDEX idx_reservations_expiry ON checkout_reservations(expires_at) WHERE released = false;
```

**Reservation protocol:**
1. `POST /checkout/reserve`: For each item → check `inventory.quantity - inventory.reserved_quantity >= requested`. If yes → `INSERT OR UPDATE checkout_reservations`, `INCREMENT inventory.reserved_quantity`. If no → 409 with `{ available, requested }` per failing variant.
2. Paystack webhook success → `DECREMENT inventory.quantity`, `DECREMENT inventory.reserved_quantity`, `SET released = true`.
3. Cron every 5 min → find expired + unreleased → `DECREMENT inventory.reserved_quantity`, `SET released = true`.

---

### 3.12 `customers`

Customer identity for any order. Walk-in or online, registered or anonymous.

```sql
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL for anonymous/walk-in
  full_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255),                  -- NULLABLE: walk-in customers may not provide email
  phone       VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_user ON customers(user_id) WHERE user_id IS NOT NULL;
```

---

### 3.13 `addresses`

```sql
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name     VARCHAR(255) NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city          VARCHAR(100) NOT NULL,
  state         VARCHAR(100) NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_customer ON addresses(customer_id);
-- Only one default per customer
CREATE UNIQUE INDEX idx_one_default_address ON addresses(customer_id) WHERE is_default = true;
```

---

### 3.14 `delivery_options`

Shipping fee tiers shown at checkout (e.g., "Lagos Same-Day", "Nationwide Standard"). This is a shipping-method/pricing table only — there is no in-house driver system tied to it. Fulfillment uses third-party couriers.

```sql
CREATE TABLE delivery_options (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  description         VARCHAR(300),                  -- e.g., "Delivered in Lagos in 4–6 hours"
  price               INTEGER NOT NULL,              -- kobo
  estimated_days_min  INTEGER NOT NULL DEFAULT 1,   -- shown at checkout: "1–3 business days"
  estimated_days_max  INTEGER NOT NULL DEFAULT 3,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  display_order       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS:**
```sql
ALTER TABLE delivery_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_active_delivery_opts" ON delivery_options FOR SELECT USING (is_active = true);
CREATE POLICY "admin_manage_delivery_opts" ON delivery_options FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
```

---

### 3.15 `promo_codes`

```sql
CREATE TABLE promo_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               VARCHAR(50) NOT NULL UNIQUE,
  description        TEXT,                           -- internal admin note about this code
  discount_type      VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value     INTEGER NOT NULL,               -- percentage: 1–100; fixed: kobo
  min_order_value    INTEGER NOT NULL DEFAULT 0,     -- kobo
  max_discount_cap   INTEGER,                        -- kobo; max ₦ off for % codes; NULL = no cap
  usage_limit        INTEGER,                        -- total uses; NULL = unlimited
  per_customer_limit INTEGER NOT NULL DEFAULT 1,     -- per unique email
  uses_count         INTEGER NOT NULL DEFAULT 0,
  -- Product/category restrictions [Phase 2]
  applicable_product_ids  UUID[],                    -- NULL = all products
  applicable_category_ids UUID[],                    -- NULL = all categories
  valid_from         TIMESTAMPTZ,
  valid_until        TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Atomicity:** `uses_count` increments must be atomic. Use:
```sql
UPDATE promo_codes
SET uses_count = uses_count + 1
WHERE id = $promoId
  AND (usage_limit IS NULL OR uses_count < usage_limit)
RETURNING uses_count;
-- If no row returned: promo has hit its limit
```

---

### 3.16 `promo_code_uses`

Per-customer usage tracking. Required to enforce `per_customer_limit`.

```sql
CREATE TABLE promo_code_uses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id  UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  order_id       UUID,                            -- set after order created
  used_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, customer_email)          -- one use per code per email by default
  -- Note: if per_customer_limit > 1, remove UNIQUE and use COUNT query instead
);

CREATE INDEX idx_promo_uses_code ON promo_code_uses(promo_code_id);
CREATE INDEX idx_promo_uses_email ON promo_code_uses(customer_email);
```

---

### 3.17 `email_opt_ins`

Email addresses captured from the storefront bottom-sheet offer.

```sql
CREATE TABLE email_opt_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  source          VARCHAR(50) NOT NULL DEFAULT 'storefront_bottom_sheet',
  promo_code_id   UUID REFERENCES promo_codes(id) ON DELETE SET NULL,  -- the code we sent them
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,         -- set if they later register
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 3.18 `orders`

```sql
CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          VARCHAR(30) NOT NULL UNIQUE DEFAULT generate_order_number(),
  channel               VARCHAR(20) NOT NULL CHECK (channel IN ('online', 'walk_in')),
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id            UUID REFERENCES users(id) ON DELETE SET NULL,  -- walk_in only
  session_id            VARCHAR(255),                                   -- cart session that became this order
  ip_address            INET,                                           -- customer IP at checkout

  -- Status
  status                VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment',        -- online: waiting for payment
      'paid',                   -- online: payment confirmed by webhook
      'confirmed',              -- admin confirmed the order
      'processing',             -- being packed
      'shipped',                -- handed to third-party courier; tracking_number may be set
      'delivered',              -- order delivered successfully (marked by admin)
      'return_requested',       -- customer requested return
      'refunded',               -- refund processed
      'cancelled',              -- order cancelled before dispatch
      'completed',              -- walk_in: payment confirmed and complete
      'voided'                  -- walk_in: voided same day
    )),

  -- Financials (all kobo)
  subtotal              INTEGER NOT NULL,
  delivery_fee          INTEGER NOT NULL DEFAULT 0,
  discount_amount       INTEGER NOT NULL DEFAULT 0,
  total                 INTEGER NOT NULL,

  -- Shipping (online orders only)
  delivery_option_id    UUID REFERENCES delivery_options(id) ON DELETE SET NULL,
  delivery_address_id   UUID REFERENCES addresses(id) ON DELETE SET NULL,
  estimated_delivery_date DATE,
  -- Third-party courier tracking — entered manually by admin when status → shipped
  carrier_name          VARCHAR(100),      -- e.g., "GIG Logistics", "Kwik Delivery", "DHL"
  tracking_number       VARCHAR(150),
  carrier_tracking_url  VARCHAR(500),      -- optional deep link to courier's tracking page

  -- Discount
  promo_code_id         UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  promo_code_snapshot   VARCHAR(50),       -- stores the code string at time of use

  -- Notes
  customer_notes        TEXT,              -- customer's delivery instructions
  internal_notes        TEXT,              -- staff-only notes; never shown to customer
  cancellation_reason   TEXT,              -- populated when status → cancelled

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at               TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_cashier ON orders(cashier_id) WHERE cashier_id IS NOT NULL;
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_session ON orders(session_id) WHERE session_id IS NOT NULL;
```

**RLS:**
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Customers can see their own orders
CREATE POLICY "customers_read_own_orders" ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_id AND c.user_id = auth.uid()
    )
  );

-- Staff read all
CREATE POLICY "staff_read_all_orders" ON orders FOR SELECT
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN
    ('admin', 'cashier', 'inventory_staff'));

-- Admin updates all
CREATE POLICY "admin_update_orders" ON orders FOR UPDATE
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

-- Cashier creates and updates walk_in orders
CREATE POLICY "cashier_insert_orders" ON orders FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'cashier');

CREATE POLICY "cashier_update_walkin" ON orders FOR UPDATE
  USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'cashier'
    AND channel = 'walk_in'
  );

-- inventory_staff can update status on online orders (e.g., confirmed → processing → shipped)
CREATE POLICY "invstaff_update_orders" ON orders FOR UPDATE
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'inventory_staff');
```

---

### 3.19 `order_items`

```sql
CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id        UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  -- Full snapshot at time of purchase — never relies on live product data
  product_snapshot  JSONB NOT NULL,
  -- Shape: { product_id, name, slug, sku, size, color, image_cloudinary_id, category_name }
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_price        INTEGER NOT NULL,   -- kobo at time of purchase
  total_price       INTEGER NOT NULL    -- unit_price * quantity
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);
```

---

### 3.20 `transactions`

```sql
CREATE TABLE transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method          VARCHAR(30) NOT NULL
    CHECK (payment_method IN (
      'paystack_card', 'paystack_bank', 'paystack_ussd',
      'paystack_qr', 'cash', 'pos_terminal'
    )),
  payment_status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'success', 'failed', 'refunded')),
  amount                  INTEGER NOT NULL,           -- kobo
  paystack_reference      VARCHAR(255) UNIQUE,        -- Paystack's reference string
  paystack_transaction_id VARCHAR(255),               -- Paystack's numeric transaction ID
  paystack_channel        VARCHAR(50),                -- card | bank | ussd | qr
  paystack_fees           INTEGER,                    -- kobo; Paystack's transaction fee
  confirmed_by            UUID REFERENCES users(id) ON DELETE SET NULL,  -- cashier for walk_in cash
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_transactions_paystack_ref ON transactions(paystack_reference)
  WHERE paystack_reference IS NOT NULL;
```

---

### 3.21 `webhook_events`

Paystack webhook idempotency. Prevents double-processing on retries.

```sql
CREATE TABLE webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        VARCHAR(30) NOT NULL DEFAULT 'paystack',
  event_type      VARCHAR(100) NOT NULL,         -- e.g., 'charge.success'
  event_id        VARCHAR(255) NOT NULL,          -- Paystack's event ID or reference
  payload         JSONB NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT false,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,                           -- populated if processing failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);
```

**Webhook processing flow:**
```
1. Request arrives at POST /webhooks/paystack
2. Verify HMAC-SHA512 signature → reject if invalid
3. INSERT INTO webhook_events (provider, event_type, event_id, payload)
   ON CONFLICT (provider, event_id) DO NOTHING
   RETURNING id
4. If no row returned: already processed → return 200 immediately
5. Process the event (decrement stock, update order, send email)
6. UPDATE webhook_events SET processed = true, processed_at = now() WHERE id = $id
7. If step 5 throws: UPDATE webhook_events SET error_message = $err WHERE id = $id
   Return 200 (never 500 to Paystack — it would retry)
```

---

### 3.22 `reviews`

```sql
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,  -- verified purchase
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        VARCHAR(100),
  body         TEXT,
  is_approved  BOOLEAN NOT NULL DEFAULT false,
  approved_at  TIMESTAMPTZ,
  approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)   -- one review per product per customer
);

CREATE INDEX idx_reviews_product ON reviews(product_id) WHERE is_approved = true;
CREATE INDEX idx_reviews_pending ON reviews(is_approved) WHERE is_approved = false;
```

**RLS:**
```sql
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public can read approved reviews only
CREATE POLICY "public_read_approved_reviews" ON reviews FOR SELECT USING (is_approved = true);

-- Customers can create reviews for products they've purchased
CREATE POLICY "customer_create_review" ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE c.user_id = auth.uid()
        AND (oi.product_snapshot->>'product_id')::UUID = product_id
        AND o.status = 'delivered'
    )
  );

-- Customers can read their own (even unapproved)
CREATE POLICY "customer_read_own_reviews" ON reviews FOR SELECT
  USING (auth.uid() = user_id);

-- Admin manages all
CREATE POLICY "admin_manage_reviews" ON reviews FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
```

---

### 3.23 `wishlists`

```sql
CREATE TABLE wishlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_wishlists_user ON wishlists(user_id);
```

**RLS:**
```sql
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_wishlist" ON wishlists FOR ALL USING (auth.uid() = user_id);
```

---

### 3.24 `size_guides`

Size guide content per category. Rendered in the PDP modal.

```sql
CREATE TABLE size_guides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title        VARCHAR(100) NOT NULL DEFAULT 'Size Guide',
  -- Size chart stored as structured JSON
  -- Shape: { headers: ["Size", "Chest (cm)", "Waist (cm)", "Hips (cm)"],
  --           rows: [["S", "88-92", "76-80", "92-96"], ...] }
  chart_data   JSONB NOT NULL,
  how_to_measure TEXT,            -- instruction text rendered below the table
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id)            -- one guide per category
);
```

**RLS:** Public read. Admin manages.

---

### 3.25 `support_tickets`

```sql
CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       VARCHAR(30) NOT NULL UNIQUE DEFAULT (
    'TKT-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(floor(random() * 9999 + 1)::TEXT, 4, '0')
  ),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_email  VARCHAR(255) NOT NULL,
  customer_name   VARCHAR(255),
  customer_phone  VARCHAR(20),
  subject         VARCHAR(255) NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority        VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  tags            TEXT[] DEFAULT '{}',
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_assigned ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tickets_customer ON support_tickets(customer_email);
```

---

### 3.26 `ticket_messages`

```sql
CREATE TABLE ticket_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  VARCHAR(10) NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT false,   -- internal notes; not emailed to customer
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_msgs_ticket ON ticket_messages(ticket_id);
```

---

### 3.27 `content_slots`

```sql
CREATE TABLE content_slots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key                  VARCHAR(50) NOT NULL UNIQUE
    CHECK (slot_key IN ('hero_1', 'hero_2', 'hero_3', 'promo_banner', 'deal_banner', 'announcement_bar')),
  headline                  VARCHAR(200),
  subheadline               VARCHAR(300),
  cta_label                 VARCHAR(100),
  cta_link                  VARCHAR(500),
  image_cloudinary_id       TEXT,
  mobile_image_cloudinary_id TEXT,    -- different crop for mobile
  is_active                 BOOLEAN NOT NULL DEFAULT false,
  start_date                TIMESTAMPTZ,
  end_date                  TIMESTAMPTZ,
  updated_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed all slot keys on migration
INSERT INTO content_slots (slot_key) VALUES
  ('hero_1'), ('hero_2'), ('hero_3'),
  ('promo_banner'), ('deal_banner'), ('announcement_bar')
ON CONFLICT (slot_key) DO NOTHING;
```

**RLS:** Public read (active only). Admin manages.

---

### 3.28 `email_campaigns`

```sql
CREATE TABLE email_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          VARCHAR(255) NOT NULL,
  preview_text     VARCHAR(90),
  body_html        TEXT,
  cta_label        VARCHAR(100),
  cta_link         VARCHAR(500),
  audience_type    VARCHAR(30) NOT NULL
    CHECK (audience_type IN ('all', 'ordered_last_30', 'never_ordered', 'opted_in_only', 'custom')),
  audience_params  JSONB,              -- e.g., { "days": 30, "category_id": "uuid" }
  recipient_count  INTEGER,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  resend_id    VARCHAR(255),           -- Resend message ID for tracking
  status       VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained')),
  sent_at      TIMESTAMPTZ,
  UNIQUE (campaign_id, email)
);

CREATE INDEX idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
```

---

### 3.29 `admin_notifications`

```sql
CREATE TABLE admin_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(40) NOT NULL
    CHECK (type IN (
      'low_stock', 'new_ticket', 'new_order', 'payment_failed', 'new_return_request'
    )),
  title        VARCHAR(200) NOT NULL,
  message      TEXT NOT NULL,
  entity_id    UUID,
  entity_type  VARCHAR(50),           -- 'order' | 'product_variant' | 'ticket'
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifs_unread ON admin_notifications(is_read, created_at DESC)
  WHERE is_read = false;
```

---

### 3.30 `activity_logs`

Immutable audit trail. Never delete.

```sql
CREATE TABLE activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role   VARCHAR(30),            -- snapshot of role at time of action
  action       VARCHAR(100) NOT NULL,  -- e.g., 'product.created', 'order.status_changed'
  target_type  VARCHAR(50),
  target_id    UUID,
  before_value JSONB,                  -- state before the change
  after_value  JSONB,                  -- state after the change
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_actor ON activity_logs(actor_id);
CREATE INDEX idx_activity_logs_target ON activity_logs(target_type, target_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
```

---

### 3.31 `seo_pages`  [Phase 3 — table only, content managed via admin]

Style guides, size guides as crawlable SEO pages.

```sql
CREATE TABLE seo_pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255) NOT NULL,
  slug             VARCHAR(255) NOT NULL UNIQUE,
  content          TEXT NOT NULL,               -- MDX or rich HTML content
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  seo_title        VARCHAR(70),
  seo_description  VARCHAR(160),
  is_published     BOOLEAN NOT NULL DEFAULT false,
  published_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 3.32 `settings` (singleton)

```sql
CREATE TABLE settings (
  id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name               VARCHAR(100) NOT NULL DEFAULT 'GTS Men''s Wear',
  logo_cloudinary_id       TEXT,
  support_email            VARCHAR(255),
  support_phone            VARCHAR(20),
  whatsapp_number          VARCHAR(20),        -- WhatsApp business number (critical for Nigeria)
  instagram_url            VARCHAR(500),
  twitter_url              VARCHAR(500),
  facebook_url             VARCHAR(500),
  tiktok_url               VARCHAR(500),
  low_stock_threshold      INTEGER NOT NULL DEFAULT 5,
  free_shipping_threshold  INTEGER,            -- kobo; NULL = no free shipping offer
  announcement_bar_text    VARCHAR(300),       -- storefront announcement bar text
  announcement_bar_active  BOOLEAN NOT NULL DEFAULT false,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

---

## Part 4: API Route Handlers

Convention:
- `[Public]` — no auth required
- `[Auth]` — any authenticated user
- `[Customer]` — auth + role = 'customer' OR anonymous session
- `[Staff]` — any staff role
- `[Cashier]` — role with `can_process_pos = true`
- `[Inventory]` — role with `can_manage_inventory = true`
- `[Orders]` — role with `can_view_all_orders = true`
- `[Products]` — role with `can_manage_products = true`
- `[Tickets]` — role with `can_handle_tickets = true`
- `[Admin]` — role = 'admin' only

---

### 4.1 Auth — `/auth/*`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/auth/anonymous` | [Public] | Create anonymous Supabase session (guest checkout). Returns JWT. |
| POST | `/auth/register` | [Public] | Register email + password. Creates user + sends verification email. |
| POST | `/auth/login` | [Public] | Login. Returns session JWT + refresh token. |
| POST | `/auth/logout` | [Auth] | Invalidate session. |
| POST | `/auth/refresh` | [Public] | Refresh access token using refresh token. |
| POST | `/auth/password-reset/request` | [Public] | Send reset email. Body: `{ email }` |
| POST | `/auth/password-reset/confirm` | [Public] | Set new password. Body: `{ token, new_password }` |
| POST | `/auth/convert-anonymous` | [Auth] | Convert anonymous session to full account post-checkout. Body: `{ password }` |

**`POST /auth/login` Rate limit:** 5 requests / 1 minute per IP.  
**`POST /auth/register` Rate limit:** 3 requests / 1 minute per IP.  
**`POST /auth/password-reset/request` Rate limit:** 3 requests / 5 minutes per IP.

---

### 4.2 Products — `/products/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/products` | [Public] | Paginated list of active products. Query: `?category=slug&size=L&color=blue&sort=bestselling&min_price=N&max_price=N&page=1&limit=24&in_stock=true` |
| GET | `/products/featured` | [Public] | `is_featured = true` products, max 8 |
| GET | `/products/search` | [Public] | Full-text search. Query: `?q=oxford+shirt&page=1&limit=24` |
| GET | `/products/bestsellers` | [Public] | Top 20 by `total_sold DESC` in last 30 days |
| GET | `/products/:slug` | [Public] | Single product with variants, images, inventory levels, avg rating, recent reviews (3) |
| GET | `/products/:id/related` | [Public] | 4 related products same category, sorted by total_sold |
| POST | `/products` | [Products]\|[Admin] | Create product |
| PUT | `/products/:id` | [Products]\|[Admin] | Full product update |
| PUT | `/products/:id/status` | [Products]\|[Admin] | Update status only. Body: `{ status }` |
| PUT | `/products/:id/featured` | [Admin] | Toggle featured. Body: `{ is_featured }` |
| DELETE | `/products/:id` | [Admin] | Delete (only Draft with no order history) |
| POST | `/products/:id/images` | [Products]\|[Admin] | Upload images. Multipart → proxied to Cloudinary. Returns `product_images` records. |
| PUT | `/products/:id/images/reorder` | [Products]\|[Admin] | Body: `[{ id, sort_order }]` |
| DELETE | `/products/:id/images/:imageId` | [Products]\|[Admin] | Remove image |
| POST | `/products/:id/duplicate` | [Admin] | Clone product as Draft with "(Copy)" suffix |
| GET | `/products/:id/variants` | [Staff] | All variants including inactive |
| POST | `/products/:id/variants` | [Products]\|[Admin] | Add variant |
| PUT | `/products/:id/variants/:variantId` | [Products]\|[Admin] | Update variant |
| DELETE | `/products/:id/variants/:variantId` | [Admin] | Deactivate variant (soft) |

**`GET /products` response (abbreviated):**
```json
{
  "data": [{
    "id": "uuid",
    "name": "GTS Oxford Shirt",
    "slug": "gts-oxford-shirt",
    "base_price": 1500000,
    "compare_at_price": null,
    "effective_price": 1500000,
    "primary_image": { "cloudinary_id": "gts/products/abc", "alt": "..." },
    "category": { "name": "Shirts", "slug": "shirts" },
    "average_rating": 4.5,
    "review_count": 12,
    "in_stock": true,
    "has_low_stock": false,
    "is_featured": false,
    "total_sold": 47,
    "badges": ["bestseller"]
  }],
  "meta": { "total": 84, "page": 1, "limit": 24, "pages": 4 }
}
```

---

### 4.3 Categories — `/categories/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/categories` | [Public] | All active categories with children. Tree structure. |
| GET | `/categories/:slug` | [Public] | Category details + paginated products |
| GET | `/categories/:slug/filters` | [Public] | Available filter values for this category (sizes, colors, price range) |
| POST | `/categories` | [Admin] | Create |
| PUT | `/categories/:id` | [Admin] | Update |
| PUT | `/categories/reorder` | [Admin] | Bulk reorder. Body: `[{ id, sort_order }]` |
| DELETE | `/categories/:id` | [Admin] | Delete (blocked if has active products) |

---

### 4.4 Cart — `/cart/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/cart/:sessionId` | [Public] | Get cart with enriched variant details + live stock check |
| POST | `/cart/:sessionId/items` | [Public] | Add item. Body: `{ variant_id, quantity }`. Validates against available stock. |
| PUT | `/cart/:sessionId/items/:variantId` | [Public] | Update quantity. Body: `{ quantity }` |
| DELETE | `/cart/:sessionId/items/:variantId` | [Public] | Remove item |
| DELETE | `/cart/:sessionId` | [Public] | Clear all items |
| POST | `/cart/:sessionId/validate` | [Public] | Stock check all items. Returns items with `available`, `requested`, `valid` per item. Call before showing checkout button. |
| POST | `/cart/merge` | [Auth] | Merge anonymous cart into user's account after login. Body: `{ session_id }` |

**Rate limit:** `POST /cart/:sessionId/items` → 30 requests / 1 minute per IP.

---

### 4.5 Checkout — `/checkout/*`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/checkout/reserve` | [Public] | Reserve stock. Body: `{ session_id }`. Returns reservation expiry. |
| DELETE | `/checkout/reserve/:sessionId` | [Public] | Release reservation (user abandoned checkout) |
| POST | `/checkout/validate-address` | [Public] | Validate Nigerian address format. Body: `{ state, city }` |
| POST | `/promos/validate` | [Public] | Validate promo code. Body: `{ code, cart_total, email }`. Returns discount amount or error. |
| POST | `/checkout/initiate` | [Public] | Create pending order. Initiate Paystack payment. |
| GET | `/checkout/status/:reference` | [Public] | Get current order status by Paystack reference. Used on return from Paystack redirect. NEVER marks as paid. |

**Rate limit:** `POST /checkout/initiate` → 3 requests / 1 minute per IP.

**`POST /checkout/initiate` request body:**
```json
{
  "session_id": "cart-session-uuid",
  "customer": {
    "full_name": "Tunde Balogun",
    "email": "tunde@example.com",
    "phone": "08012345678"
  },
  "address": {
    "full_name": "Tunde Balogun",
    "phone": "08012345678",
    "address_line1": "14 Adeola Street",
    "address_line2": "Flat 3B",
    "city": "Ikeja",
    "state": "Lagos"
  },
  "delivery_option_id": "uuid",
  "promo_code": "GTS20",
  "customer_notes": "Call me when you arrive"
}
```

**`POST /checkout/initiate` server flow:**
1. Validate reservation exists and is not expired for this session_id
2. Validate all cart items still have sufficient available stock
3. Validate promo code (if provided) → compute discount
4. Create `customers` record (or find existing by email)
5. Create `addresses` record
6. Compute totals: subtotal, delivery_fee, discount_amount, total
7. Create `orders` record (status: 'pending_payment', session_id, ip_address from request headers)
8. Create `order_items` records with product_snapshot
9. Record promo_code_uses if promo applied
10. Call Paystack Initialize Transaction API with `amount`, `email`, `reference`, `callback_url`
11. Return Paystack `authorization_url`, `access_code`, `reference`, and `order_number`

**`POST /checkout/initiate` response:**
```json
{
  "data": {
    "order_id": "uuid",
    "order_number": "GTS-202606-000142",
    "paystack_authorization_url": "https://checkout.paystack.com/xxxxx",
    "paystack_access_code": "xxxxx",
    "paystack_reference": "gts_202606_xxxxx",
    "amount": 1800000,
    "expires_at": "2026-06-19T11:30:00Z"
  }
}
```

---

### 4.6 Webhooks — `/webhooks/*`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/webhooks/paystack` | [Public — HMAC verified] | Paystack event handler |

**`POST /webhooks/paystack` processing for `charge.success`:**
1. Verify `x-paystack-signature` header (HMAC-SHA512 with `PAYSTACK_SECRET_KEY`)
2. Insert into `webhook_events` for idempotency
3. Find order by `paystack_reference` → confirm order is in `pending_payment` status
4. Update `transactions` record: `payment_status = 'success'`, `paid_at = now()`
5. Update `orders.status = 'paid'`, `orders.paid_at = now()`
6. For each order_item: decrement `inventory.quantity`, decrement `inventory.reserved_quantity`, set `checkout_reservations.released = true`
7. Insert `stock_movements` per item (reason: 'sale_online')
8. Update `products.total_sold` for each product in order
9. Create `admin_notifications` record (type: 'new_order')
10. Send order confirmation email via Resend
11. Mark `webhook_events.processed = true`
12. Return `{ received: true }` with status 200

**Always return 200** — never 4xx or 5xx to Paystack (it triggers retries). Log errors internally.

Once `paid`, an admin manually progresses the order through `confirmed → processing → shipped → delivered` from the admin dashboard (see admin spec, Order Detail). There is no automated fulfillment beyond payment confirmation.

---

### 4.7 Orders — `/orders/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/orders` | [Orders]\|[Admin] | List all orders. Query: `?status=processing&channel=online&from=date&to=date&q=search&page=1&limit=25` |
| GET | `/orders/my` | [Auth] | Customer's own orders, newest first |
| GET | `/orders/:id` | [Orders]\|[Admin]\|Owner | Single order detail with items, transaction |
| GET | `/orders/track` | [Public] | Track by order_number + email. Query: `?order_number=GTS-xxx&email=xxx` |
| PUT | `/orders/:id/status` | [Orders]\|[Admin] | Update status. Body: `{ status, carrier_name?, tracking_number?, carrier_tracking_url?, reason? }` |
| PUT | `/orders/:id/notes` | [Orders]\|[Admin] | Update internal notes. Body: `{ internal_notes }` |
| POST | `/orders/:id/cancel` | [Admin] | Cancel order. Body: `{ reason }`. Only before 'shipped'. |
| POST | `/orders/:id/refund` | [Admin] | Initiate refund via Paystack. Body: `{ amount, reason }` |
| GET | `/orders/export` | [Admin] | CSV export with same filters as list |

**Status update triggers these emails:**
- `→ confirmed`: internal notification only (no customer email)
- `→ processing`: "Your order is being packed" email
- `→ shipped`: "Your order has shipped" email — includes `carrier_name`, `tracking_number`, and `carrier_tracking_url` if provided
- `→ delivered`: "Your order has been delivered" email + review request email (7-day delay via scheduled job)
- `→ cancelled`: "Your order has been cancelled" + refund info

**`PUT /orders/:id/status` validation:** When `status = 'shipped'`, `carrier_name` and `tracking_number` are strongly recommended but not strictly required at the database level (some walk-in-adjacent edge cases may ship without formal tracking) — the Route Handler should warn in the response if they're omitted but still allow the transition.

---

### 4.8 POS — `/pos/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/pos/products/search` | [Cashier]\|[Admin] | Search products for POS. Query: `?q=oxford&category_id=uuid`. Returns variants with live stock. |
| GET | `/pos/products/sku/:sku` | [Cashier]\|[Admin] | Exact SKU lookup for barcode scan. |
| GET | `/pos/products/barcode/:barcode` | [Cashier]\|[Admin] | [Phase 2] Barcode lookup |
| POST | `/pos/orders` | [Cashier]\|[Admin] | Create walk-in order. Body below. |
| GET | `/pos/orders/today` | [Cashier]\|[Admin] | Today's walk-in orders for this cashier |
| PUT | `/pos/orders/:id/void` | [Cashier]\|[Admin] | Void order (same-day only). Body: `{ reason }` |
| POST | `/pos/orders/:id/resend-receipt` | [Cashier]\|[Admin] | Resend receipt email. Body: `{ email }` |

**`POST /pos/orders` request body:**
```json
{
  "items": [
    { "variant_id": "uuid", "quantity": 2 }
  ],
  "payment_method": "pos_terminal",
  "manual_discount_amount": 0,
  "promo_code": null,
  "customer_name": "Walk-in Customer",
  "customer_email": null,
  "customer_phone": null
}
```

**`POST /pos/orders` server flow:**
1. Validate all variant IDs and check available stock (quantity - reserved_quantity)
2. Re-validate stock with row-level lock: `SELECT FOR UPDATE` on inventory rows
3. Create `customers` record (walk-in: full_name required, email optional)
4. Compute totals
5. Create `orders` (channel: 'walk_in', status: 'completed', cashier_id: auth.uid())
6. Create `order_items` with snapshots
7. Create `transactions` (confirmed_by: cashier UUID)
8. Decrement `inventory.quantity` for each item (atomic with SELECT FOR UPDATE)
9. Insert `stock_movements` (reason: 'sale_pos', actor_id: cashier)
10. Update `products.total_sold`
11. Log to `activity_logs`
12. If customer_email: send POS receipt via Resend
13. Return created order

**Rate limit:** `POST /pos/orders` → 20 requests / 1 minute per authenticated user.

---

### 4.9 Inventory — `/inventory/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/inventory` | [Inventory]\|[Admin] | All inventory with product/variant details. Query: `?low_stock=true&out_of_stock=true&product_id=uuid&page=1` |
| GET | `/inventory/:variantId` | [Inventory]\|[Admin] | Single variant inventory + last 20 stock movements |
| PUT | `/inventory/:variantId` | [Inventory]\|[Admin] | Adjust stock. Body: `{ adjustment_type: 'add'|'remove'|'set', quantity, reason, notes }` |
| POST | `/inventory/restock` | [Inventory]\|[Admin] | Bulk restock. Body: `[{ variant_id, quantity, notes }]` |
| GET | `/inventory/movements` | [Admin] | Stock movement log. Query: `?variant_id=uuid&reason=restock&from=date&to=date&page=1` |
| GET | `/inventory/low-stock` | [Admin] | All variants at or below threshold |
| GET | `/inventory/out-of-stock` | [Admin] | All variants with `quantity - reserved_quantity = 0` |

---

### 4.10 Reviews — `/reviews/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/reviews/product/:productId` | [Public] | Approved reviews for a product. Query: `?page=1&limit=10&sort=newest` |
| POST | `/reviews` | [Customer] | Create review. Body: `{ product_id, order_id, rating, title, body }`. Verifies purchase. |
| GET | `/reviews/pending` | [Admin] | Unapproved reviews awaiting moderation |
| PUT | `/reviews/:id/approve` | [Admin] | Approve review. Triggers `update_product_rating()`. |
| DELETE | `/reviews/:id` | [Admin] | Delete inappropriate review |
| GET | `/reviews/my` | [Customer] | Authenticated customer's own reviews |

---

### 4.11 Wishlist — `/wishlist/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/wishlist` | [Customer] | Get own wishlist with product details + stock status |
| POST | `/wishlist` | [Customer] | Add product. Body: `{ product_id }`. Idempotent. |
| DELETE | `/wishlist/:productId` | [Customer] | Remove product |
| GET | `/wishlist/check/:productId` | [Customer] | Check if product is wishlisted. Returns `{ is_wishlisted: bool }` |

---

### 4.12 Promos — `/promos/*`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/promos/validate` | [Public] | Validate a code. Body: `{ code, cart_total, email }`. Returns discount or error. |
| POST | `/promos/email-capture` | [Public] | Storefront email capture. Body: `{ email }`. Creates opt-in record + unique promo + sends via Resend. Rate limited: 1/day per email. |
| GET | `/promos` | [Admin] | List all promo codes with usage stats |
| POST | `/promos` | [Admin] | Create promo code |
| PUT | `/promos/:id` | [Admin] | Update promo (cannot update `uses_count` directly) |
| PUT | `/promos/:id/activate` | [Admin] | Toggle is_active |
| DELETE | `/promos/:id` | [Admin] | Delete (only if `uses_count = 0`) |

---

### 4.13 Support Tickets — `/tickets/*`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/tickets` | [Public] | Customer submits ticket. Body: `{ customer_email, customer_name, customer_phone?, subject, body, order_id? }`. Sends auto-reply email. |
| GET | `/tickets` | [Tickets]\|[Admin] | List tickets. Query: `?status=open&priority=urgent&assigned_to=me&page=1` |
| GET | `/tickets/:id` | [Tickets]\|[Admin] | Ticket with all messages |
| PUT | `/tickets/:id` | [Tickets]\|[Admin] | Update status, priority, assigned_to, tags |
| POST | `/tickets/:id/messages` | [Tickets]\|[Admin] | Staff reply. Body: `{ body, is_internal }`. If not internal: sends email to customer via Resend. |

**Rate limit:** `POST /tickets` → 3 requests / 10 minutes per IP.

---

### 4.14 Users / Staff — `/users/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/users/me` | [Auth] | Own profile + permissions |
| PUT | `/users/me` | [Auth] | Update own profile (name, phone only) |
| PUT | `/users/me/password` | [Auth] | Change password. Body: `{ current_password, new_password }` |
| GET | `/users` | [Admin] | All users. Query: `?role=cashier&is_blocked=false&page=1` |
| GET | `/users/customers` | [Admin] | All customers. Query: `?has_ordered=true&from=date&sort=total_spent&page=1` |
| GET | `/users/staff` | [Admin] | All non-customer users |
| POST | `/users/staff/invite` | [Admin] | Create staff account + send magic link. Body: `{ email, full_name, role, permissions: {...} }` |
| GET | `/users/:id` | [Admin] | Any user's profile + permissions + order history |
| PUT | `/users/:id/role` | [Admin] | Change role. Body: `{ role }` |
| PUT | `/users/:id/permissions` | [Admin] | Update `employee_permissions`. Body: `{ can_process_pos, can_manage_inventory, ... }` |
| PUT | `/users/:id/block` | [Admin] | Block account. Sets `is_blocked = true`. |
| PUT | `/users/:id/unblock` | [Admin] | Unblock account. |

---

### 4.15 Analytics — `/analytics/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/analytics/overview` | [Admin] | KPI summary. Query: `?period=7d` (7d, 30d, today, custom) |
| GET | `/analytics/sales` | [Admin] | Daily revenue data. Query: `?from=date&to=date&channel=online` |
| GET | `/analytics/channel-split` | [Admin] | Online vs walk-in revenue + order count |
| GET | `/analytics/products/top` | [Admin] | Best-selling products. Query: `?period=30d&limit=10` |
| GET | `/analytics/inventory/alerts` | [Admin] | Low stock + out of stock summary |
| GET | `/analytics/customers/new` | [Admin] | New customer count. Query: `?period=30d` |
| GET | `/analytics/orders/average-value` | [Admin] | AOV by period and channel |

**`GET /analytics/overview` response:**
```json
{
  "data": {
    "period": "7d",
    "revenue": {
      "total": 45000000,
      "online": 32000000,
      "walkin": 13000000,
      "change_pct": 12.5
    },
    "orders": {
      "total": 38,
      "online": 27,
      "walkin": 11,
      "change_pct": 8.1
    },
    "average_order_value": 1184210,
    "new_customers": 24,
    "orders_awaiting_shipment": 5,
    "low_stock_variants": 3
  }
}
```

---

### 4.16 Notifications — `/notifications/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/notifications` | [Admin] | Get recent admin notifications. Query: `?unread=true&limit=20` |
| GET | `/notifications/unread-count` | [Admin] | Just `{ count: N }`. Called on page load for bell badge. |
| PUT | `/notifications/:id/read` | [Admin] | Mark one notification read |
| PUT | `/notifications/read-all` | [Admin] | Mark all notifications read |

---

### 4.17 Content & Settings — `/content-slots/*`, `/settings/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/content-slots` | [Public] | All active slots (filtered by start/end date). Used by homepage. |
| GET | `/content-slots/:key` | [Public] | Single slot by key |
| PUT | `/content-slots/:key` | [Admin] | Update slot |
| GET | `/settings` | [Admin] | Get settings |
| PUT | `/settings` | [Admin] | Update settings |
| GET | `/delivery-options` | [Public] | Active shipping tiers |
| POST | `/delivery-options` | [Admin] | Create |
| PUT | `/delivery-options/:id` | [Admin] | Update |
| DELETE | `/delivery-options/:id` | [Admin] | Delete (blocked if referenced in active orders) |
| GET | `/size-guides/:categorySlug` | [Public] | Size guide for a category. Returns `chart_data` JSON + `how_to_measure` |
| PUT | `/size-guides/:categorySlug` | [Admin] | Create or update size guide |

---

### 4.18 Email Campaigns — `/email-campaigns/*`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/email-campaigns` | [Admin] | List all campaigns |
| POST | `/email-campaigns` | [Admin] | Create campaign (status: 'draft') |
| PUT | `/email-campaigns/:id` | [Admin] | Update draft campaign |
| POST | `/email-campaigns/:id/send` | [Admin] | Send now or schedule. Body: `{ schedule_at?: ISO_timestamp }` |
| GET | `/email-campaigns/:id` | [Admin] | Campaign detail with per-recipient stats |
| DELETE | `/email-campaigns/:id` | [Admin] | Delete draft (cannot delete sent campaigns) |

---

### 4.19 Upload — `/upload`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/upload` | [Staff]\|[Admin] | Upload file to Cloudinary. Multipart form data. Field: `file`. Returns `{ public_id, url }`. |

**Restrictions:** Max 10MB. Allowed types: `image/jpeg`, `image/png`, `image/webp`. Product images to `gts/products/` folder. Category banners to `gts/categories/`.

---

## Part 5: Middleware Configuration

`apps/web/middleware.ts` — runs at Vercel Edge before every request.

### 5.1 CORS

```typescript
const ALLOWED_ORIGINS = [
  'https://gts.ng',
  'https://dashboard.gts.ng',
  'http://localhost:3000',
  'http://localhost:3001',
];

// All /api/v1/* routes set CORS headers
// Options preflight returns 204 with appropriate headers
// Credentials: true (for auth cookies)
// Allowed methods: GET, POST, PUT, DELETE, OPTIONS
// Allowed headers: Content-Type, Authorization
```

### 5.2 Rate Limiting (Upstash Sliding Window)

```typescript
const RATE_LIMITS: Record<string, { requests: number; window: string }> = {
  '/api/v1/auth/login':                  { requests: 5,   window: '1m'  },
  '/api/v1/auth/register':               { requests: 3,   window: '1m'  },
  '/api/v1/auth/password-reset/request': { requests: 3,   window: '5m'  },
  '/api/v1/auth/anonymous':              { requests: 10,  window: '1m'  },
  '/api/v1/checkout/initiate':           { requests: 3,   window: '1m'  },
  '/api/v1/checkout/reserve':            { requests: 5,   window: '1m'  },
  '/api/v1/promos/email-capture':        { requests: 1,   window: '24h' }, // per email
  '/api/v1/tickets':                     { requests: 3,   window: '10m' },
  '/api/v1/pos/orders':                  { requests: 20,  window: '1m'  }, // per user
  '/api/v1/webhooks/paystack':           { requests: 200, window: '1m'  }, // higher; Paystack IPs
  '/api/v1/upload':                      { requests: 20,  window: '1m'  },
  '/api/v1/reviews':                     { requests: 5,   window: '5m'  },
  'default':                             { requests: 100, window: '1m'  }, // all other /api/v1/*
};
// Rate limit key: IP address for public routes; user_id for authenticated routes
// On limit exceeded: return 429 with Retry-After header
```

### 5.3 Blocked User Check

For authenticated requests: after JWT verification, query `users.is_blocked`. If true → return 403 `{ error: 'Account suspended', code: 'ACCOUNT_BLOCKED' }`. Cache this check in Upstash (TTL: 60s) to avoid DB query on every request.

### 5.4 Request Logging

Every API request logs to `activity_logs` for sensitive operations (not every GET, but all writes):
- Extract `actor_id` from JWT
- Extract `ip_address` from `x-forwarded-for` header
- Extract `user_agent` from request headers

---

## Part 6: Business Logic Specifications

### 6.1 Promo Code Validation Logic

```
POST /promos/validate

1. Find promo by code (case-insensitive: UPPER(code) = UPPER(input))
2. If not found: 404 "Code not found"
3. If is_active = false: 400 "Code is inactive"
4. If valid_from IS NOT NULL AND now() < valid_from: 400 "Code not yet active"
5. If valid_until IS NOT NULL AND now() > valid_until: 400 "Code has expired"
6. If usage_limit IS NOT NULL AND uses_count >= usage_limit: 400 "Code has reached its limit"
7. If per_customer_limit > 0 AND email provided:
   - Count rows in promo_code_uses where promo_code_id = X AND customer_email = email
   - If count >= per_customer_limit: 400 "You've already used this code"
8. If cart_total < min_order_value: 400 "Minimum order of ₦X,XXX required"
9. Compute discount:
   - percentage: discount = MIN(cart_total * value / 100, max_discount_cap ?? Infinity)
   - fixed_amount: discount = MIN(value, cart_total)   // never exceed cart total
10. Return { discount_amount, promo_code_id, code }
```

### 6.2 Stock Adjustment Logic (Inventory Route Handler)

```typescript
// PUT /inventory/:variantId
// adjustment_type: 'add' | 'remove' | 'set'
// quantity: positive integer

const current = await db.inventory.findByVariantId(variantId);

let delta: number;
let newQuantity: number;

if (adjustment_type === 'add') {
  delta = quantity;
  newQuantity = current.quantity + quantity;
} else if (adjustment_type === 'remove') {
  if (quantity > current.quantity) throw new Error('Cannot remove more than current stock');
  delta = -quantity;
  newQuantity = current.quantity - quantity;
} else if (adjustment_type === 'set') {
  delta = quantity - current.quantity;
  newQuantity = quantity;
}

// Atomic update
await db.transaction(async (tx) => {
  await tx.inventory.update({ quantity: newQuantity, last_restocked_at: adjustment_type === 'add' ? now() : undefined });
  await tx.stock_movements.insert({ variant_id, delta, reason, actor_id, notes });
  await tx.activity_logs.insert({ action: 'inventory.adjusted', actor_id, before: current.quantity, after: newQuantity });
  
  // If now at or below threshold: create admin_notification if not created in last 24h
  if (newQuantity <= current.low_stock_threshold) {
    await createLowStockNotificationIfNotRecent(variantId);
  }
});
```

### 6.3 Order Status Transition Rules

```
Valid transitions (admin/staff can perform):
pending_payment    → cancelled (payment never arrived)
paid               → confirmed, cancelled
confirmed          → processing, cancelled
processing         → shipped, cancelled
shipped            → delivered
delivered          → return_requested
return_requested   → refunded

Invalid: No backward movement. No skipping mandatory steps.
Walk-in: pending → completed or voided (same day only for void).

Each transition:
1. Validates the current status allows the target
2. Updates orders.status + sets the relevant timestamp
3. On → shipped: accepts carrier_name, tracking_number, carrier_tracking_url in the request body and stores them on the order
4. Logs to activity_logs
5. Sends email if applicable (see email trigger table)
```

---

## Part 7: Email Triggers (Resend)

| Trigger | Template | Recipient | Sender |
|---|---|---|---|
| Order placed (webhook) | `OrderConfirmation` | customer | `orders@gts.ng` |
| Order → processing | `OrderBeingPrepared` | customer | `orders@gts.ng` |
| Order → shipped | `OrderShipped` (includes carrier + tracking info if provided) | customer | `orders@gts.ng` |
| Order → delivered | `DeliveryConfirmation` | customer | `orders@gts.ng` |
| Order → cancelled | `OrderCancellation` | customer | `orders@gts.ng` |
| Review request (7 days post-delivery) | `ReviewRequest` | customer | `orders@gts.ng` |
| New user registered | `Welcome` | customer | `hello@gts.ng` |
| Password reset request | `PasswordReset` (1hr expiry) | user | `noreply@gts.ng` |
| Email opt-in capture | `WelcomeDiscount` | subscriber | `hello@gts.ng` |
| Staff invited | `StaffInvite` (magic link) | new staff | `noreply@gts.ng` |
| Support ticket created | `SupportAutoReply` | customer | `support@gts.ng` |
| Staff replies to ticket | `SupportReply` | customer | `support@gts.ng` |
| POS receipt | `POSReceipt` | customer (if email given) | `orders@gts.ng` |

**All React Email templates in:** `apps/web/emails/`  
**Resend sending domain:** `gts.ng` — must be verified before any email can send.

---

## Part 8: Cron Jobs

### 8.1 Supabase pg_cron (runs in DB)

```sql
-- Release expired checkout reservations every 5 minutes
SELECT cron.schedule('release-reservations', '*/5 * * * *', $$
  UPDATE inventory i
  SET reserved_quantity = GREATEST(0,
    reserved_quantity - sub.total_reserved
  )
  FROM (
    SELECT variant_id, SUM(quantity) AS total_reserved
    FROM checkout_reservations
    WHERE expires_at < now() AND released = false
    GROUP BY variant_id
  ) sub
  WHERE i.variant_id = sub.variant_id;

  UPDATE checkout_reservations
  SET released = true
  WHERE expires_at < now() AND released = false;
$$);

-- Low stock notification check every hour
SELECT cron.schedule('low-stock-alerts', '0 * * * *', $$
  INSERT INTO admin_notifications (type, title, message, entity_id, entity_type)
  SELECT
    'low_stock',
    p.name || ' — ' || pv.size || ' ' || COALESCE(pv.color, '') || ' is low on stock',
    'Only ' || (i.quantity - i.reserved_quantity) || ' units remaining',
    pv.id,
    'product_variant'
  FROM inventory i
  JOIN product_variants pv ON pv.id = i.variant_id
  JOIN products p ON p.id = pv.product_id
  WHERE i.quantity - i.reserved_quantity <= i.low_stock_threshold
    AND p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM admin_notifications an
      WHERE an.entity_id = pv.id
        AND an.type = 'low_stock'
        AND an.created_at > now() - INTERVAL '24 hours'
    )
  ON CONFLICT DO NOTHING;
$$);
```

### 8.2 Vercel Cron (runs in API Route Handler)

```typescript
// /api/v1/cron/cleanup-carts
// Schedule: 0 2 * * * (daily at 2am UTC)
// Delete cart sessions older than 30 days (cascade deletes cart_items)

// /api/v1/cron/update-bestsellers
// Schedule: 0 1 * * * (daily at 1am UTC)
// UPDATE products SET total_sold = (
//   SELECT COALESCE(SUM(oi.quantity), 0)
//   FROM order_items oi JOIN orders o ON o.id = oi.order_id
//   WHERE (oi.product_snapshot->>'product_id')::UUID = products.id
//     AND o.status = 'delivered'
//     AND o.delivered_at > now() - INTERVAL '30 days'
// );

// /api/v1/cron/send-review-requests
// Schedule: 0 10 * * * (daily at 10am UTC)
// Find orders delivered 7 days ago where customer hasn't reviewed yet
// Send ReviewRequest email for each unreviewed product in the order
```

---

## Part 9: Security Contracts

These are hard requirements. No PR merges without all of these passing.

1. **RLS on all tables.** `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;` must return zero rows.

2. **Service role key never in client bundles.** `grep -r "SUPABASE_SERVICE_ROLE" apps/*/app/\(storefront\) apps/*/app/\(dashboard\)` must return nothing.

3. **Paystack webhook HMAC verified on every request.** The verification is the first operation in the Route Handler, before any DB queries.

4. **Webhook idempotency.** `webhook_events` table prevents double-processing. Check before any fulfillment action.

5. **No raw SQL from user input.** All Supabase queries use parameterized methods. No string template literals for SQL.

6. **Admin routes double-gated.** Middleware reads JWT role claim AND Route Handler calls `supabase.auth.getUser()` to re-verify. Both must pass.

7. **`cost_price` never in any public API response.** The `products.cost_price` field is for admin margin calculation only. It must be explicitly excluded from all `SELECT` queries in public-facing routes.

8. **Order numbers not guessable.** Public tracking requires BOTH `order_number` AND `email`. Neither alone reveals data.

9. **Cloudinary API secret server-side only.** All uploads proxy through `/api/v1/upload`. No client-to-Cloudinary direct.

10. **`is_blocked` check cached.** Upstash Redis caches the blocked status (TTL: 60s) to avoid DB query on every authenticated request while still reacting to blocks within 1 minute.

---

## Part 10: Environment Variables

### `apps/web` (Storefront + API)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # NEVER NEXT_PUBLIC_

# Paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_SECRET_KEY=sk_test_xxx    # NEVER NEXT_PUBLIC_
PAYSTACK_WEBHOOK_SECRET=xxx        # for HMAC verification

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=gts-brand
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx          # NEVER NEXT_PUBLIC_

# Resend
RESEND_API_KEY=re_xxx              # NEVER NEXT_PUBLIC_
RESEND_FROM_ORDERS=orders@gts.ng
RESEND_FROM_SUPPORT=support@gts.ng
RESEND_FROM_NOREPLY=noreply@gts.ng

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx       # NEVER NEXT_PUBLIC_

# App
NEXT_PUBLIC_APP_URL=https://gts.ng
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.gts.ng
CRON_SECRET=xxx                    # for securing Vercel cron endpoints
```

### `apps/dashboard` (Staff Portal)

```env
# Supabase (same project, different role)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# API base URL
NEXT_PUBLIC_API_BASE_URL=https://gts.ng/api/v1

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```
