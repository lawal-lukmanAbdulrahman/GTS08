import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const apiCall = vi.fn();
vi.mock("../../lib/staff-api", () => ({ apiCall: (...a: unknown[]) => apiCall(...a) }));
vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import PromosPage from "./page";

const PROMO = {
  id: "p1",
  code: "WELCOME10",
  discount_type: "percentage",
  discount_value: 10,
  min_order_amount: 0,
  max_uses: null,
  used_count: 3,
  starts_at: "2020-01-01T00:00:00Z",
  expires_at: null,
  is_active: true,
  target_type: "all",
  product_scope: "all",
  max_uses_per_customer: 1,
};

const ok = (data: unknown) => Promise.resolve({ ok: true, status: 200, data });

beforeEach(() => {
  apiCall.mockReset().mockImplementation((path: string, init?: { method?: string }) => {
    if (path === "/promos" && !init?.method) return ok([PROMO]);
    if (path === "/promos/p1" && !init?.method) return ok(PROMO);
    return ok(PROMO);
  });
});

describe("Promo codes page", () => {
  it("lists the codes with what they do, how used, and whether they're live", async () => {
    render(<PromosPage />);
    const row = (await screen.findByText("WELCOME10")).closest("tr")!;
    expect(row).toHaveTextContent("10% OFF");
    expect(row).toHaveTextContent("3 used");
    expect(row).toHaveTextContent("Live");
  });

  it("opens the create drawer with un-prefilled fields and disabled save button until completed", async () => {
    render(<PromosPage />);
    await screen.findByText("WELCOME10");
    const createBtn = screen.getByRole("button", { name: /create promo code/i });
    fireEvent.click(createBtn);
    expect(await screen.findByRole("heading", { name: /create promo code/i })).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /save & launch promo code/i });
    expect(saveBtn).toBeDisabled();
  });

  it("filters promo codes by search query", async () => {
    render(<PromosPage />);
    await screen.findByText("WELCOME10");
    const searchInput = screen.getByPlaceholderText(/search code/i);
    fireEvent.change(searchInput, { target: { value: "NONEXISTENT" } });
    expect(screen.queryByText("WELCOME10")).not.toBeInTheDocument();
    expect(screen.getByText(/no promo codes found/i)).toBeInTheDocument();
  });

  it("opens the detail drawer when clicking a promo row", async () => {
    render(<PromosPage />);
    const promoCode = await screen.findByText("WELCOME10");
    fireEvent.click(promoCode);
    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith("/promos/p1");
    });
  });

  it("says so when the list can't be loaded", async () => {
    apiCall.mockResolvedValue({ ok: false, status: 500, message: "Something went wrong." });
    render(<PromosPage />);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
