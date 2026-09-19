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

  describe("manual discount (permissioned)", () => {
    // 2 x ₦15,000 = ₦30,000 subtotal; a cashier may take up to 20% = ₦6,000
    const base = {
      lines: [LINE],
      paymentMethod: "cash" as const,
      onIncrement: noop,
      onDecrement: noop,
      onRemove: noop,
      onPaymentMethodChange: noop,
      onConfirm: noop,
      isAdmin: false,
      discountText: "",
      onDiscountTextChange: noop,
    };

    it("shows no discount box to a cashier without the permission", () => {
      render(<CartPanel {...base} canDiscount={false} />);
      expect(screen.queryByLabelText(/discount/i)).not.toBeInTheDocument();
    });

    it("shows the box to a cashier who has it, and reports what is typed", () => {
      const onDiscountTextChange = vi.fn();
      render(<CartPanel {...base} canDiscount onDiscountTextChange={onDiscountTextChange} />);
      fireEvent.change(screen.getByLabelText(/discount/i), { target: { value: "1000" } });
      expect(onDiscountTextChange).toHaveBeenCalledWith("1000");
    });

    it("takes the discount off the total", () => {
      render(<CartPanel {...base} canDiscount discountText="5,000" />);
      expect(screen.getByText("-₦5,000")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /confirm payment/i })).toHaveTextContent("₦25,000");
    });

    it("explains a discount above the cap, ignores it in the total, and blocks Confirm", () => {
      render(<CartPanel {...base} canDiscount discountText="7,000" />);
      expect(screen.getByRole("alert")).toHaveTextContent(/above 20%/i);
      expect(screen.queryByText("-₦7,000")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /confirm payment/i })).toBeDisabled();
    });

    it("lets an admin discount past 20%", () => {
      render(<CartPanel {...base} canDiscount isAdmin discountText="7,000" />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("-₦7,000")).toBeInTheDocument();
    });

    it("no longer offers promo codes (that backend isn't built)", () => {
      render(<CartPanel {...base} canDiscount />);
      expect(screen.queryByPlaceholderText(/promo/i)).not.toBeInTheDocument();
    });
  });

  describe("cash received", () => {
    const base = {
      lines: [LINE], // ₦30,000
      paymentMethod: "cash" as const,
      onIncrement: noop,
      onDecrement: noop,
      onRemove: noop,
      onPaymentMethodChange: noop,
      onConfirm: noop,
      onCashReceivedChange: noop,
    };

    it("works out change exactly", () => {
      render(<CartPanel {...base} cashReceived="50,000.50" />);
      expect(screen.getByText(/change due: ₦20,000\.50/i)).toBeInTheDocument();
    });

    it("shows no change for something that isn't an amount", () => {
      render(<CartPanel {...base} cashReceived="abc" />);
      expect(screen.queryByText(/change due/i)).not.toBeInTheDocument();
    });
  });

  describe("flagging a line", () => {
    it("lets the cashier flag a cart item", () => {
      const onFlagLine = vi.fn();
      render(
        <CartPanel lines={[LINE]} paymentMethod="cash" onIncrement={noop} onDecrement={noop} onRemove={noop} onPaymentMethodChange={noop} onConfirm={noop} onFlagLine={onFlagLine} />
      );
      fireEvent.click(screen.getByRole("button", { name: /flag gts oxford shirt/i }));
      expect(onFlagLine).toHaveBeenCalledWith(LINE);
    });
  });
});
