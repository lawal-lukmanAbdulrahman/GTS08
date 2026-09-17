# GTS Platform — Employee Portal Specification

**Version:** 1.0  
**Date:** June 2026  
**Audience:** Frontend engineers, coding agents  
**Portal:** `dashboard.gts.ng/*` (catch-all for non-admin, non-cashier staff)  
**Roles:** Any staff role (`cashier`, `inventory_staff`) lands here for shared features. The portal adapts based on `employee_permissions`.

> **Key concept:** The employee portal is not a separate app — it is the `dashboard.gts.ng` app, role-routed. On login, the middleware reads the JWT role and permissions, then routes the user to the correct section. This doc covers the shared employee experience and the `inventory_staff` role specifically (cashier → see `gts_03_cashier_spec.md`).

---

## Part 1: Authentication & Landing Logic

### 1.1 Login Page — `/login`

Used by all staff. One unified login page.

```
┌────────────────────────────────────────┐
│           GTS Staff Login              │
│                                        │
│  Email: [__________________________]  │
│  Password: [_______________________]  │
│                                        │
│  [  Sign In  ]                         │
│                                        │
│  Forgot your password? [Reset here]   │
└────────────────────────────────────────┘
```

- No "Create account" link — employees are invited by admin.
- "Forgot password" → calls `POST /api/v1/auth/password-reset/request`.
- On successful login: JWT is stored in Supabase session (via `createBrowserClient`).

### 1.2 Post-Login Routing (Middleware)

```typescript
// middleware.ts on dashboard.gts.ng

const role = jwt.app_metadata?.role;
const permissions = await getPermissions(userId); // single DB call, cached

switch (role) {
  case 'admin':
    redirect('/admin');
  default:
    // cashier or inventory_staff — check permissions
    if (permissions.can_process_pos) redirect('/pos');
    if (permissions.can_manage_inventory) redirect('/inventory');
    if (permissions.can_view_all_orders) redirect('/orders');
    // No matching permissions yet
    redirect('/pending');
}
```

---

## Part 2: Pending / Unassigned Screen — `/pending`

Shown when: staff is logged in but has no permissions yet, OR role doesn't map to any active feature.

```
┌──────────────────────────────────────────┐
│  [GTS Logo]                              │
│                                          │
│  👋  Welcome, [Name]                     │
│                                          │
│  Your account is ready, but access to   │
│  the GTS tools hasn't been granted yet. │
│                                          │
│  Contact your manager to get set up.    │
│                                          │
│  In the meantime:                        │
│  support@gts.ng | +234 xxx xxx xxxx     │
│                                          │
│  [  Sign Out  ]                          │
└──────────────────────────────────────────┘
```

- This page auto-refreshes every 60 seconds. If permissions are granted while the employee is on this screen, they are automatically redirected to the correct portal.
- Shows a Supabase Realtime subscription on `employee_permissions` filtered by `user_id = me`. On change: re-run routing logic.
- No functionality is exposed on this page. No navigation, no links other than logout.

---

## Part 3: Inventory Management — `/inventory`

**Role required:** `employee_permissions.can_manage_inventory = true` OR `role = 'admin'`

### 3.1 Inventory Overview — `/inventory`

**API call:** `GET /api/v1/inventory?low_stock=false&page=1`

**Layout:**

**Header:**
- "Inventory" title
- Filter: "All Products" | "Low Stock" | "Out of Stock"
- Search: by product name or variant SKU
- "Export CSV" button (Phase 2)

**Inventory Table:**

| Product | Variant | SKU | In Stock | Reserved | Available | Status | Action |
|---|---|---|---|---|---|---|---|
| GTS Oxford Shirt | Size L / Black | GTS-OXF-L-BLK | 25 | 2 | 23 | ✓ In Stock | Adjust |
| GTS Oxford Shirt | Size S / Black | GTS-OXF-S-BLK | 3 | 0 | 3 | ⚠ Low Stock | Adjust |
| GTS Chinos | Size M / Navy | GTS-CHN-M-NVY | 0 | 0 | 0 | ✗ Out of Stock | Adjust |

- "Available" = `quantity - reserved_quantity`. This is the number that matters.
- Status badges: "In Stock" (green) / "Low Stock" (amber, when available ≤ threshold) / "Out of Stock" (red, when available = 0).
- Rows sorted by: status (out of stock first, then low stock, then in stock), then alphabetically.

**Filter: "Low Stock"** — shows only rows where `available ≤ settings.low_stock_threshold`.  
**Filter: "Out of Stock"** — shows only rows where `available = 0`.

### 3.2 Adjust Stock — Slide-out Panel

Clicking "Adjust" on any row opens a slide-out panel from the right (no full page navigation).

```
┌─────────────────────────────────────────┐
│  Adjust Stock                     [✕]  │
│                                         │
│  GTS Oxford Shirt — Size L / Black      │
│  SKU: GTS-OXF-L-BLK                    │
│                                         │
│  Current stock: 25                      │
│  Reserved: 2                            │
│  Available: 23                          │
│                                         │
│  Adjustment type:                       │
│  ○ Restock (add)                        │
│  ○ Deduction (remove)                   │
│  ○ Set to exact quantity               │
│                                         │
│  Quantity: [____]                       │
│                                         │
│  Reason: [________________________]     │
│  (e.g., "New shipment arrived", "Damage")│
│                                         │
│  [  Cancel  ]  [  Save Adjustment  ]   │
└─────────────────────────────────────────┘
```

- Adjustment type:
  - **Restock:** adds to `quantity`. Delta = +N.
  - **Deduction:** removes from `quantity` (for damaged, lost, or written-off stock). Delta = -N.
  - **Set exact:** sets `quantity` to the entered number. Backend computes delta = new_value - current_value.
  
- Reason is required (for audit trail). Text input, 255 char limit.

- On "Save Adjustment": `PUT /api/v1/inventory/:variantId` with `{ delta, adjustment_type, reason }`.

- Backend:
  1. Updates `inventory.quantity`.
  2. Inserts `stock_movements` record (`reason: 'adjustment'`, `actor_id: current_user_id`, `notes: reason`).
  3. Logs to `activity_logs`.
  4. If new quantity is now at/below threshold: creates `admin_notifications` record.

- On success: close panel, update table row in place (optimistic update), show success toast.

### 3.3 Stock Movement History — `/inventory/movements`

**API call:** `GET /api/v1/inventory/movements?variant_id=uuid&from=date&to=date`

**Layout:**
- Filter bar: Product name search, Date range (from/to), Movement type (all / sale / restock / adjustment).
- Table:

| Date | Product | Variant | Change | Type | Actor | Note |
|---|---|---|---|---|---|---|
| Jun 19, 10:30 AM | GTS Oxford Shirt | L / Black | -1 | Sale (Online) | System | Order GTS-xxx |
| Jun 19, 09:00 AM | GTS Oxford Shirt | L / Black | +20 | Restock | [name] | New stock arrived |

- `delta` shown as "+20" (green) or "-1" (red) for at-a-glance reading.
- Clicking an order reference link → navigates to order detail (if `can_view_all_orders`).

### 3.4 Bulk Restock — `/inventory/restock`

**Purpose:** Adding a large shipment of stock across multiple variants at once.

**Layout:**
- Table where each row is a product variant.
- Columns: Product, Variant, SKU, Current Stock, "Add Quantity" (editable number input), Notes.
- Rows pre-populated with all variants. Filter to show only low stock or out of stock.
- "Submit Restock" button at bottom → sends all changes in one API call: `POST /api/v1/inventory/restock`.
- Backend processes each as an individual stock movement with `reason: 'restock'`.

---

## Part 4: Order Management — `/orders`

**Role required:** `employee_permissions.can_view_all_orders = true` OR `role = 'admin'`

### 4.1 Order List — `/orders`

**API call:** `GET /api/v1/orders?status=confirmed&channel=online&page=1`

A simplified read-mostly view of orders. Employees can view orders and update status, but cannot:
- Cancel orders (admin only).
- Issue refunds.
- Change financial details.

**Layout:**

Filters: Status (multi-select), Date range, Channel (Online / Walk-in), Search by order number.

Table columns: Order #, Date, Customer, Items, Total, Channel badge, Status badge, "View" link.

Status badges match same color scheme as admin dashboard.

### 4.2 Order Detail — `/orders/[id]`

**API call:** `GET /api/v1/orders/:id`

**Read-only fields:** Order items, customer info, pricing, payment method.

**Editable fields (for employees with `can_view_all_orders`):**
- Status updates: move order forward (Confirmed → Processing → Shipped).
  - Cannot move backward. Cannot cancel.
  - Shipping requires tracking number + carrier name.
- Internal notes: `orders.internal_notes` — text area, save button.

**Shipping section (if online order):**
- Current `carrier_name` and `tracking_number` if the order has been shipped.
- These fields are set by admin when the order status moves to `shipped` (see admin spec). Employees with `can_view_all_orders` can view but not edit them here.

---

## Part 5: Product Management — `/products`

**Role required:** `employee_permissions.can_manage_products = true` OR `role = 'admin'`

### 5.1 Product List

Same as the admin product list (see admin spec) but without:
- Delete product ability.
- Category management.
- Promo code management.

### 5.2 Create / Edit Product

Same as admin product editor but:
- No access to pricing settings that affect system-wide financial calculations.
- Can edit: name, description, fit notes, fabric care, images, tags, status (draft ↔ active), is_featured.
- Cannot change: base_price, compare_at_price (admin only — prices affect financial reporting).

---

## Part 6: Support Tickets — `/tickets`

**Role required:** `employee_permissions.can_handle_tickets = true` OR `role = 'admin'`

### 6.1 Ticket List

Same as admin ticket list but:
- Can only see tickets not assigned to other staff, OR tickets explicitly assigned to them.
- Cannot see internal admin notes on tickets unless specifically shared.

### 6.2 Ticket Detail

Can view and reply. Same interface as admin ticket detail but without:
- Priority escalation control.
- Role/tag management.
- Ability to close tickets (can only mark "Resolved").

---

## Part 7: Shared Navigation

All staff portals use a consistent sidebar or top nav depending on their role + permissions.

```
GTS Dashboard
──────────────────────
[Avatar] [Name] [Role Badge]
──────────────────────
[Items shown based on permissions:]

If can_manage_inventory:
  📦 Inventory
  📋 Stock Movements

If can_view_all_orders:
  📋 Orders

If can_manage_products:
  🛍️  Products

If can_handle_tickets:
  🎫 Support Tickets

If can_process_pos:
  🏪 POS (link to /pos)
──────────────────────
[Sign Out]
```

Rules:
- Menu items are invisible unless the corresponding permission is true.
- A staff member with only `can_manage_inventory = true` sees only the Inventory section.
- No menu items that lead to "Access Denied" pages — if they can't access it, it doesn't appear in the nav.
- The nav is rendered server-side (Next.js Server Component) so there's no client-side flash of unauthorized nav items.

---

## Part 8: Profile — `/profile`

Available to all authenticated employees.

- View name, email, role badge.
- Edit: phone number only (not email, not role — admin manages these).
- Change password: current + new + confirm.
- View own activity log (their recent actions in the system) — read-only.

---

## Part 9: Security Rules for Employee Portal

1. **Double-gating on every route.** Next.js middleware checks JWT role. API Route Handler checks role AND permission. Both must pass. No single point of failure.

2. **Permission checks at the Route Handler level.** Even if a staff member manually navigates to `/inventory` without the permission, the `GET /api/v1/inventory` call will return 403 because the Route Handler checks `employee_permissions.can_manage_inventory`.

3. **No access to financial data.** Employees cannot see: gross margin, admin analytics, customer payment data, Paystack references. They see order totals but not payment breakdowns.

4. **Activity logging.** Every write action (inventory adjustment, status update, product edit) creates a row in `activity_logs` with `actor_id = current_user_id`. Admin can audit who did what.

5. **Blocked accounts are logged out.** If admin blocks an employee mid-session, the next API call returns 403, the frontend clears the session and redirects to `/login` with message "Your account access has been suspended."
