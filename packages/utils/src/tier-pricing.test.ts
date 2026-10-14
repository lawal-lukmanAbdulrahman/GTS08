import { describe, it, expect } from "vitest";
import { resolveTierPrice, getProductPricingTiers } from "./tier-pricing";

describe("resolveTierPrice", () => {
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

  it("resolves customer price when retailer price is higher and qty is 1", () => {
    const product = { ...sampleProduct, base_price: 550000, price_retailer: 500000 };
    const res1 = resolveTierPrice(product, 1);
    expect(res1.unitPrice).toBe(550000);
    expect(res1.tier).toBe("customer");

    const res2 = resolveTierPrice(product, 3);
    expect(res2.unitPrice).toBe(500000);
    expect(res2.tier).toBe("retailer");
  });

  it("resolves retailer price for quantities 2 through 4", () => {
    expect(resolveTierPrice(sampleProduct, 2).unitPrice).toBe(500000);
    expect(resolveTierPrice(sampleProduct, 4).unitPrice).toBe(500000);
  });

  it("resolves wholesaler price when quantity is 5 or more up to 19", () => {
    const at5 = resolveTierPrice(sampleProduct, 5);
    expect(at5.unitPrice).toBe(470000);
    expect(at5.tier).toBe("wholesaler");
    expect(at5.savingsPerUnit).toBe(30000); // ₦300 saved per unit

    const at19 = resolveTierPrice(sampleProduct, 19);
    expect(at19.unitPrice).toBe(470000);
    expect(at19.tier).toBe("wholesaler");
  });

  it("resolves distributor price when quantity is 20 or more", () => {
    const at20 = resolveTierPrice(sampleProduct, 20);
    expect(at20.unitPrice).toBe(400000);
    expect(at20.tier).toBe("distributor");
    expect(at20.savingsPerUnit).toBe(100000); // ₦1,000 saved per unit

    const at50 = resolveTierPrice(sampleProduct, 50);
    expect(at50.unitPrice).toBe(400000);
    expect(at50.tier).toBe("distributor");
  });

  it("falls back gracefully when bulk prices are not set", () => {
    const plainProduct = {
      base_price: 300000,
    };
    const res = resolveTierPrice(plainProduct, 25);
    expect(res.unitPrice).toBe(300000);
    expect(res.tier).toBe("customer");
  });
});

describe("getProductPricingTiers", () => {
  it("structures 4 tiers with savings percentages", () => {
    const tiers = getProductPricingTiers({
      base_price: 500000,
      price_retailer: 500000,
      price_wholesaler: 470000,
      price_distributor: 400000,
    });

    expect(tiers).toHaveLength(4);
    expect(tiers[0].label).toBe("Customer");
    expect(tiers[1].label).toBe("Retailer");
    expect(tiers[2].label).toBe("Wholesaler");
    expect(tiers[2].savingsPercent).toBe(6);
    expect(tiers[3].label).toBe("Distributor");
    expect(tiers[3].savingsPercent).toBe(20);
  });
});
