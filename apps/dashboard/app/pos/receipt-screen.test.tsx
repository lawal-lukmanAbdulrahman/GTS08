import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReceiptScreen from "./receipt-screen";
import type { CompletedSale } from "./pos-types";

const SALE: CompletedSale = {
  orderNumber: "GTS-202609-000143",
  items: [
    {
      variantId: "v1",
      productId: "p1",
      productName: "GTS Oxford Shirt",
      size: "L",
      color: "Black",
      unitPrice: 1500000,
      quantity: 2,
      available: 5,
    },
  ],
  subtotal: 3000000,
  discountAmount: 0,
  total: 3000000,
  paymentMethod: "pos_terminal",
  cashierName: "Chidinma O.",
  createdAt: "2026-06-15T10:30:00.000Z",
};

describe("ReceiptScreen (spec Part 5.3)", () => {
  beforeEach(() => {
    window.print = vi.fn();
  });

  it("shows the order number and total", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    expect(screen.getAllByText(/GTS-202609-000143/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₦30,000/).length).toBeGreaterThan(0);
  });

  it("triggers the browser print dialog on Print Receipt", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /print receipt/i }));
    expect(window.print).toHaveBeenCalled();
  });

  it("opens a wa.me share link on Share via WhatsApp", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /share via whatsapp/i }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/"), "_blank");
    openSpy.mockRestore();
  });

  it("clears the cart and returns to search on New Transaction", () => {
    const onNewTransaction = vi.fn();
    render(<ReceiptScreen sale={SALE} onNewTransaction={onNewTransaction} />);
    fireEvent.click(screen.getByRole("button", { name: /new transaction/i }));
    expect(onNewTransaction).toHaveBeenCalled();
  });
});
