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
  category: { id: string; name: string; slug: string } | null;
  primary_image: { cloudinary_id: string; alt: string } | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  variants: PosVariant[];
}

export interface CartLine {
  variantId: string;
  productId: string;
  productName: string;
  size: string | null;
  color: string | null;
  unitPrice: number; // kobo, base_price + price_modifier
  quantity: number;
  available: number; // stock ceiling for the quantity stepper
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
}
