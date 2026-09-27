import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/products", useSearchParams: () => new URLSearchParams() }));
vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));

import ProductsPage from "./page";

const product = (o: Record<string, unknown>) => ({
  id: "p1", name: "Oxford Shirt", slug: "oxford-shirt", base_price: 4_800_000, status: "active", total_sold: 0, in_stock: true, has_low_stock: false,
  total_quantity: 10, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-20T09:30:00Z", variants: [], ...o,
});

function serve(products: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("/products/drafts")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    if (String(url).includes("/products")) return new Response(JSON.stringify({ data: products, meta: { total: products.length } }), { status: 200 });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }));
}

beforeEach(() => localStorage.setItem("gts_token", "tok"));

describe("Products list", () => {
  it("shows when each product was really last changed, not an invented time", async () => {
    serve([product({})]);
    const { container } = render(<ProductsPage />);
    await screen.findByText("Oxford Shirt");
    expect(container.textContent).not.toMatch(/Today at 1:23pm|Yesterday at 4:15pm|Today at 3:50pm/);
    expect(container.textContent).toMatch(/20 Sep/);
  });

  it("shows the real stock count and nothing made up when it isn't known", async () => {
    serve([product({ total_quantity: 7 }), product({ id: "p2", name: "No count", total_quantity: undefined, in_stock: true })]);
    const { container } = render(<ProductsPage />);
    await screen.findByText("No count");
    expect(container.textContent).toContain("7 in Stock");
    expect(container.textContent).not.toMatch(/\b(4|12) (Low Stock|in Stock)/);
  });

  it("has no invented figures in the summary cards", async () => {
    serve([]);
    const { container } = render(<ProductsPage />);
    await waitFor(() => expect(container.textContent).toMatch(/Total Catalog Items/i));
    for (const fake of ["84,320", "+12.5%", "142"]) expect(container.textContent).not.toContain(fake);
  });

  it("values stock at its selling price, in naira from kobo", async () => {
    serve([product({ base_price: 4_800_000, total_quantity: 10 })]);
    render(<ProductsPage />);
    expect(await screen.findByTestId("card-stock-value")).toHaveTextContent("₦480,000");
  });
});
