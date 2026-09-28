import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/image", () => ({ default: (p: { alt: string }) => <img alt={p.alt} /> }));

import { Footer } from "../app/(storefront)/_components/landing/footer";
import { resetStoreInfoCache } from "../app/(storefront)/_lib/store-info";

const STORE = {
  store_name: "GTS Wears",
  store_address: "12 Allen Avenue, Ikeja",
  support_phone: "0814 830 8129",
  whatsapp_number: "0814 830 8129",
  support_email: "hello@gts08.com",
  footer_about: "Menswear made in Lagos.",
  instagram_url: "https://instagram.com/gtswears",
  facebook_url: null,
  tiktok_url: "https://tiktok.com/@gtswears",
  x_url: null,
  linkedin_url: null,
};

function serve(data: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 })));
}

beforeEach(() => resetStoreInfoCache());

describe("storefront footer", () => {
  it("shows the store details the admin entered, not built-in ones", async () => {
    serve(STORE);
    const { container } = render(<Footer />);
    expect(await screen.findByText("Menswear made in Lagos.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@gts08.com" })).toHaveAttribute("href", "mailto:hello@gts08.com");
    expect(container.textContent).toContain("12 Allen Avenue, Ikeja");
    expect(container.textContent).toContain("0814 830 8129");
    expect(container.textContent).toContain("GTS Wears");
    for (const fake of ["support@gts.com", "800 111 1111", "Luxury in Every Detail"]) expect(container.textContent).not.toContain(fake);
  });

  it("shows only the social links that are set, pointing at them", async () => {
    serve(STORE);
    render(<Footer />);
    expect(await screen.findByRole("link", { name: /instagram/i })).toHaveAttribute("href", "https://instagram.com/gtswears");
    expect(screen.getByRole("link", { name: /tiktok/i })).toHaveAttribute("href", "https://tiktok.com/@gtswears");
    expect(screen.queryByRole("link", { name: /facebook/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /linkedin/i })).not.toBeInTheDocument();
  });

  it("opens WhatsApp for the store's number", async () => {
    serve(STORE);
    render(<Footer />);
    expect(await screen.findByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/2348148308129");
  });

  it("links to the full product listing", () => {
    serve(STORE);
    render(<Footer />);
    expect(screen.getByRole("link", { name: /all products/i })).toHaveAttribute("href", "/shop");
  });

  it("hides empty details rather than showing placeholders", async () => {
    serve({ store_name: "GTS", store_address: null, support_phone: null, whatsapp_number: null, support_email: "hello@gts.ng", footer_about: null, instagram_url: null, facebook_url: null, tiktok_url: null, x_url: null, linkedin_url: null });
    const { container } = render(<Footer />);
    await screen.findByRole("link", { name: "hello@gts.ng" });
    expect(container.textContent).not.toMatch(/Phone:|Address:/);
    expect(screen.queryByRole("link", { name: /instagram|facebook|tiktok|whatsapp/i })).not.toBeInTheDocument();
  });
});
