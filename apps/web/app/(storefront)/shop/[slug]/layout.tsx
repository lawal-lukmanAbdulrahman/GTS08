import type { Metadata } from "next";
import { createServiceClient } from "@gts/database";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return { title: "Shop" };
  try {
    const { data } = await createServiceClient().from("categories").select("name").eq("slug", slug).maybeSingle();
    const name = (data as { name?: string } | null)?.name;
    return { title: name || "Shop" };
  } catch {
    return { title: "Shop" };
  }
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
