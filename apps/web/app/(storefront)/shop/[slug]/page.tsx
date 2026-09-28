import { redirect } from "next/navigation";

/** /shop/<category> opens the product listing filtered to that category. */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/search?category=${encodeURIComponent(decodeURIComponent(slug))}`);
}
