export function CTABand() {
  return (
    <section className="py-[74px]">
      <div className="max-w-[1120px] mx-auto px-7">
        <div className="bg-mint dark:bg-[#1A2A1F] rounded-[28px] text-center py-16 px-[30px] transition-colors">
          <h2 className="font-display font-extrabold text-[clamp(26px,3.4vw,38px)] leading-[1.12] tracking-tight mb-3.5 dark:text-[#E8EDE9]">
            Run your whole store from one place.
          </h2>
          <p className="text-txt-2 dark:text-[#A3B0A5] mb-7">
            Storefront, POS, inventory, and analytics — finally in agreement.
          </p>
          <a
            href="/register"
            className="inline-flex items-center gap-2 font-semibold text-[15px] py-3.5 px-6 rounded-full bg-green text-white hover:bg-green-hover transition-all hover:-translate-y-px"
          >
            Get started
          </a>
        </div>
      </div>
    </section>
  );
}
