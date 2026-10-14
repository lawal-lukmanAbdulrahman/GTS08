import { describe, it, expect } from "vitest";
import { resolveTierPrice, getProductPricingTiers } from "@gts/utils";

describe("resolveTierPrice from @gts/utils", () => {
  const sampleProduct = {
    base_price: 500000, // ₦5,000 in kobo
    price_retailer: 500000, // ₦5,000 (1 - 4 pcs)
    price_wholesaler: 470000, // ₦4,700 (5+ pcs)
    price_distributor: 400000, // ₦4,000 (20+ pcs)
    wholesale_min_qty: 5,
    distributor_min_qty: 20,
  };

  it("resolves single customer price when quantity is 1", () => {
    const res = resolveTierPrice(sampleProduct, 1);
    expect(res.unitPrice).toBe(500000);
    expect(res.tier).toBe("customer");
  });

  it("resolves retailer price for small quantities (1-4 pcs)", () => {
    expect(resolveTierPrice(sampleProduct, 2).unitPrice).toBe(500000);
    expect(resolveTierPrice(sampleProduct, 4).unitPrice).toBe(500000);
  });

  it("resolves wholesaler price when quantity is 5 or more (5-19 pcs)", () => {
    const at5 = resolveTierPrice(sampleProduct, 5);
    expect(at5.unitPrice).toBe(470000);
    expect(at5.tier).toBe("wholesaler");
    expect(at5.savingsPerUnit).toBe(30000);

    const at19 = resolveTierPrice(sampleProduct, 19);
    expect(at19.unitPrice).toBe(470000);
    expect(at19.tier).toBe("wholesaler");
  });

  it("resolves distributor price when quantity is 20 or more", () => {
    const at20 = resolveTierPrice(sampleProduct, 20);
    expect(at20.unitPrice).toBe(400000);
    expect(at20.tier).toBe("distributor");
    expect(at20.savingsPerUnit).toBe(100000);
  });

  it("structures 4 tiers correctly for UI", () => {
    const tiers = getProductPricingTiers(sampleProduct);
    expect(tiers).toHaveLength(4);
    expect(tiers.map((t) => t.label)).toEqual(["Customer", "Retailer", "Wholesaler", "Distributor"]);
    expect(tiers[2]!.savingsPercent).toBe(6);
    expect(tiers[3]!.savingsPercent).toBe(20);
  });
});
