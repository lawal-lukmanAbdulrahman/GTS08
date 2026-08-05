import Link from "next/link";
import Image from "next/image";
import { ThemeProvider } from "./_components/theme-provider";
import { ThemeToggle } from "./_components/theme-toggle";
import { MobileNav } from "./_components/mobile-nav";
import { ErrorBoundary } from "./_components/error-boundary";

function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/logo.png"
        alt="GTS Platform"
        width={73}
        height={40}
        className="h-10 w-auto"
        priority
      />
    </Link>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-40 bg-page/85 dark:bg-[#DDDAD4]/85 backdrop-blur-[12px] border-b border-line dark:border-[#2A312A] transition-colors">
      <div className="max-w-[1120px] mx-auto px-7 flex items-center justify-between h-[68px]">
        <Logo />
        <div className="hidden md:flex gap-[30px] text-[15px] font-medium text-txt-2 dark:text-[#A3B0A5]">
          <Link href="#product" className="hover:text-txt dark:hover:text-[#E8EDE9]">
            Product
          </Link>
          <Link href="#features" className="hover:text-txt dark:hover:text-[#E8EDE9]">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-txt dark:hover:text-[#E8EDE9]">
            Pricing
          </Link>
          <Link href="#faq" className="hover:text-txt dark:hover:text-[#E8EDE9]">
            FAQ
          </Link>
        </div>
        <div className="flex gap-2.5 items-center">
          <Link
            href="/login"
            className="hidden md:inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-full border border-line dark:border-[#3A423A] bg-white dark:bg-[#1E2520] text-txt dark:text-[#E8EDE9] hover:border-txt-3 dark:hover:border-[#6B7A6E] transition-all hover:-translate-y-px"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="hidden md:inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-full bg-ink dark:bg-green text-white hover:bg-black dark:hover:bg-green-hover transition-all hover:-translate-y-px"
          >
            Get started
          </Link>
          <MobileNav />
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-[#AEB9AF] mt-[84px] relative overflow-hidden">
      <div className="max-w-[1120px] mx-auto px-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 py-16 relative z-[1]">
        <div>
          <Image
            src="/logo.png"
            alt="GTS Platform"
            width={73}
            height={40}
            className="h-10 w-auto"
          />
          <p className="text-sm max-w-[260px] mt-3.5">
            The retail operating system for stores that sell in-store and online
            — one inventory, one truth.
          </p>
        </div>
        <div>
          <h4 className="font-body text-white text-sm font-semibold mb-4">
            Product
          </h4>
          <div className="flex flex-col gap-2.5 text-sm">
            <Link href="#product" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Overview
            </Link>
            <Link href="#features" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Features
            </Link>
            <Link href="#pricing" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              FAQ
            </Link>
          </div>
        </div>
        <div>
          <h4 className="font-body text-white text-sm font-semibold mb-4">
            Resources
          </h4>
          <div className="flex flex-col gap-2.5 text-sm">
            <Link href="/help" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Help center
            </Link>
            <Link href="/tutorials" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Tutorials
            </Link>
            <Link href="/blog" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Blog
            </Link>
            <Link href="/contact" className="hover:text-white focus-visible:text-white focus-visible:outline-none">
              Contact
            </Link>
          </div>
        </div>
        <div>
          <h4 className="font-body text-white text-sm font-semibold mb-4">
            Stay up to date
          </h4>
          <div className="flex gap-2 mt-1.5">
            <input
              type="email"
              placeholder="Enter your email"
              aria-label="Email address"
              className="flex-1 bg-ink-2 border border-[#3A423A] rounded-full py-2.5 px-4 text-white font-body text-sm placeholder:text-[#7E8A80]"
            />
            <button className="inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-full bg-green text-white hover:bg-green-hover transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-7 border-t border-[#333B33] py-5 pb-[90px] text-[13px] flex justify-between relative z-[1]">
        <span>&copy; 2026 GTS. All rights reserved.</span>
        <span className="flex gap-3">
          <Link href="/privacy" className="hover:text-white focus-visible:text-white focus-visible:outline-none">Privacy</Link>
          <Link href="/terms" className="hover:text-white focus-visible:text-white focus-visible:outline-none">Terms</Link>
        </span>
      </div>
      <div
        className="absolute bottom-[-9vw] left-1/2 -translate-x-1/2 font-display font-extrabold text-[26vw] tracking-tighter text-white/[.045] leading-none pointer-events-none select-none"
        aria-hidden="true"
      >
        GTS
      </div>
    </footer>
  );
}

import { Header } from "./_components/landing/header";
import { CartProvider } from "./_components/cart-context";
import { WishlistProvider } from "./_components/wishlist-context";
import { AuthModalProvider } from "./_components/auth-modal-context";
import { AuthModal } from "./_components/auth-modal";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthModalProvider>
          <WishlistProvider>
            <CartProvider>
              {/* ── Max-width shell: centers the entire storefront at extreme zoom-out ── */}
              <div className="relative mx-auto w-full max-w-[1600px] min-h-screen bg-white shadow-[0_0_0_1px_#e0ddd6]">
                <Header />
                {children}
                <AuthModal />
              </div>
            </CartProvider>
          </WishlistProvider>
        </AuthModalProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
