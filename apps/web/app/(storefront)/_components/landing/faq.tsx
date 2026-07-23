"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Does GTS work for both my physical shop and my online store?",
    a: "Yes — that's the whole point. Your website and your in-store till share one inventory and one order list. A sale on either side updates stock everywhere instantly.",
  },
  {
    q: "What happens if someone buys online while my cashier sells the last unit?",
    a: "It can't happen. Online checkout reserves the stock the moment a customer starts paying, and in-store sales check live availability. If it's gone, it's gone — nobody gets charged for stock you don't have.",
  },
  {
    q: "Which payment methods do my customers get?",
    a: "Online payments run on Paystack — card, bank transfer, and USSD. In-store, your cashiers record cash or card-terminal payments directly at the till.",
  },
  {
    q: "Do my cashiers need special hardware?",
    a: "No. The POS runs in the browser on any tablet or laptop. Receipts print from the standard browser print dialog, and SKU search is barcode-scanner ready.",
  },
  {
    q: "Can I change my homepage and run promos without a developer?",
    a: "Yes. Hero banners, announcements, deals, and promo codes are all managed from your admin dashboard. Launch a sale in minutes, not tickets.",
  },
  {
    q: "Can I customize the look of my store?",
    a: "Absolutely. Your storefront carries your brand — logo, colors, hero banners, featured products, and announcements are all managed from your dashboard. No code or developer needed to make your store look like yours.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-[74px]" id="faq">
      <div className="max-w-[1120px] mx-auto px-7 grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-[60px] items-start">
        <div>
          <span className="text-[12px] font-bold tracking-[.14em] uppercase text-txt-3 dark:text-[#6B7A6E]">
            FAQ
          </span>
          <h2 className="font-display font-extrabold text-[clamp(28px,3.4vw,38px)] leading-[1.12] tracking-tight mt-3 mb-6 dark:text-[#E8EDE9]">
            Let&rsquo;s answer the questions store owners ask us
          </h2>
          <div className="bg-green text-white rounded-md p-6 max-w-[300px]">
            <b className="block text-base mb-1.5">Schedule a consultation</b>
            <p className="text-[13.5px] text-[#DFF2E6] mb-4">
              Get a personal walkthrough of GTS with your own products.
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 font-semibold text-[13.5px] py-2.5 px-4 rounded-full bg-transparent border border-white/50 text-white hover:border-white transition-colors"
            >
              Book a demo &rarr;
            </a>
          </div>
        </div>
        <div>
          {FAQS.map((faq, i) => (
            <div key={i} className="border-b border-line dark:border-[#2A312A]">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex justify-between items-center gap-4 py-5 px-0.5 font-semibold text-[16.5px] text-left cursor-pointer bg-transparent border-none dark:text-[#E8EDE9] transition-colors focus-visible:ring-2 focus-visible:ring-green focus-visible:outline-none focus-visible:rounded-lg"
              >
                {faq.q}
                <span
                  className={`not-italic text-[19px] text-txt-3 dark:text-[#6B7A6E] transition-transform shrink-0 ${
                    openIndex === i ? "rotate-45 text-green" : ""
                  }`}
                >
                  +
                </span>
              </button>
              {openIndex === i && (
                <p className="pr-4 md:pr-10 pb-5 pl-0.5 text-txt-2 dark:text-[#A3B0A5] text-[15px]">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
