import type { CartItem } from "../_components/cart-context";
import type { ProductItem } from "../_data/products";
import { toCheckoutLines } from "./checkout-client";

/** The cart and wishlist live in the browser first; these calls keep a copy on the server so they follow a shopper who signs in. All of them fail quietly: the browser copy is what the shopper sees. */

const SESSION_KEY = "gts_cart_session";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCartSessionId(): string {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && UUID.test(saved)) return saved;
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function setCartSessionId(id: string): void {
  try {
    if (UUID.test(id)) localStorage.setItem(SESSION_KEY, id);
  } catch {
    // storage blocked: the next visit just starts a new server copy
  }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

/** Replaces the server copy with the browser's cart. Only what to buy is sent, never a price. */
export async function pushCart(sessionId: string, items: CartItem[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/cart/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: toCheckoutLines(items) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ServerLine {
  variant_id: string;
  product_slug: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
}

/** After signing in: folds the browser's cart into the account's saved one. */
export async function mergeCart(sessionId: string, token: string): Promise<{ sessionId: string; lines: ServerLine[] } | null> {
  try {
    const res = await fetch("/api/v1/cart/merge", { method: "POST", headers: auth(token), body: JSON.stringify({ session_id: sessionId }) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.data?.session_id) return null;
    return { sessionId: body.data.session_id, lines: (body.data.lines ?? []) as ServerLine[] };
  } catch {
    return null;
  }
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** Server lines as cart items, using the storefront's own product records. Products it doesn't have are skipped. */
export function linesToCartItems(lines: ServerLine[], catalogue: ProductItem[]): CartItem[] {
  const items: CartItem[] = [];
  for (const l of lines) {
    const product = catalogue.find((p) => p.id === l.product_slug);
    if (!product) continue;
    const size = product.sizes?.find((s) => norm(s) === norm(l.size)) ?? l.size ?? product.sizes?.[0] ?? "Standard";
    const wanted = norm(l.color);
    const colour = wanted ? product.images?.find((i) => norm(i.label) === wanted || (wanted.length >= 3 && (norm(i.label).includes(wanted) || wanted.includes(norm(i.label))))) : undefined;
    items.push({ product, size, color: colour?.label ?? l.color ?? product.images?.[0]?.label ?? "Default", quantity: l.quantity });
  }
  return items;
}

/** The server's version of any product it knows (it has been checked against stock); local items it doesn't know are kept. */
export function unionCart(local: CartItem[], fromServer: CartItem[]): CartItem[] {
  const known = new Set(fromServer.map((i) => i.product.id));
  return [...fromServer, ...local.filter((i) => !known.has(i.product.id))];
}

export async function fetchWishlistSlugs(token: string): Promise<string[] | null> {
  try {
    const res = await fetch("/api/v1/wishlist", { headers: auth(token) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body?.data)) return null;
    return (body.data as Array<{ slug?: string }>).map((p) => p.slug).filter((s): s is string => typeof s === "string");
  } catch {
    return null;
  }
}

export async function saveWishlistSlug(token: string, slug: string): Promise<boolean> {
  try {
    return (await fetch("/api/v1/wishlist", { method: "POST", headers: auth(token), body: JSON.stringify({ product_slug: slug }) })).ok;
  } catch {
    return false;
  }
}

export async function removeWishlistSlug(token: string, slug: string): Promise<boolean> {
  try {
    return (await fetch(`/api/v1/wishlist/${encodeURIComponent(slug)}`, { method: "DELETE", headers: auth(token) })).ok;
  } catch {
    return false;
  }
}
