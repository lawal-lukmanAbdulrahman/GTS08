"use client";

import { useEffect, useState, useCallback } from "react";
import SearchPanel from "./search-panel";
import CartPanel from "./cart-panel";
import VariantModal from "./variant-modal";
import PaymentConfirmModal from "./payment-confirm-modal";
import ReceiptScreen from "./receipt-screen";
import TodaysOrdersPanel from "./todays-orders-panel";
import WhatsAppPanel from "./whatsapp-panel";
import { resolveQuickAddVariant } from "./quick-add";
import type { CartLine, CompletedSale, PaymentMethod, PosProduct } from "./pos-types";

const API_BASE = "http://localhost:3000/api/v1";

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCashierName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("gts_user");
    return raw ? JSON.parse(raw).full_name || "" : "";
  } catch {
    return "";
  }
}

export default function PosPage() {
  const [mode, setMode] = useState<"walkin" | "whatsapp">("walkin");

  // Product search
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Walk-in cart
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantModalProduct, setVariantModalProduct] = useState<PosProduct | null>(null);
  const [preselectedVariantId, setPreselectedVariantId] = useState<string | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Today's orders
  const [showTodaysOrders, setShowTodaysOrders] = useState(false);
  const [todaysOrders, setTodaysOrders] = useState<Awaited<ReturnType<typeof fetchTodaysOrders>>>([]);

  // WhatsApp flow
  const [waMode, setWaMode] = useState<"create" | "confirm">("create");
  const [waCart, setWaCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<{
    id: string;
    order_number: string;
    total: number;
    items: Array<{ id: string; quantity: number; unit_price: number; product_snapshot: { name: string } }>;
  } | null>(null);
  const [waPaymentMethod, setWaPaymentMethod] = useState<PaymentMethod | null>(null);

  const activeCart = mode === "walkin" ? cart : waCart;
  const setActiveCart = mode === "walkin" ? setCart : setWaCart;

  // Debounced product search (spec Part 3.1: 300ms)
  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      return;
    }
    setSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        if (category !== "all") params.set("category", category);
        const res = await fetch(`${API_BASE}/pos/products/search?${params}`, { headers: authHeaders() });
        const body = await res.json();
        if (!res.ok) setSaleError(body.error || "Product search failed.");
        setProducts(res.ok ? body.data : []);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, category]);

  function addToCart(product: PosProduct, variantId: string, quantity = 1) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return;

    setActiveCart((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variantId
            ? { ...l, quantity: Math.min(l.available, l.quantity + quantity) }
            : l
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

  function handleQuickAdd(product: PosProduct, variantId: string) {
    addToCart(product, variantId, 1);
  }

  function handleProductTapForModal(product: PosProduct) {
    setPreselectedVariantId(undefined);
    setVariantModalProduct(product);
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

  async function confirmWalkInSale(customerEmail: string) {
    setSaleError(null);
    try {
      const res = await fetch(`${API_BASE}/pos/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
          payment_method: paymentMethod,
          customer_email: customerEmail || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaleError(body.error || "Failed to complete sale.");
        return;
      }
      setCompletedSale({
        orderNumber: body.data.order_number,
        items: cart,
        subtotal: body.data.subtotal,
        discountAmount: body.data.discount_amount,
        total: body.data.total,
        paymentMethod: paymentMethod as PaymentMethod,
        cashierName: getCashierName(),
        createdAt: new Date().toISOString(),
      });
      setShowPaymentConfirm(false);
    } catch {
      setSaleError("Network error. Please try again.");
    }
  }

  function newTransaction() {
    setCart([]);
    setPaymentMethod(null);
    setCashReceived("");
    setCompletedSale(null);
    setSaleError(null);
    setQuery("");
  }

  async function fetchTodaysOrders() {
    const res = await fetch(`${API_BASE}/pos/orders/today`, { headers: authHeaders() });
    const body = await res.json();
    return res.ok ? body.data : [];
  }

  async function openTodaysOrders() {
    setTodaysOrders(await fetchTodaysOrders());
    setShowTodaysOrders(true);
  }

  async function voidOrder(orderId: string, reason: string) {
    await fetch(`${API_BASE}/pos/orders/${orderId}/void`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ reason }),
    });
    setTodaysOrders(await fetchTodaysOrders());
  }

  const createWhatsAppOrder = useCallback(async () => {
    const res = await fetch(`${API_BASE}/pos/whatsapp-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        items: waCart.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        customer_name: customerName,
        customer_phone: customerPhone,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaleError(body.error || "Failed to create WhatsApp order.");
      return;
    }
    setSaleError(null);
    setCreatedOrderNumber(body.data.order_number);
    setWaCart([]);
    setCustomerName("");
    setCustomerPhone("");
  }, [waCart, customerName, customerPhone]);

  async function lookupWhatsAppOrder() {
    setLookupError(null);
    setFoundOrder(null);
    const res = await fetch(`${API_BASE}/pos/whatsapp-orders/${lookupOrderNumber}`, {
      headers: authHeaders(),
    });
    const body = await res.json();
    if (!res.ok) {
      setLookupError(body.error || "Order not found.");
      return;
    }
    setFoundOrder(body.data);
  }

  async function confirmWhatsAppPayment() {
    if (!foundOrder || !waPaymentMethod) return;
    const res = await fetch(`${API_BASE}/pos/whatsapp-orders/${foundOrder.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ payment_method: waPaymentMethod }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaleError(body.error || "Failed to confirm payment.");
      return;
    }
    setCompletedSale({
      orderNumber: body.data.order_number,
      items: foundOrder.items.map((i) => ({
        variantId: i.id,
        productId: i.id,
        productName: i.product_snapshot.name,
        size: null,
        color: null,
        unitPrice: i.unit_price,
        quantity: i.quantity,
        available: i.quantity,
      })),
      subtotal: body.data.total,
      discountAmount: 0,
      total: body.data.total,
      paymentMethod: waPaymentMethod,
      cashierName: getCashierName(),
      createdAt: new Date().toISOString(),
    });
    setFoundOrder(null);
    setLookupOrderNumber("");
    setWaPaymentMethod(null);
  }

  if (completedSale) {
    return <ReceiptScreen sale={completedSale} onNewTransaction={newTransaction} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8F7F4] dark:bg-[#1C1C1C] font-sans">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white">GTS POS</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">{getCashierName() || "Cashier"}</span>
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
        </div>
      </div>

      {saleError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
          {saleError}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[60%_40%] overflow-hidden">
        <SearchPanel
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          categories={[]}
          products={products}
          loading={searchLoading}
          onQuickAdd={handleQuickAdd}
          onOpenVariantModal={handleProductTapForModal}
        />

        {mode === "walkin" ? (
          <CartPanel
            lines={cart}
            paymentMethod={paymentMethod}
            cashReceived={cashReceived}
            onIncrement={incrementLine}
            onDecrement={decrementLine}
            onRemove={removeLine}
            onPaymentMethodChange={setPaymentMethod}
            onCashReceivedChange={setCashReceived}
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
            onLookup={lookupWhatsAppOrder}
            lookupError={lookupError}
            foundOrder={foundOrder}
            paymentMethod={waPaymentMethod}
            onPaymentMethodChange={setWaPaymentMethod}
            onConfirmPayment={confirmWhatsAppPayment}
          />
        )}
      </div>

      {variantModalProduct && (
        <VariantModal
          product={variantModalProduct}
          preselectedVariantId={preselectedVariantId}
          onAddToCart={(product, variantId, quantity) => {
            addToCart(product, variantId, quantity);
            setVariantModalProduct(null);
          }}
          onCancel={() => setVariantModalProduct(null)}
        />
      )}

      {showPaymentConfirm && paymentMethod && (
        <PaymentConfirmModal
          total={cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)}
          paymentMethod={paymentMethod}
          itemCount={cart.length}
          onCancel={() => setShowPaymentConfirm(false)}
          onConfirm={confirmWalkInSale}
        />
      )}

      {showTodaysOrders && (
        <TodaysOrdersPanel orders={todaysOrders} onVoid={voidOrder} onClose={() => setShowTodaysOrders(false)} />
      )}
    </div>
  );
}
