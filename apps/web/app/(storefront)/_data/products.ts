export interface ProductColorOption {
  color: string;
  label: string;
  main: string;
  thumbnails: string[];
  hasTransparentBg?: boolean;
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
}
