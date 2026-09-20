-- D003 (docs/00-open-questions.md): granular POS permissions, cashier product
-- flags, and an index for per-staff activity lookups.

-- 1. Separate POS permission flags. can_process_pos still gates the terminal;
--    voiding a sale and giving a manual discount now need their own grant.
--    Admins are implicitly allowed both.
ALTER TABLE employee_permissions
  ADD COLUMN IF NOT EXISTS can_void_orders      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_apply_discounts  BOOLEAN NOT NULL DEFAULT false;

-- 2. Product flags: a cashier raises an issue on a product (wrong price, stock
--    count off, damaged, ...) for an admin to review. Not the same as
--    support_tickets, which are customer-facing and require a customer email.
CREATE TABLE IF NOT EXISTS product_flags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id       UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  raised_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  reason           VARCHAR(30) NOT NULL
    CHECK (reason IN ('wrong_price', 'wrong_stock', 'damaged', 'missing_image', 'barcode_issue', 'other')),
  note             VARCHAR(500),
  status           VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  resolution_note  VARCHAR(500),
  resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_flags_status  ON product_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_flags_product ON product_flags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_flags_raiser  ON product_flags(raised_by, created_at DESC);

-- One live flag per person per product per reason, so a cashier can't spam
-- the same issue. Resolved/dismissed flags don't count.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_flags_open
  ON product_flags(raised_by, product_id, reason)
  WHERE status IN ('open', 'in_review');

ALTER TABLE product_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_insert_own_flags" ON product_flags;
DROP POLICY IF EXISTS "staff_read_own_flags" ON product_flags;
DROP POLICY IF EXISTS "admin_manage_flags" ON product_flags;

CREATE POLICY "staff_insert_own_flags" ON product_flags FOR INSERT
  WITH CHECK (
    raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM employee_permissions ep
      WHERE ep.user_id = auth.uid() AND ep.can_process_pos = true
    )
  );
CREATE POLICY "staff_read_own_flags" ON product_flags FOR SELECT
  USING (raised_by = auth.uid());
CREATE POLICY "admin_manage_flags" ON product_flags FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

-- 3. Per-staff activity lookups (profile page, admin audit view).
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_id, created_at DESC);
