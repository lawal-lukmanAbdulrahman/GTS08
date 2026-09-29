import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrderInfoDrawer from "./order-info-drawer";

const waOrder = {
  id: "ord-wa-1",
  order_number: "GTS-WA-0001",
  channel: "whatsapp",
  status: "placed",
  payment_status: "unpaid",
  total: 500000,
  subtotal: 500000,
  delivery_fee: 0,
  discount_amount: 0,
  pickup_deadline: "2026-10-01T12:00:00.000Z",
  created_at: "2026-09-29T10:00:00.000Z",
  customer: {
    full_name: "Adeola Balogun",
    email: "adeola@example.com",
    phone: "08099887766",
  },
  items: [
    {
      id: "it-1",
      quantity: 1,
      unit_price: 500000,
      line_total: 500000,
      product_snapshot: { name: "Agbada Silk" },
    },
  ],
};

const webOrder = {
  id: "ord-web-1",
  order_number: "GTS-WEB-0001",
  channel: "web",
  status: "placed",
  payment_status: "paid",
  total: 250000,
  subtotal: 250000,
  delivery_fee: 0,
  discount_amount: 0,
  created_at: "2026-09-29T08:00:00.000Z",
  customer: {
    full_name: "Chidi Nnamdi",
    email: "chidi@example.com",
    phone: "08011223344",
  },
  items: [],
};

describe("OrderInfoDrawer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 2-step pipeline and direct handover collection card for WhatsApp orders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/orders/ord-wa-1")) {
          return new Response(JSON.stringify({ data: waOrder }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      })
    );

    render(
      <OrderInfoDrawer
        orderId="ord-wa-1"
        isOpen={true}
        onClose={vi.fn()}
        onStatusUpdated={vi.fn()}
      />
    );

    // Wait for order to load
    await waitFor(() => {
      expect(screen.getAllByText("GTS-WA-0001")[0]).toBeInTheDocument();
    });

    // Check pipeline title and 2 steps
    expect(screen.getByText("WhatsApp Fulfillment Pipeline")).toBeInTheDocument();
    expect(screen.getAllByText("Placed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Collected")).toBeInTheDocument();
    expect(screen.queryByText("Ready for Pickup")).not.toBeInTheDocument();

    // Check WhatsApp handover card
    expect(screen.getByText(/WhatsApp Order · In-Store Collection/i)).toBeInTheDocument();
    expect(screen.getByText(/Hold deadline:/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment Due at Counter:/i)).toBeInTheDocument();
    expect(screen.getByText("POS Terminal")).toBeInTheDocument();
    expect(screen.getByText(/Customer 6-Digit Verification PIN/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collect ₦5,000 & Complete Handover/i })).toBeInTheDocument();

    // Backward step should NOT be present for WhatsApp orders
    expect(screen.queryByText(/Move back a step/i)).not.toBeInTheDocument();
    // Packaging button should NOT be present
    expect(screen.queryByText(/Confirm Order \(Start Packaging\)/i)).not.toBeInTheDocument();
  });

  it("completes WhatsApp handover when entering PIN and payment method", async () => {
    const fetchMock = vi.fn(async (url: string, _opts?: any) => {
      if (url.includes("/complete-pickup")) {
        return new Response(JSON.stringify({ data: { status: "collected" } }), { status: 200 });
      }
      if (url.includes("/orders/ord-wa-1")) {
        return new Response(JSON.stringify({ data: waOrder }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onStatusUpdated = vi.fn();
    render(
      <OrderInfoDrawer
        orderId="ord-wa-1"
        isOpen={true}
        onClose={vi.fn()}
        onStatusUpdated={onStatusUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("GTS-WA-0001")[0]).toBeInTheDocument();
    });

    // Select POS terminal as payment method
    fireEvent.click(screen.getByText("POS Terminal"));

    // Enter 6-digit PIN
    const pinInput = screen.getByPlaceholderText("e.g. 481 920");
    fireEvent.change(pinInput, { target: { value: "654321" } });

    // Click Complete Handover button
    const submitBtn = screen.getByRole("button", { name: /Collect ₦5,000 & Complete Handover/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/orders/ord-wa-1/complete-pickup"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            pickup_pin: "654321",
            mark_paid: true,
            payment_method: "pos",
          }),
        })
      );
    });
  });

  it("renders standard 4-step pipeline and packaging button for storefront web orders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/orders/ord-web-1")) {
          return new Response(JSON.stringify({ data: webOrder }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      })
    );

    render(
      <OrderInfoDrawer
        orderId="ord-web-1"
        isOpen={true}
        onClose={vi.fn()}
        onStatusUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("GTS-WEB-0001")).toBeInTheDocument();
    });

    // Check pipeline title and 4 steps
    expect(screen.getByText("Fulfillment Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
    expect(screen.getByText("Step 4")).toBeInTheDocument();

    // Placed web order has packaging button
    expect(screen.getByText(/Confirm Order \(Start Packaging\)/i)).toBeInTheDocument();
    // Does NOT show WhatsApp in-store collection
    expect(screen.queryByText(/WhatsApp Order · In-Store Collection/i)).not.toBeInTheDocument();
  });
});
