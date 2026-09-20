import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FindSalePanel, { type FoundSale } from "./find-sale-panel";

const SALE: FoundSale = { id: "o1", order_number: "GTS-202609-000123", channel: "walk_in", status: "completed", total: 3000000, created_at: "2026-09-18T10:30:00Z" };

function setup(over: Partial<React.ComponentProps<typeof FindSalePanel>> = {}) {
  const props = { onSearch: vi.fn().mockResolvedValue({ ok: true, data: [SALE] }), onReprint: vi.fn(), onClose: vi.fn(), ...over };
  render(<FindSalePanel {...props} />);
  return props;
}

describe("FindSalePanel", () => {
  it("shows recent sales straight away", async () => {
    const { onSearch } = setup();
    expect(await screen.findByText("GTS-202609-000123")).toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledWith({ q: "", from: "", to: "" });
  });

  it("searches by order number and by dates", async () => {
    const { onSearch } = setup();
    await screen.findByText("GTS-202609-000123");
    fireEvent.change(screen.getByLabelText(/order number/i), { target: { value: "000123" } });
    fireEvent.change(screen.getByLabelText(/^from/i), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText(/^to/i), { target: { value: "2026-09-19" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith({ q: "000123", from: "2026-09-01", to: "2026-09-19" }));
  });

  it("shows the total, date and channel of each sale", async () => {
    setup();
    expect(await screen.findByText("₦30,000")).toBeInTheDocument();
    expect(screen.getByText(/walk-in/i)).toBeInTheDocument();
  });

  it("reprints a completed sale", async () => {
    const { onReprint } = setup();
    fireEvent.click(await screen.findByRole("button", { name: /reprint/i }));
    expect(onReprint).toHaveBeenCalledWith("o1");
  });

  it("can't reprint a voided sale, and says it was voided", async () => {
    setup({ onSearch: vi.fn().mockResolvedValue({ ok: true, data: [{ ...SALE, status: "voided" }] }) });
    await screen.findByText("GTS-202609-000123");
    expect(screen.queryByRole("button", { name: /reprint/i })).not.toBeInTheDocument();
    expect(screen.getByText(/voided/i)).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    setup({ onSearch: vi.fn().mockResolvedValue({ ok: true, data: [] }) });
    expect(await screen.findByText(/no sales found/i)).toBeInTheDocument();
  });

  it("shows why a search failed", async () => {
    setup({ onSearch: vi.fn().mockResolvedValue({ ok: false, message: "Couldn't reach the server." }) });
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the server/i);
  });

  it("shows a reprint error", async () => {
    setup({ reprintError: "You can only reprint receipts for sales you took payment for." });
    expect(await screen.findByRole("alert")).toHaveTextContent(/only reprint/i);
  });

  it("closes", async () => {
    const { onClose } = setup();
    await screen.findByText("GTS-202609-000123");
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
