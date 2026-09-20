"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "../_components/cart-context";
import { useAuth } from "../_components/auth-context";
import { useAuthModal } from "../_components/auth-modal-context";
import { Footer } from "../_components/landing/footer";
import { idempotentFetch } from "@gts/utils";
import { toCheckoutLines } from "../_lib/checkout-client";
import { useCheckoutQuote } from "../_lib/use-checkout-quote";

import { NIGERIAN_STATES, NIGERIAN_LOCATIONS } from "../_data/nigerian-locations";

interface PickupStation {
  id: string;
  name: string;
  state: string;
  city: string;
  address: string;
  closeTo: string;
  phone: string;
  hours: string;
  fee: number;
  feeFormatted: string;
  googleMapsUrl: string;
  mapX: number;
  mapY: number;
}

const GTS_CHECKOUT_PICKUP_STATIONS: PickupStation[] = [
  // Kwara / Ilorin
  {
    id: "ps_ilorin_airport",
    name: "GTS Pickup Station Ilorin Airport Rd",
    state: "Kwara",
    city: "Ilorin",
    address: "Suite A, Adebayo Yusuf House, opposite International Airport Ilorin.",
    closeTo: "Beside Donrich Educational Services",
    phone: "07055211380",
    hours: "Mon-Fri 8 AM - 6PM; SAT 9 AM - 5PM",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Airport+Road+Ilorin",
    mapX: 68,
    mapY: 53,
  },
  {
    id: "ps_alimi_road",
    name: "GTS Pickup Station Alimi Road",
    state: "Kwara",
    city: "Ilorin",
    address: "Shop 3 opposite SD Oladeji Filling station, Okolowo Ayelabowo, Ilorin, Kwara State.",
    closeTo: "SD Oladeji Filling station",
    phone: "08031234567",
    hours: "8:00am-6:00pm; 9:00am-5:00pm",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Alimi+Road+Ilorin",
    mapX: 74,
    mapY: 50,
  },
  {
    id: "ps_ilorin_stadium",
    name: "GTS Pickup Station Ilorin Stadium",
    state: "Kwara",
    city: "Ilorin",
    address: "No. 52, Stadium Road, off Ibrahim Taiwo road, Ilorin, Kwara State",
    closeTo: "Olumo Building",
    phone: "08149876543",
    hours: "Mon-Fri 9:00am - 6:00pm; Sat 9am",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Stadium+Road+Ilorin",
    mapX: 71,
    mapY: 48,
  },
  {
    id: "ps_ilorin_gambari",
    name: "GTS Pickup Station Ilorin Gambari Road",
    state: "Kwara",
    city: "Ilorin",
    address: "Balogun Gambari Road, beside Balogun Fulani Microfinance Bank, Ilorin Kwara State",
    closeTo: "Balogun Fulani Microfinance Bank",
    phone: "09023456789",
    hours: "Mon-Fri 8am-6pm; Sat 9am-5pm",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Gambari+Road+Ilorin",
    mapX: 76,
    mapY: 46,
  },

  // Lagos
  {
    id: "ps_ikeja",
    name: "GTS Pickup Station Ikeja City Hub",
    state: "Lagos",
    city: "Ikeja",
    address: "14 Medical Road, Computer Village, Ikeja, Lagos",
    closeTo: "Under Bridge / Ikeja City Mall",
    phone: "08021112233",
    hours: "Mon-Fri 8 AM - 7PM; SAT 9 AM - 6PM",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Ikeja+Lagos",
    mapX: 45,
    mapY: 40,
  },
  {
    id: "ps_vi",
    name: "GTS Pickup Station Victoria Island",
    state: "Lagos",
    city: "Victoria Island",
    address: "Plot 8 Adeola Odeku Street, Victoria Island, Lagos",
    closeTo: "Silverbird Galleria",
    phone: "08032223344",
    hours: "Mon-Fri 9 AM - 7PM; SAT 10 AM - 5PM",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Victoria+Island+Lagos",
    mapX: 55,
    mapY: 60,
  },
  {
    id: "ps_lekki",
    name: "GTS Pickup Station Lekki Phase 1",
    state: "Lagos",
    city: "Lekki",
    address: "Admiralty Way, Opposite Domino's Pizza, Lekki Phase 1, Lagos",
    closeTo: "Ebeano Supermarket",
    phone: "08093334455",
    hours: "Mon-Sat 8:30 AM - 6:30 PM",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Lekki+Phase+1+Lagos",
    mapX: 65,
    mapY: 58,
  },

  // Abuja (FCT)
  {
    id: "ps_wuse2",
    name: "GTS Pickup Station Wuse 2",
    state: "Abuja (FCT)",
    city: "Wuse 2",
    address: "12 Aminu Kano Crescent, Wuse 2, Abuja",
    closeTo: "Banex Plaza",
    phone: "08055556677",
    hours: "Mon-Sat 8:30 AM - 6 PM",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Wuse+2+Abuja",
    mapX: 50,
    mapY: 45,
  },

  // Rivers / Port Harcourt
  {
    id: "ps_phc",
    name: "GTS Pickup Station Port Harcourt GRA",
    state: "Rivers",
    city: "Port Harcourt",
    address: "23 Aba Road, beside Garrison Junction, Port Harcourt, Rivers State",
    closeTo: "Garrison Roundabout",
    phone: "08077778899",
    hours: "Mon-Sat 8 AM - 6 PM",
    fee: 1100,
    feeFormatted: "₦ 1,100",
    googleMapsUrl: "https://maps.google.com/?q=Port+Harcourt+GRA",
    mapX: 52,
    mapY: 50,
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
    description: "Collect at a nearby GTS pickup hub close to you",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    fee: "₦1,100",
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
    id: "paystack",
    label: "Pay with Bank Cards – Paystack",
    description: "Instant, verified payment processing",
    group: "prepay",
    iconBadge: (
      <div className="relative w-14 h-5 flex items-center justify-end">
        <Image src="/payments/paystack.png" alt="Paystack" fill className="object-contain object-right" />
      </div>
    ),
  },
];

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
  options: readonly string[] | string[];
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
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function StepDot({ step, current, total }: { step: number; current: number; total: number }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex flex-col items-center relative">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 ${
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

function PickupStationModal({
  isOpen,
  onClose,
  selectedStationId,
  onSelectStation,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
}) {
  const [activeId, setActiveId] = useState(selectedStationId);
  const initialStation =
    GTS_CHECKOUT_PICKUP_STATIONS.find((s) => s.id === selectedStationId) ||
    GTS_CHECKOUT_PICKUP_STATIONS[0]!;
  const [filterState, setFilterState] = useState(initialStation.state);
  const [filterCity, setFilterCity] = useState(initialStation.city);

  useEffect(() => {
    setActiveId(selectedStationId);
    const st = GTS_CHECKOUT_PICKUP_STATIONS.find((s) => s.id === selectedStationId);
    if (st) {
      setFilterState(st.state);
      setFilterCity(st.city);
    }
  }, [selectedStationId, isOpen]);

  if (!isOpen) return null;

  const states = Array.from(new Set(GTS_CHECKOUT_PICKUP_STATIONS.map((s) => s.state)));
  const citiesForState = Array.from(
    new Set(GTS_CHECKOUT_PICKUP_STATIONS.filter((s) => s.state === filterState).map((s) => s.city))
  );

  const filteredStations = GTS_CHECKOUT_PICKUP_STATIONS.filter(
    (s) => s.state === filterState && (filterCity ? s.city === filterCity : true)
  );

  const activeStation =
    GTS_CHECKOUT_PICKUP_STATIONS.find((s) => s.id === activeId) ||
    filteredStations[0] ||
    GTS_CHECKOUT_PICKUP_STATIONS[0]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-base sm:text-lg text-[#010101]">
            Select a Pick-up station close to you
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#010101] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* State and City Filter Pills */}
        <div className="px-5 py-2.5 border-b border-gray-100 bg-[#FAF9F6] flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={filterState}
              onChange={(e) => {
                const newState = e.target.value;
                setFilterState(newState);
                const matching = GTS_CHECKOUT_PICKUP_STATIONS.filter((s) => s.state === newState);
                if (matching.length > 0) {
                  setFilterCity(matching[0]!.city);
                  setActiveId(matching[0]!.id);
                }
              }}
              className="appearance-none bg-[#FFF8F2] border border-[#FDBA74] text-[#C2410C] text-xs font-bold rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer shadow-2xs"
            >
              {states.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#EA580C]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select
              value={filterCity}
              onChange={(e) => {
                const newCity = e.target.value;
                setFilterCity(newCity);
                const matching = GTS_CHECKOUT_PICKUP_STATIONS.filter(
                  (s) => s.state === filterState && s.city === newCity
                );
                if (matching.length > 0) {
                  setActiveId(matching[0]!.id);
                }
              }}
              className="appearance-none bg-[#FFF8F2] border border-[#FDBA74] text-[#C2410C] text-xs font-bold rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer shadow-2xs"
            >
              {citiesForState.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#EA580C]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Modal Body: Left List & Right Map */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Stations List */}
          <div className="md:col-span-5 border-r border-gray-200 flex flex-col overflow-y-auto max-h-[35vh] md:max-h-[520px] p-3 space-y-2.5 [scrollbar-width:thin]">
            {filteredStations.map((station) => {
              const isSelected = activeId === station.id;
              return (
                <div
                  key={station.id}
                  onClick={() => setActiveId(station.id)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#EA580C] bg-[#FFF8F2]/60 ring-1 ring-[#EA580C]/40"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-[#EA580C]" : "border-gray-300"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-[#EA580C]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-xs sm:text-sm text-[#010101] leading-tight">
                          {station.name}
                        </h4>
                        <span className="text-xs font-bold text-[#EA580C] shrink-0">
                          {station.feeFormatted}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                        {station.address}
                      </p>
                      <p className="text-[11px] text-gray-700 mt-1 flex items-center gap-1.5 font-medium">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>Close to: {station.closeTo}</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Opening hours: {station.hours}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Map & Floating Callout Card */}
          <div className="md:col-span-7 flex flex-col relative bg-[#F5F3EC] min-h-[360px] md:min-h-[520px] overflow-hidden">
            {/* Styled Interactive Map Canvas */}
            <div className="absolute inset-0 select-none overflow-hidden">
              <svg
                className="w-full h-full object-cover"
                viewBox="0 0 600 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="600" height="500" fill="#EFEFE6" />
                <path d="M 0 0 L 250 0 C 230 80, 290 140, 240 220 C 180 300, 150 400, 100 500 L 0 500 Z" fill="#E7EAE0" />
                <path d="M 450 0 C 420 120, 520 200, 480 340 C 450 440, 520 480, 600 500 L 600 0 Z" fill="#E9EDE4" />

                {/* Rivers */}
                <path d="M 380 0 C 370 80, 410 130, 390 200 C 360 290, 420 380, 370 500" stroke="#C8DFE8" strokeWidth="14" strokeLinecap="round" fill="none" />
                <path d="M 390 200 C 330 220, 280 230, 230 260 C 180 290, 150 350, 120 420" stroke="#D3E5EC" strokeWidth="8" strokeLinecap="round" fill="none" />

                {/* Highways & Roads */}
                <path d="M 0 350 Q 200 300, 360 270 T 600 150" stroke="#FDE047" strokeWidth="5" fill="none" />
                <path d="M 120 0 Q 240 180, 360 270 T 520 500" stroke="#FB923C" strokeWidth="4.5" fill="none" />
                <path d="M 360 270 L 390 500" stroke="#F87171" strokeWidth="3.5" fill="none" />
                <path d="M 280 0 L 290 500" stroke="#CBD5E1" strokeWidth="2.5" fill="none" />
                <path d="M 0 180 L 600 240" stroke="#CBD5E1" strokeWidth="2" fill="none" />
                <path d="M 180 120 L 520 380" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 2" fill="none" />
                <path d="M 320 220 Q 370 240, 420 260" stroke="#FFFFFF" strokeWidth="3" fill="none" />

                {/* Geography Labels */}
                <text x="365" y="255" fill="#4B5563" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Ilorin</text>
                <text x="210" y="390" fill="#6B7280" fontSize="10" fontWeight="600" fontFamily="sans-serif">Ogbomosho</text>
                <text x="440" y="370" fill="#6B7280" fontSize="10" fontWeight="600" fontFamily="sans-serif">Ijagbo Offa</text>
                <text x="450" y="405" fill="#9CA3AF" fontSize="9" fontFamily="sans-serif">Erin Ile</text>
                <text x="410" y="340" fill="#9CA3AF" fontSize="8" fontFamily="sans-serif">Oyun</text>
                <text x="480" y="300" fill="#9CA3AF" fontSize="8" fontFamily="sans-serif">Ajasse Ipo</text>
                <text x="520" y="305" fill="#9CA3AF" fontSize="8" fontFamily="sans-serif">Oro</text>
                <text x="345" y="270" fill="#9CA3AF" fontSize="8" fontFamily="sans-serif">Asa</text>
                <text x="300" y="420" fill="#9CA3AF" fontSize="8" fontFamily="sans-serif">Surulere</text>
              </svg>

              {/* Station Pin Markers */}
              {filteredStations.map((station) => {
                const isSelected = activeId === station.id;
                return (
                  <div
                    key={station.id}
                    onClick={() => setActiveId(station.id)}
                    style={{ left: `${station.mapX}%`, top: `${station.mapY}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-200 z-10 ${
                      isSelected ? "scale-115 z-20" : "hover:scale-110"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-all ${
                        isSelected
                          ? "bg-[#EA580C] text-white ring-4 ring-orange-200 shadow-lg"
                          : "bg-white text-[#EA580C] border-[#EA580C]"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Floating Callout Card pointing down at active station */}
            {activeStation && (
              <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[340px] bg-white rounded-xl p-3.5 shadow-xl border border-gray-100 z-30 text-left font-sans text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-1">
                  <h5 className="font-bold text-xs sm:text-sm text-[#010101] leading-tight">
                    {activeStation.name}
                  </h5>
                  <span className="text-xs font-bold text-[#EA580C] shrink-0">
                    {activeStation.feeFormatted}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  {activeStation.address}
                </p>
                <a
                  href={activeStation.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  See on google maps
                </a>
                <div className="pt-1.5 border-t border-gray-100 space-y-1.5 text-[11px] text-gray-700">
                  <p className="font-medium flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span>Close to: {activeStation.closeTo}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    <span>Contact: PUS {activeStation.city} ({activeStation.phone})</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Opening hours: {activeStation.hours}</span>
                  </p>
                  <p className="text-gray-500 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                    <span>Payment options: Payment on delivery, Pre-pay Now</span>
                  </p>
                </div>
              </div>
            )}

            {/* Map Zoom Controls */}
            <div className="absolute right-3 bottom-20 z-20 flex flex-col gap-1 shadow-md bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-50 font-bold text-base border-b border-gray-100 cursor-pointer"
              >
                +
              </button>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-50 font-bold text-base cursor-pointer"
              >
                -
              </button>
            </div>

            {/* Bottom Action Button */}
            <div className="p-3 bg-white border-t border-gray-100 mt-auto z-20">
              <button
                type="button"
                onClick={() => {
                  onSelectStation(activeId);
                  onClose();
                }}
                className="w-full bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer text-center text-sm"
              >
                Select pickup station
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const { cartItems } = useCart();
  const { user, customer, savedAddresses, addSavedAddress } = useAuth();
  const { openAuthModal } = useAuthModal();

  // ── Stepper state ──
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 3;

  // ── Step 1: Delivery Method state ──
  const [selectedDelivery, setSelectedDelivery] = useState("door");

  // ── Step 2: Pickup Station / Address state ──
  const [selectedPickupStationId, setSelectedPickupStationId] = useState("ps_ilorin_airport");
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);

  // Address state (for Door Delivery)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("Lagos");
  const [city, setCity] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [landmark, setLandmark] = useState("");

  // ── Step 3: Payment state ──
  const [selectedPayment, setSelectedPayment] = useState("paystack");

  // ── Promo code ──
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoError, setPromoError] = useState("");

  // ── Submission & Order Success State ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { quote, error: quoteError } = useCheckoutQuote(cartItems);

  // Sync user details on load
  useEffect(() => {
    if (customer) {
      if (customer.email) setEmail(customer.email);
      if (customer.full_name) {
        const parts = customer.full_name.split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
      if (customer.phone) setPhone(customer.phone);
    } else if (user?.email) {
      setEmail(user.email);
    }

    if (savedAddresses && savedAddresses.length > 0) {
      const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0]!;
      setSelectedAddressId(def.id);
      setShowNewAddressForm(false);
    } else {
      setShowNewAddressForm(true);
    }
  }, [customer, user, savedAddresses]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    if (!promoCode.trim()) return;
    // The server prices the order and applies no client-side discount, so a code that only
    // changed this page's total would promise a saving the customer is never given.
    setPromoError("Promo codes can't be applied at checkout yet.");
  };

  // ── Order math ──
  const selectedStation =
    GTS_CHECKOUT_PICKUP_STATIONS.find((s) => s.id === selectedPickupStationId) ||
    GTS_CHECKOUT_PICKUP_STATIONS[0]!;

  // The server prices the cart. Until its answer arrives the page shows its own estimate, and
  // the order can't be placed until the server has confirmed every item is available.
  const estimatedSubtotal = cartItems.reduce((sum, i) => sum + i.product.priceNum * i.quantity, 0);
  const rawSubtotal = quote ? quote.subtotal / 100 : estimatedSubtotal;
  const discountAmount = appliedPromo ? Math.round((rawSubtotal * appliedPromo.discountPercent) / 100) : 0;
  const localDeliveryFee = selectedDelivery === "express" ? 4500 : selectedDelivery === "pickup" ? selectedStation.fee : 1500;
  const deliveryFeeNum = quote ? quote.delivery_fees[selectedDelivery as "door" | "pickup" | "express"] / 100 : localDeliveryFee;
  const grandTotal = Math.max(0, rawSubtotal - discountAmount + deliveryFeeNum);
  const canPlaceOrder = cartItems.length > 0 && quote?.all_available === true;

  const cities = region ? (NIGERIAN_LOCATIONS[region] ?? []) : [];
  const userEmail = customer?.email || user?.email || email;

  // ── Stepper validations ──
  const canProceedStep1 = Boolean(selectedDelivery);

  const canProceedStep2 =
    selectedDelivery === "pickup"
      ? (
          Boolean(selectedPickupStationId) &&
          firstName.trim().length > 0 &&
          lastName.trim().length > 0 &&
          phone.trim().length >= 7
        )
      : (
          selectedAddressId !== null ||
          (
            showNewAddressForm &&
            region.length > 0 &&
            city.length > 0 &&
            firstName.length > 0 &&
            lastName.length > 0 &&
            phone.length > 0 &&
            deliveryAddress.length > 0
          )
        );

  const handleProceedFromStep1 = () => {
    if (!canProceedStep1) return;
    if (selectedDelivery === "pickup" && !selectedPickupStationId) {
      setIsPickupModalOpen(true);
    }
    setCurrentStep(2);
  };

  const handleProceedFromStep2 = async () => {
    if (!canProceedStep2) return;

    if (selectedDelivery !== "pickup" && showNewAddressForm && customer?.id && deliveryAddress.trim()) {
      try {
        const res = await addSavedAddress({
          full_name: `${firstName} ${lastName}`.trim(),
          phone: phone.trim(),
          address_line1: deliveryAddress.trim(),
          address_line2: landmark.trim() || undefined,
          city: city.trim(),
          state: region.trim(),
          is_default: savedAddresses.length === 0,
        });
        if (res.data?.id) {
          setSelectedAddressId(res.data.id);
          setShowNewAddressForm(false);
        }
      } catch (err) {
        console.error("Auto-save address error:", err);
      }
    }

    setCurrentStep(3);
  };

  // ── Handle Place Order ──
  const handleConfirmOrder = async () => {
    if (cartItems.length === 0) return;

    setIsSubmitting(true);

    // Selected address details
    let chosenAddress: any = {
      addressLine1: deliveryAddress,
      addressLine2: landmark,
      city,
      state: region,
      isDefault: false,
    };

    let chosenFullName = `${firstName} ${lastName}`.trim();
    let chosenPhone = phone;

    if (selectedDelivery === "pickup") {
      const station =
        GTS_CHECKOUT_PICKUP_STATIONS.find((s) => s.id === selectedPickupStationId) ||
        GTS_CHECKOUT_PICKUP_STATIONS[0]!;
      chosenAddress = {
        addressLine1: `${station.name} (${station.address})`,
        addressLine2: `Close to: ${station.closeTo}`,
        city: station.city,
        state: station.state,
        isDefault: false,
      };
      chosenFullName = `${firstName} ${lastName}`.trim();
      chosenPhone = phone;
    } else if (selectedAddressId && savedAddresses) {
      const matched = savedAddresses.find((a) => a.id === selectedAddressId);
      if (matched) {
        chosenAddress = {
          addressLine1: matched.address_line1,
          addressLine2: matched.address_line2 || "",
          city: matched.city,
          state: matched.state,
          isDefault: matched.is_default,
        };
        chosenFullName = matched.full_name;
        chosenPhone = matched.phone;
      }
    }

    const payload = {
      customer: {
        email: userEmail,
        fullName: chosenFullName,
        phone: chosenPhone,
      },
      address: chosenAddress,
      // Only what to buy and how many: the server looks up prices and decides discounts.
      items: toCheckoutLines(cartItems),
      deliveryOption: selectedDelivery,
      paymentMethod: selectedPayment,
    };

    setSubmitError(null);
    try {
      const res = await idempotentFetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const payUrl = data?.data?.payment?.authorization_url;
      if (res.ok && data.success && typeof payUrl === "string") {
        // The cart stays until Paystack confirms payment. Being sent back proves nothing.
        try {
          sessionStorage.setItem("gts_last_checkout", JSON.stringify({ email: userEmail, fullName: chosenFullName, phone: chosenPhone }));
        } catch {
          // storage blocked: the confirmation page just skips the account prompt
        }
        window.location.assign(payUrl);
        return; // leave the button busy while the browser goes to Paystack
      }
      setSubmitError(data?.error || "We couldn't place your order. Please try again.");
    } catch {
      setSubmitError("We couldn't reach the server. Please check your connection and try again.");
    }
    setIsSubmitting(false);
  };

  const steps = [
    {
      num: 1,
      label: "Delivery Method",
      sub: "Choose how you'd like to receive your order",
      shortLabel: "Delivery",
    },
    {
      num: 2,
      label: selectedDelivery === "pickup" ? "Pickup Station" : "Delivery Address",
      sub: selectedDelivery === "pickup" ? "Select a pickup hub close to you" : "Where should we send your order?",
      shortLabel: selectedDelivery === "pickup" ? "Station" : "Address",
    },
    {
      num: 3,
      label: "Payment",
      sub: "How would you like to pay?",
      shortLabel: "Payment",
    },
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
        <div className="mb-6 pb-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-athelas text-3xl sm:text-4xl font-bold tracking-tight text-[#010101]">Checkout</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Complete your order with progressive live profile & 1-click checkout
            </p>
          </div>
          {!user && (
            <div className="bg-[#F9F8F5] border border-gray-200 rounded-2xl px-4 py-2 text-xs flex items-center gap-2">
              <span className="text-gray-500">Already registered?</span>
              <button
                type="button"
                onClick={() => openAuthModal("login")}
                className="font-bold text-[#010101] underline hover:text-[#EDCF5D] cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile Horizontal Stepper ── */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center justify-between relative px-0">
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

        {/* ── 2-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-10 items-start">

          {/* ────── LEFT: Stepper Content ────── */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">

            {steps.map((s) => {
              const isActive = currentStep === s.num;
              const isDone = currentStep > s.num;

              return (
                <div key={s.num} className={`${isActive ? "flex" : "hidden lg:flex"} ${s.num === 4 ? "lg:hidden" : ""} gap-5 items-stretch pb-2 lg:pb-6`}>
                  {/* Timeline track (Desktop) */}
                  <div className="hidden lg:flex flex-col items-center pt-1">
                    <StepDot step={s.num} current={currentStep} total={3} />
                  </div>

                  {/* Step container */}
                  <div className={`flex-1 transition-all duration-300 ${
                    isActive
                      ? "lg:border lg:border-[#010101] lg:rounded-2xl lg:p-6 lg:bg-white"
                      : isDone
                      ? "lg:border lg:border-gray-200 lg:rounded-2xl lg:p-6 lg:bg-[#F9F8F5]"
                      : "lg:border lg:border-gray-200 lg:rounded-2xl lg:p-6 lg:bg-[#F9F8F5] opacity-50"
                  }`}>
                    <div
                      className={`flex items-center justify-between px-0 lg:px-6 pt-0 pb-3 lg:py-4 ${
                        isDone ? "cursor-pointer" : ""
                      }`}
                      onClick={() => { if (isDone) setCurrentStep(s.num); }}
                    >
                      <div>
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
                          className="text-xs font-bold text-gray-500 hover:text-[#010101] underline transition-colors cursor-pointer"
                        >
                          Change
                        </button>
                      )}
                    </div>

                    {/* ── STEP 1: DELIVERY METHOD ── */}
                    {s.num === 1 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-4 border-t border-gray-100 pt-5">
                        <div className="space-y-3">
                          {DELIVERY_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setSelectedDelivery(opt.id);
                                if (opt.id === "pickup" && !selectedPickupStationId) {
                                  setIsPickupModalOpen(true);
                                }
                              }}
                              className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all cursor-pointer ${
                                selectedDelivery === opt.id
                                  ? "border-[#010101] bg-[#F9F8F5]"
                                  : "border-gray-200 bg-white hover:border-gray-400"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    selectedDelivery === opt.id ? "border-[#010101]" : "border-gray-300"
                                  }`}>
                                    {selectedDelivery === opt.id && <div className="w-2 h-2 rounded-full bg-[#010101]" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm text-[#010101]">{opt.label}</p>
                                    <p className="text-xs text-gray-500">{opt.description} · {opt.eta}</p>
                                  </div>
                                </div>
                                <span className="font-bold text-sm text-[#010101]">{opt.fee}</span>
                              </div>
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleProceedFromStep1}
                          className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 mt-4 cursor-pointer"
                        >
                          <span>{selectedDelivery === "pickup" ? "Continue to Select Station" : "Continue to Delivery Address"}</span>
                          <span>→</span>
                        </button>
                      </div>
                    )}

                    {/* ── STEP 2: ADDRESS OR PICKUP STATION ── */}
                    {s.num === 2 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
                        {selectedDelivery === "pickup" ? (
                          /* Pickup Station Flow */
                          <div className="space-y-4">
                            {selectedStation ? (
                              <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFF8F2] text-[#C2410C] border border-[#FDBA74] px-2 py-0.5 rounded-full">
                                        Pickup Hub
                                      </span>
                                      <span className="text-xs font-bold text-[#EA580C]">{selectedStation.feeFormatted}</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-[#010101] mt-1">{selectedStation.name}</h4>
                                    <p className="text-xs text-gray-600">{selectedStation.address}</p>
                                    <p className="text-[11px] text-gray-700 flex items-center gap-1.5 font-medium">
                                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                      </svg>
                                      <span><span className="font-semibold text-gray-900">Close to:</span> {selectedStation.closeTo}</span>
                                    </p>
                                    <div className="text-[11px] text-gray-500 pt-0.5 flex flex-wrap items-center gap-3">
                                      <span className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{selectedStation.hours}</span>
                                      </span>
                                      <span className="text-gray-300">•</span>
                                      <span className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                        </svg>
                                        <span>{selectedStation.phone}</span>
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setIsPickupModalOpen(true)}
                                    className="text-xs font-bold text-[#EA580C] hover:text-[#C2410C] underline shrink-0 cursor-pointer"
                                  >
                                    Change Station
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsPickupModalOpen(true)}
                                className="w-full p-5 rounded-xl border-2 border-dashed border-[#EA580C]/60 hover:border-[#EA580C] bg-[#FFF8F2] text-[#C2410C] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                              >
                                <svg className="w-4 h-4 text-[#EA580C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Select a Pick-up station close to you</span>
                                <span>→</span>
                              </button>
                            )}

                            {/* Recipient Details for Pickup */}
                            <div className="pt-2 border-t border-gray-100 space-y-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Pickup Recipient Details</p>
                              <p className="text-[11px] text-gray-500">
                                This person will receive the pickup SMS verification code and must present a matching valid ID at the hub.
                              </p>

                              <div className="grid grid-cols-2 gap-3">
                                <FloatingInput id="pickup-fname" label="First Name" value={firstName} onChange={setFirstName} required />
                                <FloatingInput id="pickup-lname" label="Last Name" value={lastName} onChange={setLastName} required />
                              </div>

                              <div className="flex gap-2">
                                <div className="flex items-center px-3 pt-3 pb-2 bg-[#F9F8F5] border border-gray-200 rounded-xl text-sm font-bold text-gray-600 shrink-0">
                                  +234
                                </div>
                                <div className="flex-1">
                                  <FloatingInput id="pickup-phone" label="Mobile Phone (for pickup code)" type="tel" value={phone} onChange={setPhone} required />
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!canProceedStep2}
                              onClick={handleProceedFromStep2}
                              className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed mt-2 cursor-pointer"
                            >
                              <span>Continue to Payment</span>
                              <span>→</span>
                            </button>
                          </div>
                        ) : (
                          /* Door Delivery Address flow */
                          <div className="space-y-5">
                            {/* Saved addresses from DB */}
                            {savedAddresses && savedAddresses.length > 0 && !showNewAddressForm && (
                              <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Saved Addresses</p>
                                {savedAddresses.map((addr) => (
                                  <button
                                    key={addr.id}
                                    type="button"
                                    onClick={() => setSelectedAddressId(addr.id)}
                                    className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all cursor-pointer ${
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
                                          <p className="font-bold text-sm text-[#010101]">{addr.full_name}</p>
                                          <p className="text-xs text-gray-500 mt-0.5">{addr.phone}</p>
                                          <p className="text-xs text-gray-600 mt-1">{addr.address_line1}, {addr.city}, {addr.state}</p>
                                        </div>
                                      </div>
                                      {addr.is_default && (
                                        <span className="text-[10px] font-extrabold bg-[#EDCF5D] text-[#010101] px-2 py-0.5 rounded-full uppercase">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ))}

                                {/* Divider & Add New Address Pill Button */}
                                <div className="pt-2 border-t border-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedAddressId(null); setShowNewAddressForm(true); }}
                                    className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-3.5 px-6 rounded-full transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    <span>Add New Address</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* New Address Form */}
                            {showNewAddressForm && (
                              <div className="space-y-4">
                                {savedAddresses && savedAddresses.length > 0 && (
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => { setShowNewAddressForm(false); setSelectedAddressId(savedAddresses[0]!.id); }}
                                      className="text-xs font-bold text-gray-500 hover:text-[#010101] underline transition-colors cursor-pointer"
                                    >
                                      ← Use saved address
                                    </button>
                                  </div>
                                )}

                                {/* Region + City */}
                                <div className="grid grid-cols-2 gap-3">
                                  <FloatingSelect id="region" label="State / Region" value={region} onChange={(v) => { setRegion(v); setCity(""); }} options={NIGERIAN_STATES} />
                                  <FloatingSelect id="city" label="City" value={city} onChange={setCity} options={cities.length > 0 ? cities : ["Select State First", "Central", "Main Town"]} />
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
                                <FloatingInput id="delivaddr" label="Delivery Address / Street" value={deliveryAddress} onChange={setDeliveryAddress} required />

                                {/* Landmark */}
                                <FloatingInput id="landmark" label="Landmark (optional)" value={landmark} onChange={setLandmark} />
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!canProceedStep2}
                              onClick={handleProceedFromStep2}
                              className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed mt-2 cursor-pointer"
                            >
                              <span>Continue to Payment</span>
                              <span>→</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── STEP 3: PAYMENT METHOD ── */}
                    {s.num === 3 && isActive && (
                      <div className="px-0 lg:px-6 pb-6 space-y-4 border-t border-gray-100 pt-5">
                        <div className="space-y-3">
                          {PAYMENT_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSelectedPayment(opt.id)}
                              className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all cursor-pointer ${
                                selectedPayment === opt.id
                                  ? "border-[#010101] bg-[#F9F8F5]"
                                  : "border-gray-200 bg-white hover:border-gray-400"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    selectedPayment === opt.id ? "border-[#010101]" : "border-gray-300"
                                  }`}>
                                    {selectedPayment === opt.id && <div className="w-2 h-2 rounded-full bg-[#010101]" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm text-[#010101]">{opt.label}</p>
                                    <p className="text-xs text-gray-500">{opt.description}</p>
                                  </div>
                                </div>
                                {opt.iconBadge}
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="pt-2">
                          <p className="text-xs text-gray-400 leading-relaxed mb-4">
                            Your items are held while you pay. You will be taken to Paystack to complete payment securely.
                          </p>

                          <button
                            type="button"
                            disabled={isSubmitting || !canPlaceOrder}
                            onClick={handleConfirmOrder}
                            className="w-full bg-[#EDCF5D] hover:bg-[#010101] text-[#010101] hover:text-white font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {isSubmitting ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Placing live order...</span>
                              </div>
                            ) : (
                              <span>Place Order · ₦{grandTotal.toLocaleString()}</span>
                            )}
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
            <div className="bg-[#F9F8F5] rounded-2xl p-6 border border-gray-200/80">
              <h2 className="font-athelas text-xl font-bold text-[#010101] pb-4 border-b border-gray-200 flex items-center justify-between">
                Order Summary
                <span className="text-sm font-semibold text-gray-400 font-sans">
                  {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
                </span>
              </h2>

              {/* Cart items list */}
              <div className="divide-y divide-gray-100 my-4 space-y-0 max-h-[260px] overflow-y-auto pr-1">
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
                  <button onClick={() => setAppliedPromo(null)} className="text-[11px] font-bold text-gray-400 hover:text-red-500 underline transition-colors cursor-pointer">
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
                      placeholder="Promo code (e.g. WELCOME10)"
                      className="flex-1 py-2.5 text-xs font-semibold text-[#010101] placeholder-gray-400 outline-none bg-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    className="text-xs font-bold text-[#010101] hover:text-[#EDCF5D] px-3 transition-colors cursor-pointer"
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

              {(submitError || quoteError || (quote && !quote.all_available)) && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
                  {submitError ||
                    quoteError ||
                    "Some items in your cart are no longer in stock in the quantity you chose. Please update your cart."}
                </p>
              )}

              {/* Confirm order button */}
              <button
                type="button"
                disabled={isSubmitting || !canPlaceOrder}
                onClick={handleConfirmOrder}
                className={`w-full font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 transition-all duration-300 mt-4 ${
                  !canPlaceOrder
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-70"
                    : "bg-[#EDCF5D] hover:bg-[#010101] text-[#010101] hover:text-white shadow-md active:scale-95 cursor-pointer"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Processing order...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Confirm & Place Order</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
                By proceeding, you are automatically accepting the{" "}
                <Link href="/terms" className="text-[#010101] font-bold underline underline-offset-2 hover:text-[#EDCF5D]">Terms & Conditions</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pickup Station Selector Modal ── */}
      <PickupStationModal
        isOpen={isPickupModalOpen}
        onClose={() => setIsPickupModalOpen(false)}
        selectedStationId={selectedPickupStationId}
        onSelectStation={(stationId) => {
          setSelectedPickupStationId(stationId);
        }}
      />

      <Footer />
    </div>
  );
}
