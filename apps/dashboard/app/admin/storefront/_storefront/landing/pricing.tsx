"use client";

import { useState } from "react";

type Period = "monthly" | "annual";

interface Plan {
  name: string;
  popular?: boolean;
  dark?: boolean;
  monthly: string;
  annual: string;
  description: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: "Basic",
    monthly: "₦24,500",
    annual: "₦18,600",
    description: "For a single shop getting its first online storefront.",
    features: [
      "Online storefront + product catalog",
      "Paystack payments (card, transfer, USSD)",
      "Core inventory tracking",
      "Customer order tracking page",
      "Email receipts & confirmations",
      "Custom logo & brand colors",
      "Hero banner management",
      "Up to 100 products",
    ],
  },
  {
    name: "Standard",
    popular: true,
    dark: true,
    monthly: "₦39,500",
    annual: "₦30,000",
    description: "For stores selling in-store and online, every day.",
    features: [
      "Everything in Basic",
      "In-store POS with same-day voids",
      "Low-stock alerts + audit trail",
      "Promo codes & discount rules",
      "Sales analytics by channel",
      "Barcode scanner support",
      "Customer accounts & history",
      "Unlimited products",
    ],
  },
  {
    name: "Premium",
    monthly: "₦79,000",
    annual: "₦60,000",
    description: "For growing brands with a team and a mailing list.",
    features: [
      "Everything in Standard",
      "Staff roles & granular permissions",
      "Email marketing campaigns",
      "Customer support ticket inbox",
      "Priority support (< 4hr response)",
      "Advanced analytics & reports",
      "Multi-location inventory",
      "API access & integrations",
    ],
  },
];

export function Pricing() {
  const [period, setPeriod] = useState<Period>("monthly");

  return (
    <section
      className="py-[74px] min-h-[70dvh] bg-gradient-to-b from-page to-[#EFF5F0] dark:from-[#111614] dark:to-[#151C17] transition-colors"
      id="pricing"
    >
      <div className="max-w-[1120px] mx-auto px-7">
        <div className="max-w-[620px] mx-auto mb-[46px] text-center">
          <span className="text-[12px] font-bold tracking-[.14em] uppercase text-txt-3 dark:text-[#6B7A6E]">
            Pricing
          </span>
          <h2 className="font-display font-extrabold text-[clamp(28px,3.6vw,40px)] leading-[1.12] tracking-tight mt-3 mb-3.5 dark:text-[#E8EDE9]">
            Plans for every store
          </h2>
          <p className="text-txt-2 dark:text-[#A3B0A5]">
            Pick the plan that fits where your business is today.
          </p>
          <div
            className="inline-flex bg-white dark:bg-[#1A201B] border border-line dark:border-[#2A312A] rounded-full p-1 mt-5 transition-colors"
            role="group"
            aria-label="Billing period"
          >
            <button
              onClick={() => setPeriod("monthly")}
              className={`border-none font-body font-semibold text-sm py-2.5 px-5 rounded-full cursor-pointer flex gap-2 items-center transition-colors focus-visible:ring-2 focus-visible:ring-green focus-visible:outline-none ${
                period === "monthly"
                  ? "bg-ink text-white"
                  : "bg-transparent text-txt-2 dark:text-[#A3B0A5]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod("annual")}
              className={`border-none font-body font-semibold text-sm py-2.5 px-5 rounded-full cursor-pointer flex gap-2 items-center transition-colors focus-visible:ring-2 focus-visible:ring-green focus-visible:outline-none ${
                period === "annual"
                  ? "bg-ink text-white"
                  : "bg-transparent text-txt-2 dark:text-[#A3B0A5]"
              }`}
            >
              Annual{" "}
              <span
                className={`text-[11px] font-bold ${
                  period === "annual" ? "text-[#F5A97C]" : "text-orange"
                }`}
              >
                −24%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl p-6 sm:p-[36px_32px] flex flex-col transition-colors ${
                plan.dark
                  ? "bg-ink text-white border-ink md:scale-[1.03] shadow-gts"
                  : "bg-white dark:bg-[#1A201B] border border-line dark:border-[#2A312A]"
              }`}
            >
              <h3 className="font-display text-[21px] font-bold flex items-center gap-2.5 dark:text-[#E8EDE9]">
                {plan.name}
                {plan.popular && (
                  <span className="bg-green text-white text-[10.5px] font-bold py-1 px-2.5 rounded-full">
                    Popular
                  </span>
                )}
              </h3>
              <div className="font-display mt-4 mb-2">
                <b className="text-[clamp(28px,5vw,38px)] font-extrabold tracking-tight">
                  {period === "monthly" ? plan.monthly : plan.annual}
                </b>{" "}
                <small
                  className={`font-body font-medium text-sm ${
                    plan.dark ? "text-[#8E9B90]" : "text-txt-3 dark:text-[#6B7A6E]"
                  }`}
                >
                  /month
                </small>
              </div>
              <p
                className={`text-[13.5px] min-h-[44px] ${
                  plan.dark ? "text-[#B9C4BA]" : "text-txt-2 dark:text-[#A3B0A5]"
                }`}
              >
                {plan.description}
              </p>
              <a
                href="/register"
                className={`inline-flex items-center justify-center gap-2 font-semibold text-[15px] py-3.5 px-6 rounded-full transition-all hover:-translate-y-px my-4 ${
                  plan.dark
                    ? "bg-green text-white hover:bg-green-hover"
                    : "bg-white dark:bg-[#1A201B] text-txt dark:text-[#E8EDE9] border border-line dark:border-[#2A312A] hover:border-txt-3"
                }`}
              >
                Get started
              </a>
              <div
                className={`border-t pt-6 flex flex-col gap-3.5 text-sm flex-1 ${
                  plan.dark ? "border-[#3A423A]" : "border-line dark:border-[#2A312A]"
                }`}
              >
                {plan.features.map((f) => (
                  <span key={f} className="flex gap-2.5">
                    <i className="text-green not-italic font-extrabold">
                      &#10003;
                    </i>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
