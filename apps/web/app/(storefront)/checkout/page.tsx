"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "../_components/cart-context";
import { Footer } from "../_components/landing/footer";

// ─── Nigerian States for Region/City dropdowns ────────────────────────────────
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const CITIES_BY_STATE: Record<string, string[]> = {
  "Lagos": ["Ikeja", "Lekki", "Surulere", "Victoria Island", "Yaba", "Alimosho", "Badagry", "Epe"],
  "FCT - Abuja": ["Garki", "Wuse", "Maitama", "Asokoro", "Gwarinpa", "Kubwa", "Lugbe"],
  "Rivers": ["Port Harcourt", "Obio-Akpor", "Eleme", "Oyigbo", "Bonny"],
  "Kano": ["Kano Municipal", "Fagge", "Dala", "Nassarawa", "Gwale"],
  "Oyo": ["Ibadan North", "Ibadan South-West", "Ogbomosho", "Oyo", "Iseyin"],
};

const SAVED_ADDRESSES = [
  {
    id: "addr-1",
    name: "Micah Okoh",
    phone: "+234 913 511 8669",
    address: "12 Balogun Street, Victoria Island",
    city: "Victoria Island",
    state: "Lagos",
    isDefault: true,
  },
  {
    id: "addr-2",
    name: "Micah Okoh",
    phone: "+234 913 511 8669",
    address: "Flat 4B, Royal Apartments, Gwarinpa",
    city: "Gwarinpa",
    state: "FCT - Abuja",
    isDefault: false,
  },
];

const DELIVERY_OPTIONS = [
  {
    id: "door",
    label: "Door Delivery",
    description: "Delivered directly to your address",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    fee: "₦1,500",
    eta: "1–3 business days",
  },
  {
    id: "pickup",
    label: "Pickup Station",
    description: "Collect at a nearby GTS pickup hub",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    fee: "₦500",
    eta: "Same-day to 2 days",
  },
  {
    id: "express",
    label: "Express Delivery",
    description: "Next-day guaranteed delivery",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    fee: "₦4,500",
    eta: "Next business day",
  },
];

const PAYMENT_OPTIONS = [
  {
    id: "pod",
    label: "Pay on Delivery",
    description: "Pay cash when your order arrives",
    group: "pay-later",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "card-transfer",
    label: "Pay with Cards, Bank Transfer or USSD",
    description: "You will be redirected to our secure checkout page",
    group: "prepay",
    iconBadge: (
      <span className="text-[10px] font-black bg-[#010101] text-white px-2 py-0.5 rounded-md tracking-wider">SECURE</span>
    ),
  },
  {
    id: "palmpay",
    label: "PalmPay",
    description: "To use this option, you must be registered with PalmPay",
    group: "prepay",
    iconBadge: (
      <div className="relative w-11 h-5 flex items-center justify-end">
        <Image src="/payments/palmpay.png" alt="PalmPay" fill className="object-contain object-right" />
      </div>
    ),
  },
  {
    id: "opay",
    label: "OPay",
    description: "To use this option, you must be registered with OPay",
    group: "prepay",
    iconBadge: (
      <div className="relative w-11 h-5 flex items-center justify-end">
        <Image src="/payments/opay.png" alt="OPay" fill className="object-contain object-right" />
      </div>
    ),
  },
  {
    id: "paystack",
    label: "Pay with Bank Cards – Paystack",
    description: "You can pay with cards via Paystack",
    group: "prepay",
    iconBadge: (
      <div className="relative w-14 h-5 flex items-center justify-end">
        <Image src="/payments/paystack.png" alt="Paystack" fill className="object-contain object-right" />
      </div>
    ),
  },
];

// ─── Floating Label Input ─────────────────────────────────────────────────────
function FloatingInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  required = false,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const isUp = focused || value.length > 0;
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        className={`peer w-full border rounded-xl px-4 pt-5 pb-2 text-sm font-medium text-[#010101] bg-white outline-none transition-all placeholder-transparent ${
          focused ? "border-[#010101] shadow-[0_0_0_2px_rgba(1,1,1,0.08)]" : "border-gray-200 hover:border-gray-400"
        }`}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-150 pointer-events-none font-medium ${
          isUp ? "top-1.5 text-[10px] text-[#010101]" : "top-3.5 text-sm text-gray-400"
        }`}
      >
        {label}
      </label>
    </div>
  );
}

// ─── Floating Label Select ────────────────────────────────────────────────────
function FloatingSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const isUp = value.length > 0;
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`peer w-full border rounded-xl px-4 pt-5 pb-2 text-sm font-medium text-[#010101] bg-white outline-none appearance-none transition-all cursor-pointer ${
          isUp ? "border-[#010101]" : "border-gray-200 hover:border-gray-400"
        }`}
      >
        <option value="" disabled />
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-150 pointer-events-none font-medium ${
          isUp ? "top-1.5 text-[10px] text-[#010101]" : "top-3.5 text-sm text-gray-400"
        }`}
      >
        {label}
      </label>
      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}

// ─── Stepper Dot ─────────────────────────────────────────────────────────────
function StepDot({ step, current, total }: { step: number; current: number; total: number }) {
  const done = step < current;
  const active = step === current;
  return (
    <div className="flex flex-col items-center relative h-full">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 shrink-0 z-10 ${
          done
            ? "bg-[#010101] border-[#010101] text-white shadow-xs"
            : active
            ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101] shadow-xs"
            : "bg-white border-gray-300 text-gray-400"
        }`}
      >
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          step
        )}
      </div>
      {step < total && (
        <div
          className={`w-[2px] absolute top-[38px] bottom-[-22px] left-1/2 -translate-x-1/2 transition-colors ${
            done ? "bg-[#010101]" : "bg-gray-300"
          }`}
        />
      )}
    </div>
  );
}

// ─── Main Checkout Page ───────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { cartItems } = useCart();

  // ── Stepper state ──
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;

  // ── Step 1: Address state ──
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    SAVED_ADDRESSES.find((a) => a.isDefault)?.id ?? null
  );
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [landmark, setLandmark] = useState("");

  // ── Step 2: Delivery state ──
  const [selectedDelivery, setSelectedDelivery] = useState("door");

  // ── Step 3: Payment state ──
  const [selectedPayment, setSelectedPayment] = useState("pod");

  // ── Promo code ──
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoError, setPromoError] = useState("");

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    const clean = promoCode.trim().toUpperCase();
    if (!clean) return;
    if (clean === "GTS10" || clean === "WELCOME10") {
      setAppliedPromo({ code: clean, discountPercent: 10 });
      setPromoCode("");
    } else if (clean === "GTS20" || clean === "SUMMER20") {
      setAppliedPromo({ code: clean, discountPercent: 20 });
      setPromoCode("");
    } else {
      setPromoError("Invalid code. Try GTS10 for 10% off.");
    }
  };

  // ── Order math ──
  const rawSubtotal = cartItems.reduce((sum, i) => sum + i.product.priceNum * i.quantity, 0);
  const discountAmount = appliedPromo ? Math.round((rawSubtotal * appliedPromo.discountPercent) / 100) : 0;
  const deliveryFeeNum = selectedDelivery === "express" ? 4500 : selectedDelivery === "pickup" ? 500 : 1500;
  const grandTotal = Math.max(0, rawSubtotal - discountAmount + deliveryFeeNum);

  const cities = region ? (CITIES_BY_STATE[region] ?? []) : [];

  const canProceedStep1 =
    selectedAddressId !== null ||
    (showNewAddressForm &&
      region.length > 0 &&
      city.length > 0 &&
      firstName.length > 0 &&
      lastName.length > 0 &&
      phone.length > 0 &&
      deliveryAddress.length > 0);

  const steps = [
    { num: 1, label: "Delivery Address", sub: "Where should we send your order?", shortLabel: "Address" },
    { num: 2, label: "Delivery Method", sub: "Choose how you'd like to receive it", shortLabel: "Delivery" },
    { num: 3, label: "Payment", sub: "How would you like to pay?", shortLabel: "Payment" },
    { num: 4, label: "Order Review", sub: "Review your details and place order", shortLabel: "Review" },
  ];

  return (
    <div className="min-h-screen bg-white text-[#010101] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-6">
          <Link href="/" className="hover:text-[#010101] transition-colors">Home</Link>
          <span>›</span>
          <Link href="/cart" className="hover:text-[#010101] transition-colors">Cart</Link>
          <span>›</span>
          <span className="text-[#010101] font-bold">Checkout</span>
        </nav>

        {/* ── Page title ── */}
        <div className="mb-6 pb-4 border-b border-gray-100">
          <h1 className="font-athelas text-3xl sm:text-4xl font-bold tracking-tight text-[#010101]">Checkout</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Complete your order in a few simple steps
          </p>
        </div>

        {/* ── Mobile Horizontal Stepper (visible on mobile / < lg, aligns with page padding) ── */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center justify-between relative px-0">
            {/* Track line starting at center of dot 1 and ending at center of dot 4 */}
            <div className="absolute left-4 right-4 top-4 h-0.5 bg-gray-200 pointer-events-none -z-0">
              <div
                className="h-full bg-[#010101] transition-all duration-300"
                style={{
                  width: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`,
                }}
              />
            </div>

            {steps.map((s) => {
              const isDone = currentStep > s.num;
              const isActive = currentStep === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (isDone || s.num < currentStep) setCurrentStep(s.num);
                  }}
                  disabled={!isDone && s.num > currentStep}
                  className="flex flex-col items-center gap-1.5 z-10 group cursor-pointer disabled:cursor-not-allowed"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2 ${
                      isDone
                        ? "bg-[#010101] border-[#010101] text-white shadow-xs"
                        : isActive
                        ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101] shadow-xs"
                        : "bg-white border-gray-300 text-gray-400"
                    }`}
                  >
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.num
                    )}
                  </div>
                  <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap ${
                    isActive ? "text-[#010101]" : isDone ? "text-gray-600" : "text-gray-400"
                  }`}>
                    {s.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2-Column Layout (Tight gap-4 on mobile) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-10 items-start">

          {/* ────── LEFT: Stepper Content ────── */}
          <div className="lg:col-span-7 xl:col-span-8">

            {/* Step items: On mobile, only render the active step card. Step 4 is mobile-only. */}
            {steps.map((s) => {
              const isActive = currentStep === s.num;
              const isDone = currentStep > s.num;

              return (
                <div key={s.num} className={`${isActive ? "flex" : "hidden lg:flex"} ${s.num === 4 ? "lg:hidden" : ""} gap-5 items-stretch pb-2 lg:pb-6`}>
                  {/* ── Timeline track (Desktop - 3 steps) ── */}
                  <div className="hidden lg:flex flex-col items-center pt-1">
                    <StepDot step={s.num} current={currentStep} total={3} />
                  </div>

                  {/* ── Step content container (No outer card on mobile for breathing room) ── */}
                  <div className={`flex-1 transition-all duration-300 ${
                    isActive
                      ? "lg:border lg:border-[#010101] lg:rounded-2xl lg:p-6 lg:shadow-[0_2px_20px_rgba(1,1,1,0.07)] lg:bg-white"
                      : isDone
                      ? "lg:border lg:border-gray-200 lg:rounded-2xl lg:p-6 lg:bg-[#F9F8F5]"
                      : "lg:border lg:border-gray-200 lg:rounded-2xl lg:p-6 lg:bg-[#F9F8F5] opacity-50"
                  }`}>
                    {/* Card header */}
                    <div
                      className={`flex items-center justify-between px-0 lg:px-6 pt-0 pb-3 lg:py-4 ${
                        isDone ? "cursor-pointer" : ""
                      }`}
                      onClick={() => { if (isDone) setCurrentStep(s.num); }}
                    >
                      <div>
                        {/* Hidden on mobile, 3 steps total on desktop */}
                        <p className={`hidden lg:block text-xs font-semibold uppercase tracking-wider mb-0.5 ${
                          isActive ? "text-[#EDCF5D]" : isDone ? "text-gray-400" : "text-gray-300"
                        }`}>
                          Step {s.num} of 3
                        </p>
                        <h2 className={`font-athelas text-lg font-bold ${
                          isActive ? "text-[#010101]" : isDone ? "text-gray-600" : "text-gray-300"
                        }`}>
                          {s.label}
                        </h2>
                        {isActive && (
                          <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                        )}
                      </div>
                      {isDone && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCurrentStep(s.num); }}
                          className="text-xs font-bold text-gray-500 hover:text-[#010101] underline underline-offset-4 transition-colors"
                        >
                          Change
                        </button>
                      )}
                    </div>

                    {/* ── STEP 1 CONTENT ── */}
                    {s.num === 1 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
                        {/* Saved addresses */}
                        {!showNewAddressForm && (
                          <div className="space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Saved Addresses</p>
                            {SAVED_ADDRESSES.map((addr) => (
                              <button
                                key={addr.id}
                                type="button"
                                onClick={() => setSelectedAddressId(addr.id)}
                                className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all ${
                                  selectedAddressId === addr.id
                                    ? "border-[#010101] bg-[#F9F8F5]"
                                    : "border-gray-200 bg-white hover:border-gray-400"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                      selectedAddressId === addr.id ? "border-[#010101]" : "border-gray-300"
                                    }`}>
                                      {selectedAddressId === addr.id && (
                                        <div className="w-2 h-2 rounded-full bg-[#010101]" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm text-[#010101]">{addr.name}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{addr.phone}</p>
                                      <p className="text-xs text-gray-600 mt-1">{addr.address}, {addr.city}, {addr.state}</p>
                                    </div>
                                  </div>
                                  {addr.isDefault && (
                                    <span className="flex-shrink-0 text-[10px] font-extrabold bg-[#EDCF5D] text-[#010101] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Default
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}

                            <button
                              type="button"
                              onClick={() => { setSelectedAddressId(null); setShowNewAddressForm(true); }}
                              className="w-full px-4 py-3.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#010101] text-sm font-semibold text-gray-500 hover:text-[#010101] transition-all flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              Add New Address
                            </button>
                          </div>
                        )}

                        {/* New Address Form */}
                        {showNewAddressForm && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Add New Address</p>
                              {SAVED_ADDRESSES.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => { setShowNewAddressForm(false); setSelectedAddressId(SAVED_ADDRESSES[0]!.id); }}
                                  className="text-xs font-bold text-gray-400 hover:text-[#010101] underline transition-colors"
                                >
                                  ← Use saved address
                                </button>
                              )}
                            </div>

                            {/* Region + City */}
                            <div className="grid grid-cols-2 gap-3">
                              <FloatingSelect id="region" label="Region" value={region} onChange={(v) => { setRegion(v); setCity(""); }} options={NIGERIAN_STATES} />
                              <FloatingSelect id="city" label="City" value={city} onChange={setCity} options={cities.length > 0 ? cities : ["Please select region first"]} />
                            </div>

                            {/* First + Last name */}
                            <div className="grid grid-cols-2 gap-3">
                              <FloatingInput id="fname" label="First Name" value={firstName} onChange={setFirstName} required />
                              <FloatingInput id="lname" label="Last Name" value={lastName} onChange={setLastName} required />
                            </div>

                            {/* Phone row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex gap-2">
                                <div className="flex items-center px-3 pt-3 pb-2 bg-[#F9F8F5] border border-gray-200 rounded-xl text-sm font-bold text-gray-600 shrink-0">
                                  +234
                                </div>
                                <div className="flex-1">
                                  <FloatingInput id="phone" label="Phone Number" type="tel" value={phone} onChange={setPhone} required />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex items-center px-3 pt-3 pb-2 bg-[#F9F8F5] border border-gray-200 rounded-xl text-sm font-bold text-gray-600 shrink-0">
                                  +234
                                </div>
                                <div className="flex-1">
                                  <FloatingInput id="altphone" label="Additional Phone (optional)" type="tel" value={altPhone} onChange={setAltPhone} />
                                </div>
                              </div>
                            </div>

                            {/* Delivery address */}
                            <FloatingInput id="delivaddr" label="Delivery Address" value={deliveryAddress} onChange={setDeliveryAddress} required />

                            {/* Landmark */}
                            <FloatingInput id="landmark" label="Landmark (optional)" value={landmark} onChange={setLandmark} />
                          </div>
                        )}

                        {/* Continue CTA */}
                        <button
                          type="button"
                          disabled={!canProceedStep1}
                          onClick={() => setCurrentStep(2)}
                          className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed mt-2 cursor-pointer"
                        >
                          <span>Continue to Delivery</span>
                          <span>→</span>
                        </button>
                      </div>
                    )}

                    {/* ── STEP 1 SUMMARY (when done) ── */}
                    {s.num === 1 && isDone && (
                      <div className="px-6 pb-5 border-t border-gray-100 pt-4">
                        {(() => {
                          const addr = SAVED_ADDRESSES.find((a) => a.id === selectedAddressId);
                          return addr ? (
                            <div className="text-sm text-gray-600">
                              <p className="font-bold text-[#010101]">{addr.name} · {addr.phone}</p>
                              <p className="text-xs mt-0.5">{addr.address}, {addr.city}, {addr.state}</p>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">
                              <p className="font-bold text-[#010101]">{firstName} {lastName} · +234{phone}</p>
                              <p className="text-xs mt-0.5">{deliveryAddress}, {city}, {region}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── STEP 2 CONTENT ── */}
                    {s.num === 2 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-4 border-t border-gray-100 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Select Delivery Method</p>
                        {DELIVERY_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedDelivery(opt.id)}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                              selectedDelivery === opt.id
                                ? "border-[#010101] bg-white"
                                : "border-gray-200 bg-white hover:border-gray-400"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              selectedDelivery === opt.id ? "border-[#010101]" : "border-gray-300"
                            }`}>
                              {selectedDelivery === opt.id && <div className="w-2 h-2 rounded-full bg-[#010101]" />}
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              selectedDelivery === opt.id ? "bg-[#EDCF5D] text-[#010101]" : "bg-[#F2F0EA] text-gray-600"
                            }`}>
                              {opt.icon}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-sm text-[#010101]">{opt.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                              <p className="text-xs font-bold text-[#010101] mt-1">{opt.fee} · <span className="text-gray-400 font-medium">{opt.eta}</span></p>
                            </div>
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 mt-2 cursor-pointer"
                        >
                          <span>Continue to Payment</span>
                          <span>→</span>
                        </button>
                      </div>
                    )}

                    {/* ── STEP 2 SUMMARY (when done) ── */}
                    {s.num === 2 && isDone && (
                      <div className="px-6 pb-5 border-t border-gray-100 pt-4">
                        {(() => {
                          const opt = DELIVERY_OPTIONS.find((o) => o.id === selectedDelivery);
                          return opt ? (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-6 h-6 rounded-lg bg-[#EDCF5D] flex items-center justify-center text-[#010101]">
                                {opt.icon}
                              </span>
                              <span className="font-bold text-[#010101]">{opt.label}</span>
                              <span className="text-gray-400">·</span>
                              <span className="font-bold text-[#010101]">{opt.fee}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* ── STEP 3 CONTENT ── */}
                    {s.num === 3 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-3 border-t border-gray-100 pt-5">
                        {/* Pay Later section */}
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Pay on Delivery</p>
                        {PAYMENT_OPTIONS.filter((p) => p.group === "pay-later").map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedPayment(opt.id)}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                              selectedPayment === opt.id
                                ? "border-[#010101] bg-white"
                                : "border-gray-200 bg-white hover:border-gray-400"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              selectedPayment === opt.id ? "border-[#010101]" : "border-gray-300"
                            }`}>
                              {selectedPayment === opt.id && <div className="w-2 h-2 rounded-full bg-[#010101]" />}
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              selectedPayment === opt.id ? "bg-[#EDCF5D] text-[#010101]" : "bg-[#F2F0EA] text-gray-600"
                            }`}>
                              {opt.icon}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-sm text-[#010101]">{opt.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                            </div>
                          </button>
                        ))}

                        {/* Pre-pay section */}
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-5 mb-1">Pre-pay Now</p>
                        {PAYMENT_OPTIONS.filter((p) => p.group === "prepay").map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedPayment(opt.id)}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                              selectedPayment === opt.id
                                ? "border-[#010101] bg-white"
                                : "border-gray-200 bg-white hover:border-gray-400"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              selectedPayment === opt.id ? "border-[#010101]" : "border-gray-300"
                            }`}>
                              {selectedPayment === opt.id && <div className="w-2 h-2 rounded-full bg-[#010101]" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-sm text-[#010101]">{opt.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                            </div>
                            {opt.iconBadge && (
                              <div className="flex-shrink-0 min-w-[50px] flex justify-end">
                                {opt.iconBadge}
                              </div>
                            )}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setCurrentStep(4)}
                          className="lg:hidden w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 mt-4 cursor-pointer"
                        >
                          <span>Review Order →</span>
                        </button>
                      </div>
                    )}

                    {/* ── STEP 3 SUMMARY (when done) ── */}
                    {s.num === 3 && isDone && (
                      <div className="px-6 pb-5 border-t border-gray-100 pt-4">
                        {(() => {
                          const opt = PAYMENT_OPTIONS.find((o) => o.id === selectedPayment);
                          return opt ? (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-6 h-6 rounded-lg bg-[#EDCF5D] flex items-center justify-center text-[#010101]">
                                {opt.icon}
                              </span>
                              <span className="font-bold text-[#010101]">{opt.label}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* ── STEP 4 CONTENT (Mobile & Desktop Order Summary Review) ── */}
                    {s.num === 4 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-6 border-t border-gray-100 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Review & Confirm Your Order</p>

                        {/* Collapsed Card 1: Delivery Address */}
                        <div className="p-4 rounded-xl border border-gray-200 bg-[#F9F8F5] flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#010101] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">1. Delivery Address</p>
                              {(() => {
                                const addr = SAVED_ADDRESSES.find((a) => a.id === selectedAddressId);
                                return addr ? (
                                  <div className="text-xs text-gray-700">
                                    <p className="font-bold text-[#010101]">{addr.name} · {addr.phone}</p>
                                    <p className="mt-0.5">{addr.address}, {addr.city}, {addr.state}</p>
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-700">
                                    <p className="font-bold text-[#010101]">{firstName} {lastName} · +234{phone}</p>
                                    <p className="mt-0.5">{deliveryAddress}, {city}, {region}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-xs font-bold text-gray-500 hover:text-[#010101] underline shrink-0 transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>

                        {/* Collapsed Card 2: Delivery Method */}
                        <div className="p-4 rounded-xl border border-gray-200 bg-[#F9F8F5] flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#010101] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v11.135m12 0H3.375" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">2. Delivery Method</p>
                              {(() => {
                                const opt = DELIVERY_OPTIONS.find((o) => o.id === selectedDelivery);
                                return opt ? (
                                  <div className="text-xs text-gray-700">
                                    <p className="font-bold text-[#010101]">{opt.label} ({opt.fee})</p>
                                    <p className="text-gray-500 mt-0.5">{opt.description} · {opt.eta}</p>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="text-xs font-bold text-gray-500 hover:text-[#010101] underline shrink-0 transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>

                        {/* Collapsed Card 3: Payment Method */}
                        <div className="p-4 rounded-xl border border-gray-200 bg-[#F9F8F5] flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#010101] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">3. Payment Method</p>
                              {(() => {
                                const opt = PAYMENT_OPTIONS.find((o) => o.id === selectedPayment);
                                return opt ? (
                                  <div className="text-xs text-gray-700">
                                    <p className="font-bold text-[#010101]">{opt.label}</p>
                                    <p className="text-gray-500 mt-0.5">{opt.description}</p>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(3)}
                            className="text-xs font-bold text-gray-500 hover:text-[#010101] underline shrink-0 transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ────── RIGHT: Sticky Order Summary ────── */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-28 space-y-4">

            {/* Order Summary Card */}
            <div className="bg-[#F9F8F5] rounded-2xl p-6 border border-gray-200/80 shadow-2xs">
              <h2 className="font-athelas text-xl font-bold text-[#010101] pb-4 border-b border-gray-200 flex items-center justify-between">
                Order Summary
                <span className="text-sm font-semibold text-gray-400 font-sans">
                  {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
                </span>
              </h2>

              {/* Cart items list */}
              <div className="divide-y divide-gray-100 my-4 space-y-0">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Your cart is empty</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={`${item.product.id}-${item.color}-${item.size}`} className="flex gap-3 py-3">
                      <div className="relative w-14 h-14 flex-shrink-0">
                        <div className="w-full h-full rounded-xl overflow-hidden bg-[#ECEAE6] border border-gray-200 relative">
                          <Image src={item.product.image} alt={item.product.title} fill className="object-contain p-1.5" />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-[#010101] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#010101] leading-tight truncate">{item.product.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.size} · {item.color}</p>
                        <p className="text-xs font-bold text-[#010101] mt-1">
                          ₦{(item.product.priceNum * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Promo code */}
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-4">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {appliedPromo.discountPercent}% OFF
                    </span>
                    Code <strong>{appliedPromo.code}</strong> applied
                  </span>
                  <button onClick={() => setAppliedPromo(null)} className="text-[11px] font-bold text-gray-400 hover:text-red-500 underline transition-colors">
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-2 mb-4">
                  <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 bg-white focus-within:border-[#010101] transition-all">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter code here"
                      className="flex-1 py-2.5 text-xs font-semibold text-[#010101] placeholder-gray-300 outline-none bg-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    className="text-xs font-bold text-[#010101] hover:text-[#EDCF5D] px-3 transition-colors"
                  >
                    APPLY
                  </button>
                </form>
              )}
              {promoError && <p className="text-xs text-red-500 font-semibold -mt-2 mb-3">{promoError}</p>}

              {/* Totals */}
              <div className="space-y-2.5 border-t border-gray-200 pt-4 text-sm">
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Item{"'"}s total ({cartItems.reduce((s, i) => s + i.quantity, 0)})</span>
                  <span className="font-bold text-[#010101]">₦{rawSubtotal.toLocaleString()}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Promo Discount ({appliedPromo.discountPercent}%)</span>
                    <span className="font-bold">-₦{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Delivery fee</span>
                  <span className="font-bold text-[#010101]">₦{deliveryFeeNum.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-baseline pt-3 border-t border-gray-200 mt-2">
                  <span className="font-extrabold text-base text-[#010101]">Total</span>
                  <span className="font-athelas font-extrabold text-2xl text-[#010101]">
                    ₦{grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Confirm order button — enabled once step 3 or step 4 is reached */}
              <button
                type="button"
                disabled={currentStep < 3}
                className={`w-full font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 transition-all duration-300 mt-4 ${
                  currentStep < 3
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-70"
                    : "bg-[#EDCF5D] hover:bg-[#010101] text-[#010101] hover:text-white shadow-md active:scale-95 cursor-pointer"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Confirm order</span>
              </button>

              {/* WhatsApp tip */}
              <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
                Please use a WhatsApp-enabled number to receive faster delivery updates and support. By proceeding, you are automatically accepting the{" "}
                <a href="/terms" className="text-[#010101] font-bold underline underline-offset-2 hover:text-[#EDCF5D]">Terms & Conditions</a>
              </p>
            </div>

            {/* Trust badges */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#010101]">Secure Checkout</p>
                  <p className="text-[11px] text-gray-400">256-bit SSL encryption</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#010101]">30-Day Returns</p>
                  <p className="text-[11px] text-gray-400">Hassle-free return policy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
