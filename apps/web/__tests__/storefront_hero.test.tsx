import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (p: { alt: string }) => <img alt={p.alt} /> }));

import { Hero } from "../app/(storefront)/_components/landing/hero";

const product = (o: Record<string, unknown> = {}) => ({ id: "p1", slug: "oxford-shirt", name: "Classic Oxford Shirt", base_price: 3_240_000, compare_at_price: null, average_rating: null, review_count: 0, images: [{ cloudinary_id: "img1" }], variants: [], ...o });

function serve(hero: unknown[], products: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("/storefront/hero")) return new Response(JSON.stringify({ data: hero }), { status: 200 });
    if (String(url).includes("/products")) return new Response(JSON.stringify({ data: products }), { status: 200 });
    return new Response("{}", { status: 404 });
  }));
}

beforeEach(() => vi.unstubAllGlobals());

describe("storefront hero", () => {
  it("never shows the built-in sample products to a live shop with no products", async () => {
    serve([], []);
    const { container } = render(<Hero />);
    expect(await screen.findByTestId("hero-welcome")).toBeInTheDocument();
    for (const fake of ["Air Jordan", "Nexus", "Pixel", "480K", "2.1k", "1.8k"]) expect(container.textContent).not.toContain(fake);
  });

  it("features the shop's own products when no hero slides are chosen", async () => {
    serve([], [product()]);
    render(<Hero />);
    expect(await screen.findByText(/Classic Oxford/)).toBeInTheDocument();
    expect(screen.getAllByText(/₦32K|32,400/).length).toBeGreaterThan(0);
  });

  it("uses the admin's chosen hero slides first", async () => {
    serve([{ product: { ...product({ name: "Chosen Hero Jacket", images: undefined }), images: [{ cloudinary_public_id: "img2" }] } }], [product()]);
    render(<Hero />);
    expect(await screen.findByText(/Chosen Hero/)).toBeInTheDocument();
  });

  it("does not invent a rating or review count", async () => {
    serve([], [product({ average_rating: null, review_count: 0 })]);
    const { container } = render(<Hero />);
    await screen.findByText(/Classic Oxford/);
    await waitFor(() => expect(container.textContent).not.toMatch(/\(120\)|4\.9/));
  });
});
