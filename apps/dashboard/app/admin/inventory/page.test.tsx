import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));

import InventoryPage from "./page";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Admin inventory page never shows invented stock", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("says why when the server refuses, instead of listing sample products", async () => {
    fetchMock.mockResolvedValue(json({ error: "Not allowed", code: "FORBIDDEN" }, 403));
    render(<InventoryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have access/i);
    expect(screen.queryByText("Cool back pack")).not.toBeInTheDocument();
    expect(screen.queryByText(/DeLonghi/)).not.toBeInTheDocument();
  });

  it("says the stock couldn't be loaded when the server fails or is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<InventoryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.queryByText("Cool back pack")).not.toBeInTheDocument();
  });

  it("shows an honestly empty list when there is no stock yet", async () => {
    fetchMock.mockResolvedValue(json({ data: [] }));
    render(<InventoryPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByText("Cool back pack")).not.toBeInTheDocument();
  });

  it("checks the item checkbox when clicking any non-button part of the row", async () => {
    const itemData = {
      id: "inv-1",
      variant_id: "var-1",
      product_name: "Blue Oxford Shirt",
      quantity: 20,
      reserved_quantity: 0,
      available_quantity: 20,
      low_stock_threshold: 5,
      unit_price: 1000000,
      sku: "GTS-SHIRT-BLU",
    };
    fetchMock.mockResolvedValue(json({ data: [itemData] }));
    render(<InventoryPage />);

    await screen.findByText("Blue Oxford Shirt");
    const checkboxes = screen.getAllByRole("checkbox");
    const rowCheckbox = checkboxes[1]!;
    expect(rowCheckbox).not.toBeChecked();

    // Clicking the product name on the row toggles the checkbox
    fireEvent.click(screen.getByText("Blue Oxford Shirt"));
    expect(rowCheckbox).toBeChecked();

    // Clicking again untoggles it
    fireEvent.click(screen.getByText("Blue Oxford Shirt"));
    expect(rowCheckbox).not.toBeChecked();
  });

  it("does not toggle the checkbox when clicking a button on the row", async () => {
    const itemData = {
      id: "inv-1",
      variant_id: "var-1",
      product_name: "Blue Oxford Shirt",
      quantity: 20,
      reserved_quantity: 0,
      available_quantity: 20,
      low_stock_threshold: 5,
      unit_price: 1000000,
      sku: "GTS-SHIRT-BLU",
    };
    fetchMock.mockResolvedValue(json({ data: [itemData] }));
    render(<InventoryPage />);

    await screen.findByText("Blue Oxford Shirt");
    const checkboxes = screen.getAllByRole("checkbox");
    const rowCheckbox = checkboxes[1]!;
    expect(rowCheckbox).not.toBeChecked();

    // Clicking threshold button opens threshold modal and does NOT check the box
    fireEvent.click(screen.getByRole("button", { name: /≤ 5 units/i }));
    expect(rowCheckbox).not.toBeChecked();
    expect(screen.getByText(/Set Reorder Warning Threshold/i)).toBeInTheDocument();
  });
});
