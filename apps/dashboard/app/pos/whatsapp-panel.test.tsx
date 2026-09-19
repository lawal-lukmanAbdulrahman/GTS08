import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import WhatsAppPanel from "./whatsapp-panel";
import type { CartLine } from "./pos-types";

const LINE: CartLine = {
  variantId: "v1",
  productId: "p1",
  productName: "GTS Oxford Shirt",
  size: "L",
  color: "Black",
  unitPrice: 1500000,
  quantity: 1,
  available: 5,
};

const FOUND_ORDER = {
  order_number: "GTS-202609-000002",
  total: 1500000,
  items: [{ id: "oi1", quantity: 1, unit_price: 1500000, product_snapshot: { name: "Shirt" } }],
};

function baseProps(overrides: Partial<Parameters<typeof WhatsAppPanel>[0]> = {}) {
  return {
    mode: "create" as const,
    onModeChange: vi.fn(),
    cartLines: [] as CartLine[],
    customerName: "",
    customerPhone: "",
    onCustomerNameChange: vi.fn(),
    onCustomerPhoneChange: vi.fn(),
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onRemove: vi.fn(),
    onCreateOrder: vi.fn(),
    createdOrderNumber: null,
    lookupOrderNumber: "",
    onLookupOrderNumberChange: vi.fn(),
    onLookup: vi.fn(),
    lookupError: null,
    foundOrder: null,
    paymentMethod: null,
    onPaymentMethodChange: vi.fn(),
    onConfirmPayment: vi.fn(),
    onCancelOrder: vi.fn(),
    cancelledOrderNumber: null,
    ...overrides,
  };
}

describe("WhatsAppPanel create mode (D001)", () => {
  it("disables Create Order until name, phone, and at least one item are present", () => {
    render(<WhatsAppPanel {...baseProps()} />);
    expect(screen.getByRole("button", { name: /create order/i })).toBeDisabled();
  });

  it("enables Create Order once name, phone, and an item are all present", () => {
    render(
      <WhatsAppPanel {...baseProps({ cartLines: [LINE], customerName: "Chidinma O.", customerPhone: "08031234567" })} />
    );
    expect(screen.getByRole("button", { name: /create order/i })).toBeEnabled();
  });

  it("shows the generated order number after creation", () => {
    render(<WhatsAppPanel {...baseProps({ createdOrderNumber: "GTS-202609-000002" })} />);
    expect(screen.getByText(/GTS-202609-000002/)).toBeInTheDocument();
  });
});

describe("WhatsAppPanel confirm mode (D001)", () => {
  it("shows a lookup error when given", () => {
    render(
      <WhatsAppPanel
        {...baseProps({
          mode: "confirm",
          lookupOrderNumber: "GTS-BOGUS",
          lookupError: "No WhatsApp order found for number: GTS-BOGUS",
        })}
      />
    );
    expect(screen.getByText(/no whatsapp order found/i)).toBeInTheDocument();
  });

  it("disables Confirm Payment until a payment method is chosen", () => {
    render(<WhatsAppPanel {...baseProps({ mode: "confirm", foundOrder: FOUND_ORDER })} />);
    expect(screen.getByRole("button", { name: /confirm payment/i })).toBeDisabled();
  });

  it("tells the cashier when an order was cancelled and its stock released", () => {
    render(
      <WhatsAppPanel {...baseProps({ mode: "confirm", cancelledOrderNumber: "GTS-202609-000002" })} />
    );
    expect(screen.getByText(/GTS-202609-000002.*cancelled/i)).toBeInTheDocument();
  });
});

describe("WhatsAppPanel cancel order", () => {
  it("offers Cancel Order only once an order has been looked up", () => {
    const { rerender } = render(<WhatsAppPanel {...baseProps({ mode: "confirm" })} />);
    expect(screen.queryByRole("button", { name: /cancel order/i })).not.toBeInTheDocument();

    rerender(<WhatsAppPanel {...baseProps({ mode: "confirm", foundOrder: FOUND_ORDER })} />);
    expect(screen.getByRole("button", { name: /cancel order/i })).toBeInTheDocument();
  });

  it("requires a reason before the cancellation can be confirmed", () => {
    render(<WhatsAppPanel {...baseProps({ mode: "confirm", foundOrder: FOUND_ORDER })} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    expect(screen.getByRole("button", { name: /confirm cancel/i })).toBeDisabled();
  });

  it("passes the reason to onCancelOrder", () => {
    const onCancelOrder = vi.fn();
    render(<WhatsAppPanel {...baseProps({ mode: "confirm", foundOrder: FOUND_ORDER, onCancelOrder })} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    fireEvent.change(screen.getByPlaceholderText(/reason for cancelling/i), {
      target: { value: "customer went quiet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm cancel/i }));
    expect(onCancelOrder).toHaveBeenCalledWith("customer went quiet");
  });

  it("can back out of the cancel prompt without cancelling", () => {
    const onCancelOrder = vi.fn();
    render(<WhatsAppPanel {...baseProps({ mode: "confirm", foundOrder: FOUND_ORDER, onCancelOrder })} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep order/i }));
    expect(onCancelOrder).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/reason for cancelling/i)).not.toBeInTheDocument();
  });
});
