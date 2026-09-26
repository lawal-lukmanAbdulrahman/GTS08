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

## AMENDMENT 002: Test / Live data isolation

**Status:** ACTIVE. Requested by the owner: start production clean while keeping everything recorded so far as test data.

### Changes

1. **`is_test` flag** (migration `00017_test_data_isolation.sql`) on the business-data tables: `orders`, `order_items`, `transactions`, `checkout_reservations`, `promo_code_uses`, `customers`, `addresses`, `support_tickets`, `ticket_messages`, `admin_notifications`, `email_campaigns`, `activity_logs`, `stock_movements`. Every row that existed at migration time is marked test data; new rows take the mode that is active when they are written (column default `gts_is_test_mode()`).
2. **`settings.data_mode`** (`'test'` | `'live'`, default `'live'`) says which side the app shows. Only the super admin can change it (`PUT /api/v1/settings/data-mode`); the change is audit-logged as `settings.data_mode`. Nothing is deleted.
3. **Enforcement.** The public and signed-in keys are held to the current mode by a RESTRICTIVE RLS policy (`gts_mode_isolation`) on each table. The server (service-role) client bypasses RLS, so `packages/database/src/data-scope.ts` adds `is_test=eq.<mode>` to every query on those tables. `createServiceClient({ allModes: true })` opts out, and is used only by the Paystack webhook and the two stock-releasing cron jobs, which must reach records of either mode.
4. **Shared on purpose:** catalogue (products, variants, images, categories, brands, inventory levels, promos, content slots, size guides), staff accounts and permissions, carts and wishlists, reviews, webhook de-duplication, settings.

### Known limits

- The mode is cached for up to 5 seconds per server instance (the instance that changes it refreshes immediately).
- `users.total_orders` / `total_spent` (maintained by a trigger) count orders of both modes.
- Order numbers come from one sequence, so live numbering continues after the test numbers rather than restarting at 1.
