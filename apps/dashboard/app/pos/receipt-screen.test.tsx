import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReceiptScreen from "./receipt-screen";
import { PAPER_SIZES } from "./receipt-layout";
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
  paymentMethod: "cash",
  cashierName: "Chidinma O.",
  createdAt: "2026-06-15T10:30:00.000Z",
  channel: "walk_in",
  cashReceived: 5000000,
};

const WHATSAPP_SALE: CompletedSale = {
  ...SALE,
  channel: "whatsapp",
  customerName: "Ngozi A.",
  customerPhone: "08099998888",
};

function sheet(): HTMLElement {
  return document.querySelector(".receipt-sheet") as HTMLElement;
}
function sheetLines(): string[] {
  return sheet().textContent!.split("\n");
}
function pageRule(): string {
  const css = Array.from(document.querySelectorAll("style")).map((s) => s.textContent).join("\n");
  return css.match(/@page\s*{[^}]*}/)![0];
}

describe("ReceiptScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    window.print = vi.fn();
  });

  it("confirms the sale with its order number and total", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    expect(screen.getByText("Sale Complete!")).toBeInTheDocument();
    expect(screen.getAllByText(/GTS-202609-000143/).length).toBeGreaterThan(0);
  });

  it("previews the full receipt: items, totals, payment, and change", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    const text = sheet().textContent!;
    expect(text).toContain("GTS Oxford Shirt");
    expect(text).toContain("L / Black");
    expect(text).toContain("2 x ₦15,000");
    expect(text).toMatch(/TOTAL\s+₦30,000/);
    expect(text).toMatch(/Cash received\s+₦50,000/);
    expect(text).toMatch(/Change\s+₦20,000/);
    expect(text).toContain("Chidinma O.");
  });

  it("offers the three paper sizes, defaulting to 80mm", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    const group = screen.getByRole("group", { name: /paper size/i });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "58 mm roll",
      "80 mm roll",
      "A4 sheet",
    ]);
    expect(within(group).getByRole("button", { name: "80 mm roll" })).toHaveAttribute("aria-pressed", "true");
    expect(pageRule()).toMatch(/size:\s*80mm/);
  });

  it.each([
    ["58 mm roll", "58mm", /size:\s*58mm/],
    ["80 mm roll", "80mm", /size:\s*80mm/],
    ["A4 sheet", "a4", /size:\s*A4/],
  ] as const)("switching to %s re-lays the preview and print page for that paper", (label, paper, pageRe) => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    for (const l of sheetLines()) expect(l.length).toBeLessThanOrEqual(PAPER_SIZES[paper].chars);
    expect(sheetLines().some((l) => l === "=".repeat(PAPER_SIZES[paper].chars))).toBe(true);
    expect(pageRule()).toMatch(pageRe);
  });

  it("shrinks only the on-screen A4 preview so it fits a small screen, never the rolls", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    const preview = document.querySelector(".receipt-preview") as HTMLElement;
    expect(preview.style.zoom).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "A4 sheet" }));
    expect(preview.style.zoom).toBe("0.75");
    fireEvent.click(screen.getByRole("button", { name: "58 mm roll" }));
    expect(preview.style.zoom).toBe("1");
  });

  it("remembers the chosen paper for the next receipt", () => {
    const first = render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "58 mm roll" }));
    first.unmount();

    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "58 mm roll" })).toHaveAttribute("aria-pressed", "true");
    expect(pageRule()).toMatch(/size:\s*58mm/);
  });

  it("prints via the browser print dialog", () => {
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /print receipt/i }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("shows the WhatsApp customer on the receipt and shares straight to their number", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ReceiptScreen sale={WHATSAPP_SALE} onNewTransaction={vi.fn()} />);
    expect(sheet().textContent).toContain("Ngozi A.");
    fireEvent.click(screen.getByRole("button", { name: /share via whatsapp/i }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/2348099998888?text="), "_blank");
    openSpy.mockRestore();
  });

  it("opens an unaddressed WhatsApp chooser for walk-in sales (no phone known)", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ReceiptScreen sale={SALE} onNewTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /share via whatsapp/i }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/\?text=/), "_blank");
    openSpy.mockRestore();
  });

  it("clears the till for the next customer on New Transaction", () => {
    const onNewTransaction = vi.fn();
    render(<ReceiptScreen sale={SALE} onNewTransaction={onNewTransaction} />);
    fireEvent.click(screen.getByRole("button", { name: /new transaction/i }));
    expect(onNewTransaction).toHaveBeenCalled();
  });
});
