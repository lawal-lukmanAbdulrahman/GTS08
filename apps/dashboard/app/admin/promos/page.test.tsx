import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

const apiCall = vi.fn();
vi.mock("../../lib/staff-api", () => ({ apiCall: (...a: unknown[]) => apiCall(...a) }));
vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));

import PromosPage from "./page";

const PROMO = { id: "p1", code: "WELCOME10", discount_type: "percentage", discount_value: 10, min_order_amount: 0, max_uses: null, used_count: 3, starts_at: "2020-01-01T00:00:00Z", expires_at: null, is_active: true };
const ok = (data: unknown) => Promise.resolve({ ok: true, status: 200, data });
const fail = (message: string, details?: Record<string, string>) => Promise.resolve({ ok: false, status: 400, message, details });

beforeEach(() => {
  apiCall.mockReset().mockImplementation((path: string, init?: { method?: string }) => (path === "/promos" && !init?.method ? ok([PROMO]) : ok(PROMO)));
});

describe("Promo codes page", () => {
  it("lists the codes with what they do, how used, and whether they're live", async () => {
    render(<PromosPage />);
    const row = (await screen.findByText("WELCOME10")).closest("tr")!;
    expect(row).toHaveTextContent("10% off");
    expect(row).toHaveTextContent("3 used");
    expect(row).toHaveTextContent("Live");
  });

  it("creates a code, sending naira as kobo, then shows the list again", async () => {
    render(<PromosPage />);
    await screen.findByText("WELCOME10");
    fireEvent.change(screen.getByLabelText(/^code/i), { target: { value: "flat5k" } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "fixed_amount" } });
    fireEvent.change(screen.getByLabelText(/^amount/i), { target: { value: "5,000" } });
    fireEvent.click(screen.getByRole("button", { name: /create code/i }));
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith("/promos", { method: "POST", json: { code: "flat5k", discount_type: "fixed_amount", discount_value: 500000 } }));
  });

  it("shows what's wrong without calling the server, then the server's field errors", async () => {
    render(<PromosPage />);
    await screen.findByText("WELCOME10");
    fireEvent.click(screen.getByRole("button", { name: /create code/i }));
    expect(await screen.findByText(/enter a code/i)).toBeInTheDocument();
    expect(apiCall).not.toHaveBeenCalledWith("/promos", expect.objectContaining({ method: "POST" }));

    apiCall.mockImplementation((path: string, init?: { method?: string }) => (init?.method === "POST" ? fail("That code already exists.", { code: "Already in use." }) : ok([PROMO])));
    fireEvent.change(screen.getByLabelText(/^code/i), { target: { value: "WELCOME10" } });
    fireEvent.change(screen.getByLabelText(/^percent/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /create code/i }));
    expect(await screen.findByText("Already in use.")).toBeInTheDocument();
  });

  it("switches a code off, and deletes only one that has never been used", async () => {
    render(<PromosPage />);
    const row = (await screen.findByText("WELCOME10")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /switch off/i }));
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith("/promos/p1/activate", { method: "PUT", json: { is_active: false } }));
    expect(within(row).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("deletes an unused code after confirming", async () => {
    apiCall.mockImplementation((path: string, init?: { method?: string }) => (path === "/promos" && !init?.method ? ok([{ ...PROMO, used_count: 0 }]) : ok({})));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PromosPage />);
    const row = (await screen.findByText("WELCOME10")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith("/promos/p1", { method: "DELETE" }));
  });

  it("says so when the list can't be loaded, and offers to try again", async () => {
    apiCall.mockResolvedValue({ ok: false, status: 500, message: "Something went wrong." });
    render(<PromosPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
