"use client";

import { useEffect, useState } from "react";

/** A category as the shop keeps it (GET /api/v1/categories): the admin's own, never a built-in list. */
export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  banner_cloudinary_id: string | null;
}

export interface MegaCategory {
  id: string;
  name: string;
  icon: string;
  groups: { title: string; items: { label: string; href: string }[] }[];
  brands?: { name: string; href: string }[];
}

export const categoryHref = (name: string) => `/search?category=${encodeURIComponent(name)}`;

const ICON_WORDS: Array<[RegExp, string]> = [
  [/applian|kitchen|fridge|washing/i, "appliance"],
  [/phone|tablet|mobile/i, "phone"],
  [/beauty|health|skin|perfume/i, "beauty"],
  [/home|office|furniture/i, "home"],
  [/electron|tv|audio/i, "tv"],
  [/fashion|cloth|wear|shirt|shoe|dress|men|women/i, "fashion"],
  [/grocer|supermarket|food/i, "supermarket"],
  [/comput|laptop/i, "computing"],
  [/baby|kid|child/i, "baby"],
  [/gam|console/i, "gaming"],
];

export function iconFor(name: string): string {
  return ICON_WORDS.find(([re]) => re.test(name))?.[1] ?? "store";
}

const byOrder = (a: StoreCategory, b: StoreCategory) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/** The header's Categories menu: one entry per top-level category, its sub-categories as links. */
export function toMegaCategories(rows: StoreCategory[]): MegaCategory[] {
  return rows
    .filter((c) => !c.parent_id)
    .sort(byOrder)
    .map((c) => ({
      id: c.slug,
      name: c.name,
      icon: iconFor(c.name),
      groups: [
        {
          title: c.name.toUpperCase(),
          items: [{ label: `All ${c.name}`, href: categoryHref(c.name) }, ...rows.filter((s) => s.parent_id === c.id).sort(byOrder).map((s) => ({ label: s.name, href: categoryHref(s.name) }))],
        },
      ],
    }));
}

/** The landing page's category tiles: top-level categories, with the banner the admin uploaded if any. */
export function categoryTiles(rows: StoreCategory[], cloudName: string | undefined): Array<{ id: string; title: string; image: string | null; href: string }> {
  return rows
    .filter((c) => !c.parent_id)
    .sort(byOrder)
    .map((c) => ({
      id: c.id,
      title: c.name,
      image: c.banner_cloudinary_id
        ? /^https?:\/\//.test(c.banner_cloudinary_id)
          ? c.banner_cloudinary_id
          : cloudName
            ? `https://res.cloudinary.com/${cloudName}/image/upload/${c.banner_cloudinary_id}`
            : null
        : null,
      href: categoryHref(c.name),
    }));
}

let pending: Promise<StoreCategory[]> | null = null;

export function resetCategoriesCache(): void {
  pending = null;
}

/** The shop's categories, one request per page load. Null while loading. */
export function useStoreCategories(): StoreCategory[] | null {
  const [rows, setRows] = useState<StoreCategory[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    pending ??= fetch("/api/v1/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => (Array.isArray(b?.data) ? (b.data as StoreCategory[]) : []))
      .catch(() => []);
    void pending.then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return rows;
}
