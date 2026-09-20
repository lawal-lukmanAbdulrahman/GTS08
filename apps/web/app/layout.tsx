import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import SkipLink from "./_components/skip-link";
import "./globals.css";

// Brand sans-serif, served from our own domain (the site's Content-Security-Policy blocks third-party font hosts).
const satoshi = localFont({
  src: [
    { path: "../public/fonts/satoshi-300.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/satoshi-700.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/satoshi-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GTS: shop online",
    template: "%s | GTS",
  },
  description: "Shop GTS online: quality products, secure Paystack checkout and order tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} ${serif.variable} ${satoshi.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  window.addEventListener('unhandledrejection', function(event) {
                    if (event && event.reason && (
                      (typeof event.reason.message === 'string' && (event.reason.message.includes('chrome:') || event.reason.message.includes('extension'))) ||
                      (typeof event.reason.stack === 'string' && event.reason.stack.includes('chrome-extension://'))
                    )) {
                      event.preventDefault();
                      event.stopImmediatePropagation();
                    }
                  });
                  window.addEventListener('error', function(event) {
                    if (event && event.filename && event.filename.includes('chrome-extension://')) {
                      event.preventDefault();
                      event.stopImmediatePropagation();
                    }
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-body text-txt bg-white dark:bg-white transition-colors duration-300">
        <SkipLink />
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </body>
    </html>
  );
}
