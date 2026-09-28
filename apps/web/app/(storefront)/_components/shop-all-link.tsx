import Link from "next/link";

/** The way to the full product listing, in the header on every storefront page. */
export function ShopAllLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/search" className={`text-xs sm:text-sm font-semibold text-[#010101] hover:text-[#EDCF5D] transition-colors ${className}`}>
      Shop all
    </Link>
  );
}
