import { Hero } from "./_components/landing/hero";
import { TrustedBrands } from "./_components/landing/trusted-brands";
import { Stats } from "./_components/landing/stats";
import {
  FeatureRow,
  InventoryCard,
  StorefrontCard,
} from "./_components/landing/feature-row";
import { POSShowcase } from "./_components/landing/pos-showcase";
import { FeatureGrid } from "./_components/landing/feature-grid";
import { Pricing } from "./_components/landing/pricing";
import { FAQ } from "./_components/landing/faq";
import { CTABand } from "./_components/landing/cta-band";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustedBrands />
      <Stats />

      {/* Feature Row: Inventory */}
      <section className="py-[74px]">
        <div className="max-w-[1120px] mx-auto px-7">
          <FeatureRow
            card={<InventoryCard />}
            features={[
              {
                title: "Real-time inventory",
                description:
                  "Every sale — online or at the till — moves the same stock count instantly. Reservations hold items during checkout so two customers can never buy the last unit.",
                active: true,
              },
              {
                title: "Full audit trail",
                description:
                  "Every restock, sale, void, and adjustment is logged with who did it and why. Nothing disappears quietly.",
              },
              {
                title: "Low-stock alerts",
                description:
                  "Get notified per variant before you run out — set your own threshold for each product.",
              },
            ]}
          />
        </div>
      </section>

      <POSShowcase />

      {/* Feature Row: Storefront */}
      <section className="py-[74px]">
        <div className="max-w-[1120px] mx-auto px-7">
          <FeatureRow
            reversed
            card={<StorefrontCard />}
            features={[
              {
                title: "A storefront built to convert",
                description:
                  "Guest checkout by default, Paystack payments (card, transfer, USSD), real scarcity signals only — no fake timers. Your customers buy in three taps.",
                active: true,
              },
              {
                title: "Order tracking, no login",
                description:
                  "Every customer tracks their order with just the order number and email — from payment to delivered, with courier tracking when you add it.",
              },
              {
                title: "Customize everything",
                description:
                  "Brand colors, logo, hero banners, featured products, and announcements — all managed from your dashboard, no developer needed.",
              },
            ]}
          />
        </div>
      </section>

      <FeatureGrid />
      <Pricing />
      <FAQ />
      <CTABand />
    </>
  );
}
