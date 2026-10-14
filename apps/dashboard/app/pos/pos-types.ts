export interface PosVariant {
  id: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  sku: string | null;
  price_modifier: number;
  quantity: number;
  available: number;
}

export interface PosProduct {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  price_retailer?: number | null;
  price_wholesaler?: number | null;
  price_distributor?: number | null;
  wholesale_min_qty?: number | null;
  distributor_min_qty?: number | null;
  category: { id: string; name: string; slug: string } | null;
  primary_image: { cloudinary_id: string; alt: string } | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  variants: PosVariant[];
  has_transparent_bg?: boolean;
}

export interface CartLine {
  variantId: string;
  productId: string;
  productName: string;
  size: string | null;
  color: string | null;
  unitPrice: number; // kobo, resolved dynamically based on quantity
  basePrice?: number; // kobo, single-item base price + modifier
  priceRetailer?: number | null;
  priceWholesaler?: number | null;
  priceDistributor?: number | null;
  wholesaleMinQty?: number | null;
  distributorMinQty?: number | null;
  tierName?: string;
  quantity: number;
  available: number; // stock ceiling for the quantity stepper
  imageUrl?: string | null;
  primary_image?: { cloudinary_id: string; alt: string } | null;
}

export type PaymentMethod = "cash" | "pos_terminal";

export interface CompletedSale {
  orderNumber: string;
  items: CartLine[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashierName: string;
  createdAt: string;
  channel?: "walk_in" | "whatsapp";
  customerName?: string;
  customerPhone?: string;
  cashReceived?: number; // kobo, cash payments only
  duplicate?: boolean; // a reprint of an earlier sale
}
