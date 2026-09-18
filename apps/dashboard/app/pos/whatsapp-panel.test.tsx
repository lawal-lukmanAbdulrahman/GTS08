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

describe("WhatsAppPanel create mode (D001)", () => {
  it("disables Create Order until name, phone, and at least one item are present", () => {
    render(
      <WhatsAppPanel
        mode="create"
        onModeChange={vi.fn()}
        cartLines={[]}
        customerName=""
        customerPhone=""
        onCustomerNameChange={vi.fn()}
        onCustomerPhoneChange={vi.fn()}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
        onCreateOrder={vi.fn()}
        createdOrderNumber={null}
        lookupOrderNumber=""
        onLookupOrderNumberChange={vi.fn()}
        onLookup={vi.fn()}
        lookupError={null}
        foundOrder={null}
        paymentMethod={null}
        onPaymentMethodChange={vi.fn()}
        onConfirmPayment={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /create order/i })).toBeDisabled();
  });

  it("enables Create Order once name, phone, and an item are all present", () => {
    render(
      <WhatsAppPanel
        mode="create"
        onModeChange={vi.fn()}
        cartLines={[LINE]}
        customerName="Chidinma O."
        customerPhone="08031234567"
        onCustomerNameChange={vi.fn()}
        onCustomerPhoneChange={vi.fn()}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
        onCreateOrder={vi.fn()}
        createdOrderNumber={null}
        lookupOrderNumber=""
        onLookupOrderNumberChange={vi.fn()}
        onLookup={vi.fn()}
        lookupError={null}
        foundOrder={null}
        paymentMethod={null}
        onPaymentMethodChange={vi.fn()}
        onConfirmPayment={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /create order/i })).toBeEnabled();
  });

  it("shows the generated order number after creation", () => {
    render(
      <WhatsAppPanel
        mode="create"
        onModeChange={vi.fn()}
        cartLines={[LINE]}
        customerName="Chidinma O."
        customerPhone="08031234567"
        onCustomerNameChange={vi.fn()}
        onCustomerPhoneChange={vi.fn()}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
        onCreateOrder={vi.fn()}
        createdOrderNumber="GTS-202609-000002"
        lookupOrderNumber=""
        onLookupOrderNumberChange={vi.fn()}
        onLookup={vi.fn()}
        lookupError={null}
        foundOrder={null}
        paymentMethod={null}
        onPaymentMethodChange={vi.fn()}
        onConfirmPayment={vi.fn()}
      />
    );
    expect(screen.getByText(/GTS-202609-000002/)).toBeInTheDocument();
  });
});

describe("WhatsAppPanel confirm mode (D001)", () => {
  it("shows a lookup error when given", () => {
    render(
      <WhatsAppPanel
        mode="confirm"
        onModeChange={vi.fn()}
        cartLines={[]}
        customerName=""
        customerPhone=""
        onCustomerNameChange={vi.fn()}
        onCustomerPhoneChange={vi.fn()}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
        onCreateOrder={vi.fn()}
        createdOrderNumber={null}
        lookupOrderNumber="GTS-BOGUS"
        onLookupOrderNumberChange={vi.fn()}
        onLookup={vi.fn()}
        lookupError="No WhatsApp order found for number: GTS-BOGUS"
        foundOrder={null}
        paymentMethod={null}
        onPaymentMethodChange={vi.fn()}
        onConfirmPayment={vi.fn()}
      />
    );
    expect(screen.getByText(/no whatsapp order found/i)).toBeInTheDocument();
  });

  it("disables Confirm Payment until a payment method is chosen", () => {
    render(
      <WhatsAppPanel
        mode="confirm"
        onModeChange={vi.fn()}
        cartLines={[]}
        customerName=""
        customerPhone=""
        onCustomerNameChange={vi.fn()}
        onCustomerPhoneChange={vi.fn()}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
        onCreateOrder={vi.fn()}
        createdOrderNumber={null}
        lookupOrderNumber="GTS-202609-000002"
        onLookupOrderNumberChange={vi.fn()}
        onLookup={vi.fn()}
        lookupError={null}
        foundOrder={{
          order_number: "GTS-202609-000002",
          total: 1500000,
          items: [{ id: "oi1", quantity: 1, unit_price: 1500000, product_snapshot: { name: "Shirt" } }],
        }}
        paymentMethod={null}
        onPaymentMethodChange={vi.fn()}
        onConfirmPayment={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /confirm payment/i })).toBeDisabled();
  });
});
