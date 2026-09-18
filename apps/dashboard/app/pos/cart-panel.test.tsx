import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CartPanel from "./cart-panel";
import type { CartLine } from "./pos-types";

const LINE: CartLine = {
  variantId: "v1",
  productId: "p1",
  productName: "GTS Oxford Shirt",
  size: "L",
  color: "Black",
  unitPrice: 1500000,
  quantity: 2,
  available: 5,
};

function noop() {}

describe("CartPanel (spec Part 4)", () => {
  it("shows the empty state when there are no items", () => {
    render(
      <CartPanel
        lines={[]}
        paymentMethod={null}
        onIncrement={noop}
        onDecrement={noop}
        onRemove={noop}
        onPaymentMethodChange={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it("renders each line with its running total and disables Confirm until a payment method is chosen", () => {
    render(
      <CartPanel
        lines={[LINE]}
        paymentMethod={null}
        onIncrement={noop}
        onDecrement={noop}
        onRemove={noop}
        onPaymentMethodChange={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("GTS Oxford Shirt")).toBeInTheDocument();
    expect(screen.getByText(/L \/ Black/)).toBeInTheDocument();
    expect(screen.getAllByText("₦30,000").length).toBeGreaterThan(0); // 1,500,000 kobo x 2
    expect(screen.getByRole("button", { name: /confirm payment/i })).toBeDisabled();
  });

  it("enables Confirm once a payment method is selected", () => {
    render(
      <CartPanel
        lines={[LINE]}
        paymentMethod="cash"
        onIncrement={noop}
        onDecrement={noop}
        onRemove={noop}
        onPaymentMethodChange={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByRole("button", { name: /confirm payment/i })).toBeEnabled();
  });

  it("calls onIncrement/onDecrement and caps the stepper at available stock", () => {
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    render(
      <CartPanel
        lines={[{ ...LINE, quantity: 5, available: 5 }]}
        paymentMethod="cash"
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        onRemove={noop}
        onPaymentMethodChange={noop}
        onConfirm={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(onIncrement).not.toHaveBeenCalled(); // already at available cap

    fireEvent.click(screen.getByRole("button", { name: "-" }));
    expect(onDecrement).toHaveBeenCalledWith("v1");
  });

  it("disables the '-' stepper at quantity 1 (removal happens via the x button)", () => {
    render(
      <CartPanel
        lines={[{ ...LINE, quantity: 1 }]}
        paymentMethod="cash"
        onIncrement={noop}
        onDecrement={noop}
        onRemove={noop}
        onPaymentMethodChange={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByRole("button", { name: "-" })).toBeDisabled();
  });

  it("calls onRemove when the x button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <CartPanel
        lines={[LINE]}
        paymentMethod="cash"
        onIncrement={noop}
        onDecrement={noop}
        onRemove={onRemove}
        onPaymentMethodChange={noop}
        onConfirm={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith("v1");
  });
});
