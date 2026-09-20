import type { Metadata } from "next";
import { createServiceClient } from "@gts/database";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The tab title and search snippet come from the product itself. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return { title: "Product not found", robots: { index: false } };

  try {
    const { data, error } = await createServiceClient()
      .from("products")
      .select("name, short_description")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) return { title: "Shop" };
    if (!data) return { title: "Product not found", robots: { index: false } };
    const product = data as { name: string; short_description: string | null };
    return { title: product.name, ...(product.short_description ? { description: product.short_description } : {}) };
  } catch {
    return { title: "Shop" };
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
