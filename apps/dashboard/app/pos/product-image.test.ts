import { describe, it, expect } from "vitest";
import { resolveProductImageUrl } from "./product-image";

describe("resolveProductImageUrl", () => {
  it("uses a full image URL as it is", () => {
    const url = "https://res.cloudinary.com/drstfd8gs/image/upload/v1/abc.webp";
    expect(resolveProductImageUrl(url)).toBe(url);
  });

  it("builds a Cloudinary URL from a bare public id", () => {
    expect(resolveProductImageUrl("products/shirt", "mycloud")).toBe("https://res.cloudinary.com/mycloud/image/upload/products/shirt");
  });

  it("serves the catalogue's own images (\"/products/...\" files shipped with the app) from this site", () => {
    expect(resolveProductImageUrl("/products/denim_jacket.png")).toBe("/products/denim_jacket.png");
    expect(resolveProductImageUrl("/products/hero/samsung_fridge_black.png")).toBe("/products/hero/samsung_fridge_black.png");
    expect(resolveProductImageUrl("/products/standing_fan-removebg-preview.png")).toBe("/products/standing_fan-removebg-preview.png");
  });

  it("only serves local paths from the products folder, and never a traversal or another host", () => {
    for (const bad of ["/etc/passwd", "/products/../secret.png", "//evil.example/x.png", "/products//evil.example/x.png", "/products/a b.png", "/products/x.png?x=1", "/products/"]) {
      expect(resolveProductImageUrl(bad), bad).toBeNull();
    }
  });

  it("has no image for empty or missing values", () => {
    expect(resolveProductImageUrl("")).toBeNull();
    expect(resolveProductImageUrl(null)).toBeNull();
    expect(resolveProductImageUrl(undefined)).toBeNull();
  });

  it("won't load a non-https URL or a script", () => {
    expect(resolveProductImageUrl("javascript:alert(1)")).toBeNull();
    expect(resolveProductImageUrl("http://insecure.example/x.png")).toBeNull();
  });

  it("has no image for a bare id when no cloud is configured", () => {
    expect(resolveProductImageUrl("products/shirt", "")).toBeNull();
  });
});
