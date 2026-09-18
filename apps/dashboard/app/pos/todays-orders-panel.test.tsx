import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TodaysOrdersPanel from "./todays-orders-panel";

const ORDERS = [
  {
    id: "o1",
    order_number: "GTS-202609-000001",
    status: "completed" as const,
    total: 3000000,
    created_at: new Date().toISOString(),
    items: [{ id: "oi1", quantity: 2, unit_price: 1500000, line_total: 3000000, product_snapshot: { name: "Shirt" } }],
  },
  {
    id: "o2",
    order_number: "GTS-202609-000002",
    status: "voided" as const,
    total: 800000,
    created_at: new Date().toISOString(),
    items: [],
  },
];

describe("TodaysOrdersPanel (spec Part 6)", () => {
  it("lists each order with its number, total, and status", () => {
    render(<TodaysOrdersPanel orders={ORDERS} onVoid={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Voided")).toBeInTheDocument();
  });

  it("offers Void when a completed order is expanded", () => {
    render(<TodaysOrdersPanel orders={ORDERS} onVoid={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("GTS-202609-000001"));
    expect(screen.getByRole("button", { name: /void order/i })).toBeInTheDocument();
  });

  it("does not offer Void on an already-voided order", () => {
    render(<TodaysOrdersPanel orders={ORDERS} onVoid={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("GTS-202609-000002"));
    expect(screen.queryByRole("button", { name: /void order/i })).not.toBeInTheDocument();
  });

  it("asks for a reason and confirms before calling onVoid", () => {
    const onVoid = vi.fn();
    render(<TodaysOrdersPanel orders={ORDERS} onVoid={onVoid} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("GTS-202609-000001"));
    fireEvent.click(screen.getByRole("button", { name: /void order/i }));
    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: "wrong item scanned" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm void/i }));
    expect(onVoid).toHaveBeenCalledWith("o1", "wrong item scanned");
  });
});
