"use client";

import { useEffect, useState, useCallback } from "react";
import SearchPanel from "./search-panel";
import CartPanel from "./cart-panel";
import VariantModal from "./variant-modal";
import PaymentConfirmModal from "./payment-confirm-modal";
import ReceiptScreen from "./receipt-screen";
import TodaysOrdersPanel from "./todays-orders-panel";
import WhatsAppPanel, { type PendingWhatsAppOrder } from "./whatsapp-panel";
import FlagProductModal from "./flag-product-modal";
import { usePosCatalogue } from "./use-pos-catalogue";
import { resolveManualDiscount } from "./manual-discount-input";
import { parseNairaInput, type FlagReason } from "@gts/utils";
import { parseWhatsAppContact } from "./receipt-layout";
import type { ReceiptData, ReceiptStore } from "./receipt";
import { loadStoreDetails, toReceiptStore } from "../lib/store-settings-api";
import { apiCall } from "../lib/staff-api";
import { getSessionUser, reauthenticate, signOut } from "../lib/session";
import { useStaffSession } from "../lib/use-staff-session";
import StaffMenu from "../components/staff/staff-menu";
import IdleLockScreen from "../components/idle/idle-lock-screen";
import { useIdleLock } from "../components/idle/use-idle-lock";
import type { CartLine, CompletedSale, PaymentMethod, PosProduct } from "./pos-types";

interface TodaysOrder {
  id: string;
  order_number: string;
  status: "completed" | "voided";
  total: number;
  created_at: string;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_snapshot: { name: string };
  }>;
}

interface FoundWhatsAppOrder {
  id: string;
  order_number: string;
  total: number;
  internal_notes: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    product_snapshot: { name: string; size?: string | null; color?: string | null };
  }>;
}

interface FlagTarget {
  productId: string;
  variantId: string | null;
  name: string;
}

export default function PosPage() {
  const session = useStaffSession();
  const { profile } = session;
  const isAdmin = session.isAdmin;
  const canVoid = !!profile && (isAdmin || profile.permissions.can_void_orders);
  const canDiscount = !!profile && (isAdmin || profile.permissions.can_apply_discounts);
  const cashierName = profile?.full_name ?? "";

  // Locks the till after a quiet spell; it's an overlay, so a half-built cart survives it.
  const idle = useIdleLock({ enabled: !!profile });

  // Receipt header comes from the admin's store settings. Loaded up front and
  // refreshed when a sale completes; if a refresh fails the last good details
  // are kept, and before any load it's a bare "GTS" so a receipt always prints.
  const [store, setStore] = useState<ReceiptStore>(() => toReceiptStore(null));
  const refreshStore = useCallback(async () => {
    const result = await loadStoreDetails();
    if (result.ok) setStore(toReceiptStore(result.data));
  }, []);
  useEffect(() => {
    refreshStore();
  }, [refreshStore]);

  const [mode, setMode] = useState<"walkin" | "whatsapp">("walkin");

  // Product grid: the catalogue on open, narrowed by search text and category.
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const catalogue = usePosCatalogue(query, category);

  // Walk-in cart
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantModalProduct, setVariantModalProduct] = useState<PosProduct | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Flagging a product for an admin to review
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null);

  // Today's orders
  const [showTodaysOrders, setShowTodaysOrders] = useState(false);
  const [todaysOrders, setTodaysOrders] = useState<TodaysOrder[]>([]);
  const [reprintError, setReprintError] = useState<string | null>(null);

  // WhatsApp flow
  const [waMode, setWaMode] = useState<"create" | "confirm">("create");
  const [waCart, setWaCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<FoundWhatsAppOrder | null>(null);
  const [waPaymentMethod, setWaPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cancelledOrderNumber, setCancelledOrderNumber] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingWhatsAppOrder[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const activeCart = mode === "walkin" ? cart : waCart;
  const setActiveCart = mode === "walkin" ? setCart : setWaCart;

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = resolveManualDiscount(discountText, { subtotal, isAdmin, canApply: canDiscount });

  const refreshPending = useCallback(async () => {
    setPendingLoading(true);
    const result = await apiCall<PendingWhatsAppOrder[]>("/pos/whatsapp-orders");
    if (result.ok) setPendingOrders(result.data);
    setPendingLoading(false);
  }, []);
  useEffect(() => {
    if (mode === "whatsapp" && waMode === "confirm" && !foundOrder) void refreshPending();
  }, [mode, waMode, foundOrder, refreshPending]);

  function addToCart(product: PosProduct, variantId: string, quantity = 1) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return;

    setActiveCart((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variantId ? { ...l, quantity: Math.min(l.available, l.quantity + quantity) } : l
        );
      }
      return [
        ...prev,
        {
          variantId,
          productId: product.id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          unitPrice: product.base_price + variant.price_modifier,
          quantity,
          available: variant.available,
        },
      ];
    });
  }

  function incrementLine(variantId: string) {
    setActiveCart((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(l.available, l.quantity + 1) } : l))
    );
  }
  function decrementLine(variantId: string) {
    setActiveCart((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l))
    );
  }
  function removeLine(variantId: string) {
    setActiveCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  async function submitFlag(input: { reason: FlagReason; note: string }) {
    if (!flagTarget) return { ok: false as const, message: "Nothing to flag." };
    const result = await apiCall("/pos/flags", {
      method: "POST",
      json: {
        product_id: flagTarget.productId,
        variant_id: flagTarget.variantId,
        reason: input.reason,
        note: input.note || undefined,
      },
    });
    return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
  }

  async function confirmWalkInSale(customerEmail: string) {
    setSaleError(null);
    const result = await apiCall<{ order_number: string; subtotal: number; discount_amount: number; total: number }>(
      "/pos/orders",
      {
        method: "POST",
        json: {
          items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
          payment_method: paymentMethod,
          customer_email: customerEmail || undefined,
          manual_discount: discount.kobo > 0 ? discount.kobo : undefined,
        },
      }
    );
    if (!result.ok) {
      setSaleError(result.message);
      setShowPaymentConfirm(false);
      return;
    }
    const received = paymentMethod === "cash" ? parseNairaInput(cashReceived) : null;
    setCompletedSale({
      orderNumber: result.data.order_number,
      items: cart,
      subtotal: result.data.subtotal,
      discountAmount: result.data.discount_amount,
      total: result.data.total,
      paymentMethod: paymentMethod as PaymentMethod,
      cashierName,
      createdAt: new Date().toISOString(),
      channel: "walk_in",
      cashReceived: received !== null && received > 0 ? received : undefined,
    });
    setShowPaymentConfirm(false);
    refreshStore();
  }

  function newTransaction() {
    // Closing a reprint must not wipe the sale being built behind it.
    if (completedSale?.duplicate) {
      setCompletedSale(null);
      return;
    }
    setCart([]);
    setPaymentMethod(null);
    setCashReceived("");
    setDiscountText("");
    setCompletedSale(null);
    setSaleError(null);
    setQuery("");
  }

  async function fetchTodaysOrders() {
    const result = await apiCall<TodaysOrder[]>("/pos/orders/today");
    return result.ok ? result.data : [];
  }

  async function openTodaysOrders() {
    setReprintError(null);
    setTodaysOrders(await fetchTodaysOrders());
    setShowTodaysOrders(true);
  }

  async function voidOrder(orderId: string, reason: string) {
    const result = await apiCall(`/pos/orders/${orderId}/void`, { method: "PUT", json: { reason } });
    if (!result.ok) setReprintError(result.message);
    else setReprintError(null);
    setTodaysOrders(await fetchTodaysOrders());
  }

  async function reprintReceipt(orderId: string) {
    setReprintError(null);
    const result = await apiCall<ReceiptData>(`/pos/orders/${orderId}/receipt`);
    if (!result.ok) {
      setReprintError(result.message);
      return;
    }
    const r = result.data;
    setCompletedSale({
      orderNumber: r.orderNumber,
      items: r.items.map((item, index) => ({
        variantId: `${r.orderNumber}-${index}`,
        productId: `${r.orderNumber}-${index}`,
        productName: item.name,
        size: item.size,
        color: item.color,
        unitPrice: item.unitPrice ?? Math.round(item.lineTotal / item.quantity),
        quantity: item.quantity,
        available: item.quantity,
      })),
      subtotal: r.subtotal,
      discountAmount: r.discountAmount,
      total: r.total,
      paymentMethod: r.paymentMethod,
      cashierName: r.cashierName,
      createdAt: r.createdAt,
      channel: r.channel,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      duplicate: true,
    });
    setShowTodaysOrders(false);
  }

  const createWhatsAppOrder = useCallback(async () => {
    const result = await apiCall<{ order_number: string }>("/pos/whatsapp-orders", {
      method: "POST",
      json: {
        items: waCart.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        customer_name: customerName,
        customer_phone: customerPhone,
      },
    });
    if (!result.ok) {
      setSaleError(result.message);
      return;
    }
    setSaleError(null);
    setCreatedOrderNumber(result.data.order_number);
    setWaCart([]);
    setCustomerName("");
    setCustomerPhone("");
  }, [waCart, customerName, customerPhone]);

  async function lookupWhatsAppOrder(ref: string = lookupOrderNumber) {
    setLookupError(null);
    setCancelledOrderNumber(null);
    setFoundOrder(null);
    const result = await apiCall<FoundWhatsAppOrder>(`/pos/whatsapp-orders/${encodeURIComponent(ref.trim())}`);
    if (!result.ok) {
      setLookupError(result.message);
      return;
    }
    setFoundOrder(result.data);
  }

  function selectPendingOrder(orderNumber: string) {
    setLookupOrderNumber(orderNumber);
    void lookupWhatsAppOrder(orderNumber);
  }

  async function cancelWhatsAppOrder(reason: string) {
    if (!foundOrder) return;
    const result = await apiCall(`/pos/whatsapp-orders/${foundOrder.id}/cancel`, { method: "PUT", json: { reason } });
    if (!result.ok) {
      setSaleError(result.message);
      return;
    }
    setSaleError(null);
    setCancelledOrderNumber(foundOrder.order_number);
    setFoundOrder(null);
    setLookupOrderNumber("");
    setWaPaymentMethod(null);
  }

  async function confirmWhatsAppPayment() {
    if (!foundOrder || !waPaymentMethod) return;
    const result = await apiCall<{ order_number: string; total: number }>(
      `/pos/whatsapp-orders/${foundOrder.id}/confirm`,
      { method: "POST", json: { payment_method: waPaymentMethod } }
    );
    if (!result.ok) {
      setSaleError(result.message);
      return;
    }
    const contact = parseWhatsAppContact(foundOrder.internal_notes);
    setCompletedSale({
      orderNumber: result.data.order_number,
      items: foundOrder.items.map((i) => ({
        variantId: i.id,
        productId: i.id,
        productName: i.product_snapshot.name,
        size: i.product_snapshot.size ?? null,
        color: i.product_snapshot.color ?? null,
        unitPrice: i.unit_price,
        quantity: i.quantity,
        available: i.quantity,
      })),
      subtotal: result.data.total,
      discountAmount: 0,
      total: result.data.total,
      paymentMethod: waPaymentMethod,
      cashierName,
      createdAt: new Date().toISOString(),
      channel: "whatsapp",
      customerName: contact?.name,
      customerPhone: contact?.phone,
    });
    setFoundOrder(null);
    setLookupOrderNumber("");
    setWaPaymentMethod(null);
    refreshStore();
  }

  const lockScreen = (
    <IdleLockScreen
      state={idle.state}
      name={cashierName}
      onStay={idle.stayActive}
      onUnlock={async (password) => {
        const result = await reauthenticate(getSessionUser()?.email ?? profile?.email ?? "", password);
        if (result.ok) idle.unlock();
        return result;
      }}
      onSignOut={() => void signOut({ reason: "idle" })}
    />
  );

  if (completedSale) {
    return (
      <>
        <ReceiptScreen sale={completedSale} store={store} onNewTransaction={newTransaction} />
        {lockScreen}
      </>
    );
  }

  const banner = saleError ?? catalogue.error ?? session.error;

  return (
    <div className="flex flex-col h-screen bg-[#F8F7F4] dark:bg-[#1C1C1C] font-sans">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white">GTS POS</h1>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-[#242424] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setMode("walkin")}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${mode === "walkin" ? "bg-white dark:bg-[#1C1C1C] shadow-sm" : "text-gray-500"}`}
            >
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setMode("whatsapp")}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${mode === "whatsapp" ? "bg-white dark:bg-[#1C1C1C] shadow-sm" : "text-gray-500"}`}
            >
              WhatsApp
            </button>
          </div>
          <button
            type="button"
            onClick={openTodaysOrders}
            className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]"
          >
            Today&apos;s Orders
          </button>
          {profile && (
            <StaffMenu
              name={cashierName}
              role={profile.role}
              isAdmin={isAdmin}
              canUsePos={session.canUsePos}
              current="pos"
              onSignOut={session.signOut}
            />
          )}
        </div>
      </div>

      {banner && (
        <div role="alert" className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
          {banner}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[60%_40%] overflow-hidden">
        <SearchPanel
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          categories={catalogue.categories}
          products={catalogue.products}
          loading={catalogue.loading}
          hasMore={catalogue.hasMore}
          loadingMore={catalogue.loadingMore}
          onLoadMore={catalogue.loadMore}
          onQuickAdd={(product, variantId) => addToCart(product, variantId, 1)}
          onOpenVariantModal={setVariantModalProduct}
          onFlagProduct={(product) => setFlagTarget({ productId: product.id, variantId: null, name: product.name })}
        />

        {mode === "walkin" ? (
          <CartPanel
            lines={cart}
            paymentMethod={paymentMethod}
            cashReceived={cashReceived}
            canDiscount={canDiscount}
            isAdmin={isAdmin}
            discountText={discountText}
            onIncrement={incrementLine}
            onDecrement={decrementLine}
            onRemove={removeLine}
            onPaymentMethodChange={setPaymentMethod}
            onCashReceivedChange={setCashReceived}
            onDiscountTextChange={setDiscountText}
            onFlagLine={(line) => setFlagTarget({ productId: line.productId, variantId: line.variantId, name: line.productName })}
            onConfirm={() => setShowPaymentConfirm(true)}
          />
        ) : (
          <WhatsAppPanel
            mode={waMode}
            onModeChange={setWaMode}
            cartLines={waCart}
            customerName={customerName}
            customerPhone={customerPhone}
            onCustomerNameChange={setCustomerName}
            onCustomerPhoneChange={setCustomerPhone}
            onIncrement={incrementLine}
            onDecrement={decrementLine}
            onRemove={removeLine}
            onCreateOrder={createWhatsAppOrder}
            createdOrderNumber={createdOrderNumber}
            lookupOrderNumber={lookupOrderNumber}
            onLookupOrderNumberChange={setLookupOrderNumber}
            onLookup={() => void lookupWhatsAppOrder()}
            lookupError={lookupError}
            foundOrder={foundOrder}
            paymentMethod={waPaymentMethod}
            onPaymentMethodChange={setWaPaymentMethod}
            onConfirmPayment={confirmWhatsAppPayment}
            onCancelOrder={cancelWhatsAppOrder}
            cancelledOrderNumber={cancelledOrderNumber}
            pendingOrders={pendingOrders}
            pendingLoading={pendingLoading}
            onSelectPending={selectPendingOrder}
            onRefreshPending={() => void refreshPending()}
          />
        )}
      </div>

      {variantModalProduct && (
        <VariantModal
          product={variantModalProduct}
          onAddToCart={(product, variantId, quantity) => {
            addToCart(product, variantId, quantity);
            setVariantModalProduct(null);
          }}
          onCancel={() => setVariantModalProduct(null)}
        />
      )}

      {showPaymentConfirm && paymentMethod && (
        <PaymentConfirmModal
          total={subtotal - discount.kobo}
          paymentMethod={paymentMethod}
          itemCount={cart.length}
          onCancel={() => setShowPaymentConfirm(false)}
          onConfirm={confirmWalkInSale}
        />
      )}

      {showTodaysOrders && (
        <TodaysOrdersPanel
          orders={todaysOrders}
          canVoid={canVoid}
          reprintError={reprintError}
          onVoid={voidOrder}
          onReprint={reprintReceipt}
          onClose={() => setShowTodaysOrders(false)}
        />
      )}

      {flagTarget && (
        <FlagProductModal productName={flagTarget.name} onSubmit={submitFlag} onClose={() => setFlagTarget(null)} />
      )}

      {lockScreen}
    </div>
  );
}
