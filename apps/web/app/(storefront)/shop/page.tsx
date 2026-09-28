import { redirect } from "next/navigation";

/** /shop is the full product listing, which lives at /search (with no query it lists everything). */
export default function ShopPage() {
  redirect("/search");
}
