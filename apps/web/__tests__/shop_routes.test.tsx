import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import ShopPage from "../app/(storefront)/shop/page";
import CategoryPage from "../app/(storefront)/shop/[slug]/page";
import { ShopAllLink } from "../app/(storefront)/_components/shop-all-link";

beforeEach(() => {
  redirect.mockClear();
});

describe("the product listing is reachable everywhere", () => {
  it("/shop opens the full product listing", () => {
    expect(() => ShopPage()).toThrow("REDIRECT:/search");
  });

  it("/shop/<category> opens the listing filtered to that category", async () => {
    await expect(CategoryPage({ params: Promise.resolve({ slug: "men's shirts" }) })).rejects.toThrow("REDIRECT:/search?category=men's%20shirts");
  });

  it("the header link goes to the full listing", () => {
    render(<ShopAllLink />);
    expect(screen.getByRole("link", { name: /shop all/i })).toHaveAttribute("href", "/search");
  });
});
