import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchPanel from "./search-panel";
import type { PosProduct } from "./pos-types";

const SINGLE_VARIANT_PRODUCT: PosProduct = {
  id: "p1",
  name: "Plain Tee",
  slug: "plain-tee",
  base_price: 800000,
  category: { id: "c1", name: "Tees", slug: "tees" },
  primary_image: null,
  stock_status: "in_stock",
  variants: [{ id: "v1", size: null, color: null, color_hex: null, sku: "T-1", price_modifier: 0, quantity: 5, available: 5 }],
};

const MULTI_VARIANT_PRODUCT: PosProduct = {
  id: "p2",
  name: "GTS Oxford Shirt",
  slug: "gts-oxford-shirt",
  base_price: 1500000,
  category: { id: "c1", name: "Tees", slug: "tees" },
  primary_image: null,
  stock_status: "low_stock",
  variants: [
    { id: "v2", size: "S", color: "Black", color_hex: "#000", sku: "S-BLK", price_modifier: 0, quantity: 2, available: 2 },
    { id: "v3", size: "M", color: "Black", color_hex: "#000", sku: "M-BLK", price_modifier: 0, quantity: 2, available: 2 },
  ],
};

const OUT_OF_STOCK_PRODUCT: PosProduct = {
  ...MULTI_VARIANT_PRODUCT,
  id: "p3",
  name: "Sold Out Jacket",
  stock_status: "out_of_stock",
  variants: [{ id: "v4", size: "M", color: "Black", color_hex: "#000", sku: "J-M", price_modifier: 0, quantity: 0, available: 0 }],
};

const DEFAULTS = {
  hasMore: false,
  loadingMore: false,
  onLoadMore: vi.fn(),
  onFlagProduct: vi.fn(),
};

describe("SearchPanel (spec Part 3)", () => {
  it("shows a stock badge per product and dims an out-of-stock card", () => {
    render(
      <SearchPanel
        query=""
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[{ id: "c1", name: "Tees", slug: "tees" }]}
        products={[SINGLE_VARIANT_PRODUCT, MULTI_VARIANT_PRODUCT, OUT_OF_STOCK_PRODUCT]}
        loading={false}
        {...DEFAULTS}
        onQuickAdd={vi.fn()}
        onOpenVariantModal={vi.fn()}
      />
    );
    expect(screen.getByText(/in stock/i)).toBeInTheDocument();
    expect(screen.getByText(/low stock/i)).toBeInTheDocument();
    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
  });

  it("immediately quick-adds a single-variant product on tap", () => {
    const onQuickAdd = vi.fn();
    const onOpenVariantModal = vi.fn();
    render(
      <SearchPanel
        query="tee"
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[SINGLE_VARIANT_PRODUCT]}
        loading={false}
        {...DEFAULTS}
        onQuickAdd={onQuickAdd}
        onOpenVariantModal={onOpenVariantModal}
      />
    );
    fireEvent.click(screen.getByText("Plain Tee"));
    expect(onQuickAdd).toHaveBeenCalledWith(SINGLE_VARIANT_PRODUCT, "v1");
    expect(onOpenVariantModal).not.toHaveBeenCalled();
  });

  it("opens the variant modal for a multi-variant product on tap", () => {
    const onQuickAdd = vi.fn();
    const onOpenVariantModal = vi.fn();
    render(
      <SearchPanel
        query="shirt"
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[MULTI_VARIANT_PRODUCT]}
        loading={false}
        {...DEFAULTS}
        onQuickAdd={onQuickAdd}
        onOpenVariantModal={onOpenVariantModal}
      />
    );
    fireEvent.click(screen.getByText("GTS Oxford Shirt"));
    expect(onOpenVariantModal).toHaveBeenCalledWith(MULTI_VARIANT_PRODUCT);
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it("does not add an out-of-stock product on tap", () => {
    const onQuickAdd = vi.fn();
    const onOpenVariantModal = vi.fn();
    render(
      <SearchPanel
        query="jacket"
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[OUT_OF_STOCK_PRODUCT]}
        loading={false}
        {...DEFAULTS}
        onQuickAdd={onQuickAdd}
        onOpenVariantModal={onOpenVariantModal}
      />
    );
    fireEvent.click(screen.getByText("Sold Out Jacket"));
    expect(onQuickAdd).not.toHaveBeenCalled();
    expect(onOpenVariantModal).not.toHaveBeenCalled();
  });

  it("calls onQueryChange as the cashier types", () => {
    const onQueryChange = vi.fn();
    render(
      <SearchPanel
        query=""
        onQueryChange={onQueryChange}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[]}
        loading={false}
        {...DEFAULTS}
        onQuickAdd={vi.fn()}
        onOpenVariantModal={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/search by product name or sku/i), {
      target: { value: "shirt" },
    });
    expect(onQueryChange).toHaveBeenCalledWith("shirt");
  });

  describe("opens on the catalogue, before any search", () => {
    const render0 = (over = {}) =>
      render(
        <SearchPanel
          query=""
          onQueryChange={vi.fn()}
          category="all"
          onCategoryChange={vi.fn()}
          categories={[]}
          products={[SINGLE_VARIANT_PRODUCT, MULTI_VARIANT_PRODUCT]}
          loading={false}
          onQuickAdd={vi.fn()}
          onOpenVariantModal={vi.fn()}
          {...DEFAULTS}
          {...over}
        />
      );

    it("shows products with no search text, headed 'Best sellers'", () => {
      render0();
      expect(screen.getByText("Best sellers")).toBeInTheDocument();
      expect(screen.getByText("Plain Tee")).toBeInTheDocument();
      expect(screen.queryByText(/start typing/i)).not.toBeInTheDocument();
    });

    it("heads the list 'Results' once the cashier searches", () => {
      render0({ query: "tee" });
      expect(screen.getByText(/results for .tee./i)).toBeInTheDocument();
      expect(screen.queryByText("Best sellers")).not.toBeInTheDocument();
    });

    it("says so when the catalogue is empty, and when a search finds nothing", () => {
      const { rerender } = render0({ products: [] });
      expect(screen.getByText(/no products available/i)).toBeInTheDocument();
      rerender(
        <SearchPanel query="zzz" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} />
      );
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    });

    it("shows a loading state for the first load", () => {
      render0({ products: [], loading: true });
      expect(screen.getByText(/loading products/i)).toBeInTheDocument();
    });

    it("pages: 'Load more' appears only when there are more, and asks for them", () => {
      const onLoadMore = vi.fn();
      const { rerender } = render0();
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
      rerender(
        <SearchPanel query="" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[SINGLE_VARIANT_PRODUCT]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} hasMore onLoadMore={onLoadMore} />
      );
      fireEvent.click(screen.getByRole("button", { name: /load more/i }));
      expect(onLoadMore).toHaveBeenCalled();
    });

    it("disables 'Load more' while it loads", () => {
      render0({ hasMore: true, loadingMore: true });
      expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
    });

    it("renders the category tabs and picks one", () => {
      const onCategoryChange = vi.fn();
      render0({ categories: [{ id: "c1", name: "Appliances", slug: "appliances" }], onCategoryChange });
      fireEvent.click(screen.getByRole("button", { name: "Appliances" }));
      expect(onCategoryChange).toHaveBeenCalledWith("appliances");
    });
  });

  describe("flagging a product", () => {
    const renderWith = (products: PosProduct[], handlers: Record<string, unknown> = {}) =>
      render(
        <SearchPanel query="" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={products} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} {...handlers} />
      );

    it("has a flag button on each card that flags that product without adding it to the cart", () => {
      const onFlagProduct = vi.fn();
      const onQuickAdd = vi.fn();
      renderWith([SINGLE_VARIANT_PRODUCT], { onFlagProduct, onQuickAdd });
      fireEvent.click(screen.getByRole("button", { name: /flag plain tee/i }));
      expect(onFlagProduct).toHaveBeenCalledWith(SINGLE_VARIANT_PRODUCT);
      expect(onQuickAdd).not.toHaveBeenCalled();
    });

    it("still lets you flag an out-of-stock product (that's often exactly the problem)", () => {
      const onFlagProduct = vi.fn();
      renderWith([OUT_OF_STOCK_PRODUCT], { onFlagProduct });
      const flag = screen.getByRole("button", { name: /flag sold out jacket/i });
      expect(flag).toBeEnabled();
      fireEvent.click(flag);
      expect(onFlagProduct).toHaveBeenCalledWith(OUT_OF_STOCK_PRODUCT);
    });
  });

  describe("product pictures", () => {
    const withImage = (cloudinary_id: string): PosProduct => ({ ...SINGLE_VARIANT_PRODUCT, primary_image: { cloudinary_id, alt: "Plain Tee photo" } });
    const show = (p: PosProduct) =>
      render(<SearchPanel query="" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[p]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} />);

    it("shows the picture when the catalogue holds a full image URL", () => {
      show(withImage("https://res.cloudinary.com/drstfd8gs/image/upload/v1/tee.webp"));
      expect(screen.getByAltText("Plain Tee photo")).toHaveAttribute("src", "https://res.cloudinary.com/drstfd8gs/image/upload/v1/tee.webp");
    });

    it("shows a placeholder, not a broken image, for a stored path that was never uploaded", () => {
      show(withImage("/products/tee.png"));
      expect(screen.queryByAltText("Plain Tee photo")).not.toBeInTheDocument();
      expect(screen.getByTestId("no-image")).toBeInTheDocument();
    });

    it("falls back to the placeholder if the picture fails to load", () => {
      show(withImage("https://res.cloudinary.com/drstfd8gs/image/upload/v1/gone.webp"));
      fireEvent.error(screen.getByAltText("Plain Tee photo"));
      expect(screen.queryByAltText("Plain Tee photo")).not.toBeInTheDocument();
      expect(screen.getByTestId("no-image")).toBeInTheDocument();
    });

    it("shows the placeholder when a product has no picture at all", () => {
      show(SINGLE_VARIANT_PRODUCT);
      expect(screen.getByTestId("no-image")).toBeInTheDocument();
    });
  });

  describe("scanning a barcode (Enter)", () => {
    const shell = (over = {}) =>
      render(<SearchPanel query="GTS-TEE-1" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} {...over} />);

    it("reports the text when Enter is pressed in the search box", () => {
      const onSubmitQuery = vi.fn();
      shell({ onSubmitQuery });
      fireEvent.keyDown(screen.getByPlaceholderText(/search by product name or sku/i), { key: "Enter" });
      expect(onSubmitQuery).toHaveBeenCalledWith("GTS-TEE-1");
    });

    it("does nothing on Enter for an empty box", () => {
      const onSubmitQuery = vi.fn();
      shell({ query: "  ", onSubmitQuery });
      fireEvent.keyDown(screen.getByPlaceholderText(/search by product name or sku/i), { key: "Enter" });
      expect(onSubmitQuery).not.toHaveBeenCalled();
    });

    it("shows a scan message when there is one", () => {
      shell({ scanMessage: "Added Plain Tee" });
      expect(screen.getByRole("status")).toHaveTextContent("Added Plain Tee");
    });
  });

  describe("stock and density", () => {
    const only = (p: PosProduct) =>
      render(<SearchPanel query="" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[p]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} />);

    it("says how many are left on a low-stock product", () => {
      only(MULTI_VARIANT_PRODUCT); // 2 + 2 available
      expect(screen.getByText(/4 left/i)).toBeInTheDocument();
    });

    it("doesn't clutter healthy stock with a number", () => {
      only(SINGLE_VARIANT_PRODUCT);
      expect(screen.queryByText(/\d+ left/i)).not.toBeInTheDocument();
    });

    it("switches between comfortable and compact, and remembers the choice", () => {
      localStorage.clear();
      const { unmount } = render(<SearchPanel query="" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[SINGLE_VARIANT_PRODUCT]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} />);
      expect(screen.getByRole("button", { name: /compact view/i })).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(screen.getByRole("button", { name: /compact view/i }));
      expect(screen.getByRole("button", { name: /compact view/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("product-grid").className).toMatch(/grid-cols-3|grid-cols-4|grid-cols-5/);
      unmount();
      render(<SearchPanel query="" onQueryChange={vi.fn()} category="all" onCategoryChange={vi.fn()} categories={[]} products={[SINGLE_VARIANT_PRODUCT]} loading={false} onQuickAdd={vi.fn()} onOpenVariantModal={vi.fn()} {...DEFAULTS} />);
      expect(screen.getByRole("button", { name: /compact view/i })).toHaveAttribute("aria-pressed", "true");
    });

    it("the flag button has a visible label and a touch-sized target", () => {
      only(SINGLE_VARIANT_PRODUCT);
      const flag = screen.getByRole("button", { name: /flag plain tee/i });
      expect(flag).toHaveTextContent(/flag/i);
      expect(flag.className).toMatch(/min-h-\[44px\]/);
    });
  });
});
