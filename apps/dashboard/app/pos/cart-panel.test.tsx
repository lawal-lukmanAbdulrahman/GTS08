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

  describe("discount quick-picks", () => {
    const base = { lines: [LINE], paymentMethod: "cash" as const, onIncrement: noop, onDecrement: noop, onRemove: noop, onPaymentMethodChange: noop, onConfirm: noop, isAdmin: false, canDiscount: true, discountText: "" };

    it("offers 5, 10 and 20 percent, filling the exact amount", () => {
      const onDiscountTextChange = vi.fn();
      render(<CartPanel {...base} onDiscountTextChange={onDiscountTextChange} />);
      fireEvent.click(screen.getByRole("button", { name: "10%" }));
      expect(onDiscountTextChange).toHaveBeenLastCalledWith("3000"); // 10% of ₦30,000
      fireEvent.click(screen.getByRole("button", { name: "20%" }));
      expect(onDiscountTextChange).toHaveBeenLastCalledWith("6000");
    });

    it("tells a cashier the ceiling", () => {
      render(<CartPanel {...base} onDiscountTextChange={noop} />);
      expect(screen.getByText(/up to 20%/i)).toBeInTheDocument();
    });

    it("doesn't show the ceiling to an admin", () => {
      render(<CartPanel {...base} isAdmin onDiscountTextChange={noop} />);
      expect(screen.queryByText(/up to 20%/i)).not.toBeInTheDocument();
    });

    it("has a Clear button once a discount is entered", () => {
      const onDiscountTextChange = vi.fn();
      render(<CartPanel {...base} discountText="500" onDiscountTextChange={onDiscountTextChange} />);
      fireEvent.click(screen.getByRole("button", { name: /clear discount/i }));
      expect(onDiscountTextChange).toHaveBeenCalledWith("");
    });
  });

  describe("cash tendered", () => {
    const base = { lines: [LINE], paymentMethod: "cash" as const, onIncrement: noop, onDecrement: noop, onRemove: noop, onPaymentMethodChange: noop, onCashReceivedChange: noop, onConfirm: noop }; // total ₦30,000

    it("says how short the customer is, and blocks Confirm", () => {
      render(<CartPanel {...base} cashReceived="25,000" />);
      expect(screen.getByRole("status")).toHaveTextContent(/short by ₦5,000/i);
      expect(screen.getByRole("button", { name: /confirm payment/i })).toBeDisabled();
    });

    it("is fine with the exact amount or more", () => {
      const { rerender } = render(<CartPanel {...base} cashReceived="30,000" />);
      expect(screen.getByRole("button", { name: /confirm payment/i })).toBeEnabled();
      expect(screen.queryByText(/short by/i)).not.toBeInTheDocument();
      rerender(<CartPanel {...base} cashReceived="50,000" />);
      expect(screen.getByRole("button", { name: /confirm payment/i })).toBeEnabled();
    });

    it("doesn't insist on a tendered amount (it's optional)", () => {
      render(<CartPanel {...base} cashReceived="" />);
      expect(screen.getByRole("button", { name: /confirm payment/i })).toBeEnabled();
    });

    it("ignores the tendered box for card payments", () => {
      render(<CartPanel {...base} paymentMethod="pos_terminal" cashReceived="10" />);
      expect(screen.getByRole("button", { name: /confirm payment/i })).toBeEnabled();
    });
  });

  describe("holding a sale", () => {
    it("offers Hold while there are items, and holds it", () => {
      const onHold = vi.fn();
      render(<CartPanel lines={[LINE]} paymentMethod="cash" onIncrement={noop} onDecrement={noop} onRemove={noop} onPaymentMethodChange={noop} onConfirm={noop} onHold={onHold} />);
      fireEvent.click(screen.getByRole("button", { name: /hold sale/i }));
      expect(onHold).toHaveBeenCalled();
    });

    it("has nothing to hold on an empty cart", () => {
      render(<CartPanel lines={[]} paymentMethod={null} onIncrement={noop} onDecrement={noop} onRemove={noop} onPaymentMethodChange={noop} onConfirm={noop} onHold={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /hold sale/i })).not.toBeInTheDocument();
    });
  });
});
