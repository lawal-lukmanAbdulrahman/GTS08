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
      <body className="font-body text-txt bg-page dark:bg-[#111614] dark:text-[#E8EDE9] transition-colors duration-300">{children}</body>
    </html>
  );
}
