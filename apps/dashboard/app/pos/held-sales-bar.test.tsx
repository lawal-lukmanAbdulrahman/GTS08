import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import HeldSalesBar from "./held-sales-bar";
import type { HeldSale } from "./held-sales";

const held = (id: string, qty: number, price = 1000): HeldSale => ({
  id,
  heldAt: "2026-09-20T10:15:00Z",
  discountText: "",
  lines: [{ variantId: "v" + id, productId: "p", productName: "Shirt", size: null, color: null, unitPrice: price, quantity: qty, available: 9 }],
});

describe("HeldSalesBar", () => {
  it("renders nothing when nothing is held", () => {
    const { container } = render(<HeldSalesBar sales={[]} onResume={vi.fn()} onDiscard={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists held sales with units and total, and resumes one", () => {
    const onResume = vi.fn();
    render(<HeldSalesBar sales={[held("a", 2, 150000), held("b", 1)]} onResume={onResume} onDiscard={vi.fn()} />);
    expect(screen.getByText(/held sales \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();
    expect(screen.getByText("₦3,000")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /resume/i })[0]!);
    expect(onResume).toHaveBeenCalledWith("a");
  });

  it("discards one", () => {
    const onDiscard = vi.fn();
    render(<HeldSalesBar sales={[held("a", 1)]} onResume={vi.fn()} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledWith("a");
  });
});
