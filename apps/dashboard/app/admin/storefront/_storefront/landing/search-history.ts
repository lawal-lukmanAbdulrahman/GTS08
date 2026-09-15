"use client";

export interface RecentlyViewedProduct {
  id: string;
  slug: string;
  title: string;
  price: string;
  discountBadge?: string;
  image: string;
  viewedAt: number;
}

const RECENTLY_VIEWED_KEY = "gts_recently_viewed";
const RECENT_SEARCHES_KEY = "gts_recent_searches";

export function getRecentlyViewed(): RecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentlyViewed(product: {
  id: string;
  slug?: string;
  title: string;
  price: string;
  discountBadge?: string;
  image?: string;
}): void {
  if (typeof window === "undefined" || !product || !product.id) return;
  try {
    const current = getRecentlyViewed();
    const item: RecentlyViewedProduct = {
      id: product.id,
      slug: product.slug || product.id,
      title: product.title || "Product",
      price: product.price || "",
      discountBadge: product.discountBadge,
      image: product.image || "/placeholder-product.png",
      viewedAt: Date.now(),
    };
    // Deduplicate by id or slug and place at front (max 12 items)
    const filtered = current.filter((p) => p.id !== item.id && p.slug !== item.slug);
    const updated = [item, ...filtered].slice(0, 12);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("gts_recently_viewed_updated"));
  } catch (err) {
    console.warn("Failed to save recently viewed product:", err);
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENTLY_VIEWED_KEY);
    window.dispatchEvent(new Event("gts_recently_viewed_updated"));
  } catch (err) {
    console.warn("Failed to clear recently viewed products:", err);
  }
}

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") return;
  try {
    const current = getRecentSearches();
    // Deduplicate case-insensitively and place at front (max 8 terms)
    const filtered = current.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, 8);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("gts_recent_searches_updated"));
  } catch (err) {
    console.warn("Failed to save recent search query:", err);
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new Event("gts_recent_searches_updated"));
  } catch (err) {
    console.warn("Failed to clear recent searches:", err);
  }
}
