import Image from "next/image";
import styles from "../../page.module.css";

const BARS = [
  { online: "44%", walkin: "18%", day: "Mon" },
  { online: "58%", walkin: "22%", day: "Tue" },
  { online: "36%", walkin: "30%", day: "Wed" },
  { online: "70%", walkin: "24%", day: "Thu" },
  { online: "52%", walkin: "40%", day: "Fri" },
  { online: "86%", walkin: "52%", day: "Sat" },
  { online: "64%", walkin: "34%", day: "Sun" },
];

function DashboardMockup() {
  return (
    <div className={styles.shot}>
      <div className={styles.chrome} aria-hidden="true">
        <i className={styles.chromeDot} />
        <i className={styles.chromeDot} />
        <i className={styles.chromeDot} />
      </div>
      <div className={styles.dash}>
        <aside className={styles.side}>
          <div className="flex items-center gap-[7px] mx-1.5 mb-4 mt-0.5">
            <Image
              src="/logo.png"
              alt="GTS"
              width={51}
              height={28}
              className="h-7 w-auto"
            />
            <span className="text-[10px] font-semibold text-txt-2 dark:text-[#A3B0A5]">Admin</span>
          </div>
          <div className={styles.sideNav}>
            <a className={styles.active}>&#9638; Dashboard</a>
            <a>&#9636; Orders</a>
            <a>&#9640; Products</a>
            <a>&#9637; Inventory</a>
            <a>&#9643; Customers</a>
            <a>&#9881; Settings</a>
          </div>
        </aside>
        <div className={styles.dashMain}>
          <div className="flex justify-between items-center mb-3.5">
            <p className="text-[15px] font-display font-bold">
              Welcome back, Adaeze
            </p>
            <span className="text-[10.5px] text-txt-3 dark:text-[#6B7A6E] bg-page dark:bg-[#111614] border border-line dark:border-[#2A312A] rounded-full py-1.5 px-3 pr-10 transition-colors">
              Search orders, products&hellip;
            </span>
          </div>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>
                Total Revenue <span>7d</span>
              </div>
              <div className={styles.kpiValue}>&#8358;4,920,500</div>
              <div className={`${styles.kpiDelta} ${styles.up}`}>
                &#9650; 12.5% vs last week
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>
                Orders <span>7d</span>
              </div>
              <div className={styles.kpiValue}>138</div>
              <div className={`${styles.kpiDelta} ${styles.up}`}>
                &#9650; 8.1% &middot; 96 online
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>
                Walk-in Sales <span>7d</span>
              </div>
              <div className={styles.kpiValue}>&#8358;1,310,000</div>
              <div className={`${styles.kpiDelta} ${styles.up}`}>
                &#9650; 4.2% &middot; 42 sales
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Low Stock</div>
              <div className={`${styles.kpiValue} ${styles.warnVal}`}>
                3 variants
              </div>
              <div className={`${styles.kpiDelta} ${styles.down}`}>
                Restock needed
              </div>
            </div>
          </div>
          <div className={styles.panes}>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                Sales — Online vs Walk-in
                <span className="flex gap-2.5 text-[9px] text-txt-2 dark:text-[#A3B0A5]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-[3px] inline-block bg-green" aria-hidden="true" />
                    Online
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-[3px] inline-block bg-[#CFE7D7]" aria-hidden="true" />
                    Walk-in
                  </span>
                </span>
              </div>
              <div className={styles.bars}>
                {BARS.map((b) => (
                  <div key={b.day} className={styles.barGroup}>
                    <span
                      className={styles.barOnline}
                      style={{ height: b.online }}
                    />
                    <span
                      className={styles.barWalkin}
                      style={{ height: b.walkin }}
                    />
                    <span className={styles.barDay}>{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>Channel Split</div>
              <div className={styles.donut} />
              <div className="flex justify-around text-[9.5px] text-txt-2 dark:text-[#A3B0A5]">
                <span>
                  Online
                  <b className="block font-mono text-[11px] text-txt dark:text-[#E8EDE9]">
                    &#8358;3.61M
                  </b>
                </span>
                <span>
                  Walk-in
                  <b className="block font-mono text-[11px] text-txt dark:text-[#E8EDE9]">
                    &#8358;1.31M
                  </b>
                </span>
              </div>
            </div>
          </div>
          <div className={styles.ordersTable}>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>Recent Orders</div>
              <div className={styles.orowHead}>
                <span>Order</span>
                <span>Item</span>
                <span>Total</span>
                <span>Status</span>
              </div>
              <div className={styles.orow}>
                <span className="font-mono">GTS-202607-000142</span>
                <span>Oxford Shirt — L / Black &times;1</span>
                <span className="font-mono">&#8358;15,000</span>
                <span className={`${styles.status} ${styles.stPaid}`}>
                  Paid
                </span>
              </div>
              <div className={styles.orow}>
                <span className="font-mono">GTS-202607-000141</span>
                <span>Chinos — 34 / Navy &times;2</span>
                <span className="font-mono">&#8358;39,000</span>
                <span className={`${styles.status} ${styles.stOut}`}>
                  Out for delivery
                </span>
              </div>
              <div className={styles.orow}>
                <span className="font-mono">GTS-202607-000140</span>
                <span>Kaftan Set — M / White &times;1</span>
                <span className="font-mono">&#8358;28,500</span>
                <span className={`${styles.status} ${styles.stDone}`}>
                  Completed &middot; POS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <header className={styles.hero} id="product">
      <div className="max-w-[1120px] mx-auto px-7 relative text-center">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold py-1.5 px-3.5 rounded-full bg-white dark:bg-[#1A201B] border border-line dark:border-[#2A312A] text-txt-2 dark:text-[#A3B0A5] transition-colors">
          <b className="bg-green text-white text-[11px] py-0.5 px-2.5 rounded-full">
            New
          </b>
          One system for your shop floor and your website
        </span>
        <h1 className="font-display font-extrabold text-[clamp(38px,5.4vw,60px)] leading-[1.12] tracking-tight mt-[22px] mb-[18px] mx-auto max-w-[760px]">
          Your entire store.
          <br />
          <em className="not-italic text-green">One system.</em>
        </h1>
        <p className="max-w-[560px] mx-auto mb-[30px] text-txt-2 dark:text-[#A3B0A5] text-[17px]">
          GTS gives your brand its own online storefront and in-store POS,
          running on a single shared backend — so a sale on the shop floor and a
          sale on your website never disagree.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-16">
          <a
            href="/register"
            className="inline-flex items-center gap-2 font-semibold text-[15px] py-3.5 px-6 rounded-full bg-green text-white hover:bg-green-hover transition-all hover:-translate-y-px"
          >
            Get started
          </a>
          <a
            href="#faq"
            className="inline-flex items-center gap-2 font-semibold text-[15px] py-3.5 px-6 rounded-full bg-white dark:bg-[#1A201B] text-txt dark:text-[#E8EDE9] border border-line dark:border-[#2A312A] hover:border-txt-3 transition-all hover:-translate-y-px"
          >
            Book a demo
          </a>
        </div>
        <DashboardMockup />
      </div>
    </header>
  );
}
