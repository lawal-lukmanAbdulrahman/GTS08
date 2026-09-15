"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductCard } from "../_components/ui/product-card";
import { REAL_PRODUCTS } from "../_data/products";
import { Footer } from "../_components/landing/footer";
import { useCart } from "../_components/cart-context";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, clearCart, totalItemCount } = useCart();

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoError, setPromoError] = useState("");

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    const cleanCode = promoCode.trim().toUpperCase();
    if (!cleanCode) return;

    if (cleanCode === "GTS10" || cleanCode === "WELCOME10") {
      setAppliedPromo({ code: cleanCode, discountPercent: 10 });
      setPromoCode("");
    } else if (cleanCode === "GTS20" || cleanCode === "SUMMER20") {
      setAppliedPromo({ code: cleanCode, discountPercent: 20 });
      setPromoCode("");
    } else {
      setPromoError("Invalid code. Try GTS10 for 10% off.");
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
  };

  // ── Calculation Math ──
  const rawSubtotal = cartItems.reduce(
    (sum, item) => sum + item.product.priceNum * item.quantity,
    0
  );

  const discountAmount = appliedPromo
    ? Math.round((rawSubtotal * appliedPromo.discountPercent) / 100)
    : 0;

  const FREE_SHIPPING_THRESHOLD = 500000;
  const isFreeShipping = rawSubtotal >= FREE_SHIPPING_THRESHOLD || cartItems.length === 0;
  const shippingFee = isFreeShipping ? 0 : 15000;
  const progressPercent = Math.min(100, Math.round((rawSubtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - rawSubtotal);

  const grandTotal = Math.max(0, rawSubtotal - discountAmount + shippingFee);

  // Recommended Products for the bottom carousel
  const recommendedProducts = REAL_PRODUCTS.slice(3, 8);

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
              onClick={() => clearCart()}
              className="self-start sm:self-auto text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Clear Cart
            </button>
          )}
        </div>

        {/* ── Free Shipping Progress Bar ── */}
        {cartItems.length > 0 && (
          <div className="bg-[#F9F8F5] rounded-2xl p-4 mb-8 border border-gray-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-2">
              <span className="flex items-center gap-2 text-[#010101]">
                <svg className="w-4 h-4 text-[#EDCF5D]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 7h-3V6a3 3 0 00-3-3H5a3 3 0 00-3 3v9a3 3 0 003 3h.78a3 3 0 005.44 0h3.56a3 3 0 005.44 0H21a1 1 0 001-1v-5a3 3 0 00-3-3zM7.5 18a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm11 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                </svg>
                {isFreeShipping ? (
                  <span className="text-emerald-700 font-bold">You qualify for FREE Express Shipping!</span>
                ) : (
                  <span>
                    Add <strong className="text-[#010101]">₦{remainingForFreeShipping.toLocaleString()}</strong> more to get <strong>Free Express Shipping</strong>
                  </span>
                )}
              </span>
              <span className="text-xs font-bold text-[#010101]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#F2F0EA] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#010101] h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {cartItems.length > 0 ? (
          /* ── Main Two-Column Layout ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* ────── LEFT COLUMN: Cart Items List & Promo Code ────── */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
              {cartItems.map((item, index) => {
                const itemSubtotal = item.product.priceNum * item.quantity;
                return (
                  <div
                    key={`${item.product.id}-${index}`}
                    className="relative bg-[#F9F8F5] rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-2xs flex flex-col gap-3 transition-all hover:border-gray-300"
                  >
                    {/* Absolutely Positioned Red Trash Delete Icon (Top Right) */}
                    <button
                      onClick={() => removeFromCart(index)}
                      aria-label="Remove item"
                      className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors z-10"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>

                    {/* Top Row (Before Divider): Image + Brand/Title/Variants */}
                    <div className="flex items-stretch gap-3 sm:gap-4 w-full">
                      {/* Product Image (stretches vertically if details grow) */}
                      <Link
                        href={`/product/${item.product.id}`}
                        className="relative w-20 sm:w-24 min-h-[5rem] sm:min-h-[5.5rem] self-stretch rounded-xl overflow-hidden shrink-0 border border-gray-200/70 flex items-center justify-center p-2 group"
                        style={{ background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }}
                      >
                        <Image
                          src={item.product.image}
                          alt={item.product.title}
                          fill
                          className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                          sizes="96px"
                        />
                      </Link>

                      {/* Brand, Title, Variants */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 pr-7 sm:pr-8">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#A4A4A4]">
                            {item.product.brand}
                          </span>
                          <Link
                            href={`/product/${item.product.id}`}
                            className="font-bold text-sm sm:text-base text-[#010101] hover:underline line-clamp-2 leading-snug block"
                          >
                            {item.product.title}
                          </Link>
                        </div>

                        {/* Variant Badges (Compact) */}
                        <div className="flex flex-wrap items-center gap-1 text-gray-600 font-medium mt-0.5">
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
                      </div>
                    </div>

                    {/* Bottom Row (After Divider): Price + Stepper */}
                    <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between gap-3 w-full">
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base sm:text-lg font-extrabold text-[#010101]">
                            ₦{itemSubtotal.toLocaleString()}
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

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-2.5 bg-[#F9F8F5] border border-gray-200 rounded-full px-3 py-1.5 shrink-0">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(index, -1)}
                          className="text-[#010101] hover:text-[#EDCF5D] flex items-center justify-center transition-all active:scale-90 p-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                          </svg>
                        </button>

                        <span className="text-xs sm:text-sm font-black text-[#010101] min-w-[16px] text-center tabular-nums font-sans">
                          {item.quantity}
                        </span>

                        <button
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(index, 1)}
                          className="text-[#010101] hover:text-[#EDCF5D] flex items-center justify-center transition-all active:scale-90 p-0.5"
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

              {/* ── Promo Code Card ── */}
              <div className="bg-[#F9F8F5] rounded-2xl p-5 border border-gray-200/80 shadow-2xs mt-2">
                <h3 className="text-sm font-bold text-[#010101] mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                  </svg>
                  Have a Promo Code or Gift Card?
                </h3>

                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-[#F2F0EA] rounded-xl px-4 py-2.5">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {appliedPromo.discountPercent}% OFF
                      </span>
                      Code <strong>{appliedPromo.code}</strong> applied
                    </span>
                    <button
                      onClick={removePromo}
                      className="text-xs font-bold text-gray-500 hover:text-red-600 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromo} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter promo code (e.g. GTS10)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 bg-[#F9F8F5] border border-gray-200 focus:border-[#010101] rounded-xl px-4 py-2 text-xs font-semibold text-[#010101] placeholder-gray-400 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      className="bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] text-xs font-bold px-5 py-2 rounded-xl transition-all shadow-2xs"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {promoError && <p className="text-xs font-semibold text-red-500 mt-2">{promoError}</p>}
              </div>
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

                  {/* Promo Discount */}
                  {appliedPromo && (
                    <div className="flex items-center justify-between text-emerald-700 font-medium">
                      <span>Promo Discount ({appliedPromo.discountPercent}%)</span>
                      <span className="font-bold">-₦{discountAmount.toLocaleString()}</span>
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

                {/* Grand Total */}
                <div className="pt-4 border-t border-gray-200 flex items-baseline justify-between">
                  <div>
                    <span className="text-base font-extrabold text-[#010101] block">Total</span>
                    <span className="text-[10px] text-gray-400 font-medium">Includes all applicable taxes</span>
                  </div>
                  <span className="font-athelas text-2xl sm:text-3xl font-extrabold text-[#010101] tracking-tight">
                    ₦{grandTotal.toLocaleString()}
                  </span>
                </div>

                {/* Proceed to Checkout Button */}
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

                {/* Secure Checkout Trust Badges */}
                <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-4 text-gray-400 text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      256-bit SSL
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      30-Day Money Back
                    </span>
                  </div>

                  {/* Payment Icons Pill */}
                  <div className="flex items-center justify-center gap-2 pt-1 opacity-70">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">VISA</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Mastercard</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Verve</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Apple Pay</span>
                  </div>
                </div>
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

      <Footer />
    </div>
  );
}
