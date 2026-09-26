export interface ProductColorOption {
  color: string;
  label: string;
  main: string;
  thumbnails: string[];
  hasTransparentBg?: boolean;
}

export interface ProductVariantItem {
  id: string;
  size: string;
  color: string;
  colorHex?: string;
  sku?: string;
  available: number;
  inStock: boolean;
  quantity: number;
}

export interface ProductItem {
  id: string;
  brand: string;
  sku: string;
  title: string;
  price: string;
  originalPrice?: string;
  priceNum: number;
  badge?: string;
  rating: number;
  reviewsCount: number;
  reviews: string;
  shortDescription?: string;
  description: string;
  category: string;
  subCategory: string;
  image: string;
  images: ProductColorOption[];
  sizes: string[];
  tags: string[];
  hasTransparentBg?: boolean;
  descriptionImages?: string[];
  totalSold?: number;
  createdAt?: string;
  rawCompareAtPrice?: number | null;
  rawBasePrice?: number;
  discountPercent?: number;
  variants?: ProductVariantItem[];
  availableStock?: number;
  inStock?: boolean;
}
