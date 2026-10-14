export type PricingTier = "customer" | "retailer" | "wholesaler" | "distributor";

export interface TierPricingSource {
  base_price: number; // Customer price (kobo)
  price_retailer?: number | null; // Retailer price (kobo, 1-4 pcs)
  price_wholesaler?: number | null; // Wholesaler price (kobo, 5+ pcs)
  price_distributor?: number | null; // Distributor price (kobo, 20+ pcs)
  wholesale_min_qty?: number | null; // default 5
  distributor_min_qty?: number | null; // default 20
}

export interface ResolvedTierPrice {
  unitPrice: number; // kobo
  tier: PricingTier;
  tierLabel: string; // "Customer", "Retailer", "Wholesaler", "Distributor"
  minQty: number;
  savingsPerUnit: number; // kobo saved compared to customer base_price
}

export const DEFAULT_WHOLESALE_MIN_QTY = 5;
export const DEFAULT_DISTRIBUTOR_MIN_QTY = 20;

/**
 * Resolves the unit price according to quantity and tiered breakpoints:
 * - qty >= distributor_min_qty (default 20): Distributor price
 * - qty >= wholesale_min_qty (default 5): Wholesaler price
 * - qty >= 2 (or retailer price if same as customer): Retailer price
 * - Otherwise: Customer base price
 */
export function resolveTierPrice(
  source: TierPricingSource,
  quantity: number
): ResolvedTierPrice {
  const customerPrice = source.base_price || 0;
  const wholesaleMin = source.wholesale_min_qty ?? DEFAULT_WHOLESALE_MIN_QTY;
  const distributorMin = source.distributor_min_qty ?? DEFAULT_DISTRIBUTOR_MIN_QTY;

  // Distributor Tier (e.g. 20+ pcs)
  if (
    quantity >= distributorMin &&
    source.price_distributor !== null &&
    source.price_distributor !== undefined &&
    source.price_distributor > 0
  ) {
    return {
      unitPrice: source.price_distributor,
      tier: "distributor",
      tierLabel: "Distributor",
      minQty: distributorMin,
      savingsPerUnit: Math.max(0, customerPrice - source.price_distributor),
    };
  }

  // Wholesaler Tier (e.g. 5+ pcs)
  if (
    quantity >= wholesaleMin &&
    source.price_wholesaler !== null &&
    source.price_wholesaler !== undefined &&
    source.price_wholesaler > 0
  ) {
    return {
      unitPrice: source.price_wholesaler,
      tier: "wholesaler",
      tierLabel: "Wholesaler",
      minQty: wholesaleMin,
      savingsPerUnit: Math.max(0, customerPrice - source.price_wholesaler),
    };
  }

  // Retailer Tier (e.g. 2 - 4 pcs or small bulk)
  if (
    source.price_retailer !== null &&
    source.price_retailer !== undefined &&
    source.price_retailer > 0
  ) {
    if (quantity >= 2) {
      return {
        unitPrice: source.price_retailer,
        tier: "retailer",
        tierLabel: "Retailer",
        minQty: 2,
        savingsPerUnit: Math.max(0, customerPrice - source.price_retailer),
      };
    }
  }

  // Customer Tier (default / 1 item)
  return {
    unitPrice: customerPrice,
    tier: "customer",
    tierLabel: "Customer",
    minQty: 1,
    savingsPerUnit: 0,
  };
}

/**
 * Returns all 4 tiers structured for UI display (Storefront cards, Admin drawer, POS modals)
 */
export function getProductPricingTiers(source: TierPricingSource): Array<{
  tier: PricingTier;
  label: string;
  qtyRange: string;
  minQty: number;
  maxQty?: number;
  unitPrice: number;
  savingsPerUnit: number;
  savingsPercent: number;
}> {
  const customerPrice = source.base_price || 0;
  const wholesaleMin = source.wholesale_min_qty ?? DEFAULT_WHOLESALE_MIN_QTY;
  const distributorMin = source.distributor_min_qty ?? DEFAULT_DISTRIBUTOR_MIN_QTY;

  const retailerPrice = source.price_retailer ?? customerPrice;
  const wholesalerPrice = source.price_wholesaler ?? customerPrice;
  const distributorPrice = source.price_distributor ?? customerPrice;

  return [
    {
      tier: "customer",
      label: "Customer",
      qtyRange: "1 pc",
      minQty: 1,
      maxQty: 1,
      unitPrice: customerPrice,
      savingsPerUnit: 0,
      savingsPercent: 0,
    },
    {
      tier: "retailer",
      label: "Retailer",
      qtyRange: `1 – ${wholesaleMin - 1} pcs`,
      minQty: 1,
      maxQty: wholesaleMin - 1,
      unitPrice: retailerPrice,
      savingsPerUnit: Math.max(0, customerPrice - retailerPrice),
      savingsPercent: customerPrice > 0 ? Math.round((Math.max(0, customerPrice - retailerPrice) / customerPrice) * 100) : 0,
    },
    {
      tier: "wholesaler",
      label: "Wholesaler",
      qtyRange: `${wholesaleMin} – ${distributorMin - 1} pcs`,
      minQty: wholesaleMin,
      maxQty: distributorMin - 1,
      unitPrice: wholesalerPrice,
      savingsPerUnit: Math.max(0, customerPrice - wholesalerPrice),
      savingsPercent: customerPrice > 0 ? Math.round((Math.max(0, customerPrice - wholesalerPrice) / customerPrice) * 100) : 0,
    },
    {
      tier: "distributor",
      label: "Distributor",
      qtyRange: `${distributorMin}+ pcs`,
      minQty: distributorMin,
      unitPrice: distributorPrice,
      savingsPerUnit: Math.max(0, customerPrice - distributorPrice),
      savingsPercent: customerPrice > 0 ? Math.round((Math.max(0, customerPrice - distributorPrice) / customerPrice) * 100) : 0,
    },
  ];
}
