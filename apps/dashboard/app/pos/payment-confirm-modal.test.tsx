import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import PaymentConfirmModal from "./payment-confirm-modal";

describe("PaymentConfirmModal (spec Part 5.1)", () => {
  it("shows the total, payment method label, and item count", () => {
    render(
      <PaymentConfirmModal
        total={2700000}
        paymentMethod="pos_terminal"
        itemCount={2}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("₦27,000")).toBeInTheDocument();
    expect(screen.getByText("Card Terminal")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onConfirm with the optional customer email", () => {
    const onConfirm = vi.fn();
    render(
      <PaymentConfirmModal
        total={2700000}
        paymentMethod="cash"
        itemCount={1}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/customer email/i), {
      target: { value: "shopper@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm sale/i }));
    expect(onConfirm).toHaveBeenCalledWith("shopper@example.com");
  });

  it("calls onConfirm with an empty string when no email is given (it's optional)", () => {
    const onConfirm = vi.fn();
    render(
      <PaymentConfirmModal total={1000} paymentMethod="cash" itemCount={1} onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm sale/i }));
    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <PaymentConfirmModal total={1000} paymentMethod="cash" itemCount={1} onCancel={onCancel} onConfirm={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
