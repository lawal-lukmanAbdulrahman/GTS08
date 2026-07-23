import styles from "../../page.module.css";

interface FeatureItem {
  title: string;
  description: string;
  active?: boolean;
}

interface FeatureRowProps {
  features: FeatureItem[];
  card: React.ReactNode;
  reversed?: boolean;
}

export function FeatureRow({
  features,
  card,
  reversed,
}: FeatureRowProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-14 items-center ${
        reversed ? "md:[direction:rtl] md:[&>*]:[direction:ltr]" : ""
      }`}
    >
      <div>{card}</div>
      <div className="flex flex-col">
        {features.map((f, i) => (
          <div
            key={i}
            className={`py-5.5 pl-6 border-l-2 relative ${
              f.active ? "border-l-green" : "border-l-line dark:border-l-[#2A312A]"
            }`}
          >
            <h3 className="font-display text-[19px] font-bold mb-2">
              {f.title}
            </h3>
            <p className="text-[14.5px] text-txt-2 dark:text-[#A3B0A5] max-w-[400px]">
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Pre-built card mockups for the two feature rows */

export function InventoryCard() {
  return (
    <div className={styles.fcard}>
      <div className={`${styles.mini} ${styles.tilt}`}>
        <div className="text-xs font-bold mb-2.5">Inventory — Live</div>
        <div className="grid grid-cols-[1.6fr_.7fr_.9fr] gap-1.5 sm:gap-2 items-center text-[8px] sm:text-[9px] font-bold text-txt-3 dark:text-[#6B7A6E] uppercase tracking-wide px-1">
          <span>Variant</span>
          <span>Avail.</span>
          <span>Status</span>
        </div>
        {[
          { variant: "Oxford Shirt · L/Black", avail: "23", status: "In stock", cls: styles.stPaid },
          { variant: "Oxford Shirt · S/Black", avail: "3", status: "Low stock", cls: styles.stOut },
          { variant: "Chinos · 32/Navy", avail: "0", status: "Out of stock", cls: styles.stDone },
        ].map((r) => (
          <div
            key={r.variant}
            className="grid grid-cols-[1.6fr_.7fr_.9fr] gap-1.5 sm:gap-2 items-center text-[9px] sm:text-[10px] py-[7px] px-1 border-t border-line dark:border-[#2A312A]"
          >
            <span>{r.variant}</span>
            <span className="font-mono">{r.avail}</span>
            <span className={`${styles.status} ${r.cls}`}>{r.status}</span>
          </div>
        ))}
      </div>
      <div
        className={`${styles.float} ${styles.floatRight}`}
      >
        <b className="block text-[12.5px]">&#9888; Low stock alert</b>
        <span className="font-mono text-[11px]">
          GTS-OXF-S-BLK &middot; 3 left
        </span>
      </div>
    </div>
  );
}

export function StorefrontCard() {
  return (
    <div className={styles.fcard}>
      <div className={styles.mini} style={{ maxWidth: "100%", margin: "0 auto" }}>
        <div className="text-xs font-bold mb-2.5">gts.ng/track</div>
        <p className="text-[11px] text-txt-2 dark:text-[#A3B0A5] mb-2.5">
          Order <span className="font-mono">GTS-202607-000141</span>
        </p>
        {[
          { icon: "✓", text: "Order placed · Jul 15, 2:14 PM", cls: styles.stPaid },
          { icon: "✓", text: "Payment confirmed · Paystack", cls: styles.stPaid },
          { icon: "✓", text: "Processing · packed", cls: styles.stPaid },
          { icon: "●", text: "Out for delivery · GIG Logistics", cls: styles.stOut, bold: true },
          { icon: "○", text: "Delivered", cls: styles.stDone, muted: true },
        ].map((step, i) => (
          <div
            key={i}
            className={`grid grid-cols-[auto_1fr] gap-2 items-center text-[10px] py-[7px] px-1 ${
              i > 0 ? "border-t border-line dark:border-[#2A312A]" : ""
            }`}
          >
            <span className={`${styles.status} ${step.cls}`}>{step.icon}</span>
            <span className={step.muted ? "text-txt-3 dark:text-[#6B7A6E]" : ""}>
              {step.bold ? <b>{step.text}</b> : step.text}
            </span>
          </div>
        ))}
      </div>
      <div
        className={`${styles.float} ${styles.floatLeft}`}
      >
        <b className="block text-[12.5px]">Paystack</b>
        <span className="text-txt-2 dark:text-[#A3B0A5]">Payment verified &#10003;</span>
      </div>
    </div>
  );
}
