import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/image", () => ({ default: (p: { alt: string; src: string }) => <img alt={p.alt} src={p.src} /> }));

import { toMegaCategories, categoryTiles, resetCategoriesCache, type StoreCategory } from "../app/(storefront)/_lib/categories";
import { Categories } from "../app/(storefront)/_components/landing/categories";
import { CategoryMegaMenu } from "../app/(storefront)/_components/landing/category-mega-menu";

const SHIRTS: StoreCategory = { id: "c1", name: "Shirts", slug: "shirts", parent_id: null, sort_order: 0, banner_cloudinary_id: "banners/shirts" };
const OXFORD: StoreCategory = { id: "c2", name: "Oxford", slug: "oxford", parent_id: "c1", sort_order: 0, banner_cloudinary_id: null };
const SHOES: StoreCategory = { id: "c3", name: "Shoes", slug: "shoes", parent_id: null, sort_order: 1, banner_cloudinary_id: null };

function serve(rows: StoreCategory[]) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: rows }), { status: 200 })));
}

beforeEach(() => resetCategoriesCache());

describe("the storefront's categories come from the shop's own list", () => {
  it("builds the menu from top-level categories and their sub-categories", () => {
    const menu = toMegaCategories([SHIRTS, OXFORD, SHOES]);
    expect(menu.map((c) => c.name)).toEqual(["Shirts", "Shoes"]);
    expect(menu[0]!.groups[0]!.items).toEqual([
      { label: "All Shirts", href: "/search?category=Shirts" },
      { label: "Oxford", href: "/search?category=Oxford" },
    ]);
    expect(menu[1]!.groups[0]!.items).toEqual([{ label: "All Shoes", href: "/search?category=Shoes" }]);
  });

  it("makes a tile per top-level category, with its banner when it has one", () => {
    const tiles = categoryTiles([SHIRTS, OXFORD, SHOES], "demo-cloud");
    expect(tiles).toEqual([
      { id: "c1", title: "Shirts", image: "https://res.cloudinary.com/demo-cloud/image/upload/banners/shirts", href: "/search?category=Shirts" },
      { id: "c3", title: "Shoes", image: null, href: "/search?category=Shoes" },
    ]);
  });

  it("hides the featured categories section when the shop has none", async () => {
    serve([]);
    const { container } = render(<Categories />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the shop's categories, and none of the old built-in ones", async () => {
    serve([SHIRTS, SHOES]);
    const { container } = render(<Categories />);
    expect(await screen.findByText("Shirts")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Appliances|Computing|Supermarket/);
  });

  it("hides the Categories menu when the shop has none", async () => {
    serve([]);
    const { container } = render(<CategoryMegaMenu />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Categories menu once there are categories", async () => {
    serve([SHIRTS]);
    render(<CategoryMegaMenu />);
    expect(await screen.findByRole("button", { name: /categories/i })).toBeInTheDocument();
  });
});
