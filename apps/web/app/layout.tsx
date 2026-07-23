import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "GTS — Your entire store. One system.",
    template: "%s | GTS",
  },
  description:
    "GTS gives your brand its own online storefront and in-store POS, running on a single shared backend — so a sale on the shop floor and a sale on your website never disagree.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="font-body text-txt bg-page dark:bg-[#111614] dark:text-[#E8EDE9] transition-colors duration-300">{children}</body>
    </html>
  );
}
