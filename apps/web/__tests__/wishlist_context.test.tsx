import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WishlistProvider, useWishlist } from "../app/(storefront)/_components/wishlist-context";

function Probe() {
  const { wishlistIds } = useWishlist();
  return <span data-testid="ids">{wishlistIds.join(",")}</span>;
}
const show = () =>
  render(
    <WishlistProvider>
      <Probe />
    </WishlistProvider>
  );

describe("the wishlist", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty for a first-time visitor", async () => {
    show();
    await waitFor(() => expect(localStorage.getItem("gts_wishlist_items")).not.toBeNull());
    expect(screen.getByTestId("ids")).toHaveTextContent("");
    expect(screen.getByTestId("ids").textContent).toBe("");
  });

  it("restores what the visitor saved", async () => {
    localStorage.setItem("gts_wishlist_items", JSON.stringify(["fan", "tv"]));
    show();
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("fan,tv"));
  });
});
