-- ==========================================
-- GTS Platform — Initial Database Migration
-- Schema Version: 2.2
-- ==========================================

-- 1. Helper Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Custom Access Token Hook for Supabase Auth JWT Claims
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

-- 3. Auto-enable RLS Event Trigger
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

DROP EVENT TRIGGER IF EXISTS auto_enable_rls;
CREATE EVENT TRIGGER auto_enable_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION enable_rls_on_new_tables();

-- 4. Order Number Sequence & Generator
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'GTS-' ||
    TO_CHAR(NOW(), 'YYYYMM') || '-' ||
    LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Core Public Tables

-- 5.1 Users
CREATE TABLE IF NOT EXISTS users (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   VARCHAR(255) UNIQUE,
  full_name               VARCHAR(255),
  phone                   VARCHAR(20),
  role                    VARCHAR(30) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'cashier', 'inventory_staff', 'admin')),
  avatar_cloudinary_id    TEXT,
  is_anonymous            BOOLEAN NOT NULL DEFAULT false,
  is_blocked              BOOLEAN NOT NULL DEFAULT false,
  email_marketing_opt_out BOOLEAN NOT NULL DEFAULT false,
  email_verified_at       TIMESTAMPTZ,
  total_orders            INTEGER NOT NULL DEFAULT 0,
  total_spent             INTEGER NOT NULL DEFAULT 0, -- stored in kobo
  last_order_at           TIMESTAMPTZ,
  last_sign_in_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Trigger: auto-create users row on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_anonymous)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_app_meta_data->>'provider' = 'anonymous')
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5.2 Employee Permissions
CREATE TABLE IF NOT EXISTS employee_permissions (
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

-- 5.3 Categories
CREATE TABLE IF NOT EXISTS categories (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(100) NOT NULL,
  slug                        VARCHAR(100) NOT NULL UNIQUE,
  description                 TEXT,
  banner_cloudinary_id        TEXT,
  mobile_banner_cloudinary_id TEXT,
  parent_id                   UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order                  INTEGER NOT NULL DEFAULT 0,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  seo_title                   VARCHAR(70),
  seo_description             VARCHAR(160),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE is_active = true;

-- 5.4 Products
CREATE TABLE IF NOT EXISTS products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(255) NOT NULL UNIQUE,
  sku                   VARCHAR(100) UNIQUE,
  short_description     VARCHAR(300),
  description           TEXT,
  fit_notes             TEXT,
  fabric_care           TEXT,
  material              VARCHAR(255),
  category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
  base_price            INTEGER NOT NULL CHECK (base_price > 0), -- kobo
  compare_at_price      INTEGER, -- kobo
  cost_price            INTEGER, -- kobo; admin only
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'archived')),
  is_featured           BOOLEAN NOT NULL DEFAULT false,
  tags                  TEXT[] DEFAULT '{}',
  total_sold            INTEGER NOT NULL DEFAULT 0,
  average_rating        DECIMAL(3,2),
  review_count          INTEGER NOT NULL DEFAULT 0,
  seo_title             VARCHAR(70),
  seo_description       VARCHAR(160),
  weight_grams          INTEGER,
  search_vector         TSVECTOR,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_total_sold ON products(total_sold DESC);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);

-- Search Vector Auto-update Trigger
CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.short_description, '') || ' ' ||
    coalesce(NEW.material, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

-- 5.5 Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size            VARCHAR(20),
  color           VARCHAR(50),
  color_hex       VARCHAR(7),
  sku             VARCHAR(150),
  barcode         VARCHAR(100),
  price_modifier  INTEGER NOT NULL DEFAULT 0, -- kobo
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- 5.6 Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id            UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  cloudinary_public_id  TEXT NOT NULL,
  alt_text              VARCHAR(255),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_primary            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_per_product ON product_images(product_id) WHERE is_primary = true;

-- 5.7 Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id          UUID NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  last_restocked_at   TIMESTAMPTZ,
  last_sold_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(variant_id)
  WHERE quantity - reserved_quantity <= low_stock_threshold;

-- 5.8 Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  delta       INTEGER NOT NULL,
  reason      VARCHAR(30) NOT NULL
    CHECK (reason IN (
      'sale_online', 'sale_pos', 'restock', 'adjustment',
      'return', 'reservation', 'release', 'void', 'write_off', 'correction'
    )),
  order_id    UUID,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_mv_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_mv_order ON stock_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_mv_created ON stock_movements(created_at DESC);

-- 5.9 Customers & Addresses
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  phone       VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
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

-- 5.10 Orders & Order Items
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          VARCHAR(30) NOT NULL UNIQUE DEFAULT generate_order_number(),
  channel               VARCHAR(20) NOT NULL DEFAULT 'online'
    CHECK (channel IN ('online', 'walk_in')),
  status                VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'paid', 'confirmed', 'processing',
      'shipped', 'delivered', 'cancelled', 'completed', 'voided'
    )),
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  address_id            UUID REFERENCES addresses(id) ON DELETE SET NULL,
  delivery_option_id    UUID,
  promo_code            VARCHAR(50),
  subtotal              INTEGER NOT NULL CHECK (subtotal >= 0), -- kobo
  delivery_fee          INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0), -- kobo
  discount_amount       INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0), -- kobo
  total                 INTEGER NOT NULL CHECK (total >= 0), -- kobo
  ip_address            VARCHAR(45),
  session_id            VARCHAR(255),
  cashier_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  internal_notes        TEXT,
  carrier_name          VARCHAR(100),
  tracking_number       VARCHAR(100),
  carrier_tracking_url  VARCHAR(500),
  paid_at               TIMESTAMPTZ,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id       UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price       INTEGER NOT NULL CHECK (unit_price >= 0), -- kobo
  line_total       INTEGER NOT NULL CHECK (line_total >= 0), -- kobo
  product_snapshot JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Trigger: update user stats when order delivered
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

DROP TRIGGER IF EXISTS order_stats_update ON orders;
CREATE TRIGGER order_stats_update
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_order_stats();

-- 5.11 Transactions & Webhook Events
CREATE TABLE IF NOT EXISTS transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method          VARCHAR(30) NOT NULL
    CHECK (payment_method IN (
      'paystack_card', 'paystack_bank', 'paystack_ussd',
      'paystack_qr', 'cash', 'pos_terminal'
    )),
  payment_status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'success', 'failed', 'refunded')),
  amount                  INTEGER NOT NULL, -- kobo
  paystack_reference      VARCHAR(255) UNIQUE,
  paystack_transaction_id VARCHAR(255),
  paystack_channel        VARCHAR(50),
  paystack_fees           INTEGER, -- kobo
  confirmed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        VARCHAR(30) NOT NULL DEFAULT 'paystack',
  event_type      VARCHAR(100) NOT NULL,
  event_id        VARCHAR(255) NOT NULL,
  payload         JSONB NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT false,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- 5.12 Cart & Checkout Reservations
CREATE TABLE IF NOT EXISTS cart_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  VARCHAR(255) NOT NULL UNIQUE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  VARCHAR(255) NOT NULL REFERENCES cart_sessions(session_id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, variant_id)
);

CREATE TABLE IF NOT EXISTS checkout_reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  VARCHAR(255) NOT NULL,
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  released    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.13 Promos & Uses
CREATE TABLE IF NOT EXISTS promos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50) NOT NULL UNIQUE,
  discount_type     VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value    INTEGER NOT NULL CHECK (discount_value > 0),
  min_order_amount  INTEGER DEFAULT 0,
  max_uses          INTEGER,
  used_count        INTEGER NOT NULL DEFAULT 0,
  starts_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_code_uses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id    UUID NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.14 Reviews & Wishlists
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        VARCHAR(100),
  body         TEXT,
  is_approved  BOOLEAN NOT NULL DEFAULT false,
  approved_at  TIMESTAMPTZ,
  approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- 5.15 Size Guides, Support Tickets, Content Slots, Notifications, Activity Logs
CREATE TABLE IF NOT EXISTS size_guides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  title          VARCHAR(100) NOT NULL DEFAULT 'Size Guide',
  chart_data     JSONB NOT NULL,
  how_to_measure TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
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

CREATE TABLE IF NOT EXISTS ticket_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  VARCHAR(10) NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT false,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_slots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key                  VARCHAR(50) NOT NULL UNIQUE
    CHECK (slot_key IN ('hero_1', 'hero_2', 'hero_3', 'promo_banner', 'deal_banner', 'announcement_bar')),
  headline                  VARCHAR(200),
  subheadline               VARCHAR(300),
  cta_label                 VARCHAR(100),
  cta_link                  VARCHAR(500),
  image_cloudinary_id       TEXT,
  mobile_image_cloudinary_id TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT false,
  start_date                TIMESTAMPTZ,
  end_date                  TIMESTAMPTZ,
  updated_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          VARCHAR(255) NOT NULL,
  preview_text     VARCHAR(90),
  body_html        TEXT,
  cta_label        VARCHAR(100),
  cta_link         VARCHAR(500),
  audience_type    VARCHAR(30) NOT NULL
    CHECK (audience_type IN ('all', 'ordered_last_30', 'never_ordered', 'opted_in_only', 'custom')),
  audience_params  JSONB,
  recipient_count  INTEGER,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(40) NOT NULL
    CHECK (type IN ('low_stock', 'new_ticket', 'new_order', 'payment_failed', 'new_return_request')),
  title        VARCHAR(200) NOT NULL,
  message      TEXT NOT NULL,
  link         VARCHAR(500),
  is_read      BOOLEAN NOT NULL DEFAULT false,
  read_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  target_type   VARCHAR(50) NOT NULL,
  target_id     UUID,
  changes       JSONB,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  description   VARCHAR(255),
  price         INTEGER NOT NULL CHECK (price >= 0), -- kobo
  estimated_days VARCHAR(50),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name                    VARCHAR(100) NOT NULL DEFAULT 'GTS',
  support_email                 VARCHAR(255) NOT NULL DEFAULT 'hello@gts.ng',
  support_phone                 VARCHAR(20),
  whatsapp_number               VARCHAR(20),
  currency                      VARCHAR(3) NOT NULL DEFAULT 'NGN',
  free_shipping_threshold       INTEGER DEFAULT 5000000, -- kobo (₦50,000)
  default_low_stock_threshold   INTEGER NOT NULL DEFAULT 5,
  tax_rate                      DECIMAL(5,2) NOT NULL DEFAULT 7.50,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Singleton Settings
INSERT INTO settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 6. Row Level Security Policies & Automatic RLS Enforcement

-- 6.0 Automatic RLS Enforcement (Guaranteed active on all tables)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 6.1 Users RLS
DROP POLICY IF EXISTS "users_read_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "admin_read_all_users" ON users;
DROP POLICY IF EXISTS "admin_update_all_users" ON users;

CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_read_all_users" ON users FOR SELECT USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
CREATE POLICY "admin_update_all_users" ON users FOR UPDATE USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

-- 6.2 Categories RLS
DROP POLICY IF EXISTS "public_read_active_cats" ON categories;
DROP POLICY IF EXISTS "staff_read_all_cats" ON categories;
DROP POLICY IF EXISTS "admin_manage_cats" ON categories;

CREATE POLICY "public_read_active_cats" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "staff_read_all_cats" ON categories FOR SELECT USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff', 'cashier'));
CREATE POLICY "admin_manage_cats" ON categories FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

-- 6.3 Products RLS
DROP POLICY IF EXISTS "public_read_active_products" ON products;
DROP POLICY IF EXISTS "staff_read_all_products" ON products;
DROP POLICY IF EXISTS "admin_inv_manage_products" ON products;

CREATE POLICY "public_read_active_products" ON products FOR SELECT USING (status = 'active');
CREATE POLICY "staff_read_all_products" ON products FOR SELECT USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'cashier', 'inventory_staff'));
CREATE POLICY "admin_inv_manage_products" ON products FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));

-- 6.4 Variants & Images RLS
DROP POLICY IF EXISTS "public_read_active_variants" ON product_variants;
DROP POLICY IF EXISTS "staff_read_all_variants" ON product_variants;
DROP POLICY IF EXISTS "admin_inv_manage_variants" ON product_variants;
DROP POLICY IF EXISTS "public_read_images" ON product_images;
DROP POLICY IF EXISTS "admin_inv_manage_images" ON product_images;

CREATE POLICY "public_read_active_variants" ON product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "staff_read_all_variants" ON product_variants FOR SELECT USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'cashier', 'inventory_staff'));
CREATE POLICY "admin_inv_manage_variants" ON product_variants FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));
CREATE POLICY "public_read_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "admin_inv_manage_images" ON product_images FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));

-- 6.5 Inventory RLS
DROP POLICY IF EXISTS "public_read_inventory" ON inventory;
DROP POLICY IF EXISTS "staff_manage_inventory" ON inventory;

CREATE POLICY "public_read_inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "staff_manage_inventory" ON inventory FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));

-- 6.6 Orders & Items RLS
DROP POLICY IF EXISTS "admin_staff_read_orders" ON orders;
DROP POLICY IF EXISTS "admin_staff_manage_orders" ON orders;
DROP POLICY IF EXISTS "admin_staff_read_order_items" ON order_items;

CREATE POLICY "admin_staff_read_orders" ON orders FOR SELECT USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff', 'cashier'));
CREATE POLICY "admin_staff_manage_orders" ON orders FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff'));
CREATE POLICY "admin_staff_read_order_items" ON order_items FOR SELECT USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('admin', 'inventory_staff', 'cashier'));

-- 6.7 Public Delivery Options & Content Slots & Settings RLS
DROP POLICY IF EXISTS "public_read_delivery_options" ON delivery_options;
DROP POLICY IF EXISTS "admin_manage_delivery_options" ON delivery_options;
DROP POLICY IF EXISTS "public_read_content_slots" ON content_slots;
DROP POLICY IF EXISTS "admin_manage_content_slots" ON content_slots;
DROP POLICY IF EXISTS "public_read_settings" ON settings;
DROP POLICY IF EXISTS "admin_manage_settings" ON settings;

CREATE POLICY "public_read_delivery_options" ON delivery_options FOR SELECT USING (is_active = true);
CREATE POLICY "admin_manage_delivery_options" ON delivery_options FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
CREATE POLICY "public_read_content_slots" ON content_slots FOR SELECT USING (is_active = true);
CREATE POLICY "admin_manage_content_slots" ON content_slots FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
CREATE POLICY "public_read_settings" ON settings FOR SELECT USING (true);
CREATE POLICY "admin_manage_settings" ON settings FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
