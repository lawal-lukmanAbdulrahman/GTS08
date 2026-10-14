export interface PromoEnhancedView {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  target_type: "all" | "specific_customers";
  customer_ids?: string[];
  product_scope: "all" | "specific_products";
  product_ids?: string[];
  max_uses_per_customer?: number | null;
  uses?: PromoUseRecord[];
  products?: PromoProductPreview[];
  targeted_customers?: PromoCustomerPreview[];
}

export interface PromoUseRecord {
  id: string;
  promo_id: string;
  order_id: string;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  discount_applied_kobo: number;
  used_at: string;
}

export interface PromoProductPreview {
  id: string;
  name: string;
  slug?: string;
  image_url?: string;
  base_price: number;
  cost_price?: number | null;
  status?: string;
}

export interface PromoCustomerPreview {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
}
