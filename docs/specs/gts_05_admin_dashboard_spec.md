# GTS Platform — Admin Dashboard Specification

**Version:** 2.1  
**Date:** June 2026  
**Audience:** Frontend engineers, coding agents  
**Portal:** `dashboard.gts.ng/admin/*`  
**Role required:** `admin` exclusively. No staff role has access to any `/admin/*` route.

> This spec supersedes the v1.0 and v2.0 admin docs. The platform adds staff permission control and multi-channel analytics, all admin-only. There is no in-house delivery driver system — online order fulfillment uses third-party couriers, and admin manually marks orders `shipped` with a carrier name and tracking number.

---

## Part 1: Access & Layout

### 1.1 Auth Guard
- Next.js middleware on `dashboard.gts.ng`: if JWT role ≠ `'admin'` → redirect to `/pending` or `/pos` based on their actual role.
- Every API call to `/api/v1/analytics/*`, `/api/v1/users/*`, `/api/v1/settings/*` → backend verifies `role = 'admin'`.

### 1.2 Global Layout

**Sidebar (desktop, persistent) / Drawer (mobile, hamburger-triggered):**

```
[GTS Logo]
────────────────────────────
📊  Dashboard
📦  Orders
🛍️   Products
🗂️   Categories
📉  Inventory
🏷️   Deals & Promos
📢  Content
✉️   Email Center
🎫  Support Inbox
👥  Staff & Customers
⚙️   Settings
────────────────────────────
[Admin Avatar] [Name] [Logout]
```

**Global Header (top bar):**
- Breadcrumb (e.g., "Dashboard / Orders / GTS-202606-000142")
- Notification bell — shows unread `admin_notifications` count. Click → dropdown of last 10 notifications with links.
- Quick search: Ctrl+K / Cmd+K → opens command palette to jump to any order, product, or customer by typing.

**Color scheme:** Dark sidebar (near-black #111827), white content area, neutral grays for data. Admin interface is low-fatigue and functional — not branded with GTS orange/black consumer palette.

---

## Part 2: Dashboard Home — `/admin`

One-glance situational awareness: is the business healthy right now?

### 2.1 KPI Cards Row

Eight cards in a 4-column grid (desktop) / 2-column (mobile). Each shows:
- Metric value (large)
- % change vs previous period (green = up, red = down — but context-dependent: cancelled orders going up is bad even though it's "up")
- Trend sparkline (7-day mini chart)
- Period toggle: Today / 7 days / 30 days

| Card | Metric | Data Source |
|---|---|---|
| Total Revenue | Sum of `orders.total` where status ∉ cancelled, refunded | `orders` |
| Total Orders | Count of all non-cancelled orders | `orders` |
| Avg Order Value | Revenue ÷ Order count | computed |
| Online Orders | Count where `channel = 'online'` | `orders` |
| Walk-in Sales (POS) | Revenue from `channel = 'walk_in'` | `orders` |
| New Customers | Users with `role = 'customer'` created in period | `users` |
| Low Stock Alerts | Variants at or below threshold | `inventory` |
| Orders Awaiting Shipment | Orders with `status IN (confirmed, processing)` | `orders` |

- **Low Stock card:** Always rendered in amber/red regardless of comparison trend. If 0, show green "All stocked."
- **Orders Awaiting Shipment card:** If any order has sat in `confirmed` or `processing` for more than 3 days, pulse amber as a gentle reminder to move it along.

### 2.2 Revenue Chart

Dual-line chart: Gross Revenue vs Net Revenue (after discounts), last 30 days.

- X-axis: dates (abbreviated: "Jun 1", "Jun 2"...)
- Y-axis: ₦ formatted (₦120k, ₦1.2M)
- Hover tooltip: date, gross, net, order count, AOV for that day
- Toggle: "Online" / "Walk-in" / "Combined" — filters which channel's data is charted

Data from: `GET /api/v1/analytics/sales?from=30d`

### 2.3 Channel Split Widget

Side-by-side stat (or donut chart):
- Online Revenue: ₦X,XXX,XXX (X%)
- Walk-in Revenue: ₦X,XXX,XXX (X%)

Shows the balance between e-commerce and in-store. Admin can judge which channel needs attention.

### 2.4 Recent Orders Table

Last 15 orders across both channels. Newest first.

Columns: Order # | Date | Customer | Items | Total | Channel (icon) | Status badge | Action

- Channel icon: globe for online, store for walk-in.
- Clicking a row → `/admin/orders/[id]`.

### 2.5 Top Selling Products (This Month)

Table of 5 products: Thumbnail | Name | Units Sold | Revenue | Stock. "Edit" link per row.

Data: `GET /api/v1/analytics/products/top?period=30d&limit=5`

### 2.6 Low Stock Alert List

All variants at or below `settings.low_stock_threshold`. Compact list:
- Product name | Variant | Current stock | Threshold | "Adjust Stock" quick link

Click "Adjust Stock" → `/admin/inventory?variant_id=xxx` with adjustment panel auto-opened.

---

## Part 3: Order Management — `/admin/orders`

### 3.1 Order List

**Filters:** Status (multi-select), Channel (online / walk_in / both), Date range, Search (by order #, customer name, email).

**Sort:** Date descending (default), Date ascending, Total descending.

**Columns:** # | Date | Customer | Items | Total | Channel | Status | Actions

**Actions per row:**
- "View" → order detail

**Bulk actions (checkbox select multiple orders):**
- Mark selected as Confirmed
- Export selected as CSV

### 3.2 Order Detail — `/admin/orders/[id]`

**Left column — main content:**

**Order header:** Order number, date, status badge, channel badge.

**Items table:**
- Snapshot-based: product thumbnail (from snapshot image_cloudinary_id) | Product name + variant | Unit price | Quantity | Line total

**Payment summary:** Subtotal | Delivery fee | Discount (promo code shown) | **Total**

**Payment info:** Payment method | Paystack reference (if online) | Paid at

**Status Management section:**
- Visual status timeline (horizontal stepper):
  ```
  [✓ Paid] → [✓ Confirmed] → [● Processing] → [○ Shipped] → [○ Delivered]
  ```
- Status update dropdown or button group: move to next valid status only (no backward movement except Cancel).
- Status-specific fields:
  - → Confirmed: no fields needed.
  - → Processing: no fields needed.
  - → Shipped: opens a small form requiring `carrier_name` (text or dropdown of common Nigerian couriers — GIG Logistics, Kwik Delivery, DHL, Other) and `tracking_number` (text). Optional: `carrier_tracking_url`. These populate the "Shipped" email to the customer.
  - → Delivered: no extra fields — admin confirms fulfillment is complete (via courier confirmation, customer contact, etc.)
  - → Cancelled: requires reason text field.
- Every status save triggers the corresponding email to the customer and creates `activity_logs` record.

**Right column — sidebar:**
- Customer info: name, email, phone. "View Customer" link.
- Delivery address (full block).
- **Shipping info section:** once shipped, shows `carrier_name`, `tracking_number`, and `carrier_tracking_url` (if set) with an "Edit" link to correct a typo without changing the order status.
- Internal notes textarea (autosaves on blur).
- Linked support tickets (if `support_tickets.order_id = this order`).

---

## Part 4: Product Management — `/admin/products`

### 4.1 Product List

**Search:** by name or SKU.  
**Filters:** Category | Status (Active/Draft/Archived) | Stock status | Featured.

**Columns:** Thumbnail | Name | Category | Price | Compare Price | Total Stock | Status | Actions

**Actions:** Edit | Archive toggle | Duplicate (creates a Draft copy) | Delete (with confirmation modal; only for Draft products with no order history).

**Bulk actions:** Set status Active | Set Archived | Delete selected.

### 4.2 Create / Edit Product — `/admin/products/new` & `/admin/products/[id]/edit`

**Tabbed interface:**

**Tab 1 — Basic Info:**
- `name` → text input
- `slug` → auto-generated from name, editable, shows preview URL: `gts.ng/product/[slug]`
- `category_id` → searchable dropdown
- `status` → radio: Draft | Active | Archived
- `is_featured` → checkbox

**Tab 2 — Content:**
- `description` → rich text editor (bold, italic, H2, H3, ordered/unordered list)
- `fit_notes` → plain textarea
- `fabric_care` → plain textarea
- `tags` → tag input (type and press Enter to add; comma-separated)

**Tab 3 — Pricing:**
- `base_price` → number input in ₦ (stored as kobo internally)
- `compare_at_price` → number input in ₦ (optional; must be > base_price validation)

**Tab 4 — Images:**
- Drag-and-drop zone. Accepts JPG, PNG, WebP. Max 8 images.
- Preview grid with sort handles (drag to reorder).
- "Set as primary" button per image.
- "Delete" per image.
- Upload proxied to `/api/v1/upload` → Cloudinary.

**Tab 5 — Variants:**
- List of existing variants with inline edit.
- "Add Variant" button → form row: size + color + color_hex + price_modifier + SKU suffix.
- Each variant has its own stock field (shown inline, calls `/api/v1/inventory/:variantId`).

**Tab 6 — SEO:**
- `seo_title` → text input, 70 char limit with counter.
- `seo_description` → textarea, 160 char limit.
- Live SERP preview: shows how the product would appear in Google search results.

---

## Part 5: Category Management — `/admin/categories`

**List:** Name | Slug | Parent | Products count | Active toggle | Edit | Delete  
**Create/Edit form:** name, slug (auto-gen), parent category (dropdown), description, banner image upload, sort_order, is_active, seo_title, seo_description.

Deleting a category with active products is blocked by the backend — must re-assign or archive products first.

---

## Part 6: Inventory — `/admin/inventory`

**Identical to the employee inventory view (see `gts_04_employee_portal_spec.md` Part 3) but with additional admin capabilities:**

- Can set `low_stock_threshold` per individual variant (overrides global setting).
- Can see who made each stock adjustment (`actor_id` → resolved to name).
- Full export of stock movements as CSV.
- Can write off stock (create an adjustment with reason "Written off — damaged" with audit trail).

---

## Part 7: Deals & Promos — `/admin/deals`

### 7.1 Promo Code List

**Columns:** Code | Type | Value | Min Order | Uses | Limit | Valid Until | Active | Actions

**Actions:** Edit | Deactivate | Delete (only if 0 uses).

### 7.2 Create / Edit Promo Code

Form fields:
- `code` — uppercase text input. Unique validation.
- `discount_type` — radio: Percentage | Fixed Amount
- `discount_value` — number (% or ₦)
- `max_discount_cap` — number in ₦ (optional, for % codes: caps the max discount given)
- `min_order_value` — number in ₦ (minimum cart total to apply)
- `usage_limit` — number or "Unlimited" toggle
- `per_customer_limit` — number (default 1)
- `valid_from` — date picker (optional)
- `valid_until` — date picker (optional)
- `is_active` — toggle

---

## Part 8: Content Slots — `/admin/content`

Admin manages homepage banners and promotional sections without a developer.

**Slots table:**

| Slot Key | Purpose | Active | Last Updated | Edit |
|---|---|---|---|---|
| `hero_1` | Main homepage hero banner | ✓ | Jun 19 | Edit |
| `hero_2` | Secondary hero (if multi-slide) | ✗ | Jun 10 | Edit |
| `promo_banner` | Mid-page promotion strip | ✓ | Jun 18 | Edit |
| `deal_banner` | Deal-of-the-week banner | ✗ | — | Edit |

**Edit Slot form:**
- `headline`, `subheadline`, `cta_label`, `cta_link`
- Desktop image upload
- Mobile image upload (separate crop for mobile)
- `start_date` / `end_date` (optional scheduling)
- `is_active` toggle
- Preview: live preview of how the slot will look (renders the actual component with entered data).

---

## Part 9: Email Center — `/admin/email`

### 9.1 Campaign List

**Table:** Subject | Audience | Status | Recipients | Sent At | View

**Statuses:** Draft | Scheduled | Sending | Sent | Failed

### 9.2 Compose Campaign — `/admin/email/compose`

**Step 1 — Compose:**
- Subject line input (90 char limit)
- Preview text (90 char)
- Body: rich text editor
- CTA button (optional): label + URL

**Step 2 — Audience:**
- Radio: All Customers | Ordered in Last 30 Days | Never Ordered | Custom
- "Custom": date range + category filter (e.g., customers who ordered from the Shirts category)
- Preview: "Estimated recipients: X"

**Step 3 — Schedule:**
- Send Now or Schedule for: date + time picker (WAT)
- Review summary before sending

**Sending:** Backend processes via Resend. For large lists, uses batching (Resend supports bulk sends). Progress tracked in `email_campaigns.status`.

### 9.3 Campaign Detail — `/admin/email/[id]`

- Full campaign stats: sent, delivered, bounced, complained.
- Per-recipient status (from `email_campaign_recipients` table).
- "Resend to failed recipients" action.

---

## Part 10: Support Inbox — `/admin/support`

### 10.1 Ticket List

**Filters:** Status | Priority | Assigned to (me / unassigned / all) | Date range

**Columns:** Ref | Subject | Customer | Order | Status | Priority | Assigned To | Created | Last Updated

**Quick actions:** Claim (assign to me) | Mark resolved

**Unread tickets** (no staff response yet) shown in bold.

### 10.2 Ticket Detail — `/admin/support/[id]`

**Left — conversation:**
- Chronological messages: customer messages (left) / staff replies (right).
- Internal notes (yellow background, only staff see these).
- "Reply" text area below. "Post as Internal Note" checkbox.
- "Send Reply" button → `POST /api/v1/tickets/:id/messages` → triggers Resend email to customer.

**Right — metadata:**
- Status dropdown | Priority toggle | Assigned to dropdown | Tags input
- Customer info (name, email, phone, "View Customer" link)
- Linked order (if `order_id` set) — order summary + "View Order" link

---

## Part 11: Staff & Customer Management — `/admin/staff`

### 11.1 Staff List

**All users with role ≠ 'customer'.**

**Table:** Name | Email | Role | Permissions summary | Last Login | Status | Actions

**Actions:** Edit Permissions | Block/Unblock | Change Role

### 11.2 Invite Staff

```
┌────────────────────────────────────────┐
│  Invite New Staff Member               │
│                                        │
│  Full Name: [_______________________] │
│  Email: [___________________________] │
│                                        │
│  Role:                                 │
│  ○ Cashier                             │
│  ○ Inventory Staff                     │
│  ○ Admin                               │
│                                        │
│  Permissions:                          │
│  ☐ Can Process POS                    │
│  ☐ Can Manage Inventory               │
│  ☐ Can View All Orders                │
│  ☐ Can Manage Products                │
│  ☐ Can Handle Tickets                 │
│                                        │
│  [  Send Invitation  ]                 │
└────────────────────────────────────────┘
```

- Backend sends an invite email via Resend with a Supabase magic link.
- Creates the `users` record + `employee_permissions` record.
- Staff follows the magic link to set their password.

### 11.3 Customer List — `/admin/customers`

**Filters:** Date registered | Has ordered (yes/no) | Email opt-out status

**Columns:** Name | Email | Phone | Total Orders | Total Spent | Last Order | Joined

**Clicking a row:** Customer profile page → full order history, addresses, linked tickets, account actions (block, unblock, change role).

---

## Part 12: Settings — `/admin/settings`

### 12.1 Store Info
Fields: `store_name`, `logo_cloudinary_id` (image upload), `support_email`, `support_phone`, `whatsapp_number`, social links (Instagram, Twitter, Facebook, TikTok).

### 12.2 Shipping Tiers
CRUD interface for `delivery_options` table (e.g., "Lagos Same-Day", "Nationwide Standard") — name, description, price, estimated delivery window. See backend spec for schema. This is shipping-fee configuration only; there is no in-house driver assignment to configure.

### 12.3 Inventory Thresholds
Single field: "Alert when stock ≤ [N] units." Updates `settings.low_stock_threshold`.
Optional: "Free shipping threshold" in ₦ — sets `settings.free_shipping_threshold`.

### 12.4 Integration Status
Read-only display of connected integrations (Paystack, Resend, Cloudinary, Supabase) — shows connection status, not secrets. Environment variables managed on Vercel dashboard directly.

---

## Part 13: Admin Route Map

```
/admin                          → Dashboard home
/admin/orders                   → Order list
/admin/orders/[id]              → Order detail
/admin/products                 → Product list
/admin/products/new             → Create product
/admin/products/[id]/edit       → Edit product
/admin/categories               → Category list
/admin/categories/new           → Create category
/admin/categories/[id]/edit     → Edit category
/admin/inventory                → Inventory table
/admin/inventory/movements      → Stock movements
/admin/inventory/restock        → Bulk restock
/admin/deals                    → Promo codes
/admin/content                  → Content slots
/admin/email                    → Email center
/admin/email/compose            → Compose campaign
/admin/email/[id]               → Campaign stats
/admin/support                  → Ticket inbox
/admin/support/[id]             → Ticket detail
/admin/staff                    → Staff list
/admin/staff/invite             → Invite staff
/admin/staff/[id]               → Staff profile + permissions
/admin/customers                → Customer list
/admin/customers/[id]           → Customer profile
/admin/settings                 → Settings
```

All routes: `noindex, nofollow` in meta robots.  
All routes: redirect to `/login` if no valid admin JWT.  
All routes: return 403 if JWT role ≠ `'admin'`.
