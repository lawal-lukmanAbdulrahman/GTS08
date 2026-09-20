import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

let params = new URLSearchParams("reference=gts_11111111-1111-4111-8111-111111111111");
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const clearCart = vi.fn();
vi.mock("../app/(storefront)/_components/cart-context", () => ({ useCart: () => ({ clearCart }) }));
const claimAccount = vi.fn();
let user: unknown = null;
vi.mock("../app/(storefront)/_components/auth-context", () => ({ useAuth: () => ({ user, claimAccount }) }));

let status: { state: string; order: unknown } = { state: "waiting", order: null };
vi.mock("../app/(storefront)/_lib/use-payment-status", () => ({ usePaymentStatus: () => status }));

import CompleteView from "../app/(storefront)/checkout/complete/complete-view";

const ORDER = { order_number: "GTS-1", paid: true, total: 100, delivery_fee: 0, items: [{ name: "Shirt", size: null, color: null, quantity: 1, unit_price: 100, line_total: 100 }], created_at: "2026-09-20T10:00:00Z" };

beforeEach(() => {
  clearCart.mockReset();
  claimAccount.mockReset();
  user = null;
  params = new URLSearchParams("reference=gts_11111111-1111-4111-8111-111111111111");
  sessionStorage.clear();
});

describe("checkout completion page", () => {
  it("waits for confirmation without claiming success, and keeps the cart", () => {
    status = { state: "waiting", order: null };
    render(<CompleteView />);
    expect(screen.getByRole("status")).toHaveTextContent(/confirming your payment/i);
    expect(screen.queryByText(/payment received/i)).not.toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("shows the receipt and empties the cart only once the server says it's paid", () => {
    status = { state: "paid", order: ORDER };
    render(<CompleteView />);
    expect(screen.getByRole("heading", { name: /payment received/i })).toBeInTheDocument();
    expect(screen.getByText("Order also: www.GTS08.com")).toBeInTheDocument();
    expect(clearCart).toHaveBeenCalledTimes(1);
  });

  it("says it's still pending, and doesn't claim success or touch the cart, if confirmation never arrives", () => {
    status = { state: "pending", order: { ...ORDER, paid: false } };
    render(<CompleteView />);
    expect(screen.getByText(/haven.t received confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText(/payment received/i)).not.toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("explains an unknown or missing reference and leaves the cart alone", () => {
    status = { state: "not_found", order: null };
    render(<CompleteView />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t find that payment/i);
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("lets a guest turn the order's email into an account, after payment", async () => {
    sessionStorage.setItem("gts_last_checkout", JSON.stringify({ email: "bola@example.com", fullName: "Bola A", phone: "0801" }));
    claimAccount.mockResolvedValue({ error: null });
    status = { state: "paid", order: ORDER };
    render(<CompleteView />);
    fireEvent.change(screen.getByLabelText(/choose a password/i), { target: { value: "longenough1" } });
    fireEvent.submit(screen.getByLabelText(/choose a password/i).closest("form")!);
    expect(claimAccount).toHaveBeenCalledWith("longenough1", { fullName: "Bola A", phone: "0801" });
    expect(await screen.findByText(/account saved/i)).toBeInTheDocument();
  });

  it("doesn't offer an account to someone already signed in", () => {
    user = { id: "u1" };
    sessionStorage.setItem("gts_last_checkout", JSON.stringify({ email: "bola@example.com", fullName: "Bola A", phone: "0801" }));
    status = { state: "paid", order: ORDER };
    render(<CompleteView />);
    expect(screen.queryByLabelText(/choose a password/i)).not.toBeInTheDocument();
  });
});
