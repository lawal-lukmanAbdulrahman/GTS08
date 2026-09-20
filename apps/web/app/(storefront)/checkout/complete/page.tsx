import type { Metadata } from "next";
import CompleteView from "./complete-view";

export const metadata: Metadata = { title: "Order confirmation | GTS", robots: { index: false } };

export default function CheckoutCompletePage() {
  return <CompleteView />;
}
