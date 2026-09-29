import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (p: { alt: string }) => <img alt={p.alt} /> }));
vi.mock("../app/(storefront)/_components/landing/footer", () => ({ Footer: () => null }));

const cart = { cartItems: [] as any[], clearCart: vi.fn(), hydrated: true };
vi.mock("../app/(storefront)/_components/cart-context", () => ({ useCart: () => cart }));
vi.mock("../app/(storefront)/_components/auth-context", () => ({ useAuth: () => ({ user: null, customer: null }) }));
vi.mock("../app/(storefront)/_components/auth-modal-context", () => ({ useAuthModal: () => ({ openAuthModal: vi.fn() }) }));
vi.mock("../app/(storefront)/_lib/use-checkout-quote", () => ({
  useCheckoutQuote: () => ({ quote: { lines: [], subtotal: 3_100_000, delivery_fees: { door: 0, pickup: 0, express: 0 }, all_available: true }, error: null }),
}));
vi.mock("../app/(storefront)/_lib/store-info", () => ({
  useStoreInfo: () => ({ store_name: "GTS Wears", store_address: "12 Allen Avenue, Ikeja", support_phone: "0814", whatsapp_number: null, support_email: "a@b.co", pickup_hold_hours: 24 }),
}));
const idempotentFetch = vi.fn();
vi.mock("@gts/utils", async (orig) => ({ ...(await orig<typeof import("@gts/utils")>()), idempotentFetch: (...a: unknown[]) => idempotentFetch(...a) }));

import CheckoutPage from "../app/(storefront)/checkout/page";

const ITEM = { product: { id: "oxford-shirt", title: "Oxford Shirt", image: "/x.png", priceNum: 15500 }, size: "M", color: "Blue", quantity: 2 };

async function fillDetails() {
  await waitFor(() => expect(screen.getByRole("radio", { name: /GTS Wears/i })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Obi" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "08012345678" } });
}

const DEFAULT_STATION = {
  id: "st-1",
  name: "GTS Wears",
  address_line1: "12 Allen Avenue, Ikeja",
  address_line2: null,
  city: "Ikeja",
  state: "Lagos",
  phone: "0814",
  operating_hours: "Mon - Sat: 9:00 AM - 6:00 PM",
  is_active: true,
  is_default: true,
};

beforeEach(() => {
  replace.mockReset();
  cart.cartItems = [ITEM];
  cart.hydrated = true;
  cart.clearCart = vi.fn();
  idempotentFetch.mockReset();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/v1/pickup-stations")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: [DEFAULT_STATION] }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

describe("checkout", () => {
  it("disables ordering when no pickup stations are configured", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/pickup-stations")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<CheckoutPage />);
    expect(await screen.findByText(/No pickup stations available/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place order/i })).toBeDisabled();
    expect(screen.getByText(/Orders disabled: Store has no pickup stations configured/i)).toBeInTheDocument();
  });
  it("offers pay on pickup, with where and how long the items are held", () => {
    render(<CheckoutPage />);
    const pickup = screen.getByRole("radio", { name: /pay on pickup/i });
    expect(pickup).toBeChecked();
    expect(screen.getByText(/12 Allen Avenue, Ikeja/)).toBeInTheDocument();
    expect(screen.getByText(/24 hours/)).toBeInTheDocument();
  });

  it("shows pay now as unavailable for now", () => {
    render(<CheckoutPage />);
    const payNow = screen.getByRole("radio", { name: /pay now/i });
    expect(payNow).toBeDisabled();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it("asks for contact details only: no delivery address", () => {
    render(<CheckoutPage />);
    expect(screen.queryByLabelText(/address/i)).not.toBeInTheDocument();
  });

  it("places a pay-on-pickup order, empties the cart and shows where, what and by when", async () => {
    idempotentFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { order_number: "GTS-202609-000010", total: 3_100_000, pickup: { deadline: "2026-09-29T14:00:00Z", address: "12 Allen Avenue, Ikeja", store_name: "GTS Wears", hold_hours: 24 } } }), { status: 200 }));
    render(<CheckoutPage />);
    await fillDetails();
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    expect(await screen.findByText("GTS-202609-000010")).toBeInTheDocument();
    const [url, init] = idempotentFetch.mock.calls[0]!;
    expect(url).toBe("/api/v1/checkout");
    expect(JSON.parse(init.body)).toMatchObject({ fulfilment: "pickup", paymentMethod: "pay_on_pickup", customer: { email: "ada@example.com", fullName: "Ada Obi", phone: "08012345678" } });
    expect(JSON.parse(init.body).address).toBeUndefined();
    expect(cart.clearCart).toHaveBeenCalled();
    expect(screen.getByText(/₦31,000/)).toBeInTheDocument();
    expect(screen.getByText(/29 Sept 2026|29 Sep 2026/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("won't place the order until the contact details are filled in", () => {
    render(<CheckoutPage />);
    expect(screen.getByRole("button", { name: /place order/i })).toBeDisabled();
  });

  it("shows the server's reason when the order can't be placed", async () => {
    idempotentFetch.mockResolvedValue(new Response(JSON.stringify({ error: "One or more items no longer have enough stock." }), { status: 409 }));
    render(<CheckoutPage />);
    await fillDetails();
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enough stock/);
    expect(cart.clearCart).not.toHaveBeenCalled();
  });

  it("goes straight back to the product listing when the cart is empty", async () => {
    cart.cartItems = [];
    render(<CheckoutPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/search"));
  });

  it("waits for the cart to load before deciding it's empty", () => {
    cart.cartItems = [];
    cart.hydrated = false;
    render(<CheckoutPage />);
    expect(replace).not.toHaveBeenCalled();
  });
});
