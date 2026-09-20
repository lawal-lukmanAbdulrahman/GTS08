/**
 * Who may call each API route. Every route file and exported method must be
 * listed here, and `__tests__/authz_policies.test.ts` fails if one is missing,
 * stale, or its code doesn't enforce what is declared. A new route can't ship
 * unprotected by accident: it has to say what it is.
 *
 * Policies
 *   public                       anyone (say why in the comment)
 *   stub                         not built; returns 501
 *   session                      signed-in user of any kind; the route checks it itself
 *   session|optionalStaff        signed-in user; staff see more (checked via optionalStaff)
 *   session|permission:<key>     signed-in user, and a staff grant for part of it
 *   staff                        any active staff member
 *   pos                          staff with can_process_pos
 *   permission:<key>             staff holding that grant (admins hold all)
 *   pos-permission:<key>         POS access plus that grant
 *   admin                        admins only
 *   super_admin                  the super admin only
 *   optionalStaff                public, with extra fields for staff
 *   webhook                      third-party call, verified by signature
 *   cron                         scheduled job, verified by a shared secret
 */
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const stub = (...m: Method[]) => Object.fromEntries(m.map((x) => [x, "stub"])) as Partial<Record<Method, string>>;

export const ROUTE_POLICIES: Record<string, Partial<Record<Method, string>>> = {
  "analytics/overview": { GET: "admin" },
  "analytics/sales": { GET: "admin" },
  "analytics/channel-split": { GET: "admin" },
  "analytics/products/top": { GET: "admin" },
  "analytics/inventory/alerts": { GET: "admin" },
  "analytics/customers/new": { GET: "admin" },
  "analytics/orders/average-value": { GET: "admin" },

  // ── auth
  "auth/delete-account": { POST: "session" },
  "auth/login": { POST: "public" }, // credentials endpoint; rate limited
  "auth/logout": { POST: "session" },
  "auth/me": { GET: "session" },
  "auth/passkeys/auth-options": { POST: "public" }, // start of a passkey sign-in
  "auth/passkeys/auth-verify": { POST: "public" }, // verifies the signed challenge itself
  "auth/passkeys/delete": { DELETE: "session" },
  "auth/passkeys/list": { GET: "session" },
  "auth/passkeys/register-options": { POST: "session" },
  "auth/passkeys/register-verify": { POST: "session" },
  "auth/phone/send-code": { POST: "session" },
  "auth/phone/verify-code": { POST: "session" },
  "auth/pin-login": { POST: "public" }, // credentials endpoint
  "auth/pin/reset-with-password": { POST: "session" },
  "auth/pin/update": { POST: "session" },
  "auth/pin/verify": { POST: "session" },
  "auth/register": { POST: "public" }, // customer sign-up

  // ── catalogue
  "brands": { GET: "public", POST: "permission:can_manage_products" },
  "categories": { GET: "public", POST: "permission:can_manage_products" },
  "categories/[id]": { GET: "public", PATCH: "permission:can_manage_products", DELETE: "permission:can_manage_products" },
  "categories/reorder": { PUT: "permission:can_manage_products" },
  "products": { GET: "public", POST: "permission:can_manage_products", PUT: "permission:can_manage_products" }, // GET adds cost for staff
  "products/[slug]": { GET: "optionalStaff" },
  "products/drafts": { GET: "permission:can_manage_products", POST: "permission:can_manage_products", DELETE: "permission:can_manage_products" },
  "products/search": { GET: "public" },
  "reviews": { GET: "public", POST: "session" },
  "size-guides": stub("GET", "POST"),
  "size-guides/[id]": stub("GET", "PATCH", "DELETE"),

  // ── storefront content
  "broadcast": { GET: "public", DELETE: "admin", POST: "admin" }, // GET: the banner the storefront shows
  "broadcast/analytics": { POST: "public" }, // visitor impression events; rate limited
  "content-slots": stub("GET", "POST"),
  "content-slots/[id]": stub("GET", "PATCH", "DELETE"),
  "settings": { GET: "public", PATCH: "admin" },
  "storefront/sections": { GET: "public", PUT: "admin" },

  // ── cart, checkout, promos, wishlist
  "cart": stub("GET", "POST", "PATCH", "DELETE"),
  "checkout": { POST: "public" }, // guest checkout by design; payment is confirmed only by the webhook
  "checkout/status": { GET: "public" }, // keyed by an unguessable payment reference; reveals no customer details
  "checkout/quote": { POST: "public" }, // read-only price and stock check for the cart; holds nothing
  "promos": stub("GET", "POST"),
  "promos/[id]": stub("GET", "PATCH", "DELETE"),
  "promos/validate": stub("POST"),
  "wishlist": stub("GET", "POST", "DELETE"),

  // ── orders
  "orders": { GET: "session|optionalStaff" }, // own orders; everyone's with can_view_all_orders
  "orders/[id]": { GET: "permission:can_view_all_orders", PATCH: "permission:can_view_all_orders" },
  "orders/[id]/status": { PUT: "permission:can_view_all_orders" },
  "orders/customer": { GET: "session" },
  "orders/track": { GET: "public" }, // requires order number AND email

  // ── inventory
  "inventory": { GET: "permission:can_manage_inventory" },
  "inventory/[id]": { PUT: "permission:can_manage_inventory" },
  "inventory/adjustments": { POST: "permission:can_manage_inventory" },
  "inventory/movements": { GET: "permission:can_manage_inventory" },

  // ── support
  "inquiries": { GET: "session|permission:can_handle_tickets", POST: "session" }, // GET: own; ?all=true needs the grant
  "inquiries/[id]/messages": { GET: "session|optionalStaff", POST: "session|optionalStaff" },
  "inquiries/[id]/status": { PATCH: "permission:can_handle_tickets" },
  "tickets": stub("GET", "POST"),
  "tickets/[id]": stub("GET", "PATCH"),

  // ── email, notifications, cron
  "email-campaigns": stub("GET", "POST"),
  "email-campaigns/[id]": stub("GET", "PATCH"),
  "email-campaigns/[id]/send": stub("POST"),
  "notifications": stub("GET", "POST"),
  "cron/cleanup-reservations": { GET: "cron", POST: "cron" }, // Vercel Cron calls with GET
  "cron/expire-orders": { GET: "cron", POST: "cron" },

  // ── staff and admin
  "flags": { GET: "admin" },
  "live/summary": { GET: "admin" },
  "flags/[id]": { PATCH: "admin" },
  "staff/me": { GET: "staff", PATCH: "staff" },
  "staff/me/activity": { GET: "staff" },
  "staff/me/password": { POST: "staff" },
  "staff/me/sales": { GET: "staff" },
  "upload": { POST: "permission:can_manage_products" },
  "users": stub("GET", "POST"),
  "users/[id]": { GET: "admin", PATCH: "admin" },
  "users/staff": { GET: "admin", POST: "super_admin" },

  // ── point of sale
  "pos/categories": { GET: "pos" },
  "pos/flags": { POST: "pos", GET: "pos" },
  "pos/orders": { POST: "pos", GET: "pos" },
  "pos/orders/[id]/receipt": { GET: "pos" },
  "pos/orders/[id]/void": { PUT: "pos-permission:can_void_orders" },
  "pos/orders/today": { GET: "pos" },
  "pos/products/[sku]": { GET: "pos" },
  "pos/products/search": { GET: "pos" },
  "pos/whatsapp-orders": { GET: "pos", POST: "pos" },
  "pos/whatsapp-orders/[ref]": { GET: "pos" },
  "pos/whatsapp-orders/[ref]/cancel": { PUT: "pos" },
  "pos/whatsapp-orders/[ref]/confirm": { POST: "pos" },

  // ── third parties
  "webhooks/paystack": { POST: "webhook" },
};
