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
import ErrorBanner from "./error-banner";
import FindSalePanel, { type FoundSale, type SaleQuery } from "./find-sale-panel";
import { useSidebar, SidebarToggle } from "../admin/sidebar-context";
import NoPosAccess from "./no-pos-access";
import HeldSalesBar from "./held-sales-bar";
import { discardHeldSale, holdSale, loadHeldSales, type HeldSale } from "./held-sales";
import { looksLikeSku, skuLookupToProduct } from "./sku-scan";
import { usePosCatalogue } from "./use-pos-catalogue";
import { useCartStockSync } from "./use-cart-stock-sync";
import { resolveManualDiscount } from "./manual-discount-input";
import { parseNairaInput, type FlagReason } from "@gts/utils";
import { parseWhatsAppContact } from "./receipt-layout";
import type { ReceiptData, ReceiptStore } from "./receipt";
import { loadStoreDetails, toReceiptStore } from "../lib/store-settings-api";
import { apiCall } from "../lib/staff-api";
import { getSessionUser, reauthenticate, signOut } from "../lib/session";
import { useStaffSession } from "../lib/use-staff-session";
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
  const [showFindSale, setShowFindSale] = useState(false);
  const { setMobileOpen } = useSidebar(); // opens the admin menu on tablets (a no-op outside the admin shell)
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  useCartStockSync(cart, setCart, catalogue.products, setSaleError);

  // Flagging a product for an admin to review
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null);

  // Today's orders
  const [showTodaysOrders, setShowTodaysOrders] = useState(false);
  const [todaysOrders, setTodaysOrders] = useState<TodaysOrder[]>([]);
  const [todaysOrdersLoading, setTodaysOrdersLoading] = useState(false);
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

  const setActiveCart = mode === "walkin" ? setCart : setWaCart;

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = resolveManualDiscount(discountText, { subtotal, isAdmin, canApply: canDiscount });

  // An error is about the sale as it was; once the cart, discount or payment changes it's stale.
  useEffect(() => {
    setSaleError(null);
  }, [cart, discountText, paymentMethod]);

  // Sales parked on this till by this person
  const staffId = profile?.id ?? null;
  useEffect(() => {
    if (staffId) setHeldSales(loadHeldSales(staffId));
  }, [staffId]);

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
        headers: { "Idempotency-Key": `pos_${crypto.randomUUID()}` },
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

  function holdCurrentSale() {
    if (!staffId) return;
    const held = holdSale(staffId, { lines: cart, discountText });
    if (!held) {
      setSaleError("Couldn't hold this sale on this device. Finish it or clear it instead.");
      return;
    }
    setHeldSales(loadHeldSales(staffId));
    setCart([]);
    setPaymentMethod(null);
    setCashReceived("");
    setDiscountText("");
  }

  function resumeHeldSale(id: string) {
    if (!staffId) return;
    const target = heldSales.find((h) => h.id === id);
    if (!target) return;
    // Swap: whatever is on the till now is parked, so nothing is lost.
    if (cart.length > 0) holdSale(staffId, { lines: cart, discountText });
    discardHeldSale(staffId, id);
    setHeldSales(loadHeldSales(staffId));
    setMode("walkin");
    setCart(target.lines);
    setDiscountText(target.discountText);
    setPaymentMethod(null);
    setCashReceived("");
  }

  function discardHeld(id: string) {
    if (!staffId) return;
    discardHeldSale(staffId, id);
    setHeldSales(loadHeldSales(staffId));
  }

  // A barcode scanner types the SKU then presses Enter: add that exact variant.
  async function submitSearchText(text: string) {
    setScanMessage(null);
    if (!looksLikeSku(text)) return; // an ordinary word: the search results already show
    const result = await apiCall<Parameters<typeof skuLookupToProduct>[0]>(`/pos/products/${encodeURIComponent(text)}`);
    if (!result.ok) return; // not a SKU: leave the search as it is
    const product = skuLookupToProduct(result.data);
    if (product.variants[0]!.available <= 0) {
      setScanMessage(`${product.name} is out of stock`);
    } else {
      addToCart(product, product.variants[0]!.id, 1);
      setScanMessage(`Added ${product.name}`);
      setQuery("");
    }
    setTimeout(() => setScanMessage(null), 3000);
  }

  function newTransaction() {
    void catalogue.refresh(); // the sale just took stock; show what's left
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
    setShowTodaysOrders(true);
    setTodaysOrdersLoading(true);
    try {
      const orders = await fetchTodaysOrders();
      setTodaysOrders(orders);
    } finally {
      setTodaysOrdersLoading(false);
    }
  }

  async function voidOrder(orderId: string, reason: string) {
    const result = await apiCall(`/pos/orders/${orderId}/void`, { method: "PUT", json: { reason } });
    if (!result.ok) setReprintError(result.message);
    else setReprintError(null);
    setTodaysOrdersLoading(true);
    try {
      const orders = await fetchTodaysOrders();
      setTodaysOrders(orders);
    } finally {
      setTodaysOrdersLoading(false);
    }
  }

  async function searchSales(query: SaleQuery): Promise<{ ok: true; data: FoundSale[] } | { ok: false; message: string }> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const result = await apiCall<FoundSale[]>(`/pos/orders${params.size ? `?${params}` : ""}`);
    return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
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
    setShowFindSale(false);
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
      {
        method: "POST",
        headers: { "Idempotency-Key": `wa_${crypto.randomUUID()}` },
        json: { payment_method: waPaymentMethod },
      }
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

  // Signed in but not allowed to take sales: say so, instead of an empty till full of errors.
  if (profile && !session.canUsePos) {
    return <NoPosAccess name={cashierName} isAdmin={isAdmin} onSignOut={session.signOut} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F8F7F4] dark:bg-[#1C1C1C] font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]">
        <div className="flex items-center gap-2">
          <SidebarToggle className="hidden lg:inline-flex -ml-2 mr-0.5" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="lg:hidden min-w-[36px] min-h-[36px] -ml-2 text-xl text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          >
            ☰
          </button>
          <h1 className="text-base font-bold text-gray-900 dark:text-white">POS</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-[#242424] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setMode("walkin")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold ${mode === "walkin" ? "bg-white dark:bg-[#1C1C1C] shadow-sm" : "text-gray-500"}`}
            >
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setMode("whatsapp")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold ${mode === "whatsapp" ? "bg-white dark:bg-[#1C1C1C] shadow-sm" : "text-gray-500"}`}
            >
              WhatsApp
            </button>
          </div>
          <button
            type="button"
            onClick={openTodaysOrders}
            className="px-4 py-2 text-sm font-semibold rounded-[8px] bg-gray-100 dark:bg-[#242424]"
          >
            Today&apos;s Orders
          </button>
          <button
            type="button"
            onClick={() => {
              setReprintError(null);
              setShowFindSale(true);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-[8px] bg-gray-100 dark:bg-[#242424]"
          >
            Find a sale
          </button>
        </div>
      </div>

      <ErrorBanner message={banner} onDismiss={() => setSaleError(null)} />
      <HeldSalesBar sales={heldSales} onResume={resumeHeldSale} onDiscard={discardHeld} />

      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[60%_40%] lg:grid-rows-[minmax(0,1fr)] overflow-hidden">
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
          onSubmitQuery={submitSearchText}
          scanMessage={scanMessage}
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
            onHold={holdCurrentSale}
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
          unitCount={cart.reduce((n, l) => n + l.quantity, 0)}
          discountAmount={discount.kobo}
          onCancel={() => setShowPaymentConfirm(false)}
          onConfirm={confirmWalkInSale}
        />
      )}

      {showTodaysOrders && (
        <TodaysOrdersPanel
          orders={todaysOrders}
          loading={todaysOrdersLoading}
          canVoid={canVoid}
          reprintError={reprintError}
          onVoid={voidOrder}
          onReprint={reprintReceipt}
          onClose={() => setShowTodaysOrders(false)}
        />
      )}

      {showFindSale && (
        <FindSalePanel onSearch={searchSales} onReprint={reprintReceipt} reprintError={reprintError} onClose={() => setShowFindSale(false)} />
      )}

      {flagTarget && (
        <FlagProductModal productName={flagTarget.name} onSubmit={submitFlag} onClose={() => setFlagTarget(null)} />
      )}

      {lockScreen}
    </div>
  );
}
