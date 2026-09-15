"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItem {
  id: string;
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    q: "Are GTS products 100% authentic and genuine?",
    a: "Yes, every item listed on GTS is 100% genuine and ethically sourced directly from verified global brands and authorized distributors. We guarantee exceptional quality, durability, and a premium shopping experience.",
  },
  {
    id: "faq-2",
    q: "Does GTS ship internationally and safely?",
    a: "Yes! We provide fast nationwide delivery across Nigeria as well as reliable international shipping. Every package is securely handled, tracked in real-time, and fully insured for safe delivery.",
  },
  {
    id: "faq-3",
    q: "How can I verify my order status and tracking?",
    a: "Once your order is placed, you will receive instant updates via email and SMS with your live tracking code. You can also monitor your package status anytime under your GTS account dashboard.",
  },
  {
    id: "faq-4",
    q: "What payment options are accepted on GTS?",
    a: "We accept secure credit/debit cards (Mastercard, Visa, Verve), instant bank transfers, USSD, and encrypted digital payment gateways for seamless transactions.",
  },
  {
    id: "faq-5",
    q: "What is the GTS return and refund policy?",
    a: "We offer a hassle-free 7-day return policy on all eligible items. If your item arrives damaged or incorrect, our 24/7 support team will arrange an immediate replacement or full refund.",
  },
  {
    id: "faq-6",
    q: "Do GTS packages include eco-friendly packaging?",
    a: "Absolutely. We package all shipments using premium eco-friendly, recyclable protective materials to ensure your items arrive safely while keeping our footprint clean.",
  },
];

export function FAQ() {
  const [openId, setOpenId] = useState<string | null>("faq-1");

  const toggleFaq = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="w-full px-3 md:px-4 pt-4 sm:pt-6 pb-12 sm:pb-16 bg-white" id="faq">
      <div className="max-w-[1240px] mx-auto">
        {/* Header Row: Styled to match Bestsellers & New Arrivals section headers */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5 mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#010101] tracking-tight flex items-center gap-2">
              Have any <span className="font-serif italic font-bold text-[#010101]">questions?</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-normal text-gray-500 max-w-xs md:text-right leading-relaxed">
            Hear from shoppers who rely on GTS with confidence and style.
          </p>
        </div>

        {/* 2-Column Cards Grid: Warm GTS Neutral background (#F9F8F5) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4.5 items-start">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                onClick={() => toggleFaq(faq.id)}
                className={`cursor-pointer rounded-2xl p-5 sm:p-6 transition-all duration-200 border ${
                  isOpen
                    ? "bg-[#F9F8F5] border-amber-200/80 shadow-xs"
                    : "bg-[#F9F8F5] border-transparent hover:bg-[#F2F0EA]"
                }`}
              >
                {/* Question Row */}
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs sm:text-sm md:text-base font-semibold text-[#010101] leading-snug">
                    {faq.q}
                  </h3>
                  <button
                    aria-label={isOpen ? "Collapse question" : "Expand question"}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isOpen
                        ? "bg-[#EDCF5D] text-[#010101]"
                        : "bg-white text-[#010101] shadow-2xs hover:bg-gray-100"
                    }`}
                  >
                    {isOpen ? (
                      <svg className="w-3.5 h-3.5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Answer Content */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs sm:text-sm font-normal text-gray-600 leading-relaxed pt-3 mt-2.5 border-t border-gray-200/60">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
