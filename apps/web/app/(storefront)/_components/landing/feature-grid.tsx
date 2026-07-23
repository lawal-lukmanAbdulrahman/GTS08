const FEATURES = [
  {
    icon: "🛍",
    title: "Your branded storefront",
    description:
      "Your own online store with custom logo, brand colors, hero banners, and featured products — all managed from your dashboard without touching code. Your brand, your look, your rules.",
  },
  {
    icon: "🏪",
    title: "In-store POS",
    description:
      "A tablet-first point-of-sale with barcode-ready SKU search, line-item discounts, receipt printing, and same-day void support. Works in any browser — no special hardware needed.",
  },
  {
    icon: "▥",
    title: "Real-time inventory",
    description:
      "One stock count shared across online and in-store channels. Automatic reservations prevent overselling, and a full movement audit log tracks every unit in and out.",
  },
  {
    icon: "%",
    title: "Promotions & discounts",
    description:
      "Create promo codes with usage limits, discount caps, and expiry dates. Run email-capture offers that grow your subscriber list while rewarding your customers.",
  },
  {
    icon: "◫",
    title: "Customers & staff",
    description:
      "Customer accounts with full order history and saved details. Invite staff with granular role-based permissions — cashiers, inventory managers, and admins each see only what they need.",
  },
  {
    icon: "✉",
    title: "Email campaigns",
    description:
      "Send targeted offers to all customers, recent buyers, or newsletter subscribers — directly from your admin dashboard. No third-party email tool required.",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-[74px] min-h-[70dvh] flex items-center" id="features">
      <div className="max-w-[1120px] mx-auto px-7 w-full">
        <div className="max-w-[620px] mx-auto mb-[46px] text-center">
          <span className="text-[12px] font-bold tracking-[.14em] uppercase text-txt-3 dark:text-[#6B7A6E]">
            Everything included
          </span>
          <h2 className="font-display font-extrabold text-[clamp(28px,3.6vw,40px)] leading-[1.12] tracking-tight mt-3 mb-3.5 dark:text-[#E8EDE9]">
            Everything your store runs on
          </h2>
          <p className="text-txt-2 dark:text-[#A3B0A5]">
            One login for you. One system of record for the whole business.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-[#1A201B] border border-line dark:border-[#2A312A] rounded-xl p-6 sm:p-8 transition-all hover:-translate-y-[3px] hover:shadow-gts-sm flex flex-col"
            >
              <div className="w-12 h-12 rounded-[13px] bg-green-soft dark:bg-[#1E3328] text-green-hover grid place-items-center text-[20px] mb-5" aria-hidden="true">
                {f.icon}
              </div>
              <h3 className="font-display text-[19px] font-bold mb-3 dark:text-[#E8EDE9]">
                {f.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-txt-2 dark:text-[#A3B0A5]">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
