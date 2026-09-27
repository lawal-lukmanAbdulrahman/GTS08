# Scope Amendments

## AMENDMENT 001: Delivery System Removal

**Status:** ACTIVE — overrides specs where applicable.

### Changes

1. **Delivery/driver system removed entirely.** No driver role, no driver tables, no driver routes, no driver portal/UI.
2. **`gts_04_delivery.md` is DEPRECATED.** Kept for reference but must not be implemented.
3. **Revised order state machine** (supersedes backend spec §6.3):
   - `pending_payment` → `paid` → `processing` → `ready_for_pickup` → `completed`
   - `cancelled` is reachable from `pending_payment`, `paid`, `processing`
   - No backward moves, no skipped steps.
4. **11-sprint plan** replaces the original sprint plan.

### Schema Deltas

- No `drivers` table
- No `driver_id` columns
- No delivery-related enums or status values

## AMENDMENT 002: Demo / live data isolation (revised 2026-09-27)

**Status:** ACTIVE. Requested by the owner: start production clean, and keep everything recorded while the app was built as demo data that only a demo account can see.

### Model

- **Data follows the account, not a switch.** `users.is_demo` marks demo accounts. A demo account sees and writes only demo rows; everyone else, including anonymous storefront visitors, sees only the live shop. (The first version had a shop-wide `settings.data_mode` switch; that column is no longer read.)
- **What is split** (`is_test` on each row, existing rows = demo):
  - Business records (migration `00024`): `orders`, `order_items`, `transactions`, `checkout_reservations`, `promo_code_uses`, `customers`, `addresses`, `support_tickets`, `ticket_messages`, `admin_notifications`, `email_campaigns`, `activity_logs`, `stock_movements`, `product_views`, `search_queries`.
  - Catalogue and storefront content (migration `00025`): `products`, `product_variants`, `product_images`, `inventory`, `categories`, `brands`, `promos`, `product_flags`, `content_slots`, `size_guides`, `reviews`, `product_drafts`, `hero_carousel`.
- **Shared on purpose:** staff and customer accounts (`users`, `employee_permissions`), store details (`settings`), carts and wishlists (keyed per visitor), `storefront_sections`, webhook de-duplication.
- Slugs, SKUs, barcodes, brand names, promo codes and content slot keys are unique per data set, so the live shop can reuse a demo name.

### Enforcement

- **Public and signed-in keys:** a RESTRICTIVE RLS policy (`gts_mode_isolation`) on each split table compares `is_test` with `gts_is_test_mode()`, which is the signed-in user's `is_demo` (false for anonymous).
- **Server (service role, bypasses RLS):** `packages/database/src/data-scope.ts` reads the caller from the bearer token or Supabase session cookie, adds `is_test=eq.<mode>` to every query on a split table, and stamps every insert/upsert with the caller's mode (overriding any `is_test` the caller sent). `search_products` takes `data_is_test`. `createServiceClient({ allModes: true })` opts out; only the Paystack webhook and the two stock-releasing cron jobs use it.
- **The demo account is sandboxed:** it can't change store settings, staff accounts/permissions or its own login (`DEMO_READ_ONLY`), can never hold super-admin powers, never sends email, and its answers are never publicly cached (`publicCache`). Staff lists show only accounts on the caller's side.

### Known limits

- The token is decoded (not verified) only to choose the data set; every protected route still verifies it, so a forged token can only view public demo data.
- `users.total_orders` / `total_spent` (trigger-maintained) count both data sets. Order numbers share one sequence.
- A demo account's Paystack payment would record its transaction as live (the webhook runs without a caller).
