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

## Spec Corrections

- `gts_03_cashier_spec.md` Part 9's documented paths (`/pos/orders`,
  `/pos/orders/:id/void`) are implemented as such. The pre-existing stub
  files at `apps/web/app/api/v1/pos/sale` and `.../pos/void` did not match
  the spec's own path table and were replaced.
