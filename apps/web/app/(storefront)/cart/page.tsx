"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useMemo, useRef, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { ProductCard } from "../_components/ui/product-card";
import { useCheckoutQuote } from "../_lib/use-checkout-quote";
import { useCatalogue } from "../_components/catalogue-context";
import { Footer } from "../_components/landing/footer";
import { useCart, type CartItem } from "../_components/cart-context";
import { AuthContext } from "../_components/auth-context";
import PromoCodesPresentModal from "./promo-codes-present-modal";

interface AvailablePromo {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  expires_at: string | null;
  product_scope: "all" | "specific_products";
  product_ids?: string[];
  products?: Array<{ id: string; name: string; image_url: string; base_price: number }>;
}

export default function CartPage() {
  const { cartItems, updateQuantity, setQuantity, syncCartLimits, removeFromCart, clearCart, totalItemCount } = useCart();
  const auth = useContext(AuthContext);
  const customer = auth?.customer ?? null;
  const user = auth?.user ?? null;
  const router = useRouter();

  // ── Promo Codes State ──
  const [availablePromos, setAvailablePromos] = useState<AvailablePromo[]>([]);
  const [appliedPromos, setAppliedPromos] = useState<AvailablePromo[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showPresentModal, setShowPresentModal] = useState(false);
  const [dismissedModal, setDismissedModal] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Fetch available promo codes for this visitor or signed-in customer
  useEffect(() => {
    const custId = customer?.id || "";
    const userId = user?.id || "";
    const query = new URLSearchParams();
    if (custId) query.set("customerId", custId);
    if (userId) query.set("userId", userId);
    const custQuery = query.toString() ? `?${query.toString()}` : "";
    try {
      const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
      const url = origin ? `${origin}/api/v1/promos/available${custQuery}` : `/api/v1/promos/available${custQuery}`;
      const token = typeof window !== "undefined" ? localStorage.getItem("gts_customer_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const p = fetch(url, { headers, credentials: "include" });
      if (p && typeof p.then === "function") {
        p.then((res) => (res && typeof res.json === "function" ? res.json() : null))
          .then((json) => {
            if (json && Array.isArray(json.data)) {
              setAvailablePromos(json.data);
            }
          })
          .catch((err) => console.error("Failed to fetch available promos:", err));
      }
    } catch {
      // test environment or network failure
    }
  }, [customer?.id, user?.id]);

  // Click outside listener for autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync applied promos to localStorage for checkout
  useEffect(() => {
    try {
      if (appliedPromos.length > 0) {
        localStorage.setItem("gts_checkout_promos", JSON.stringify(appliedPromos.map((p) => p.code)));
      } else {
        localStorage.removeItem("gts_checkout_promos");
      }
    } catch {}
  }, [appliedPromos]);

  // Once nothing is left there's nothing to do here: straight back to the products.
  const removeItem = (index: number) => {
    const wasLast = cartItems.length === 1;
    removeFromCart(index);
    if (wasLast) router.push("/search");
  };
  const emptyCart = () => {
    clearCart();
    router.push("/search");
  };

  const { quote } = useCheckoutQuote(cartItems);

  // Sync server stock limits to cart items
  const quoteLinesKey = quote?.lines
    ? quote.lines
        .map(
          (l) =>
            `${l.product_slug}:${(l.size ?? "").toLowerCase()}:${(l.color ?? "").toLowerCase()}:${l.available}`
        )
        .join("|")
      : "";

  useEffect(() => {
    if (quote?.lines && quote.lines.length > 0) {
      syncCartLimits(quote.lines);
    }
  }, [quoteLinesKey, syncCartLimits]);

  // Check if any cart item exceeds live inventory or is out of stock
  const hasStockIssue = cartItems.some((item) => {
    const quoteLine = quote?.lines?.find(
      (l) =>
        l.product_slug === item.product.id &&
        (l.size ?? "").toLowerCase() === (item.size ?? "").toLowerCase() &&
        (l.color ?? "").toLowerCase() === (item.color ?? "").toLowerCase()
    );
    const available = quoteLine ? quoteLine.available : (item.maxAvailable ?? item.product.availableStock ?? 999);
    return item.quantity > available || available <= 0;
  });

  const canProceedToCheckout = cartItems.length > 0 && !hasStockIssue && (quote ? quote.all_available : true);

  // ── Item Level Discount Resolver ──
  const getItemDiscount = useCallback(
    (item: CartItem): number => {
      const matching = appliedPromos.filter(
        (p) => p.product_scope === "all" || p.product_ids?.includes(item.product.id)
      );
      if (matching.length === 0) return 0;
      const totalPct = matching.reduce(
        (acc, p) => (p.discount_type === "percentage" ? acc + p.discount_value : acc),
        0
      );
      return Math.min(90, totalPct);
    },
    [appliedPromos]
  );

  // ── Calculation Math ──
  const rawSubtotal = quote
    ? quote.subtotal / 100
    : cartItems.reduce((sum, item) => sum + item.product.priceNum * item.quantity, 0);

  const totalPromoDiscount = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const pct = getItemDiscount(item);
      if (pct > 0) {
        const itemTotal = item.product.priceNum * item.quantity;
        return acc + Math.round((itemTotal * pct) / 100);
      }
      return acc;
    }, 0);
  }, [cartItems, getItemDiscount]);

  const discountedSubtotal = Math.max(0, rawSubtotal - totalPromoDiscount);

  const FREE_SHIPPING_THRESHOLD = 500000;
  const isFreeShipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD || cartItems.length === 0;
  const shippingFee = isFreeShipping ? 0 : 15000;

  const grandTotal = Math.max(0, discountedSubtotal + shippingFee);

  // ── Find Eligible Items for "Promo Codes Present" Modal ──
  const eligibleItemsForModal = useMemo(() => {
    if (cartItems.length === 0 || availablePromos.length === 0) return [];
    const list: Array<{
      item: CartItem;
      discountPercent: number;
      originalPrice: number;
      discountedPrice: number;
    }> = [];

    cartItems.forEach((it) => {
      const matchingPromo = availablePromos.find(
        (p) => p.product_scope === "all" || p.product_ids?.includes(it.product.id)
      );
      if (matchingPromo && matchingPromo.discount_type === "percentage") {
        const pct = matchingPromo.discount_value;
        const orig = it.product.priceNum * it.quantity;
        const disc = Math.round(orig * (1 - pct / 100));
        list.push({
          item: it,
          discountPercent: pct,
          originalPrice: orig,
          discountedPrice: disc,
        });
      }
    });

    return list;
  }, [cartItems, availablePromos]);

  // Cumulative modal prices
  const modalCumulativeSavings = useMemo(() => {
    return eligibleItemsForModal.reduce((acc, el) => acc + (el.originalPrice - el.discountedPrice), 0);
  }, [eligibleItemsForModal]);

  // Auto Prompt Promo Codes Present Modal
  useEffect(() => {
    if (
      eligibleItemsForModal.length > 0 &&
      appliedPromos.length === 0 &&
      !dismissedModal
    ) {
      const hasShown = sessionStorage.getItem("gts_promo_present_shown");
      if (!hasShown) {
        setShowPresentModal(true);
      }
    }
  }, [eligibleItemsForModal, appliedPromos.length, dismissedModal]);

  const handleUseModalPromos = () => {
    const matchingCodes = new Set<string>();
    cartItems.forEach((it) => {
      availablePromos.forEach((p) => {
        if (p.product_scope === "all" || p.product_ids?.includes(it.product.id)) {
          matchingCodes.add(p.code);
        }
      });
    });
    const toApply = availablePromos.filter((p) => matchingCodes.has(p.code));
    setAppliedPromos(toApply);
    sessionStorage.setItem("gts_promo_present_shown", "true");
    setDismissedModal(true);
  };

  const handleApplyManualPromo = () => {
    setPromoError(null);
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned) return;

    if (appliedPromos.some((p) => p.code === cleaned)) {
      setPromoError("This promo code is already applied.");
      return;
    }

    // Check against available promos first
    const found = availablePromos.find((p) => p.code === cleaned);
    if (found) {
      setAppliedPromos((prev) => [...prev, found]);
      setPromoInput("");
      setShowAutocomplete(false);
      return;
    }

    // Otherwise validate with API
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("gts_customer_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const p = fetch("/api/v1/promos/validate", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          code: cleaned,
          cart_total: Math.round(rawSubtotal * 100),
          customer_id: customer?.id,
          user_id: user?.id,
          cart_items: cartItems.map((it) => ({
            product_id: it.product.id,
            price: it.product.priceNum * 100,
            quantity: it.quantity,
          })),
        }),
      });
      if (p && typeof p.then === "function") {
        p.then((res) => (res && typeof res.json === "function" ? res.json() : null))
          .then((json) => {
            if (!json) return;
            if (json.data) {
              const newPromo: AvailablePromo = {
                id: json.data.code,
                code: json.data.code,
                discount_type: "percentage",
                discount_value: json.data.discount ? Math.round((json.data.discount / (rawSubtotal * 100)) * 100) : 10,
                min_order_amount: null,
                expires_at: null,
                product_scope: json.data.product_scope || "all",
                product_ids: json.data.product_ids || [],
              };
              setAppliedPromos((prev) => [...prev, newPromo]);
              setPromoInput("");
              setShowAutocomplete(false);
            } else {
              setPromoError(json.error || "That promo code isn't valid.");
            }
          })
          .catch(() => setPromoError("Could not validate promo code."));
      }
    } catch {
      setPromoError("Could not validate promo code.");
    }
  };

  // Recommended Products for the bottom carousel
  const { products: catalogue } = useCatalogue();
  const recommendedProducts = catalogue.slice(3, 8);

  return (
    <div className="min-h-screen bg-white text-[#010101] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-6 font-sans">
          <Link href="/" className="hover:text-[#010101] transition-colors">
            Home
          </Link>
          <span>›</span>
          <span className="text-[#010101] font-bold">Shopping Cart</span>
        </nav>

        {/* ── Page Title & Item Count ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-5 border-b border-gray-200">
          <div>
            <h1 className="font-athelas text-3xl sm:text-4xl font-bold tracking-tight text-[#010101]">
              Shopping Cart
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              You have <strong className="text-[#010101]">{totalItemCount}</strong> {totalItemCount === 1 ? "item" : "items"} in your cart
            </p>
          </div>

          {cartItems.length > 0 && (
            <button
              onClick={emptyCart}
              className="text-xs font-bold text-gray-500 hover:text-red-600 transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {cartItems.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ────── LEFT COLUMN: Cart Items List ────── */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
              {cartItems.map((item, index) => {
                const quoteLine = quote?.lines?.find(
                  (l) =>
                    l.product_slug === item.product.id &&
                    (l.size ?? "").toLowerCase() === (item.size ?? "").toLowerCase() &&
                    (l.color ?? "").toLowerCase() === (item.color ?? "").toLowerCase()
                );
                const maxStock = quoteLine ? quoteLine.available : (item.maxAvailable ?? item.product.availableStock ?? 999);
                const isOutOfStock = maxStock <= 0;
                const isStockExceeded = item.quantity > maxStock;
                const isAtMaxStock = item.quantity >= maxStock;

                const rawItemSubtotal = item.product.priceNum * item.quantity;
                const itemDiscountPct = getItemDiscount(item);
                const discountedUnitPrice = Math.round(item.product.priceNum * (1 - itemDiscountPct / 100));
                const discountedItemSubtotal = discountedUnitPrice * item.quantity;

                return (
                  <div
                    key={`${item.product.id}-${item.size}-${item.color}-${index}`}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border flex flex-col gap-3 shadow-2xs transition-all ${
                      isOutOfStock
                        ? "border-red-300 bg-red-50/20"
                        : isStockExceeded
                        ? "border-amber-300 bg-amber-50/20"
                        : "border-gray-200"
                    }`}
                  >
                    {/* Top Row: Thumbnail + Product Info + Remove Button */}
                    <div className="flex items-start gap-4 w-full">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100 flex items-center justify-center relative">
                        {item.product.image ? (
                          <Image
                            src={item.product.image}
                            alt={item.product.title}
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-gray-400 font-mono">GTS</span>
                        )}
                        {itemDiscountPct > 0 && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#EDCF5D] text-black text-[10px] font-black shadow-xs">
                            -{itemDiscountPct}%
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/product/${item.product.id}`}
                            className="font-bold text-sm sm:text-base text-[#010101] hover:text-[#EDCF5D] transition-colors line-clamp-2"
                          >
                            {item.product.title}
                          </Link>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                            aria-label="Remove item"
                            title="Remove item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Variants Chips */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {item.color && (
                            <span className="px-2 py-0.5 rounded-full bg-[#F2F0EA] text-[#010101] text-[10px] font-semibold leading-tight">
                              Color: {item.color}
                            </span>
                          )}
                          {item.size && (
                            <span className="px-2 py-0.5 rounded-full bg-[#F2F0EA] text-[#010101] text-[10px] font-semibold leading-tight">
                              Size: {item.size}
                            </span>
                          )}
                        </div>

                        {/* Real-time Inventory Warnings */}
                        {isOutOfStock ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            <span>Out of stock · Please remove to proceed</span>
                          </div>
                        ) : isStockExceeded ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-amber-700 mt-1">
                            <span>Only <strong>{maxStock}</strong> available in stock.</span>
                            <button
                              type="button"
                              onClick={() => setQuantity(index, maxStock)}
                              className="text-xs font-bold text-[#010101] underline hover:text-[#EDCF5D] cursor-pointer"
                            >
                              Set to {maxStock}
                            </button>
                          </div>
                        ) : maxStock <= 5 ? (
                          <span className="text-[11px] font-semibold text-amber-600 mt-0.5">
                            Only {maxStock} left in stock
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Bottom Row: Price Slashed + Quantity Stepper */}
                    <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between gap-3 w-full">
                      {itemDiscountPct > 0 ? (
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base sm:text-lg font-black text-emerald-600">
                              ₦{discountedItemSubtotal.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-400 line-through font-normal">
                              ₦{rawItemSubtotal.toLocaleString()}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 text-[10px] font-black uppercase">
                              -{itemDiscountPct}%
                            </span>
                          </div>
                          {item.quantity > 1 && (
                            <span className="text-[11px] text-gray-400 font-medium">
                              ₦{discountedUnitPrice.toLocaleString()} each (was ₦{item.product.priceNum.toLocaleString()})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base sm:text-lg font-extrabold text-[#010101]">
                              ₦{rawItemSubtotal.toLocaleString()}
                            </span>
                            {item.product.originalPrice && (
                              <span className="text-xs text-gray-400 line-through font-normal">
                                {item.product.originalPrice}
                              </span>
                            )}
                          </div>
                          {item.quantity > 1 && (
                            <span className="text-[11px] text-gray-400 font-medium">
                              ₦{item.product.priceNum.toLocaleString()} each
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-2.5 bg-[#F9F8F5] border border-gray-200 rounded-full px-3 py-1.5 shrink-0">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(index, -1)}
                          disabled={item.quantity <= 1}
                          className="text-[#010101] hover:text-[#EDCF5D] flex items-center justify-center transition-all p-0.5 disabled:opacity-30 disabled:cursor-not-allowed hover:disabled:text-[#010101]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                          </svg>
                        </button>

                        <span className={`text-xs sm:text-sm font-black min-w-[16px] text-center tabular-nums font-sans ${isStockExceeded ? "text-amber-700" : isOutOfStock ? "text-red-600" : "text-[#010101]"}`}>
                          {item.quantity}
                        </span>

                        <button
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(index, 1)}
                          disabled={isAtMaxStock || isOutOfStock}
                          className="text-[#010101] hover:text-[#EDCF5D] flex items-center justify-center transition-all p-0.5 disabled:opacity-30 disabled:cursor-not-allowed hover:disabled:text-[#010101]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ────── RIGHT COLUMN: Sticky Order Summary ────── */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-28">
              <div className="bg-[#F9F8F5] rounded-2xl p-6 border border-gray-200/80 shadow-2xs flex flex-col gap-4">
                <h2 className="font-athelas text-xl font-bold text-[#010101] pb-3 border-b border-gray-100">
                  Order Summary
                </h2>

                <div className="flex flex-col gap-2.5 text-xs sm:text-sm">
                  {/* Items Subtotal */}
                  <div className="flex items-center justify-between text-gray-600 font-medium">
                    <span>Subtotal ({totalItemCount} items)</span>
                    <span className="font-bold text-[#010101]">₦{rawSubtotal.toLocaleString()}</span>
                  </div>

                  {/* Promo Code Savings */}
                  {totalPromoDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 font-bold">
                      <span>Promo Discount Savings</span>
                      <span className="font-mono">-₦{totalPromoDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Estimated Shipping */}
                  <div className="flex items-center justify-between text-gray-600 font-medium">
                    <span>Estimated Express Shipping</span>
                    {isFreeShipping ? (
                      <span className="font-bold text-emerald-700 uppercase tracking-wide text-xs">Free</span>
                    ) : (
                      <span className="font-bold text-[#010101]">₦{shippingFee.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* ── Promo Code Input with Autocomplete ── */}
                <div className="pt-3 border-t border-gray-200 flex flex-col gap-2" ref={autocompleteRef}>
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Have a promo code?</span>
                    {availablePromos.length > 0 && (
                      <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                        {availablePromos.length} available
                      </span>
                    )}
                  </label>

                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter or pick promo code..."
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value.toUpperCase());
                          setShowAutocomplete(true);
                          setPromoError(null);
                        }}
                        onFocus={() => setShowAutocomplete(true)}
                        className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider rounded-xl border border-gray-300 bg-white text-[#010101] placeholder-gray-400 focus:outline-none focus:border-[#010101]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyManualPromo}
                        className="px-4 py-2.5 rounded-xl bg-[#010101] text-white text-xs font-bold hover:bg-[#EDCF5D] hover:text-[#010101] transition-all cursor-pointer shadow-xs"
                      >
                        Apply
                      </button>
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && availablePromos.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-200 z-30 max-h-56 overflow-y-auto divide-y divide-gray-100 p-1.5">
                        <div className="p-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Promo codes available to you:
                        </div>
                        {availablePromos.map((p) => {
                          const isAlreadyApplied = appliedPromos.some((ap) => ap.code === p.code);
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (!isAlreadyApplied) {
                                  setAppliedPromos((prev) => [...prev, p]);
                                }
                                setShowAutocomplete(false);
                                setPromoInput("");
                              }}
                              className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                                isAlreadyApplied ? "bg-gray-50 opacity-50" : "hover:bg-amber-50"
                              }`}
                            >
                              <div>
                                <div className="font-mono font-black text-xs text-[#010101] flex items-center gap-2">
                                  <span>{p.code}</span>
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                                    {p.discount_type === "percentage" ? `${p.discount_value}% OFF` : `₦${p.discount_value / 100} OFF`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {p.product_scope === "all" ? "Applies storewide" : `${p.product_ids?.length || 0} product(s) scoped`}
                                  {p.expires_at ? ` • Ends ${new Date(p.expires_at).toLocaleDateString()}` : ""}
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 font-bold">
                                {isAlreadyApplied ? "Applied ✓" : "+ Add"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {promoError && (
                    <p className="text-[11px] text-red-500 font-semibold">{promoError}</p>
                  )}

                  {/* Applied Promo Code Chips */}
                  {appliedPromos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {appliedPromos.map((p) => (
                        <span
                          key={p.code}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-bold"
                        >
                          <span>🏷️ {p.code} (-{p.discount_value}%)</span>
                          <button
                            type="button"
                            onClick={() => setAppliedPromos((prev) => prev.filter((item) => item.code !== p.code))}
                            className="text-emerald-700 hover:text-red-600 ml-0.5 cursor-pointer font-black"
                            title="Remove promo code"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="pt-4 border-t border-gray-200 flex items-baseline justify-between">
                  <div>
                    <span className="text-base font-extrabold text-[#010101] block">Total</span>
                    <span className="text-[10px] text-gray-400 font-medium">Includes all applicable taxes</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {totalPromoDiscount > 0 && (
                      <span className="text-sm font-semibold text-gray-400 line-through">
                        ₦{Math.max(0, rawSubtotal + shippingFee).toLocaleString()}
                      </span>
                    )}
                    <span className="font-athelas text-2xl sm:text-3xl font-extrabold text-[#010101] tracking-tight">
                      ₦{grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Stock Issue Alert */}
                {(!canProceedToCheckout || (quote && !quote.all_available)) && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-700 flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Some items in your cart exceed available stock. Please adjust quantities or remove out-of-stock items before checkout.</span>
                  </div>
                )}

                {/* Proceed to Checkout Button */}
                {canProceedToCheckout ? (
                  <Link
                    href="/checkout"
                    className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 shadow-md transition-all duration-300 active:scale-95 group font-sans mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25V12.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Proceed to Checkout</span>
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full bg-gray-200 text-gray-400 font-bold text-sm py-4 rounded-full flex items-center justify-center gap-2 cursor-not-allowed mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25V12.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Adjust Stock Limits to Checkout</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Empty Cart State ── */
          <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 px-4 my-8 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#F2F0EA] flex items-center justify-center mb-5 text-[#010101]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="font-athelas text-2xl font-bold text-[#010101] mb-2">Your cart is currently empty</h2>
            <p className="text-xs sm:text-sm text-gray-500 max-w-xs mb-6">
              Looks like you haven&apos;t added any items to your shopping cart yet. Explore our top collections and finds!
            </p>
            <Link
              href="/search"
              className="bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] text-xs sm:text-sm font-bold px-8 py-3.5 rounded-full transition-all shadow-md"
            >
              Start Shopping
            </Link>
          </div>
        )}

        {/* ────── Recommended Products / Carousel ────── */}
        <div className="mt-20 pt-10 border-t border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-athelas text-2xl sm:text-3xl font-bold text-[#010101]">
                You Might Also Like
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Handpicked additions for your style
              </p>
            </div>
            <Link
              href="/search"
              className="text-xs sm:text-sm text-gray-700 font-semibold hover:text-black flex items-center gap-1 underline underline-offset-4 decoration-gray-300"
            >
              Explore all →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {recommendedProducts.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                title={p.title}
                price={p.price}
                originalPrice={p.originalPrice}
                badge={p.badge}
                rating={p.rating}
                reviews={p.reviews}
                image={p.image}
                hasTransparentBg={p.hasTransparentBg}
                className="w-full"
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Auto Prompt "Promo Codes Present" Modal ── */}
      <PromoCodesPresentModal
        isOpen={showPresentModal}
        onClose={() => {
          setShowPresentModal(false);
          sessionStorage.setItem("gts_promo_present_shown", "true");
          setDismissedModal(true);
        }}
        onUse={handleUseModalPromos}
        eligibleItems={eligibleItemsForModal}
        oldCumulativePrice={rawSubtotal + shippingFee}
        newCumulativePrice={Math.max(0, rawSubtotal - modalCumulativeSavings + shippingFee)}
        appliedPromoCount={eligibleItemsForModal.length}
      />

      <Footer />
    </div>
  );
}
