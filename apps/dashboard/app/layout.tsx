import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import DataModeBanner from "./components/data-mode-banner";

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

export const metadata: Metadata = {
  title: {
    default: "GTS Dashboard",
    template: "%s | GTS Dashboard",
  },
  description:
    "GTS staff dashboard — POS, inventory management, orders, and admin.",
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
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        {/* Inline blocking script to prevent Flash of Unstyled Theme (FOUC) & suppress third-party extension noise */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('gts_theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}

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
      <body className="font-body text-txt bg-page" suppressHydrationWarning>
        {children}
        <DataModeBanner />
      </body>
    </html>
  );
}
