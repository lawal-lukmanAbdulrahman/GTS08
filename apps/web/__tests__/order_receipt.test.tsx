import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrderReceipt from "../app/(storefront)/_components/order-receipt";

const ORDER = {
  order_number: "GTS-202609-000050",
  paid: true,
  subtotal: 3100000,
  delivery_fee: 150000,
  discount_amount: 0,
  total: 3250000,
  created_at: "2026-09-20T10:00:00Z",
  items: [
    { name: "GTS Oxford Shirt", size: "M", color: "Black", quantity: 2, unit_price: 1550000, line_total: 3100000 },
    { name: "Denim Jacket", size: null, color: null, quantity: 1, unit_price: 4500000, line_total: 4500000 },
  ],
};

describe("OrderReceipt (the online confirmation, in the shop's receipt format)", () => {
  it("opens with the shop name and phone, then Date and Receipt No", () => {
    render(<OrderReceipt order={ORDER} />);
    expect(screen.getByText("GTS WEARS")).toBeInTheDocument();
    expect(screen.getByText("08148308129")).toBeInTheDocument();
    expect(screen.getByText(/Date:/)).toBeInTheDocument();
    expect(screen.getByText("GTS-202609-000050")).toBeInTheDocument();
  });

  it("lists Qty, Description, Unit price and Amount", () => {
    render(<OrderReceipt order={ORDER} />);
    const table = screen.getByRole("table");
    for (const h of ["Qty", "Description", "Unit price", "Amount"]) expect(within(table).getByText(h)).toBeInTheDocument();
    const row = within(table).getByText("GTS Oxford Shirt").closest("tr")!;
    expect(row).toHaveTextContent("2");
    expect(row).toHaveTextContent("M / Black");
    expect(row).toHaveTextContent("₦15,500");
    expect(row).toHaveTextContent("₦31,000");
  });

  it("shows delivery and the total, all from the server's kobo figures", () => {
    render(<OrderReceipt order={ORDER} />);
    expect(screen.getByText(/Delivery/)).toBeInTheDocument();
    expect(screen.getByTestId("receipt-total")).toHaveTextContent("₦32,500");
  });

  it("only shows a discount line when there was one", () => {
    const { rerender } = render(<OrderReceipt order={ORDER} />);
    expect(screen.queryByText(/Discount/)).not.toBeInTheDocument();
    rerender(<OrderReceipt order={{ ...ORDER, discount_amount: 100000, total: 3150000 }} />);
    expect(screen.getByText(/Discount/)).toBeInTheDocument();
  });

  it("uses the name, phone and website from Store Details when given", () => {
    render(<OrderReceipt order={ORDER} store={{ name: "GTS Menswear", phone: "0803 111 2222", website: "https://gtswears.com/" }} />);
    expect(screen.getByText("GTS MENSWEAR")).toBeInTheDocument();
    expect(screen.getByText("0803 111 2222")).toBeInTheDocument();
    expect(screen.getByText("Order also: gtswears.com")).toBeInTheDocument();
  });

  it("ends with the thanks and the website to order from", () => {
    render(<OrderReceipt order={ORDER} />);
    expect(screen.getByText("Thanks for your patronage.")).toBeInTheDocument();
    expect(screen.getByText("Order also: www.GTS08.com")).toBeInTheDocument();
  });
});
