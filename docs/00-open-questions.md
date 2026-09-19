# Open Questions & Decision Log

> Check this file before touching any affected area. Resolved decisions are binding.

## Resolved Decisions

### D001 — WhatsApp order channel (2026-09-18)

`gts_03_cashier_spec.md` only covers walk-in orders. Client requested a second
flow: a customer orders over WhatsApp chat; a staff member records the order
(order number generated); later, a cashier looks the order up by number in the
POS, confirms it, takes payment, and issues a receipt.

Decisions:
- Added `'whatsapp'` to `orders.channel` (migration `00008`), alongside
  `'online'` / `'walk_in'`.
- Order creation for this channel is staff-entered (no live WhatsApp Business
  API integration exists in this codebase) — a staff member with
  `can_process_pos = true` builds the cart from the chat conversation and
  creates the order as `status = 'pending_payment'`. The generated
  `order_number` is read back to the customer over WhatsApp manually.
- A cashier confirms later via `GET /pos/whatsapp-orders/:orderNumber` →
  `POST /pos/whatsapp-orders/:id/confirm`, which reuses the same payment /
  inventory-decrement / receipt logic as walk-in order confirmation
  (`gts_03_cashier_spec.md` Part 5.2).
- No `customers.email` is required for this channel (column is `NOT NULL`);
  when no email is given, contact info is stored in `orders.internal_notes`
  instead of a `customers` row, matching the existing walk-in-without-email
  path.
- Receipt delivery: browser print dialog (`@media print`, same as walk-in)
  plus a `wa.me` deep-link "Share via WhatsApp" button — no server-side
  WhatsApp send integration (none exists; would need a verified WhatsApp
  Business API account).

### D002 — Receipt store details are admin-managed (2026-09-19)

The receipt header (store name, address, phone) was first read from
`NEXT_PUBLIC_STORE_*` env vars. It now comes from the existing `settings`
singleton (`store_name`, `support_phone`) plus a new `store_address` column
(migration `00009`), edited by admins at `/admin/settings` and served by
`GET/PATCH /api/v1/settings` (PATCH is admin-only, re-verified server-side).
The POS falls back to name "GTS" with no address/phone if the settings can't
be loaded, so a receipt can always be printed. The env vars were removed.

### D003 — POS staff access, sub-admin records, product flags (2026-09-19)

The POS is the point of sale for sub-admins (cashiers); their actions are
recorded against their own profile. Decisions (reviewer: project owner):

- **Separate permission flags:** `can_void_orders` and `can_apply_discounts`
  (migration `00010`) alongside `can_process_pos`. Admins are implicitly
  allowed both.
- **Voids:** a cashier can void only sales they took payment for; admins can
  void any. Requires `can_void_orders`.
- **Manual discounts:** need `can_apply_discounts`; above 20% of the subtotal
  only an admin may apply. Promo codes are NOT built (`/promos/validate` is an
  unimplemented stub) and are out of scope here.
- **Ownership of a sale:** the staff member who confirmed payment
  (`transactions.confirmed_by`). For WhatsApp orders that can differ from who
  recorded the order (`orders.cashier_id`).
- **Audit:** every staff write action is written to `activity_logs`
  (spec: employee portal Part 9.4). Cashiers see only their own; admins see
  everyone's.
- **Product flags:** cashiers raise issues on a product (wrong price/stock,
  damaged, missing image, barcode, other) into a new `product_flags` table,
  reviewed by admins. `support_tickets` is customer-facing and not reused.
- **Session:** sign-out revokes the session and clears cookies; idle lock at
  30 minutes keeps the cart; blocked accounts are signed out on the next call.
- **Products on load:** the POS lists active products (best sellers first)
  before any search. The WhatsApp confirm tab lists pending orders to pick
  from (the reading of "same for orders" is unconfirmed by the owner and easy
  to revert).

## Spec Corrections

- `gts_03_cashier_spec.md` Part 9's documented paths (`/pos/orders`,
  `/pos/orders/:id/void`) are implemented as such. The pre-existing stub
  files at `apps/web/app/api/v1/pos/sale` and `.../pos/void` did not match
  the spec's own path table and were replaced.
