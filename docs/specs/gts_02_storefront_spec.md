# GTS Platform — Storefront Specification

**Version:** 2.0  
**Date:** June 2026  
**Audience:** Frontend engineers, UI/UX designers, coding agents  
**Portal:** `gts.ng` (Next.js, App Router, SSR + ISR)

> **Note to coding agent:** The storefront carries the entire public face of GTS. Every page decision maps to a user psychology principle or a business outcome. Do not skip the psychology notes — they explain *why* certain elements are placed where they are. Implement them exactly as described.

---

## Part 1: Conversion Psychology Foundation

These principles drive every page decision. Internalize them before implementing any screen.

### 1.1 The Purchase Funnel
Every page moves the user one step forward:
```
Discover → Browse → Evaluate → Trust → Purchase → Return
```
Every friction point that breaks this flow costs a sale.

### 1.2 Core Psychology Principles Applied
- **Loss aversion over desire.** "Only 2 left in Size L" converts better than "Popular choice." Frame scarcity as a personal loss risk, not an abstract fact.
- **Social proof as trust substitute.** GTS is a new brand. Review counts, bestseller badges, and purchase notifications must do the trust-building work that years of brand recognition would normally do.
- **Reduce decision fatigue.** Default sorts to Bestselling, not Newest. Limit filters shown at once. Never show more than 24 products per page.
- **Eliminate checkout friction.** Zero forced account creation. Minimal form fields. Full autocomplete support. Clear progress indicators.
- **Scarcity signals are real or absent.** No fake countdown timers. No fake "viewing now" numbers unless driven by real data. Nigerian shoppers detect fake urgency and leave permanently.

---

## Part 2: Pages & Screens

---

### 2.1 Homepage — `/`

**Rendering:** SSR (personalized for logged-in users) or ISR (6-hour cache for anonymous).  
**Purpose:** First impression. Funnel visitors toward the catalog. Establish brand trust instantly.

**Above the fold (what's visible without scrolling):**
- **Full-width hero banner** — managed from admin via `content_slots.slot_key = 'hero_1'`. Contains: headline, subheadline, CTA button linking to a category or product. Mobile: single image/text. Desktop: image-left, text-right. Image from Cloudinary, auto-format, compressed.
- **Navigation bar** (sticky): GTS logo (left), nav links: Shop / Categories / Deals, Search icon, Wishlist icon, Cart icon with item count badge. Hamburger on mobile.

**Sections below fold (in order):**

1. **Category Quick Links** — horizontal scrollable pill buttons on mobile, grid on desktop. Shows all active top-level categories (from `/api/v1/categories`). Each links to `/shop/[category-slug]`.

2. **Featured Products** — grid of up to 8 products where `is_featured = true`. Labeled "Editor's Picks" or "New In". Product card layout defined in Section 2.3.1.

3. **Bestsellers Strip** — horizontal scroll of up to 10 products sorted by `total_sold DESC`. Labeled "Bestsellers." Shows product card with "Bestseller" badge.

4. **Promo Banner** — full-width content slot (`slot_key = 'promo_banner'`). Can be disabled from admin when not running a promotion.

5. **Why GTS** — static section with 3 trust icons: "Authentic Men's Wear" / "Secure Paystack Checkout" / "Easy Returns". Not animated, not flashy — clean and scannable.

6. **Instagram / Social Proof strip** — Phase 3. Placeholder area in Phase 1. Leave a styled empty section or hide.

7. **Email Capture** — NOT a modal. A bottom-sheet that slides up after 30 seconds OR 60% scroll depth, whichever comes first. Shows once per device per 30 days. Text: "Join GTS — Get 10% Off Your First Order." Single email input + "Get My Code" button. On submit: calls `/api/v1/promos/email-capture` which creates a promo code and sends via Resend. Dismiss button closes and sets a cookie.

8. **Footer** — Logo, nav links, social links, policy links (Return Policy, Privacy, Terms), trust badges (Paystack, SSL), copyright. On mobile: accordion collapse for link groups.

---

### 2.2 Category / Shop Page — `/shop/[slug]`

**Rendering:** ISR (1-hour revalidation). Each category has its own cached page.  
**URL examples:** `/shop/shirts`, `/shop/trousers`, `/shop/accessories`

**Page layout:**

**Header section:**
- Category name (H1)
- Category description (from `categories.description`) — 1-2 sentences max
- Product count: "X products"
- Category banner image (from `categories.banner_cloudinary_id`, if set)

**Layout: Filters sidebar (desktop) + Product grid**

**Filters panel:**
Sticky sidebar on desktop. Bottom sheet drawer on mobile (triggered by "Filter" button).

Active filters:
- **Size** — checkbox list of available sizes for this category. Show only sizes that have at least 1 in-stock variant. Auto-updates product grid on selection.
- **Color** — colored circular swatches. Show only colors available in category.
- **Price range** — two number inputs (₦ min – ₦ max) with Apply button.
- **In Stock only** — toggle, default ON. Filters out variants with 0 available stock.
- **Clear all filters** — link to reset to defaults.

**Sort dropdown (top right of grid):**
Options: Bestselling (default), Newest, Price: Low to High, Price: High to Low.

**Product Grid:**
- Desktop: 4 columns. Tablet: 3 columns. Mobile: 2 columns.
- 24 products per page. Infinite scroll (load more on scroll) rather than numbered pagination — better mobile UX.

**Empty state:**
If filters return no results, show: "No products match your filters." + "Clear Filters" button. Never show a blank grid.

---

### 2.3 Product Card (Reusable Component)

Used in homepage, category pages, search results, recommendations.

**Card contents:**
- Product image (primary image, 4:5 aspect ratio, Cloudinary optimized). Lazy-loaded below fold.
- On hover (desktop): second image fades in if `product_images` has ≥ 2 images.
- Product name (max 2 lines, ellipsis overflow)
- Price: if `compare_at_price` exists, show it crossed out in gray. Show `base_price` in black.
- Review stars + count (e.g., ★★★★☆ (23)) — shown even with small counts.
- **Badges** (applied based on data):
  - "Bestseller" (dark badge) — if product ranks in top 10% of `total_sold` in last 30 days
  - "Low Stock" (amber badge) — if any popular size has ≤ 3 units available
  - "Sale" (red badge) — if `compare_at_price` is set
  - "New" (green badge) — if `created_at` within last 14 days

**Quick Add (desktop only):**
On hover, a size selector slides up from the bottom of the card. User selects size → click "Add" → item added to cart without leaving the page. If product has color variants too, clicking the card goes to PDP (too complex for quick-add).

**Mobile interaction:**
Tap card → navigate to PDP. No quick-add on mobile to avoid accidental taps.

---

### 2.4 Product Detail Page (PDP) — `/product/[slug]`

**Rendering:** ISR (15-minute revalidation for price/stock updates).  
**This is where buying decisions are made. Every element has a purpose.**

**Page structure (mobile order, desktop adjusts):**

**1. Image Gallery (top, full width on mobile)**
- Primary image displays first.
- Thumbnail strip below for switching images.
- Tap/click to zoom (lightbox on desktop; pinch-to-zoom native on mobile).
- If variant is selected and has variant-specific images, gallery switches to those images.
- Minimum 3 images per product required. Admin enforced at upload.

**2. Product Name (H1)**
- Full product name, 18–22px font, prominent.

**3. Pricing**
- Current price in ₦ (formatted: ₦15,000). Large and black.
- If `compare_at_price`: show it crossed out, smaller, gray. Show "Save ₦X,XXX" or "XX% off".

**4. Rating Summary**
- Star average + "(X reviews)". Tappable — scrolls to reviews section.

**5. Variant Selector**

*Color selector (if product has color variants):*
- Round swatches with `color_hex` background + tooltip with color name.
- Selected color: highlighted border.
- If a color's variants are all out-of-stock: swatch shows a diagonal line, still tappable but shows message.

*Size selector:*
- Grid of size buttons (S / M / L / XL / XXL etc.)
- In-stock variants: solid border, clickable.
- Out-of-stock variants: grayed out, line-through text, still visible but unselectable.
- Size Guide link → opens a modal with a measurement table. Modal is a simple table. No form, no email capture.
- **When a size with ≤ 5 units is selected:** Show "Only X left in Size [selected]" in amber text below the size buttons. This is the loss aversion trigger — size-specific, not generic.

**6. Add to Cart CTA**
- Button: "Add to Cart" — full width, black background, white text, 48px height.
- **Sticky on mobile**: fixed to bottom of screen as user scrolls. Does not cover the review section or footer (use appropriate bottom padding on page).
- If no size selected and user taps: highlight size selector, shake animation, "Please select a size" message. Never silently ignore.
- On add: brief visual confirmation (button text changes to "Added ✓" for 2 seconds). Cart icon in header badge increments.

**7. Product Description**
- Heading "About This Piece" (not "Description" — makes it feel more editorial).
- `products.description` content (rich text rendered as HTML).

**8. Fit & Fabric**
- Two collapsible accordions: "Fit & Sizing" (from `products.fit_notes`) and "Fabric & Care" (from `products.fabric_care`).
- Default: closed. User opens by tapping header. One accordion can be open at a time.

**9. Trust Strip (critical — must appear near CTA)**
- 3 small icons: "Secure Paystack Checkout" / "Free Returns within 7 Days" / "Fast Delivery in Lagos"
- This strip must appear within scrolling distance of the Add to Cart button — not below the fold.

**10. Shipping Info**
- Brief delivery information: "Delivery from ₦X,XXX. Lagos same-day available."
- Links to delivery options section at checkout.

**11. "Complete the Look" Recommendations (Phase 2)**
- Horizontal scroll of 4 related products in the same category.
- Heading: "You Might Also Like"

**12. Recent Purchase Notification (Toast)**
- Appears once per session, on PDPs with real recent purchases (last 24h).
- Small toast at bottom-left: "Someone in Lagos ordered this 2 hours ago."
- Only triggered when backend query returns a real recent `order_items` entry for this product.
- Dismissed automatically after 5 seconds. Never shown more than once per session.

**13. Reviews Section**
- Heading: "What People Are Saying"
- Rating breakdown bar (5★ to 1★ with fill bars showing percentage).
- Individual review cards: rating, title, body, reviewer name (partial: "Tunde B."), date.
- Sort: Most Recent | Most Helpful (Phase 2).
- "Write a Review" button — only shown to logged-in customers who have purchased this product. Clicking opens a form modal: star rating + optional title + body.
- Reviews sorted by `is_approved = true` only in production.

**Structured Data (JSON-LD) — see SEO spec for full implementation:**
- `Product` schema with `AggregateRating`, `Offer`, `Brand`.
- `BreadcrumbList`.

---

### 2.5 Search — `/search`

**Rendering:** SSR (no caching — results are dynamic).  
**Trigger:** Search icon in header → expands inline search bar → user types → navigates to `/search?q=oxford+shirt` on Enter.

**Page layout:**
- "Results for '[query]'" heading with result count.
- Same product grid + filter panel as category page.
- Full-text search powered by Supabase's `to_tsvector` + `plainto_tsquery` on `products.name`, `products.description`, `products.tags`, `categories.name`.
- Empty state: "No results for '[query]'." + suggested categories.

---

### 2.6 Cart — `/cart`

**Rendering:** Client-side (no cache). Cart state from API using `session_id`.

**Layout:**
- Mobile: single column. Desktop: 2-column (cart items left, order summary right).

**Cart items list:**
- Each line item: product image (thumbnail), product name, variant (size + color), quantity stepper (+/- buttons), unit price, line total, remove button.
- If a variant is now out-of-stock since being added: highlight in red, "This item is no longer available" — remove it before proceeding.
- If quantity exceeds available stock: reduce to max available, show warning.

**Order summary (sticky on desktop):**
- Subtotal
- Delivery (shows "Calculated at checkout" until address entered)
- Promo code field: text input + "Apply" button. Inline success/error.
- Free shipping progress bar (if `settings.free_shipping_threshold` is set): "You're ₦X,XXX away from free shipping!" — amber bar fills toward threshold. This is an AOV driver.
- **Total (placeholder until delivery confirmed)**
- "Proceed to Checkout" button — large, prominent.

**Cross-sell (below cart items):**
"You might also need:" — 3-4 product cards in a horizontal scroll. Algorithm: other products from the same categories as items in cart.

**Empty cart state:**
Large illustration or icon + "Your cart is empty" + "Start Shopping" button → links to `/shop`.

---

### 2.7 Checkout — `/checkout`

**Rendering:** SSR (no ISR — sensitive page).  
**Guest checkout is the default.** No account required. Login option is secondary, unobtrusive.

**Step 1 of 3 — Contact & Delivery**

Form fields (all with `autocomplete` attributes — non-negotiable for mobile UX):
```
Full Name         autocomplete="name"          (single field, not first+last)
Email             autocomplete="email"
Phone Number      autocomplete="tel"
Address           autocomplete="street-address"
City              autocomplete="address-level2"
State             (dropdown of Nigerian states)
```

"Already have an account? [Sign in]" — gray link, secondary. Not a barrier.

Delivery option selector:
- Cards showing each `delivery_options` entry (name, description, price).
- Selected option highlights with border.
- Selecting an option updates the order summary price.

"Continue to Payment" button.

**Step 2 of 3 — Review Your Order**
- Order summary: items, quantities, prices.
- Subtotal, delivery fee, discount, **Total**.
- Editable: "Change" links next to contact info and address.
- Promo code input (if not already applied from cart).
- "Confirm & Pay" button.

**Step 3 — Payment (Paystack Inline)**
- On clicking "Confirm & Pay":
  1. Client calls `POST /checkout/reserve` → reserves stock.
  2. Client calls `POST /checkout/initiate` → gets Paystack access code.
  3. Paystack Popup SDK opens inline (not redirect). Customer sees card form overlay on the GTS checkout page.
  4. On Paystack `success` callback: redirect to `/checkout/success?order=GTS-xxx`.
  5. On Paystack `close` callback (customer closes popup): release reservation (`DELETE /checkout/reserve/:sessionId`), return to Step 2.
  
- **Trust signals near the payment button:** "Secured by Paystack" badge, SSL lock icon. These must be visible in the viewport when the "Confirm & Pay" button is visible — not below it.

- **Never lose form data.** Persist all form state in `sessionStorage` across steps. Back button must restore previous step's data exactly.

**Checkout flow state management:**
- Steps: `contact_delivery` → `review` → `payment`
- State stored in React context (in-memory) + `sessionStorage` for persistence across navigation.
- Cart session ID in `localStorage`.
- JWT for anonymous session in memory only (not localStorage).

---

### 2.8 Order Success — `/checkout/success`

**Rendering:** SSR.

Content:
- Large success checkmark icon (animated, subtle).
- "Order Placed!" heading.
- "Your order **GTS-202606-000142** has been placed. We've sent a confirmation to [email]."
- Order summary (items, address, total) — pulled from `GET /orders/track?order_number=xxx&email=xxx`.
- What happens next: a simple 3-step visual timeline ("Processing → Packed → Delivered").
- "Track Your Order" button → `/track?order=GTS-xxx`.
- **Account creation prompt (critical retention step):** "Save your details for faster checkout next time. Create a password:" — single password field + "Create Account" button. This converts the anonymous session to a full account using the email they provided. No re-entering data. One tap.
- "Continue Shopping" link.

---

### 2.9 Order Tracking — `/track`

**Rendering:** SSR. Public — no login required.  
**URL:** `/track?order=GTS-202606-000142&email=tunde@example.com`

If order number + email match: show order tracking page.  
If no match: show error "We couldn't find that order. Please check your order number and email."

**Tracking page content:**
- Order number, date placed, total.
- **Status Timeline:** Visual step tracker showing order journey:
  ```
  ✓ Order Placed (date/time)
  ✓ Payment Confirmed (date/time)
  ● Processing (current state — animated pulse)
  ○ Shipped
  ○ Delivered
  ```
- Current status description: "Your order is being prepared for shipment."
- Items ordered (thumbnail + name + quantity).
- Delivery address.
- When `order.status = 'shipped'` and `carrier_name` / `tracking_number` are set: show a "Shipment Info" block with the courier name and tracking number. If `carrier_tracking_url` is present, show a "Track with [Carrier]" button linking out to the courier's own tracking page. There is no in-app real-time GPS — tracking beyond "shipped" happens on the courier's platform.

---

### 2.10 Customer Account

**Auth guard:** Redirect to `/account/login` if no valid session.

#### `/account` — Dashboard
- Welcome message: "Good [time], [name]."
- Quick stats: Total orders, Total spent.
- Recent orders (last 3) with status badge + "View All" link.
- Quick links: Order History, Saved Addresses, Wishlist, Profile.

#### `/account/orders` — Order History
- All orders in reverse chronological order.
- Status badge per order.
- Tap/click → `/account/orders/[id]` → full order detail with tracking.

#### `/account/addresses` — Saved Addresses
- List of saved addresses with "Set as Default" + "Delete" actions.
- "Add New Address" form.

#### `/account/wishlist` — Wishlist
- Grid of wished products (from `wishlists` table).
- "Remove from Wishlist" on each card.
- "Add to Cart" button on each card (if in stock).

#### `/account/profile` — Profile
- Edit full name, phone.
- Change password (requires current password).
- Email marketing opt-out toggle.
- Danger zone: "Delete my account" (soft delete — admin must action this; this sends a request to support).

#### `/account/login` — Login Page
- Email + password form.
- "Forgot password" link.
- Link to register page.

#### `/account/register` — Register Page
- Name, email, phone, password.
- "Already have an account? Sign in."
- Terms checkbox.

---

## Part 3: User Experience Rules (Enforce These in Code)

1. **No full-page loads between cart actions.** Adding to cart, changing quantity, removing items — all optimistic updates with server sync. User never waits for a spinner to add to cart.

2. **Images never layout-shift.** Every image placeholder uses aspect-ratio CSS (`aspect-ratio: 4/5` for product cards, `aspect-ratio: 1` for thumbnails) to prevent CLS.

3. **Skeleton loading, never spinners.** Use skeleton screens that match the shape of the content they replace. No full-page spinners. Users should know what they're waiting for.

4. **Error states are always actionable.** Never show "An error occurred." Show: "We couldn't load these products. [Try Again]" — with a retry button that calls the same API again.

5. **Mobile touch targets ≥ 44×44px.** Every button, link, size swatch, and interactive element must meet this minimum. Nothing is tap-missed on mobile.

6. **Keyboard navigation works on every page.** Tab order is logical. Size selectors work with arrow keys. Cart quantity stepper works with keyboard.

7. **No layout differences between an empty state and a populated state.** Reserve space for content in the UI. An empty cart should still feel like the cart page, not a broken page.

8. **Every API call has a loading state, success state, and error state.** These are not optional.

9. **Cart syncs on focus.** When the browser tab regains focus (user returns from Paystack), the cart state re-validates against the server.

10. **Session ID is generated once and persists.** The cart `session_id` is generated once (UUID v4, client-side) and stored in `localStorage`. It must never change mid-session or the user loses their cart.

---

## Part 4: Performance Requirements

| Metric | Target |
|---|---|
| Largest Contentful Paint (LCP) | < 2.5s on 4G mobile |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Interaction to Next Paint (INP) | < 200ms |
| Time to First Byte (TTFB) | < 200ms (ISR pages from Vercel edge cache) |
| Lighthouse Performance Score | ≥ 85 on mobile |
| Image format | WebP or AVIF (Cloudinary auto) |
| JS bundle (first load) | < 150kb gzipped per page |

**Implementation requirements:**
- `next/image` for every product image. Never raw `<img>` tags.
- `next/font` for all custom fonts. Self-hosted via Google Fonts route.
- Route-based code splitting (automatic with Next.js App Router).
- Product images: lazy-loaded below fold. Hero image + first visible product images: `priority` prop.
- Cloudinary transformations via URL: `q_auto,f_auto,w_[breakpoint]`.

---

## Part 5: Component Map

These components must be built as reusable shared components (in `packages/ui` or `apps/web/components`):

| Component | Used On |
|---|---|
| `ProductCard` | Homepage, category pages, search, recommendations |
| `ProductGrid` | Category pages, search |
| `CartDrawer` | All storefront pages (slide-in cart from right) |
| `SizeGuideModal` | PDP |
| `ReviewCard` | PDP reviews section |
| `OrderStatusTimeline` | Order tracking, order success, account orders |
| `PriceDisplay` | Everywhere prices appear (handles kobo → ₦ formatting) |
| `ImageGallery` | PDP |
| `FilterSidebar` | Category page |
| `ToastNotification` | Add to cart, wishlist, errors, social proof toast |
| `SkeletonLoader` | Loading states everywhere |
| `EmptyState` | Empty cart, empty wishlist, empty search results |
| `BreadcrumbNav` | Category pages, PDP |
| `CheckoutProgress` | Checkout steps |
| `PromoCodeInput` | Cart, checkout |

---

## Part 6: Storefront API Calls Map

| Page | API Calls |
|---|---|
| Homepage | `GET /content-slots`, `GET /products/featured`, `GET /products?sort=bestselling&limit=10`, `GET /categories` |
| Category page | `GET /categories/:slug`, `GET /products?category=:slug&filters...` |
| PDP | `GET /products/:slug` (includes variants, images, inventory, recent reviews) |
| Cart | `GET /cart/:sessionId` |
| Checkout | `GET /delivery-options`, `POST /checkout/reserve`, `POST /checkout/initiate`, `POST /promos/validate` |
| Order success | `GET /orders/track?order_number&email` |
| Order tracking | `GET /orders/track?order_number&email` |
| Account orders | `GET /orders/my` |
| Search | `GET /products/search?q=:query` |
