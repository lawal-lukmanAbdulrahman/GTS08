const BRANDS = [
  { name: "Adire&Co", initials: "A&C" },
  { name: "ILÉ Studio", initials: "ILÉ" },
  { name: "NorthLoom", initials: "NL" },
  { name: "Kola District", initials: "KD" },
  { name: "Bespoke.NG", initials: "B." },
  { name: "Woven Lagos", initials: "WL" },
  { name: "Thread & Press", initials: "T&P" },
  { name: "Aso Collective", initials: "AC" },
];

// Duplicate for seamless infinite loop
const MARQUEE_ITEMS = [...BRANDS, ...BRANDS];

export function TrustedBrands() {
  return (
    <section className="py-14 overflow-hidden">
      <div className="max-w-[1120px] mx-auto px-7">
        <p className="text-[13px] font-medium text-txt-3 dark:text-[#6B7A6E] mb-7 text-center tracking-wide uppercase">
          Built for retail brands selling in-store and online
        </p>
      </div>
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-page dark:from-[#111614] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-page dark:from-[#111614] to-transparent z-10 pointer-events-none" />

        {/* Sliding track — pauses on hover for accessibility */}
        <div className="flex animate-marquee hover:[animation-play-state:paused] gap-12 w-max">
          {MARQUEE_ITEMS.map((brand, i) => (
            <div
              key={`${brand.name}-${i}`}
              className="flex items-center gap-3 px-6 py-4 rounded-xl border border-line dark:border-[#2A312A] bg-white dark:bg-[#1A201B] shrink-0 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-green/10 dark:bg-green/20 flex items-center justify-center">
                <span className="font-display font-extrabold text-[13px] text-green">
                  {brand.initials}
                </span>
              </div>
              <span className="font-display font-bold text-[17px] text-txt dark:text-[#E8EDE9] whitespace-nowrap">
                {brand.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
