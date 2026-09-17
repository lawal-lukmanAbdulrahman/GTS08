import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

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
    default: "Aura — Aura V1 Pro Vacuum",
    template: "%s | Aura",
  },
  description:
    "The Aura V1 Pro vacuum combines whisper-quiet suction with intelligent surface detection. Experience effortless cleaning designed for modern living.",
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
      className={`${display.variable} ${body.variable} ${mono.variable} ${serif.variable}`}
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
      <body className="font-body text-txt bg-white dark:bg-white transition-colors duration-300">{children}</body>
    </html>
  );
}
