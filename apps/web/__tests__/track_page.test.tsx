import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseAuth = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("../app/(storefront)/_components/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("../app/(storefront)/_components/landing/footer", () => ({
  Footer: () => null,
}));

vi.mock("../app/(storefront)/_lib/store-info", () => ({
  useStoreInfo: () => ({ store_name: "GTS", store_address: "12 Allen Ave" }),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqr"),
  },
}));

import TrackOrderPage from "../app/(storefront)/track/page";

describe("TrackOrderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com" },
      customer: { email: "customer@example.com", full_name: "Customer Name" },
      isLoading: false,
    });
  });

  it("prefills the email field with the logged-in customer email", async () => {
    render(<TrackOrderPage />);
    const emailInput = screen.getByPlaceholderText("email@example.com") as HTMLInputElement;
    expect(emailInput.value).toBe("customer@example.com");
    expect(screen.getByText(/Logged In/i)).toBeInTheDocument();
  });

  it("updates the email field when auth finishes loading after initial render", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      customer: null,
      isLoading: true,
    });

    const { rerender } = render(<TrackOrderPage />);
    const emailInput = screen.getByPlaceholderText("email@example.com") as HTMLInputElement;
    expect(emailInput.value).toBe("");

    // Auth completes and provides user
    mockUseAuth.mockReturnValue({
      user: { email: "okohmicah00@gmail.com" },
      customer: null,
      isLoading: false,
    });

    rerender(<TrackOrderPage />);

    await waitFor(() => {
      expect(emailInput.value).toBe("okohmicah00@gmail.com");
    });
    expect(screen.getByText(/Logged In/i)).toBeInTheDocument();
  });

  it("renders 2-step WhatsApp timeline, collection pass, and guidance for WhatsApp orders", async () => {
    const params = new URLSearchParams();
    params.set("order_number", "GTS-WA-1001");
    params.set("email", "customer@example.com");
    mockSearchParams.mockReturnValue(params);

    const mockWhatsAppOrder = {
      id: "wa-order-1",
      order_number: "GTS-WA-1001",
      status: "placed",
      channel: "whatsapp",
      payment_status: "unpaid",
      subtotal: 750000,
      delivery_fee: 0,
      total: 750000,
      created_at: "2026-09-29T10:00:00Z",
      tracking_number: "749201",
      pickup_deadline: "2026-10-01T10:00:00Z",
      items: [
        {
          id: "item-1",
          quantity: 2,
          unit_price: 375000,
          line_total: 750000,
          product_snapshot: { name: "Silk Shirt", image: "/shirt.jpg" },
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockWhatsAppOrder }),
    });
    global.fetch = fetchMock as any;

    render(<TrackOrderPage />);

    await waitFor(() => {
      expect(screen.getByText("WhatsApp Collection Pass")).toBeInTheDocument();
    });

    // Verify 6-digit PIN is displayed (in pass card and in instructions)
    expect(screen.getAllByText("749 201").length).toBeGreaterThanOrEqual(2);

    // Verify WhatsApp 2-step timeline is used
    expect(screen.getByText("Collect at Store")).toBeInTheDocument();
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready for Pickup")).not.toBeInTheDocument();

    // Verify WhatsApp fulfillment and payment status badges
    expect(screen.getByText("Ready for In-Store Pickup")).toBeInTheDocument();
    expect(screen.getByText("Payment Due at Pickup")).toBeInTheDocument();

    // Verify guidance instructions
    expect(screen.getByText("How to collect your order:")).toBeInTheDocument();
  });

  it("renders standard 4-step timeline for web storefront orders", async () => {
    const params = new URLSearchParams();
    params.set("order_number", "GTS-WEB-2002");
    params.set("email", "customer@example.com");
    mockSearchParams.mockReturnValue(params);

    const mockWebOrder = {
      id: "web-order-1",
      order_number: "GTS-WEB-2002",
      status: "ready_for_pickup",
      channel: "storefront",
      payment_status: "paid",
      subtotal: 1200000,
      delivery_fee: 0,
      total: 1200000,
      created_at: "2026-09-29T08:00:00Z",
      tracking_number: "123456",
      pickup_deadline: "2026-10-01T08:00:00Z",
      items: [],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockWebOrder }),
    });
    global.fetch = fetchMock as any;

    render(<TrackOrderPage />);

    await waitFor(() => {
      expect(screen.getByText("Pickup Collection Pass")).toBeInTheDocument();
    });

    // 4-step timeline
    expect(screen.getByText("Order Placed")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Ready for Pickup")).toBeInTheDocument();
    expect(screen.getByText("Collected")).toBeInTheDocument();
    expect(screen.queryByText("Collect at Store")).not.toBeInTheDocument();
  });
});
