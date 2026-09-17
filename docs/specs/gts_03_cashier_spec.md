# GTS Platform — Cashier (POS) Portal Specification

**Version:** 1.0  
**Date:** June 2026  
**Audience:** Frontend engineers, coding agents  
**Portal:** `dashboard.gts.ng/pos/*`  
**Role required:** `cashier` (checked via `employee_permissions.can_process_pos = true`)  
**Device:** Optimized for tablet (1024px) in landscape mode. Also works on desktop. Mobile is supported but not the primary use case for a POS.

---

## Part 1: Access & Auth

**Who accesses this:** Users with `role` set to any staff role AND `employee_permissions.can_process_pos = true`.

**Access flow:**
1. Staff logs in at `dashboard.gts.ng/login`.
2. Middleware reads JWT role.
3. If `can_process_pos = true` in their permissions → redirect to `/pos`.
4. If logged in but `can_process_pos = false` → redirect to `/pending` (unassigned employee screen).

**Critical:** The POS is the most financially sensitive portal. Role + permission must be checked server-side on every `/pos/*` API call — not just in middleware.

---

## Part 2: POS Layout

The POS uses a **two-panel split layout** (fixed, no scroll on the outer container):

```
┌────────────────────────────────┬─────────────────────────┐
│                                │                          │
│  LEFT PANEL: Product Search    │  RIGHT PANEL: Cart       │
│  (60% width)                   │  (40% width)             │
│                                │                          │
│  [Search input]                │  Cart Items List         │
│                                │  Subtotal                │
│  Product Results Grid          │  Discount                │
│  (scrollable)                  │  Total                   │
│                                │                          │
│                                │  [Confirm Payment]       │
│                                │                          │
└────────────────────────────────┴─────────────────────────┘
```

This layout never changes. The cashier always has the product search on the left and the building order on the right. No navigation away from this screen during a transaction.

**Top bar (full width, above the two panels):**
```
GTS POS    |  [Cashier Name]  |  [Today's Orders]  |  [Logout]
```

---

## Part 3: Left Panel — Product Search

### 3.1 Search Input

- Large, focused by default on page load (keyboard ready immediately).
- Placeholder: "Search by product name or SKU..."
- Clears on `Esc` key.
- Searches on every keystroke (debounced 300ms).
- API: `GET /api/v1/pos/products/search?q=[query]`

### 3.2 Quick Category Tabs (below search)

- Horizontal scrollable tab bar showing all active categories.
- Default: "All" tab selected.
- Clicking a category tab filters the results grid to that category.
- Tabs are supplementary to search — search still queries across all categories.

### 3.3 Product Results Grid

- 3-column grid (tablet landscape). 2-column on smaller screens.
- Each result card shows:
  - Product image (square, 1:1 ratio)
  - Product name (2 lines max)
  - Base price (₦)
  - Stock badge: "In Stock" (green) or "Low Stock" (amber) or "Out of Stock" (red, card dimmed)
  
**Tap on a product card:**
- If product has only one size and no color variants: immediately add 1 unit to cart.
- If product has multiple variants: opens a **Variant Selector Modal**.

### 3.4 Variant Selector Modal

Full-screen modal overlay (doesn't close left panel).

```
┌──────────────────────────────────┐
│  GTS Oxford Shirt                │
│  Base price: ₦15,000             │
│                                  │
│  Select Size:                    │
│  [S] [M] [L] [XL] [XXL]         │
│      ↑                           │
│   (3 left)                       │
│                                  │
│  Select Color:                   │
│  ⚫ ⚪ 🔵 (swatches)              │
│                                  │
│  Quantity: [-] 1 [+]             │
│                                  │
│  [Add to Cart — ₦15,000]        │
│  [Cancel]                        │
└──────────────────────────────────┘
```

- Size buttons: grayed out if that size is out of stock.
- Stock count shown for sizes with ≤ 5 units remaining.
- Price updates if a variant has a `price_modifier`.
- Add to Cart button is disabled until both size (and color if applicable) are selected.
- After adding: modal closes, product appears in right panel cart, search results remain.

---

## Part 4: Right Panel — Cart

### 4.1 Cart Items List

Scrollable list if items overflow the panel height.

Each item row:
```
[Product Image]  GTS Oxford Shirt — Size L / Black
                 ₦15,000 × [- 1 +]  =  ₦15,000    [✕]
```

- Quantity stepper: tap `-` or `+`. Min 1. Max: current stock.
- `✕` button: removes item from cart immediately.
- Price updates in real-time as quantity changes.
- If a quantity exceeds available stock (e.g., another cashier sold the last unit), highlight in red: "Only X left in stock."

**Empty cart state:**
Center of panel: "Cart is empty. Add products from the left." Minimal, clean.

### 4.2 Discount / Promo

Below the items list:

**Promo Code field:**
- Text input + "Apply" button.
- API: `POST /api/v1/promos/validate`
- On success: show discount amount below (e.g., "Promo GTS20: -₦3,000")
- On failure: show inline error ("Code expired" / "Minimum order not met")
- "Remove" link clears applied promo.

**Manual Discount (admin-permission required):**
- If `employee_permissions.can_process_pos = true` AND admin grants override:
  - A secondary input: "Manual discount ₦" — flat amount cashier can knock off.
  - This requires audit logging: `activity_logs.action = 'pos.manual_discount'` with delta amount and cashier ID.
  - Limit: cannot exceed 20% of order total without a second admin confirmation.

### 4.3 Order Summary

```
Subtotal:        ₦30,000
Promo (GTS20):  -₦3,000
─────────────────────────
Total:           ₦27,000
```

### 4.4 Payment Method Selector

Below order summary:

```
Payment Method:
 ○ Cash
 ● Card Terminal (POS Terminal)
```

- Two options. No Paystack — this is in-person. No online payment gateway.
- If "Cash" selected: show "Cash Received" field (₦ amount) — optional but helpful. Change due: `cash_received - total`.
- If "POS Terminal" selected: no extra fields. Cashier confirms after terminal approves.

### 4.5 Confirm Payment Button

```
[  Confirm Payment — ₦27,000  ]
```

- Large, full width, green.
- Disabled until at least one item is in cart AND payment method is selected.
- On tap: confirmation modal (see Part 5).

---

## Part 5: Payment Confirmation Flow

### 5.1 Confirmation Modal

```
┌─────────────────────────────────────┐
│  Confirm Walk-in Order              │
│                                     │
│  Total: ₦27,000                     │
│  Payment: Card Terminal             │
│  Items: 2                           │
│                                     │
│  Customer email (optional):         │
│  [email input for receipt]          │
│                                     │
│  [  Cancel  ]  [  Confirm Sale  ]  │
└─────────────────────────────────────┘
```

- Customer email is optional. If provided, a receipt email is sent.
- "Confirm Sale" button: calls `POST /api/v1/pos/orders`.

### 5.2 Order Creation Request

```json
{
  "items": [
    { "variant_id": "uuid", "quantity": 1 },
    { "variant_id": "uuid", "quantity": 1 }
  ],
  "payment_method": "pos_terminal",
  "discount_amount": 3000,
  "promo_code": "GTS20",
  "customer_email": "optional@email.com"
}
```

The backend:
1. Validates all variant IDs and quantities against current stock.
2. Creates `customers` record (if email provided).
3. Creates `orders` record (`channel: 'walk_in'`, `cashier_id: current_user_id`, `status: 'completed'`).
4. Creates `order_items` records with price snapshots.
5. Creates `transactions` record (`payment_method: 'pos_terminal'`, `payment_status: 'success'`, `confirmed_by: cashier_id`).
6. Decrements `inventory.quantity` for each variant.
7. Inserts `stock_movements` records (`reason: 'sale_pos'`).
8. If email provided: sends POS receipt email via Resend.
9. Returns created order.

### 5.3 Success Screen

After order creation:

```
┌─────────────────────────────────────┐
│         ✓  Sale Complete!           │
│                                     │
│  Order #GTS-202606-000143           │
│  ₦27,000  — Card Terminal           │
│                                     │
│  [  Print Receipt  ]                │
│  [  New Transaction  ]              │
└─────────────────────────────────────┘
```

- "Print Receipt" → triggers browser print dialog with a styled receipt layout. The receipt layout is a separate `@media print` styled component showing: store logo, order number, date, items + quantities + prices, total, payment method, cashier name.
- "New Transaction" → clears the cart completely and returns focus to the search input. This is the most common flow — back to search in one tap.

---

## Part 6: Today's Orders — `/pos/orders/today`

Side panel or full screen accessible from the top bar.

**Purpose:** Cashier can view and void same-day walk-in orders if a mistake was made.

**API:** `GET /api/v1/pos/orders/today` — returns today's walk-in orders created by this cashier.

**Layout:**
- List of today's orders: order number, time, items count, total, status.
- Status: "Completed" or "Voided".
- Each order is expandable: shows full item list.
- "Void Order" button (only on same-day completed orders):
  - Opens confirmation: "Void order #GTS-xxx? This cannot be undone."
  - On confirm: `PUT /api/v1/pos/orders/:id/void` with `{ reason: "..." }`
  - Backend: marks order `voided`, restores inventory, creates stock movements (`reason: 'void'`), logs action.

---

## Part 7: Barcode / SKU Scan Support

For a future barcode scanner (Phase 2), the search input must accept SKU strings directly.

**How it works:**
- Barcode scanners act as keyboard input — they type the SKU string and press Enter.
- If the search query exactly matches a product variant's `sku`: `GET /api/v1/pos/products/:sku` returns that exact variant.
- If found: immediately opens the Variant Selector Modal with that variant pre-selected (since the SKU already identifies the size/color). Cashier just taps "Add to Cart."
- If not found: show "No product found for SKU: [sku]" error in the search field area.

---

## Part 8: UX Rules

1. **Speed above all else.** A cashier with a queue of customers cannot wait for slow UI. Every action must complete in < 500ms visible response.

2. **Keyboard shortcuts (Phase 2):** `Ctrl/Cmd + Enter` = Confirm Payment. `Esc` = Clear search / Close modal.

3. **No page navigation during a transaction.** The cashier must not accidentally navigate away and lose a half-built cart. The left panel (search) and right panel (cart) are always visible simultaneously.

4. **Stock is re-validated at order creation, not just at add-to-cart.** If another cashier or an online order depletes stock between "add to cart" and "confirm", the backend rejects the order creation with a clear error: "Item [x] no longer has sufficient stock."

5. **Manual discount is logged.** Any manual discount override must appear in `activity_logs`. Admin must be able to audit every manual discount applied and by whom.

6. **Session timeout warning.** If cashier has been idle for 30 minutes, show a warning: "Your session will expire in 5 minutes. Tap to stay logged in." On timeout: lock screen (require PIN or re-login), but do not clear the current cart.

---

## Part 9: API Calls Map

| Action | API Call | Method |
|---|---|---|
| Search products | `/pos/products/search?q=...` | GET |
| Get by SKU | `/pos/products/:sku` | GET |
| Validate promo | `/promos/validate` | POST |
| Create walk-in order | `/pos/orders` | POST |
| Today's orders | `/pos/orders/today` | GET |
| Void order | `/pos/orders/:id/void` | PUT |
