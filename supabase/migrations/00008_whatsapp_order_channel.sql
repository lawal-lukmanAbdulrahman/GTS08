-- Adds the 'whatsapp' order channel: a staff member creates a pending order
-- while chatting with a customer on WhatsApp; a cashier later looks it up by
-- order_number in the POS to confirm payment. See docs/00-open-questions.md
-- for the decision record (gts_03_cashier_spec.md Part 1-9 predates this).

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
ALTER TABLE orders ADD CONSTRAINT orders_channel_check
  CHECK (channel IN ('online', 'walk_in', 'whatsapp'));
