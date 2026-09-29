import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminSalesPage from "./page";
import * as excelService from "./sale-excel-service";
import * as receiptPdf from "../../pos/receipt-pdf";

// Mock dependencies
vi.mock("../sidebar-context", () => ({
  AdminTopStrip: () => <div data-testid="top-strip" />,
}));

vi.mock("../../lib/session", () => ({
  authFetch: vi.fn(),
}));

const MOCK_SALES: excelService.SaleRecordItem[] = [
  {
    id: "sale-1",
    order_number: "GTS-202609-000001",
    channel: "walk_in",
    status: "completed",
    payment_status: "paid",
    payment_method: "cash",
    total: 2500000,
    subtotal: 3000000,
    discount_amount: 500000,
    created_at: "2026-09-19T10:00:00Z",
    customer: null,
    items: [
      {
        id: "i1",
        quantity: 2,
        unit_price: 1500000,
        line_total: 3000000,
        product_snapshot: { name: "Oxford Cotton Shirt", size: "L", color: "White" },
      },
    ],
    cashier_name: "Ada Obi",
  },
  {
    id: "sale-2",
    order_number: "GTS-202609-000002",
    channel: "whatsapp",
    status: "collected",
    payment_status: "paid",
    payment_method: "pos_terminal",
    total: 1000000,
    subtotal: 1000000,
    discount_amount: 0,
    created_at: "2026-09-20T14:30:00Z",
    internal_notes: "WhatsApp customer: Ngozi Eze (08031234567)",
    customer: { full_name: "Ngozi Eze", phone: "08031234567" },
    items: [
      {
        id: "i2",
        quantity: 1,
        unit_price: 1000000,
        line_total: 1000000,
        product_snapshot: { name: "Graphic Tee", size: "M", color: "Black" },
      },
    ],
    cashier_name: "Emeka Okoro",
  },
  {
    id: "sale-3",
    order_number: "GTS-202609-000003",
    channel: "online",
    status: "confirmed",
    payment_status: "paid",
    payment_method: "paystack",
    total: 4500000,
    subtotal: 4500000,
    discount_amount: 0,
    created_at: "2026-09-21T09:15:00Z",
    customer: { full_name: "Babatunde Lawal", email: "tunde@example.com", phone: "08099887766" },
    items: [
      {
        id: "i3",
        quantity: 3,
        unit_price: 1500000,
        line_total: 4500000,
        product_snapshot: { name: "Chino Trousers", size: "32", color: "Navy" },
      },
    ],
  },
];

describe("AdminSalesPage (Sales Overview Log Book)", () => {
  beforeEach(async () => {
    const { authFetch } = await import("../../lib/session");
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: MOCK_SALES }),
    } as any);
  });

  it("renders page header and subtitle", async () => {
    render(<AdminSalesPage />);
    expect(screen.getByRole("heading", { name: "Sales Overview" })).toBeInTheDocument();
    expect(
      screen.getByText(/a log book of all sales made across walk-in, whatsapp, and storefront channels/i)
    ).toBeInTheDocument();
  });

  it("renders 4 KPI summary cards with revenue figures and counts", async () => {
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("Total Sales Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText("Walk-in Store Sales")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp Orders")).toBeInTheDocument();
    expect(screen.getByText("Storefront (Online)")).toBeInTheDocument();
    expect(screen.getByText("3 Total Sales Recorded")).toBeInTheDocument();
  });

  it("renders sales log book table with unique IDs, channels, and customer info", async () => {
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
    });
    expect(screen.getByText("GTS-202609-000002")).toBeInTheDocument();
    expect(screen.getByText("GTS-202609-000003")).toBeInTheDocument();

    // Channel Badges
    expect(screen.getAllByText("Walk-in").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WhatsApp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Storefront").length).toBeGreaterThan(0);

    // Customer details
    expect(screen.getByText("Walk-in Guest")).toBeInTheDocument();
    expect(screen.getByText("Ngozi Eze")).toBeInTheDocument();
    expect(screen.getByText("Babatunde Lawal")).toBeInTheDocument();
  });

  it("has no action dropdown, but provides single View Sale buttons", async () => {
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole("button", { name: /view sale/i });
    expect(viewButtons.length).toBe(3);
    // Ensure no 3-dot dropdown exists
    expect(screen.queryByLabelText(/more actions/i)).not.toBeInTheDocument();
  });

  it("opens side panel drawer when clicking View Sale button and allows receipt download", async () => {
    const downloadSpy = vi.spyOn(receiptPdf, "fetchAndDownloadReceipt").mockResolvedValue({ ok: true });
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("GTS-202609-000002")).toBeInTheDocument();
    });

    // Click "View Sale" for WhatsApp order
    const viewButtons = screen.getAllByRole("button", { name: /view sale/i });
    fireEvent.click(viewButtons[1]!);

    // Drawer is now open
    expect(screen.getByRole("button", { name: /download receipt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print receipt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share via whatsapp/i })).toBeInTheDocument();
    expect(screen.getAllByText("Graphic Tee").length).toBeGreaterThan(0);

    // Click Download Receipt
    fireEvent.click(screen.getByRole("button", { name: /download receipt/i }));
    expect(downloadSpy).toHaveBeenCalledWith("sale-2");
  });

  it("filters sales by channel when clicking KPI cards or channel pills", async () => {
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
    });

    // Click WhatsApp KPI card
    fireEvent.click(screen.getByText("WhatsApp Orders"));

    // Only WhatsApp order remains
    expect(screen.queryByText("GTS-202609-000001")).not.toBeInTheDocument();
    expect(screen.getByText("GTS-202609-000002")).toBeInTheDocument();
    expect(screen.queryByText("GTS-202609-000003")).not.toBeInTheDocument();
  });

  it("searches sales by order number, customer name, or phone", async () => {
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "Babatunde" } });

    expect(screen.queryByText("GTS-202609-000001")).not.toBeInTheDocument();
    expect(screen.queryByText("GTS-202609-000002")).not.toBeInTheDocument();
    expect(screen.getByText("GTS-202609-000003")).toBeInTheDocument();
  });

  it("triggers Excel export of sales", async () => {
    const exportSpy = vi.spyOn(excelService, "exportSalesToExcel").mockImplementation(() => {});
    render(<AdminSalesPage />);
    await waitFor(() => {
      expect(screen.getByText("GTS-202609-000001")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /export sales/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalled();
  });
});
