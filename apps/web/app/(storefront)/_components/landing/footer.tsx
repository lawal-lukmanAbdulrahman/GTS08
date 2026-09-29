"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useStoreInfo, whatsappLink } from "../../_lib/store-info";

/** Small monochrome icons for the social links the admin sets in Store Details. */
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  Instagram: <path d="M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2zm4.5 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.25-3.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" />,
  Facebook: <path d="M14 8h3V4h-3a4 4 0 00-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z" />,
  TikTok: <path d="M16.5 3a5 5 0 004 4v3.2a8.2 8.2 0 01-4-1.2V15a6 6 0 11-6-6c.3 0 .7 0 1 .1v3.3a2.8 2.8 0 102 2.6V3h3z" />,
  X: <path d="M4 3h4.5l4 5.6L17.2 3H20l-6.2 7.3L21 21h-4.5l-4.4-6.1L6.7 21H4l6.9-8.1L4 3z" />,
  LinkedIn: <path d="M4 3a2 2 0 110 4 2 2 0 010-4zM2.5 9h3v12h-3V9zm6 0h2.9v1.7h.1c.4-.8 1.4-1.7 3-1.7 3.2 0 3.8 2.1 3.8 4.8V21h-3v-6.2c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21h-3V9z" />,
  WhatsApp: <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0112 4zm-3.2 4c-.2 0-.6.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6z" />,
};

function SocialLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="w-8 h-8 rounded-full bg-[#010101] text-white flex items-center justify-center hover:opacity-80 transition-opacity">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {SOCIAL_ICONS[label]}
      </svg>
    </a>
  );
}

export function Footer() {
  const store = useStoreInfo();
  const storeName = store?.store_name || "GTS";
  const whatsapp = whatsappLink(store?.whatsapp_number);
  const socials = [
    { label: "Instagram", href: store?.instagram_url },
    { label: "Facebook", href: store?.facebook_url },
    { label: "TikTok", href: store?.tiktok_url },
    { label: "X", href: store?.x_url },
    { label: "LinkedIn", href: store?.linkedin_url },
    { label: "WhatsApp", href: whatsapp },
  ].filter((s): s is { label: string; href: string } => !!s.href);
  const [searchQuery, setSearchQuery] = useState("");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const triggerNavSearch = (initialQuery?: string) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(
      new CustomEvent("gts_open_search", {
        detail: { query: initialQuery ?? searchQuery },
      })
    );
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="w-full bg-white pt-4 sm:pt-6 pb-6 text-[#010101] px-3 md:px-4">
      <div className="max-w-[1240px] mx-auto">
        {/* ── Top CTA Banner Box (Matching Exact Section Margins & Width of Page Cards) ── */}
        <div className="w-full mb-8 sm:mb-10">
        <div
          className="w-full rounded-[28px] sm:rounded-[36px] overflow-hidden p-6 sm:p-10 md:p-12 relative border border-gray-200/80 shadow-2xs flex items-center justify-center min-h-[220px] sm:min-h-[260px]"
          style={{ background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }}
        >
          {/* Background Model Image on Far Left — pushed left so woman's side crops on border while the bag on the right shows in full */}
          <div className="absolute -left-10 sm:-left-12 md:-left-16 top-0 bottom-0 h-full w-auto max-w-[55%] sm:max-w-[34%] z-0 pointer-events-none overflow-hidden flex items-center justify-start">
            <Image
              src="/products/model_holding_bag_invert.png"
              alt="Model holding handbag"
              width={400}
              height={400}
              className="h-full w-auto object-contain object-right-bottom"
              priority
            />
          </div>

          {/* Dark Overlay on Mobile View to ensure text legibility */}
          <div className="absolute inset-0 bg-[#010101]/60 sm:hidden z-5 pointer-events-none" />

          {/* Center Main Text & Search Input (Centered relative to container) */}
          <div className="relative z-10 text-center max-w-xl mx-auto space-y-3 sm:space-y-4 px-2 sm:px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white sm:text-[#010101] tracking-tight leading-tight">
              Step Into a World of Timeless Elegance with GTS
            </h2>
            <p className="text-xs sm:text-sm font-normal text-gray-200 sm:text-gray-600 max-w-md mx-auto leading-relaxed">
              Experience the harmony of luxury design, verified authenticity and purposeful craftsmanship.
            </p>

            {/* White Search Input Pill */}
            <div className="pt-2 max-w-md mx-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  triggerNavSearch(searchQuery);
                }}
                onClick={() => triggerNavSearch(searchQuery)}
                className="bg-white rounded-full px-5 py-2.5 sm:py-3 shadow-xs flex items-center justify-between border border-gray-200/80 transition-all cursor-text hover:border-gray-400 group"
              >
                <input
                  type="text"
                  placeholder="Search here...."
                  value={searchQuery}
                  onFocus={(e) => {
                    e.target.blur();
                    triggerNavSearch(searchQuery);
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm text-[#010101] placeholder-gray-400 outline-none w-full font-normal cursor-pointer"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="text-[#010101] hover:opacity-75 transition-opacity ml-2 shrink-0 cursor-pointer"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Footer Link Columns (Full Section Width) ── */}
      <div className="w-full pb-6 sm:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Column 1: Brand Logo & Newsletter Subscribe */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="text-2xl sm:text-3xl font-black text-[#010101] tracking-tighter inline-flex items-center gap-2 font-moara">
              <span>{storeName}</span>
            </Link>
            {store?.footer_about && (
              <p className="text-xs sm:text-sm text-gray-500 font-normal leading-relaxed max-w-sm">{store.footer_about}</p>
            )}

            {/* Newsletter Input + Subscribe Button */}
            <form onSubmit={handleSubscribe} className="pt-2 flex items-center gap-2 max-w-sm">
              <div className="relative flex-1">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F9F8F5] border border-gray-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#010101] placeholder-gray-400 outline-none focus:bg-white focus:border-[#010101] transition-colors"
                />
              </div>
              <button
                type="submit"
                className="bg-[#010101] hover:bg-black text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all shrink-0 active:scale-[0.98]"
              >
                {subscribed ? "Subscribed!" : "Subscribe"}
              </button>
            </form>
          </div>

          {/* Column 2: Customer */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-[#010101] uppercase tracking-wider">
              Customer
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600 font-normal">
              <li>
                <Link href="/about" className="hover:text-[#010101] transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-[#010101] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-[#010101] transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-[#010101] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#010101] transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: SHOP */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-[#010101] uppercase tracking-wider">
              SHOP
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600 font-normal">
              <li>
                <Link href="/shop" className="hover:text-[#010101] transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-[#010101] transition-colors">
                  All Categories
                </Link>
              </li>
              <li>
                <Link href="/materials" className="hover:text-[#010101] transition-colors">
                  Materials & Care
                </Link>
              </li>
              <li>
                <Link href="#bestsellers" className="hover:text-[#010101] transition-colors">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href="#new-arrivals" className="hover:text-[#010101] transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="#crazy-finds" className="hover:text-[#010101] transition-colors">
                  Crazy Deals
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Social Icons */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-[#010101] uppercase tracking-wider">
              Contact
            </h4>
            <div className="space-y-1.5 text-xs sm:text-sm text-gray-600 font-normal">
              {store?.support_email && (
                <p>
                  Email:{" "}
                  <a href={`mailto:${store.support_email}`} className="text-[#010101] underline underline-offset-2 hover:opacity-80">
                    {store.support_email}
                  </a>
                </p>
              )}
              {store?.support_phone && (
                <p>
                  Phone: <a href={`tel:${store.support_phone.replace(/[^\d+]/g, "")}`} className="hover:text-[#010101]">{store.support_phone}</a>
                </p>
              )}
              {store?.store_address && <p>Address: {store.store_address}</p>}
            </div>

            {socials.length > 0 && (
              <div className="flex items-center gap-2.5 pt-3">
                {socials.map((s) => (
                  <SocialLink key={s.label} label={s.label} href={s.href} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* ── Full Width Bottom Bar with Centered Grid Content ── */}
      <div className="-mx-3 md:-mx-4 border-t border-gray-200/80 pt-5 pb-3">
        <div className="max-w-[1240px] mx-auto px-3 md:px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 font-medium">
          <p>© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#010101] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[#010101] transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
