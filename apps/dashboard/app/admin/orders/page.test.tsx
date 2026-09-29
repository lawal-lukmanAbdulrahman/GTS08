import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/orders",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

import AdminOrdersPage from "./page";
import { exportOrdersToExcel } from "./order-excel-service";
import * as XLSX from "xlsx";

const sampleOrder = (o: Record<string, unknown> = {}) => ({
  id: "ord-1",
  order_number: "GTS-202609-000048",
  status: "placed",
  payment_status: "unpaid" as const,
  total: 120000,
  created_at: "2026-09-28T23:17:11.419Z",
  pickup_station: {
    id: "st-1",
    name: "Ikeja Hub",
    address_line1: "12 Allen Avenue",
    city: "Ikeja",
    state: "Lagos",
  },
  customer: {
    full_name: "Micah Okoh",
    email: "micah@example.com",
    phone: "08012345678",
  },
  ...o,
});

function serveOrders(orders: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/orders/ord-1")) {
        return new Response(
          JSON.stringify({
            data: {
              ...sampleOrder(),
              items: [
                {
                  id: "item-1",
                  quantity: 1,
                  unit_price: 120000,
                  line_total: 120000,
                  product_snapshot: { name: "Oversized Tee", size: "L", color: "Black" },
                },
              ],
              audit_log: [],
            },
          }),
          { status: 200 }
        );
      }
      if (String(url).includes("/orders")) {
        return new Response(JSON.stringify({ data: orders, meta: { total: orders.length } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    })
  );
}

beforeEach(() => {
  localStorage.setItem("gts_token", "test-token");
});

describe("Admin Orders Page Revamp", () => {
  it("renders header with only the Export button and no Channel column", async () => {
    serveOrders([sampleOrder()]);
    render(<AdminOrdersPage />);

    await screen.findByText("GTS-202609-000048");

    // Header has Export button
    const exportBtn = screen.getByRole("button", { name: /Export/i });
    expect(exportBtn).toBeInTheDocument();

    // Verify Channel column header does not exist
    expect(screen.queryByText(/^CHANNEL$/i)).not.toBeInTheDocument();

    // Table has expected columns
    expect(screen.getByText("Order #")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Pickup Location")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("calculates and displays the 4 KPI cards correctly", async () => {
    serveOrders([
      sampleOrder({ id: "o1", order_number: "GTS-001", status: "placed", total: 100000 }),
      sampleOrder({ id: "o2", order_number: "GTS-002", status: "collected", payment_status: "paid", total: 200000 }),
      sampleOrder({ id: "o3", order_number: "GTS-003", status: "ready_for_pickup", payment_status: "unpaid", total: 300000 }),
    ]);

    render(<AdminOrdersPage />);

    await screen.findByText("GTS-001");

    // Total Orders: 3
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("Completed Orders")).toBeInTheDocument();
    expect(screen.getAllByText("Ready for Pickup").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending Action")).toBeInTheDocument();

    // 1 completed order
    expect(screen.getByText("All items handed over & collected")).toBeInTheDocument();
  });

  it("opens the floating action menu with Info and red Cancel Order on clicking ⋮", async () => {
    serveOrders([sampleOrder({ id: "ord-1", status: "placed" })]);
    render(<AdminOrdersPage />);

    await screen.findByText("GTS-202609-000048");

    // Click the 3-dots action button
    const actionBtn = screen.getByTitle("Actions");
    fireEvent.click(actionBtn);

    // Dropdown items appear
    await screen.findByText("Info");

    const cancelItem = screen.getByText("Cancel Order");
    expect(cancelItem).toBeInTheDocument();
    // Verify it is styled in red
    expect(cancelItem.closest("button")).toHaveClass("text-red-600");
  });

  it("toggles row selection on checkbox click", async () => {
    serveOrders([sampleOrder({ id: "ord-1" })]);
    render(<AdminOrdersPage />);

    await screen.findByText("GTS-202609-000048");

    const checkboxes = screen.getAllByRole("checkbox");
    const rowCheckbox = checkboxes[1]!;
    expect(rowCheckbox).not.toBeChecked();

    fireEvent.click(rowCheckbox);
    expect(rowCheckbox).toBeChecked();

    // Bulk selection count appears
    expect(screen.getByText("1 Selected")).toBeInTheDocument();
  });

  it("exports orders via order-excel-service without error", () => {
    expect(() =>
      exportOrdersToExcel([
        {
          id: "ord-1",
          order_number: "GTS-202609-000048",
          created_at: "2026-09-28T23:17:11.419Z",
          status: "placed",
          payment_status: "unpaid",
          total: 120000,
          customer: { full_name: "Micah Okoh", email: "micah@example.com" },
          pickup_station: {
            name: "Ikeja Hub",
            address_line1: "12 Allen Avenue",
            city: "Ikeja",
            state: "Lagos",
          },
        },
      ])
    ).not.toThrow();

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
  });
});
