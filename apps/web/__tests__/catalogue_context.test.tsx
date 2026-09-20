import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CatalogueProvider, useCatalogue } from "../app/(storefront)/_components/catalogue-context";

const api = (slug: string, category = "Fashion") => ({
  id: slug, name: slug.toUpperCase(), slug, sku: slug, brand: "GTS", sub_category: null, short_description: null, description: "d", base_price: 100000, compare_at_price: null,
  average_rating: 4, review_count: 3, tags: [], badges: [], category: { name: category, slug: category.toLowerCase() }, primary_image: null, images: [], variants: [],
});

function Probe() {
  const { products, loading, error, getProduct } = useCatalogue();
  return (
    <div>
      <span data-testid="state">{loading ? "loading" : "ready"}</span>
      <span data-testid="ids">{products.map((p) => p.id).join(",")}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="one">{getProduct("b")?.title ?? "none"}</span>
      <span data-testid="decoded">{getProduct("B%20")?.title ?? "none"}</span>
    </div>
  );
}
const show = () => render(<CatalogueProvider><Probe /></CatalogueProvider>);

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("the storefront catalogue (products come from the database)", () => {
  it("loads every product from the API and shows them as storefront products", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [api("a"), api("b")] }), { status: 200 }));
    show();
    expect(screen.getByTestId("state")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("a,b"));
    expect(screen.getByTestId("state")).toHaveTextContent("ready");
    expect(fetchMock.mock.calls[0]![0]).toMatch(/^\/api\/v1\/products\?/);
  });

  it("finds one product by its slug, ignoring case and encoding, and never guesses a near match", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [api("a"), api("b")] }), { status: 200 }));
    show();
    await waitFor(() => expect(screen.getByTestId("one")).toHaveTextContent("B"));
    expect(screen.getByTestId("decoded")).toHaveTextContent("none"); // "b " is not "b"
  });

  it("shows what it had last time straight away, and refreshes behind it", async () => {
    sessionStorage.setItem("gts_catalogue_v1", JSON.stringify({ at: Date.now() - 1000, products: [api("cached")] }));
    let release!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (release = r)));
    show();
    expect(screen.getByTestId("ids")).toHaveTextContent("cached");
    expect(screen.getByTestId("state")).toHaveTextContent("ready");
    release(new Response(JSON.stringify({ data: [api("fresh")] }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("fresh"));
  });

  it("says so, and keeps what it had, when the server can't be reached", async () => {
    sessionStorage.setItem("gts_catalogue_v1", JSON.stringify({ at: Date.now(), products: [api("cached")] }));
    fetchMock.mockRejectedValue(new TypeError("offline"));
    show();
    await waitFor(() => expect(screen.getByTestId("error")).not.toHaveTextContent(/^$/));
    expect(screen.getByTestId("ids")).toHaveTextContent("cached");
  });

  it("shows an error, not a made-up list, when there's no server and nothing saved", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    show();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));
    expect(screen.getByTestId("ids")).toHaveTextContent("");
    expect(screen.getByTestId("error")).not.toHaveTextContent(/^$/);
  });

  it("ignores a corrupt saved copy", async () => {
    sessionStorage.setItem("gts_catalogue_v1", "{nope");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [api("a")] }), { status: 200 }));
    show();
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("a"));
  });

  it("works with no provider around it (empty, not a crash)", () => {
    render(<Probe />);
    expect(screen.getByTestId("ids")).toHaveTextContent("");
  });
});
