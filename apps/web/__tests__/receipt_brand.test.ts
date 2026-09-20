import { describe, it, expect } from "vitest";
import { receiptBrand, RECEIPT_THANKS } from "@gts/utils";

describe("receiptBrand (the words every receipt shares)", () => {
  it("falls back to the shop's handwritten header when Store Details is empty", () => {
    expect(receiptBrand()).toEqual({
      name: "GTS Wears",
      phone: "08148308129",
      website: "www.GTS08.com",
      thanks: "Thanks for your patronage.",
      orderAlso: "Order also: www.GTS08.com",
    });
  });

  it("uses the name and phone from Store Details when they're set", () => {
    const b = receiptBrand({ name: "GTS Menswear", phone: "0803 111 2222" });
    expect(b.name).toBe("GTS Menswear");
    expect(b.phone).toBe("0803 111 2222");
    expect(b.orderAlso).toBe("Order also: www.GTS08.com");
  });

  it("ignores blank values rather than printing an empty header", () => {
    expect(receiptBrand({ name: "  ", phone: null }).name).toBe("GTS Wears");
    expect(receiptBrand({ name: "", phone: "" }).phone).toBe("08148308129");
  });

  it("exports the thank-you line", () => {
    expect(RECEIPT_THANKS).toBe("Thanks for your patronage.");
  });
});
