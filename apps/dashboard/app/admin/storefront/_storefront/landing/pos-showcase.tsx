import styles from "../../page.module.css";

const CHECKS = [
  "Works on any tablet — no special hardware",
  "Promo codes and audited manual discounts",
  "Every sale lands in the same analytics as online",
];

function POSMockup() {
  return (
    <div className={styles.posMock}>
      <div className="text-xs font-bold mb-2.5 flex justify-between">
        Walk-in Sale <span className="text-txt-3 font-medium">Cashier &middot; Emeka</span>
      </div>
      <div className={styles.posRow}>
        <span>
          Oxford Shirt
          <small className="block text-[9.5px] text-txt-3">
            Size L &middot; Black &middot; &times;1
          </small>
        </span>
        <span className="font-mono">&#8358;15,000</span>
      </div>
      <div className={styles.posRow}>
        <span>
          Kaftan Set
          <small className="block text-[9.5px] text-txt-3">
            Size M &middot; White &middot; &times;1
          </small>
        </span>
        <span className="font-mono">&#8358;28,500</span>
      </div>
      <div className={styles.posRow}>
        <span>
          Promo — GTS10
          <small className="block text-[9.5px] text-txt-3">10% off</small>
        </span>
        <span className="font-mono text-green">&minus;&#8358;4,350</span>
      </div>
      <div className={styles.posTotal}>
        <span>Total</span>
        <span className="font-mono">&#8358;39,150</span>
      </div>
      <div className={styles.posBtn}>Confirm Payment — Card Terminal</div>
    </div>
  );
}

export function POSShowcase() {
  return (
    <section className="py-[74px]">
      <div
        className={`max-w-[1120px] mx-auto px-7 bg-ink text-white rounded-[28px] p-14 md:p-[58px_54px] grid grid-cols-1 md:grid-cols-2 gap-[50px] items-center ${styles.showcase}`}
      >
        <div>
          <span className="text-[12px] font-bold tracking-[.14em] uppercase text-[#7BAF8C]">
            In-store POS
          </span>
          <h2 className="font-display font-extrabold text-[clamp(26px,3.2vw,36px)] leading-[1.12] tracking-tight mt-3 mb-4">
            A till your cashiers learn in five minutes.
          </h2>
          <p className="text-[#B9C4BA] text-[15.5px] max-w-[440px]">
            Search by name or SKU, build the cart, confirm cash or terminal
            payment, print the receipt. Same-day voids restore stock
            automatically — with a full audit log.
          </p>
          <div className="flex flex-col gap-3 mt-6 text-[14.5px]">
            {CHECKS.map((c) => (
              <span key={c} className="flex gap-2.5 items-center">
                <span className="w-[18px] h-[18px] rounded-full bg-green inline-grid place-items-center text-[10px] font-extrabold shrink-0" aria-hidden="true">
                  &#10003;
                </span>
                {c}
              </span>
            ))}
          </div>
        </div>
        <POSMockup />
      </div>
    </section>
  );
}
