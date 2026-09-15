"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function Footer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="w-full bg-white pt-4 sm:pt-6 pb-6 text-[#010101] px-3 md:px-6">
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
              <div className="bg-white rounded-full px-5 py-2.5 sm:py-3 shadow-xs flex items-center justify-between border border-gray-200/80 transition-all focus-within:ring-2 focus-within:ring-[#010101]">
                <input
                  type="text"
                  placeholder="Search here...."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm text-[#010101] placeholder-gray-400 outline-none w-full font-normal"
                />
                <button aria-label="Search" className="text-[#010101] hover:opacity-75 transition-opacity ml-2 shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
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
              <span>GTS</span>
            </Link>
            <p className="text-xs sm:text-sm text-gray-500 font-normal leading-relaxed max-w-sm">
              Luxury in Every Detail, Crafted for Timeless Style.
            </p>

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
                <Link href="#categories" className="hover:text-[#010101] transition-colors">
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
              <p>
                Email:{" "}
                <a href="mailto:support@gts.com" className="text-[#010101] underline underline-offset-2 hover:opacity-80">
                  support@gts.com
                </a>
              </p>
              <p>Phone: +234 (0) 800 111 1111</p>
            </div>

            {/* Social Icons Row */}
            <div className="flex items-center gap-2.5 pt-3">
              <a href="#linkedin" aria-label="LinkedIn" className="w-8 h-8 rounded-full bg-[#010101] text-white flex items-center justify-center hover:opacity-80 transition-opacity">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" /></svg>
              </a>
              <a href="#producthunt" aria-label="Community" className="w-8 h-8 rounded-full bg-[#010101] text-white flex items-center justify-center hover:opacity-80 transition-opacity">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M13.601 2.002C7.942 2.002 3.348 6.596 3.348 12.255c0 5.659 4.594 10.253 10.253 10.253 5.659 0 10.253-4.594 10.253-10.253 0-5.659-4.594-10.253-10.253-10.253zm-.25 15.753h-2.502v-5.253H8.347V7.25h5.004c1.448 0 2.626 1.178 2.626 2.626v2.253c0 1.448-1.178 2.626-2.626 2.626zm0-5.253v-2.5h-2.502v2.5h2.502z" /></svg>
              </a>
              <a href="#instagram" aria-label="Instagram" className="w-8 h-8 rounded-full bg-[#010101] text-white flex items-center justify-center hover:opacity-80 transition-opacity">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
              <a href="#facebook" aria-label="Facebook" className="w-8 h-8 rounded-full bg-[#010101] text-white flex items-center justify-center hover:opacity-80 transition-opacity">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edge-to-Edge Full Width Bottom Bar ── */}
      <div className="-mx-3 md:-mx-4 w-[calc(100%+24px)] md:w-[calc(100%+32px)] border-t border-gray-200/80 pt-5 pb-3">
        <div className="w-full px-3 md:px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 font-medium">
          <p>© {new Date().getFullYear()} GTS. All rights reserved.</p>
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
