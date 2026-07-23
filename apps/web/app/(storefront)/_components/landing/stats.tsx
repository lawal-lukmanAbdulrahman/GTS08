const STATS = [
  { value: <>2 <em className="not-italic text-green">&rarr;</em> 1</>, label: "Sales channels, one shared inventory" },
  { value: <><em className="not-italic text-green">0</em></>, label: "Oversells — stock is reserved the moment checkout starts" },
  { value: <>&lt; 1s</>, label: "Stock sync between shop floor and website" },
  { value: <>24/7</>, label: "Order tracking for every customer, no account needed" },
];

export function Stats() {
  return (
    <section className="py-16">
      <div className="max-w-[1120px] mx-auto px-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        {STATS.map((s, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1A201B] border border-line dark:border-[#2A312A] rounded-md p-5 sm:p-6 shadow-gts-sm transition-colors"
          >
            <b className="font-display text-[clamp(26px,4vw,34px)] font-extrabold tracking-tight block">
              {s.value}
            </b>
            <span className="text-[13px] sm:text-[13.5px] text-txt-2 dark:text-[#A3B0A5]">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
