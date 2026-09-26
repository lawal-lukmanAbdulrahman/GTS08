"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, use, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@gts/database/client";
import { Footer } from "../../_components/landing/footer";
import { ProductCard } from "../../_components/ui/product-card";
import { useCatalogue } from "../../_components/catalogue-context";
import type { ProductItem } from "../../_data/products";
import { dbProductToItem, type ApiProduct } from "../../_lib/catalogue";
import { getCartSessionId } from "../../_lib/server-sync";
import { useCart } from "../../_components/cart-context";
import { useWishlist } from "../../_components/wishlist-context";
import { useAuth } from "../../_components/auth-context";
import { useAuthModal } from "../../_components/auth-modal-context";
import { ProductZoomLightbox } from "../../_components/ui/product-zoom-lightbox";
import { MarkdownContent } from "../../_components/markdown-content";
import { NIGERIAN_STATES, NIGERIAN_LOCATIONS } from "../../_data/nigerian-locations";
import { saveRecentlyViewed } from "../../_components/landing/search-history";
import { useProductDwellTracker, trackProductWishlist, trackProductCart } from "../../_lib/analytics";

// Universal standard color swatch map for when merchant hasn't provided a hex code
const STANDARD_COLOR_PALETTE: Record<string, string> = {
  black: "#181818",
  white: "#FFFFFF",
  red: "#DC2626",
  crimson: "#991B1B",
  coral: "#EA580C",
  blue: "#2563EB",
  navy: "#1E3A8A",
  green: "#10B981",
  emerald: "#059669",
  mint: "#34D399",
  yellow: "#F59E0B",
  amber: "#D97706",
  gold: "#EAB308",
  orange: "#EA580C",
  purple: "#7C3AED",
  violet: "#8B5CF6",
  pink: "#EC4899",
  rose: "#F43F5E",
  gray: "#6B7280",
  grey: "#6B7280",
  silver: "#94A3B8",
  metal: "#64748B",
  titanium: "#475569",
  brown: "#78350F",
  bronze: "#92400E",
  mocha: "#5B3A29",
  teal: "#0D9488",
  cyan: "#06B6D4",
  beige: "#D4C5B9",
};

// Generic color hex resolver: respects variant's DB hex code first, then falls back to standard color names
function getColorHex(colorName: string, fallbackHex?: string): string {
  if (fallbackHex && fallbackHex.trim().startsWith("#")) {
    return fallbackHex.trim();
  }
  const c = colorName.toLowerCase();
  for (const [name, hex] of Object.entries(STANDARD_COLOR_PALETTE)) {
    if (c.includes(name)) return hex;
  }
  return fallbackHex || "#6B7280";
}

// Generic image matcher: scores images based on whether their filename/alt text contains any words from the variant's color name
function matchImageByColor(colorName: string, images: any[]): string | null {
  if (!colorName || !images || images.length === 0) return null;
  const words = colorName
    .toLowerCase()
    .split(/[\s/_-]+/)
    .filter((w) => w.length >= 3);

  if (words.length === 0) return null;

  let bestImg: string | null = null;
  let bestScore = 0;

  for (const img of images) {
    const url = (img.cloudinary_public_id || img.url || (typeof img === "string" ? img : "")).toLowerCase();
    const alt = (img.alt_text || "").toLowerCase();
    let score = 0;

    for (const word of words) {
      if (url.includes(word)) score += 3;
      if (alt.includes(word)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestImg = img.cloudinary_public_id || img.url || (typeof img === "string" ? img : null);
    }
  }

  return bestScore > 0 ? bestImg : null;
}

// Generic transparency detector: transparent formats (.png, transparent flag, removebg)
function isImageTransparent(imgUrl?: string | null, productHasTransparent?: boolean): boolean {
  if (!imgUrl || typeof imgUrl !== "string") return false;
  const lower = imgUrl.toLowerCase();
  if (
    lower.endsWith(".png") ||
    lower.includes(".png?") ||
    lower.includes("transparent") ||
    lower.includes("removebg")
  ) {
    return true;
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return false;
  }
  if (productHasTransparent && !lower.includes("cloudinary.com") && !lower.includes("unsplash.com")) {
    return true;
  }
  return false;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [product, setProduct] = useState<ProductItem | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  // Active dwell time, detail reading, and scroll tracking
  useProductDwellTracker(product?.id);

  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const [selectedState, setSelectedState] = useState("Lagos");
  const [selectedArea, setSelectedArea] = useState("LEKKI-AJAH (SANGOTEDO)");
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  // Track product view in recently viewed items
  useEffect(() => {
    if (product) {
      saveRecentlyViewed({
        id: product.id,
        slug: slug,
        title: product.title,
        price: product.price,
        discountBadge: product.badge,
        image: product.image,
      });
    }
  }, [product, slug]);

  const handleCopyLink = () => {
    const url = currentUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    const url = currentUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: product?.title || "Product on GTS",
          text: `Check out ${product?.title || "this product"} on GTS!`,
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // If the detail request can't be answered, the catalogue copy (also from the database) stands in.
  const { getProduct } = useCatalogue();
  const getFromCatalogue = useRef(getProduct);
  getFromCatalogue.current = getProduct;

  // Fetch product from live database
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

    async function fetchProductDetails() {
      try {
        const supabase = createClient() as any;
        const localFallback = getFromCatalogue.current(slug);

        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUuid = UUID_RE.test(decodedSlug);

        // 1. Query Supabase by slug or id
        let query = supabase
          .from("products")
          .select(`
            id,
            name,
            slug,
            sku,
            brand,
            sub_category,
            has_transparent_bg,
            short_description,
            description,
            base_price,
            compare_at_price,
            average_rating,
            review_count,
            tags,
            category:categories(name),
            variants:product_variants(*, inventory(quantity, reserved_quantity)),
            images:product_images(*)
          `);

        if (isUuid) {
          query = query.eq("id", decodedSlug);
        } else {
          query = query.ilike("slug", decodedSlug);
        }

        const { data: dbProduct, error: _queryErr } = await query.maybeSingle();

        let matched = dbProduct;

        // 2. If not found, try searching by product name keywords
        if (!matched && !isUuid) {
          const keywords = decodedSlug
            .split("-")
            .filter((w: string) => w.length > 2)
            .slice(0, 4)
            .join("%");

          if (keywords) {
            const { data: fallbackList } = await supabase
              .from("products")
              .select(`
                id,
                name,
                slug,
                sku,
                brand,
                sub_category,
                has_transparent_bg,
                short_description,
                description,
                base_price,
                compare_at_price,
                average_rating,
                review_count,
                tags,
                category:categories(name),
                variants:product_variants(*, inventory(quantity, reserved_quantity)),
                images:product_images(*)
              `)
              .ilike("name", `%${keywords}%`)
              .limit(1);

            if (fallbackList && fallbackList.length > 0) {
              matched = fallbackList[0];
            }
          }
        }

        if (matched && isMounted) {
          const priceNaira = (matched.base_price || 0) / 100;
          const origPriceNaira = matched.compare_at_price ? matched.compare_at_price / 100 : undefined;

          // Images
          const sortedImages = (matched.images || []).sort(
            (a: any, b: any) => (a.sort_order ?? a.position ?? 0) - (b.sort_order ?? b.position ?? 0)
          );
          const primaryImg =
            sortedImages.find((img: any) => img.is_primary)?.cloudinary_public_id ||
            sortedImages[0]?.cloudinary_public_id ||
            localFallback?.image ||
            "/placeholder-product.png";
          const allImgUrls: string[] = Array.from(
            new Set(sortedImages.map((img: any) => img.cloudinary_public_id).filter(Boolean))
          );

          // Check has_transparent_bg:
          // 1. Explicit boolean in DB takes highest precedence if true
          // 2. localFallback?.hasTransparentBg if true
          // 3. Auto-detect if primary image is .png or includes transparent
          const rawTransparent = matched.has_transparent_bg;
          const isPrimaryPng =
            typeof primaryImg === "string" &&
            (primaryImg.toLowerCase().endsWith(".png") ||
              primaryImg.toLowerCase().includes(".png?") ||
              primaryImg.toLowerCase().includes("transparent") ||
              primaryImg.toLowerCase().includes("removebg"));

          const detectedTransparent =
            rawTransparent === true ||
            localFallback?.hasTransparentBg === true ||
            isPrimaryPng;

          // Variants / Colors
          const dbVariants = matched.variants || [];
          const uniqueColorsMap = new Map<
            string,
            { color: string; label: string; main: string; thumbnails: string[]; hasTransparentBg?: boolean }
          >();

          let colorIndex = 0;
          dbVariants.forEach((v: any) => {
            const colorName = v.color || v.variant_color;
            if (colorName && !uniqueColorsMap.has(colorName)) {
              // 1. Check if variant has an explicit image_url
              let resolvedImg = v.image_url;

              // 2. Check if an image in sortedImages has variant_id matching this variant
              if (!resolvedImg) {
                const linkedImg = sortedImages.find(
                  (img: any) => img.variant_id && (img.variant_id === v.id || img.variant_id === v.variant_id)
                );
                if (linkedImg?.cloudinary_public_id) {
                  resolvedImg = linkedImg.cloudinary_public_id;
                }
              }

              // 3. Match against sortedImages by color keyword in url or alt text
              if (!resolvedImg && sortedImages.length > 0) {
                const colorMatched = matchImageByColor(colorName, sortedImages);
                if (colorMatched) {
                  resolvedImg = colorMatched;
                }
              }

              // 4. Index fallback if there are multiple images for multiple variants
              if (!resolvedImg) {
                resolvedImg = sortedImages[colorIndex]?.cloudinary_public_id || primaryImg;
              }

              const resolvedHex = getColorHex(colorName, v.color_hex || v.color_code);
              const isImgTrans = isImageTransparent(resolvedImg, detectedTransparent);

              uniqueColorsMap.set(colorName, {
                color: resolvedHex,
                label: colorName,
                main: resolvedImg,
                thumbnails: [resolvedImg, ...allImgUrls.filter((u: string) => u !== resolvedImg)],
                hasTransparentBg: isImgTrans,
              });

              colorIndex++;
            }
          });

          const colorImagesList = Array.from(uniqueColorsMap.values());
          const finalImages =
            colorImagesList.length > 0
              ? colorImagesList
              : (localFallback?.images && localFallback.images.length > 1
                  ? localFallback.images
                  : [
                      {
                        color: "default",
                        label: "Standard",
                        main: primaryImg,
                        thumbnails: allImgUrls.length > 0 ? allImgUrls : [primaryImg],
                        hasTransparentBg: detectedTransparent,
                      },
                    ]);

          const uniqueSizes = Array.from(
            new Set(dbVariants.map((v: any) => v.size || v.variant_size).filter(Boolean))
          ) as string[];

          const finalSizes =
            uniqueSizes.length > 0
              ? uniqueSizes
              : (localFallback?.sizes && localFallback.sizes.length > 0
                  ? localFallback.sizes
                  : ["Standard"]);

          // Clean short description extraction
          let shortDesc = matched.short_description;
          if (!shortDesc && matched.description) {
            const clean = matched.description
              .replace(/<[^>]*>/g, " ")
              .replace(/[#*`_>]/g, "")
              .replace(/^[-\d.]+\s+/gm, "")
              .replace(/\s+/g, " ")
              .trim();
            if (clean && clean.length > 0) {
              const firstSentence = clean.split(/[.!?]\s+/)[0];
              shortDesc =
                firstSentence && firstSentence.length > 20
                  ? (firstSentence.length > 220 ? firstSentence.slice(0, 217) + "..." : firstSentence + ".")
                  : (clean.length > 220 ? clean.slice(0, 217) + "..." : clean);
            }
          }
          if (!shortDesc && localFallback?.shortDescription) {
            shortDesc = localFallback.shortDescription;
          }
          if (!shortDesc && localFallback?.description) {
            shortDesc = localFallback.description;
          }

          // Map variant inventory
          const mappedVariants = dbVariants.map((v: any) => {
            const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
            const qty = Number(inv?.quantity ?? v.quantity ?? 0);
            const reserved = Number(inv?.reserved_quantity ?? 0);
            const available = Math.max(0, qty - reserved);
            return {
              id: v.id,
              size: v.size || v.variant_size || "Standard",
              color: v.color || v.variant_color || "Default",
              colorHex: v.color_hex || v.color_code,
              sku: v.sku,
              quantity: qty,
              available,
              inStock: available > 0,
            };
          });

          const totalAvailable = mappedVariants.length > 0
            ? mappedVariants.reduce((sum: number, v: any) => sum + v.available, 0)
            : 0;

          const formatted: ProductItem = {
            id: matched.slug || matched.id,
            brand: matched.brand || localFallback?.brand || "GTS",
            sku: matched.sku || localFallback?.sku || `GTS-${matched.id.slice(0, 6)}`,
            title: matched.name || localFallback?.title,
            price: `₦${priceNaira.toLocaleString()}`,
            originalPrice: origPriceNaira ? `₦${origPriceNaira.toLocaleString()}` : localFallback?.originalPrice,
            priceNum: priceNaira || localFallback?.priceNum || 0,
            badge:
              origPriceNaira && origPriceNaira > priceNaira
                ? `${Math.round(((origPriceNaira - priceNaira) / origPriceNaira) * 100)}% OFF`
                : (localFallback?.badge && localFallback.badge !== "HOT" ? localFallback.badge : undefined),
            rating: Number(matched.average_rating || localFallback?.rating || 4.8),
            reviewsCount: Number(matched.review_count || localFallback?.reviewsCount || 42),
            reviews: `${matched.review_count || localFallback?.reviews || 42}`,
            shortDescription: shortDesc || matched.description || localFallback?.description || "",
            description: matched.description || localFallback?.description || "",
            category: matched.category?.name || localFallback?.category || "General",
            subCategory: matched.sub_category || localFallback?.subCategory || "All",
            image: primaryImg !== "/placeholder-product.png" ? primaryImg : (localFallback?.image || primaryImg),
            images: finalImages,
            sizes: finalSizes,
            tags: matched.tags || localFallback?.tags || [],
            descriptionImages: (() => {
              const dbDesc = Array.isArray(matched.description_image_urls) && matched.description_image_urls.length > 0
                ? matched.description_image_urls
                : (Array.isArray(matched.description_images) && matched.description_images.length > 0
                    ? matched.description_images.map((d: any) => (typeof d === "string" ? d : d.url)).filter(Boolean)
                    : []);
              return Array.from(
                new Set([...dbDesc, ...allImgUrls, ...(localFallback?.descriptionImages || [])].filter(Boolean))
              ) as string[];
            })(),
            hasTransparentBg: detectedTransparent,
            variants: mappedVariants,
            availableStock: totalAvailable,
            inStock: totalAvailable > 0,
          };

          setProduct(formatted);

          // Track product page view in analytics for Trending scoring
          if (matched.id) {
            void fetch("/api/v1/analytics/view", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: matched.id }),
            }).catch(() => {});
          }

          if (finalSizes && finalSizes.length > 0) {
            setSelectedSize(finalSizes[0] || "Standard");
          }

          // Fetch brand logo via /api/v1/brands if brand exists
          const bName = matched?.brand || localFallback?.brand;
          if (bName) {
            try {
              const bRes = await fetch("/api/v1/brands");
              if (bRes.ok) {
                const json = await bRes.json();
                const matchedBrand = (json.data || []).find(
                  (b: any) => b.name && b.name.toLowerCase() === bName.trim().toLowerCase()
                );
                if (matchedBrand?.logo_url && isMounted) {
                  setBrandLogoUrl(matchedBrand.logo_url);
                }
              }
            } catch {
              // silent
            }
          }
        } else if (isMounted) {
          if (localFallback) {
            setProduct(localFallback);
            if (localFallback.sizes && localFallback.sizes.length > 0) {
              setSelectedSize(localFallback.sizes[0] || "Standard");
            }
          } else {
            setProduct(null);
          }
        }
      } catch (err) {
        console.warn("Could not fetch product details from database:", err);
        const localFallback = getFromCatalogue.current(slug);
        if (localFallback && isMounted) {
          setProduct(localFallback);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProductDetails();

    // Subscribe to live inventory updates via Supabase Realtime
    const supabase = createClient() as any;
    const channel = supabase
      .channel(`inventory-live-${decodedSlug}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          if (isMounted) fetchProductDetails();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [slug]);

  // Loading skeleton state matching exact 3-pane structure
  if (loading) {
    return <ProductDetailSkeleton />;
  }

  // Not found state
  if (!product) {
    return (
      <div className="min-h-[70vh] bg-white text-[#010101] flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F2F0EA] flex items-center justify-center mb-4 text-[#A4A4A4]">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="font-athelas text-3xl font-bold text-[#010101] mb-2">Product Not Found</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          We couldn&apos;t find the product you were looking for. It may have been removed or the link might be broken.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="px-6 py-3 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white text-xs font-bold rounded-full transition-all shadow-xs"
          >
            Explore Catalog
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-[#F2F0EA] hover:bg-gray-200 text-[#010101] text-xs font-bold rounded-full transition-all"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const isWishlisted = isInWishlist(product.id);

  const handleToggleWishlist = () => {
    toggleWishlist(product.id);
    trackProductWishlist(product.id, !isWishlisted ? "add" : "remove");
  };

  // Check if product has real multiple color options (hide for single-variant / snacks)
  const hasMultipleColors =
    Boolean(product.images) &&
    product.images.length > 1 &&
    product.images.some(
      (img) => img.label && img.label.toLowerCase() !== "default" && img.label.toLowerCase() !== "standard"
    );

  const hasMultipleSizes =
    Boolean(product.sizes) &&
    product.sizes.length > 1 &&
    product.sizes.some(
      (s) => s && s.toLowerCase() !== "standard" && s.toLowerCase() !== "one size" && s.toLowerCase() !== "default"
    );

  const activeColor = product.images?.[selectedColorIndex] || product.images?.[0] || {
    color: "#111827",
    label: "Default",
    main: product.image || "/placeholder-product.png",
    thumbnails: [product.image || "/placeholder-product.png"],
  };

  // The active color's main photo
  const activeColorMain = activeColor.main || product.image || "/placeholder-product.png";

  // Build list of thumbnails: ONLY the active product photo + actual product description images (NOT other color variants)
  const allThumbnails: string[] = [activeColorMain];
  if (product.descriptionImages && product.descriptionImages.length > 0) {
    product.descriptionImages.forEach((img) => {
      if (img && !allThumbnails.includes(img)) {
        allThumbnails.push(img);
      }
    });
  }

  // Only show thumbnail row if there are real product description images
  const hasDescriptionGallery = allThumbnails.length > 1;

  const activeMainImage =
    allThumbnails[selectedImageIndex] || activeColorMain || product.image || "/placeholder-product.png";

  const isMainTransparent = Boolean(product.hasTransparentBg);
  const isCurrentTransparent = isImageTransparent(activeMainImage, isMainTransparent);

  // Match active variant and calculate available stock
  const currentVariant =
    product.variants?.find((v) => {
      const matchSize = !selectedSize || selectedSize.toLowerCase() === v.size.toLowerCase();
      const matchColor = !activeColor?.label || activeColor.label.toLowerCase() === v.color.toLowerCase() || activeColor.color.toLowerCase() === v.color.toLowerCase();
      return matchSize && matchColor;
    }) ||
    product.variants?.find((v) => !selectedSize || selectedSize.toLowerCase() === v.size.toLowerCase()) ||
    product.variants?.[0];

  const currentAvailableStock = currentVariant ? currentVariant.available : (product.availableStock ?? 0);
  const isOutOfStock = currentAvailableStock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const addQty = Math.min(currentAvailableStock, quantity);
    const result = addToCart(
      product,
      selectedSize || product.sizes?.[0] || "Standard",
      activeColor.label,
      addQty,
      currentVariant?.id,
      currentAvailableStock
    );
    if (result.ok) {
      trackProductCart(product.id);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  // Calculate delivery date ranges
  const now = new Date();
  const pickupStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const pickupEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const doorStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const doorEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const formatShortDate = (d: Date) =>
    d.toLocaleDateString("en-NG", { day: "2-digit", month: "long" });

  const pickupDateStr = `${formatShortDate(pickupStart)} and ${formatShortDate(pickupEnd)}`;
  const doorDateStr = `${formatShortDate(doorStart)} and ${formatShortDate(doorEnd)}`;

  const availableAreas = NIGERIAN_LOCATIONS[selectedState] || NIGERIAN_LOCATIONS["Lagos"] || [];

  return (
    <div className="min-h-screen bg-white text-[#010101] pb-24 md:pb-0">

      {/* ── Top Section (Breadcrumb, Image Showcase, Details, Delivery & Returns) ── */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 pb-2 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

          {/* ════════ LEFT SECTION (9 cols): Breadcrumb + (Image & Details) ════════ */}
          <div className="lg:col-span-9 flex flex-col gap-3">
            {/* Breadcrumb - spanning across on top of Image and Details */}
            <nav aria-label="Breadcrumb" className="text-xs text-gray-500 font-medium flex items-center gap-1.5 flex-wrap font-sans">
              <Link href="/" className="hover:text-[#010101] transition-colors">Home</Link>
              <span>›</span>
              <Link href={`/search?category=${encodeURIComponent(product.category)}`} className="hover:text-[#010101] transition-colors">
                {product.category}
              </Link>
              <span>›</span>
              <Link href={`/search?brand=${encodeURIComponent(product.brand)}`} className="text-[#010101] font-bold hover:underline transition-all">
                {product.brand}
              </Link>
            </nav>

            {/* Sub-container for Pane 1 (Image) & Pane 2 (Details) */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-6 lg:gap-8 items-start pt-1">

              {/* ── Pane 1: Image Showcase & Social Share ── */}
              <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-0 md:gap-2.5 md:sticky md:top-[80px] pb-0 md:pb-1">
                {/* ── MOBILE VIEW: Horizontal Peekable Card List (Multiple Images) or Single Card ── */}
                {hasDescriptionGallery ? (
                  <div className="md:hidden w-full">
                    <div className="flex items-center gap-3 overflow-x-auto snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-6 pb-1 pt-0.5 px-4 -mx-4 sm:px-6 sm:-mx-6 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {allThumbnails.map((imgSrc, idx) => {
                        const thumbTransparent = isImageTransparent(imgSrc, isMainTransparent);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedImageIndex(idx);
                              const matchedColorIdx = product.images?.findIndex((col) => col.main === imgSrc);
                              if (matchedColorIdx !== -1 && matchedColorIdx !== undefined) {
                                setSelectedColorIndex(matchedColorIdx);
                              }
                              setIsZoomOpen(true);
                            }}
                            className={`shrink-0 snap-start w-[78vw] max-w-[320px] aspect-square rounded-2xl overflow-hidden relative border border-gray-200/80 shadow-2xs group transition-all cursor-zoom-in flex items-center justify-center ${
                              thumbTransparent ? "" : "bg-white"
                            }`}
                            style={
                              thumbTransparent
                                ? { background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }
                                : undefined
                            }
                          >
                            <Image
                              src={imgSrc}
                              alt={`${product.title} - Image ${idx + 1}`}
                              fill
                              className={`group-hover:scale-105 transition-transform duration-300 ${
                                thumbTransparent
                                  ? "object-contain p-6 drop-shadow-md"
                                  : "object-cover p-0"
                              }`}
                              sizes="(max-width: 768px) 85vw, 320px"
                              priority={idx === 0}
                            />
                          </div>
                        );
                      })}
                      {/* Trailing spacer so the last card has padding on the right when scrolled */}
                      <div className="w-1 shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="md:hidden w-full">
                    <div
                      onClick={() => {
                        setSelectedImageIndex(0);
                        setIsZoomOpen(true);
                      }}
                      className={`w-full aspect-square rounded-2xl overflow-hidden relative border border-gray-200/80 shadow-2xs group transition-all cursor-zoom-in shrink-0 flex items-center justify-center ${
                        isCurrentTransparent ? "" : "bg-white"
                      }`}
                      style={
                        isCurrentTransparent
                          ? { background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }
                          : undefined
                      }
                    >
                      <Image
                        src={activeMainImage}
                        alt={product.title}
                        fill
                        className={`group-hover:scale-105 transition-transform duration-300 ${
                          isCurrentTransparent
                            ? "object-contain p-6 drop-shadow-md"
                            : "object-cover p-0"
                        }`}
                        sizes="(max-width: 768px) 100vw, 320px"
                        priority
                      />
                    </div>
                  </div>
                )}

                {/* ── DESKTOP VIEW: Single Showcase Card + Thumbnails Row ── */}
                <div className="hidden md:flex flex-col gap-2.5">
                  {/* Square Showcase Image Box */}
                  <div
                    onClick={() => setIsZoomOpen(true)}
                    className={`w-full aspect-square rounded-2xl sm:rounded-3xl overflow-hidden relative border border-gray-200/80 shadow-2xs group transition-all cursor-zoom-in shrink-0 flex items-center justify-center ${
                      isCurrentTransparent ? "" : "bg-white"
                    }`}
                    style={
                      isCurrentTransparent
                        ? { background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }
                        : undefined
                    }
                  >
                    <Image
                      src={activeMainImage}
                      alt={product.title}
                      fill
                      className={`group-hover:scale-105 transition-transform duration-300 ${
                        isCurrentTransparent
                          ? "object-contain p-6 sm:p-7 drop-shadow-md"
                          : "object-cover p-0"
                      }`}
                      sizes="(max-width: 768px) 100vw, 320px"
                      priority
                    />
                  </div>

                  {/* Compact Thumbnail Row (Desktop Only) */}
                  {hasDescriptionGallery && (
                    <div className="flex items-center gap-2 overflow-x-auto shrink-0 pt-1 pb-2 px-0.5 -mx-0.5 [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
                      {allThumbnails.map((thumb, idx) => {
                        const isSelected = selectedImageIndex === idx;
                        const thumbTransparent = isImageTransparent(thumb, isMainTransparent);

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedImageIndex(idx);
                              const matchedColorIdx = product.images?.findIndex((col) => col.main === thumb);
                              if (matchedColorIdx !== -1 && matchedColorIdx !== undefined) {
                                setSelectedColorIndex(matchedColorIdx);
                              }
                            }}
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all overflow-hidden relative cursor-pointer ${
                              thumbTransparent ? "p-1" : "p-0"
                            } ${
                              isSelected
                                ? "border-2 border-[#010101] bg-[#ECEAE6] shadow-sm ring-1 ring-[#010101]/20"
                                : "border-gray-200 bg-[#F9F8F5] hover:bg-[#F2F0EA]"
                            }`}
                          >
                            <Image
                              src={thumb}
                              alt={`Thumbnail ${idx + 1}`}
                              fill
                              className={thumbTransparent ? "object-contain p-0.5" : "object-cover p-0"}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Share This Product (Desktop only) ── */}
                <div className="hidden md:flex pt-2.5 border-t border-gray-200/90 flex-col gap-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-black-500 font-mono">
                    SHARE THIS PRODUCT
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on Facebook"
                      className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full border border-gray-300 hover:border-[#1877F2] hover:bg-[#1877F2]/10 hover:text-[#1877F2] text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>

                    {/* X (Twitter) */}
                    <a
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(product.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on X"
                      className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full border border-gray-300 hover:border-black hover:bg-black/10 hover:text-black text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>

                    {/* WhatsApp */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${product.title} - ${currentUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on WhatsApp"
                      className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full border border-gray-300 hover:border-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366] text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                    </a>

                    {/* Copy Link */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        aria-label="Copy link"
                        className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full border border-gray-300 hover:border-black hover:bg-black/10 hover:text-black text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-3.35l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                      </button>
                      {copiedLink && (
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#010101] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Pane 2: Middle Details Pane (Expands to take available space) ── */}
              <div className="flex-1 min-w-0 space-y-2.5 sm:space-y-3.5 md:space-y-4">
            {/* Top Brand & SKU Row */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs">
                {brandLogoUrl ? (
                  <div className="w-5 h-5 rounded-full bg-white border border-gray-200/90 flex items-center justify-center overflow-hidden p-0.5 shadow-2xs shrink-0">
                    <img
                      src={brandLogoUrl}
                      alt={product.brand || "Brand"}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-[#010101] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    ✓
                  </span>
                )}
                <span className="font-bold text-[#010101] uppercase tracking-wider font-mono">
                  {product.brand}
                </span>
              </div>
              <span className="text-gray-400 text-xs font-mono">{product.sku}</span>
            </div>

            {/* Product Title */}
            <h1 className="text-2xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-[#010101] leading-tight font-sans">
              {product.title}
            </h1>

            {/* Price Display (Above Ratings on mobile & desktop) */}
            <div className="flex items-baseline gap-2.5 sm:gap-3 flex-wrap">
              <span className="font-sans text-2xl sm:text-3xl font-extrabold text-[#010101] tracking-tight">
                {product.price}
              </span>
              {product.originalPrice && (
                <span className="text-sm sm:text-base text-gray-400 line-through">
                  {product.originalPrice}
                </span>
              )}
              {product.badge && (
                <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {product.badge}
                </span>
              )}
            </div>

            {/* Rating Row + Mobile Native Share Trigger (Below Price) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
                <div className="flex items-center text-amber-500 gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${
                        i < Math.floor(product.rating) ? "fill-current" : "fill-gray-200"
                      }`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-bold text-[#010101] text-xs">{product.rating}</span>
                <span className="text-gray-300">•</span>
                <button
                  onClick={() => {
                    const revTab = document.getElementById("reviews-section");
                    revTab?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-gray-500 hover:text-[#010101] underline cursor-pointer text-xs"
                >
                  {product.reviewsCount || 2300} reviews
                </button>
              </div>

              {/* Anchored Share Icon Button for Mobile */}
              <div className="relative md:hidden">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  aria-label="Share product"
                  className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </button>
                {copiedLink && (
                  <span className="absolute -top-7 right-0 bg-[#010101] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                    Copied!
                  </span>
                )}
              </div>
            </div>

            {/* Short Description (concise summary) */}
            {(product.shortDescription || product.description) && (
              <div className="text-xs sm:text-sm text-gray-600 font-normal leading-relaxed">
                <MarkdownContent content={product.shortDescription || product.description} />
              </div>
            )}

            {/* Live Stock Status Indicator */}
            <div className="pt-1">
              {isOutOfStock ? (
                <div className="inline-flex items-center gap-2 py-1 px-3 rounded-lg bg-red-50 border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs font-bold text-red-700">Out of Stock</span>
                  <span className="text-[11px] text-red-600">Currently unavailable for order</span>
                </div>
              ) : currentAvailableStock <= 5 ? (
                <div className="inline-flex items-center gap-2 py-1 px-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold text-amber-800">Only {currentAvailableStock} left in stock!</span>
                  <span className="text-[11px] text-amber-700">Order soon to secure yours</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 py-1 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-800">In Stock</span>
                  <span className="text-[11px] text-emerald-700 font-mono">({currentAvailableStock} units available)</span>
                </div>
              )}
            </div>

            {/* ── Color Selection (only if real color options exist) ── */}
            {hasMultipleColors && (
              <div className="space-y-2 sm:space-y-2.5 pt-1.5 sm:pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-500">
                    Color: <span className="text-[#010101] font-bold ml-1">{activeColor.label}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-2.5">
                  {product.images.map((img, idx) => {
                    const isColorSelected = selectedColorIndex === idx;
                    const swatchTransparent =
                      typeof img.hasTransparentBg === "boolean"
                        ? img.hasTransparentBg
                        : isImageTransparent(img.main, isMainTransparent);

                    return (
                      <button
                        key={img.label || img.color || idx}
                        onClick={() => {
                          setSelectedColorIndex(idx);
                          setSelectedImageIndex(0);
                        }}
                        title={img.label}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center transition-all cursor-pointer overflow-hidden relative ${
                          swatchTransparent ? "p-1" : "p-0"
                        } ${
                          isColorSelected
                            ? "border-2 border-[#010101] bg-[#ECEAE6] shadow-sm ring-1 ring-[#010101]/20 scale-105"
                            : "border-gray-200 bg-[#F9F8F5] hover:bg-gray-100"
                        }`}
                      >
                        <Image
                          src={img.main}
                          alt={img.label}
                          fill
                          className={swatchTransparent ? "object-contain p-0.5" : "object-cover p-0"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Size Selection (only if multiple sizes exist) ── */}
            {hasMultipleSizes && (
              <div className="space-y-2 sm:space-y-2.5 pt-1.5 sm:pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-500">
                    Size: <span className="text-[#010101] font-bold ml-1">{selectedSize}</span>
                  </span>
                  <button className="text-xs text-[#010101] underline font-medium hover:opacity-80 cursor-pointer">
                    Size guide
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {product.sizes.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#010101] text-white border-[#010101] shadow-xs"
                            : "bg-white text-[#010101] border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Add to Cart & Wishlist with Quantity Stepper (Desktop Inline) ── */}
            <div className="hidden md:flex pt-1 sm:pt-2 items-center gap-2.5 sm:gap-3">
              {/* Quantity Stepper */}
              <div className="flex items-center gap-2.5 sm:gap-3 bg-[#F9F8F5] border border-gray-200 rounded-full px-3.5 py-2.5 shrink-0">
                <button
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1 || isOutOfStock}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="text-[#010101] hover:text-[#EDCF5D] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all active:scale-90 p-0.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                <span className="text-sm font-black text-[#010101] min-w-[18px] text-center tabular-nums font-sans">
                  {isOutOfStock ? 0 : Math.min(currentAvailableStock, quantity)}
                </span>

                <button
                  aria-label="Increase quantity"
                  disabled={quantity >= currentAvailableStock || isOutOfStock}
                  onClick={() => setQuantity((q) => Math.min(currentAvailableStock, q + 1))}
                  className="text-[#010101] hover:text-[#EDCF5D] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all active:scale-90 p-0.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 font-bold py-3 px-4 rounded-full shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs sm:text-sm font-sans ${
                  isOutOfStock
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : addedToCart
                    ? "bg-emerald-600 text-white"
                    : "bg-[#010101] hover:bg-black text-white cursor-pointer"
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span>{isOutOfStock ? "Out of Stock" : addedToCart ? "Added to Cart!" : "Add to cart"}</span>
              </button>

              <button
                aria-label="Add to wishlist"
                onClick={handleToggleWishlist}
                className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                  isWishlisted
                    ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101] shadow-xs"
                    : "bg-[#F9F8F5] border-gray-200 text-[#010101] hover:bg-gray-100"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill={isWishlisted ? "#010101" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            </div>

            {/* ── Promotions Section ── */}
            <div className="pt-3.5 border-t border-gray-200/90 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#010101] font-mono block">
                PROMOTIONS
              </span>

              <div className="space-y-2 text-xs">
                {/* Promo 1: Call To Place Order */}
                <div className="flex items-start gap-2.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#010101] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                  <a
                    href="tel:02018883300"
                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-normal leading-tight"
                  >
                    Call 02018883300 To Place Your Order
                  </a>
                </div>

                {/* Promo 2: PickUp Station Shipping */}
                <div className="flex items-start gap-2.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#010101] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                  <span className="text-blue-600 hover:text-blue-800 transition-colors font-normal leading-tight">
                    Enjoy cheaper shipping fees when you select a PickUp Station at checkout.
                  </span>
                </div>

                {/* Promo 3: Wholesaler Sign Up */}
                <div className="flex items-start gap-2.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#010101] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                  <span className="text-gray-800 font-normal leading-tight">
                    Are you a wholesaler? Sign up{" "}
                    <Link
                      href="/auth/register?type=wholesale"
                      className="underline font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      here
                    </Link>{" "}
                    to get wholesale discounts.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

          {/* ════════ RIGHT SECTION: Delivery & Returns (~3 cols) ════════ */}
          <div className="lg:col-span-3 border-t border-gray-200/90 lg:border-t-0 pt-4 sm:pt-5 lg:pt-0">
            <div className="lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:p-5 lg:shadow-xs space-y-4 text-xs font-sans">
              {/* Header */}
              <div className="space-y-1.5 pb-3 border-b border-gray-100">
                <span className="text-[11px] font-bold tracking-wider text-black-500 uppercase font-mono">
                  DELIVERY & RETURNS
                </span>
                <p className="text-[11px] text-gray-500 leading-snug">
                  The BEST products, delivered faster. Pay on DELIVERY, Cash, Bank Transfer or Card.
                </p>
              </div>

              {/* Location Selectors */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                  Choose your location
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setSelectedState(newState);
                      const areas = NIGERIAN_LOCATIONS[newState] || [];
                      setSelectedArea(areas[0] || "");
                    }}
                    className="w-full text-xs font-medium rounded-xl border border-gray-200 px-3 py-2 bg-[#F9F8F5] text-gray-800 focus:outline-none focus:border-[#010101] cursor-pointer"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-gray-200 px-3 py-2 bg-[#F9F8F5] text-gray-800 focus:outline-none focus:border-[#010101] cursor-pointer"
                  >
                    {availableAreas.map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Options */}
              <div className="space-y-3.5 pt-1 border-t border-gray-100">
                {/* Pickup Station */}
                <div className="flex gap-3 items-start mt-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-700 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-xs">Pickup Station</span>
                      <span className="font-bold text-gray-900 text-xs font-mono">₦1,000</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Ready for pickup between <span className="font-semibold text-gray-800">{pickupDateStr}</span> if you order now.
                    </p>
                  </div>
                </div>

                {/* Door Delivery */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-700 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-xs">Door Delivery</span>
                      <span className="font-bold text-gray-900 text-xs font-mono">₦1,600</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Ready for delivery between <span className="font-semibold text-gray-800">{doorDateStr}</span> to your address.
                    </p>
                  </div>
                </div>

                {/* Return Policy */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-700 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <span className="font-bold text-gray-900 text-xs">Return Policy</span>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Free return within 7 days for ALL eligible items.
                    </p>
                  </div>
                </div>

                {/* Warranty & Guarantee */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-[#EDCF5D]/20 flex items-center justify-center shrink-0 text-[#9E7B00] mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <span className="font-bold text-gray-900 text-xs">Authenticity Guarantee</span>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      100% Genuine product verified by GTS Quality Control.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Tabs Section: Details, Reviews, Discussion ── */}
      <ProductTabs
        product={product}
        rating={product.rating}
        reviewsCount={product.reviewsCount}
        onOpenZoom={(imgUrl) => {
          const idx = allThumbnails.indexOf(imgUrl);
          if (idx !== -1) {
            setSelectedImageIndex(idx);
          }
          setIsZoomOpen(true);
        }}
      />

      {/* ── Similar Finds Section: Landing page style carousel ── */}
      <SimilarFinds currentProduct={product} />

      {/* ── Product Full-Screen Pan & Zoom Lightbox ── */}
      <ProductZoomLightbox
        isOpen={isZoomOpen}
        onClose={() => setIsZoomOpen(false)}
        images={allThumbnails}
        initialIndex={selectedImageIndex}
        productTitle={product.title}
        hasTransparentBg={isMainTransparent}
      />

      {/* ── Fixed Mobile Bottom Action Bar (Pinned overlay at bottom of screen) ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-2.5 shadow-[0_-4px_25px_rgba(0,0,0,0.1)] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center gap-2.5 max-w-md mx-auto">
          {/* Quantity Stepper */}
          <div className="flex items-center gap-2.5 bg-[#F9F8F5] border border-gray-200 rounded-full px-3 py-2 shrink-0">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || isOutOfStock}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="text-[#010101] hover:text-[#EDCF5D] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all active:scale-90 p-0.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>

            <span className="text-sm font-black text-[#010101] min-w-[16px] text-center tabular-nums font-sans">
              {isOutOfStock ? 0 : Math.min(currentAvailableStock, quantity)}
            </span>

            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= currentAvailableStock || isOutOfStock}
              onClick={() => setQuantity((q) => Math.min(currentAvailableStock, q + 1))}
              className="text-[#010101] hover:text-[#EDCF5D] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all active:scale-90 p-0.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
            className={`flex-1 font-bold py-3 px-4 rounded-full shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs sm:text-sm font-sans ${
              isOutOfStock
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : addedToCart
                ? "bg-emerald-600 text-white"
                : "bg-[#010101] hover:bg-black text-white cursor-pointer"
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span>{isOutOfStock ? "Out of Stock" : addedToCart ? "Added to Cart!" : "Add to cart"}</span>
          </button>

          {/* Wishlist Button */}
          <button
            type="button"
            aria-label="Add to wishlist"
            onClick={handleToggleWishlist}
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all shrink-0 ${
              isWishlisted
                ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101] shadow-xs"
                : "bg-[#F9F8F5] border-gray-200 text-[#010101] hover:bg-gray-100"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill={isWishlisted ? "#010101" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Reviews Custom Sort Dropdown ─────────────────────────────────────────────
function ReviewsSortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const options = ["Newest", "Highest Rating", "Lowest Rating"];

  return (
    <div ref={dropdownRef} className="relative inline-block text-left font-sans">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#010101] bg-[#F2F0EA] hover:bg-[#EDCF5D] px-4 py-2 rounded-full transition-colors cursor-pointer select-none"
      >
        <span>{value}</span>
        <svg
          className={`w-3.5 h-3.5 text-[#010101] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden min-w-[175px] animate-in fade-in duration-150 py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors font-sans flex items-center justify-between cursor-pointer ${
                value === opt
                  ? "bg-[#EDCF5D] text-[#010101]"
                  : "text-[#010101] hover:bg-[#F2F0EA]"
              }`}
            >
              <span>{opt}</span>
              {value === opt && (
                <svg className="w-3.5 h-3.5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bento Product Gallery (Dimension & Orientation Aware) ───────────────────
type ImageOrientation = "portrait" | "landscape" | "square";

interface ImageMeta {
  url: string;
  aspect: number;
  orientation: ImageOrientation;
}

function ProductBentoGallery({
  images,
  productTitle,
  onImageClick,
}: {
  images: string[];
  productTitle: string;
  onImageClick?: (imgUrl: string, idx: number) => void;
}) {
  // Strictly deduplicate images to eliminate any repeated color or showcase photos
  const uniqueImages = useMemo(() => Array.from(new Set((images || []).filter(Boolean))), [images]);

  const [imageMetas, setImageMetas] = useState<ImageMeta[]>(() =>
    uniqueImages.map((url) => ({
      url,
      aspect: 1.33,
      orientation: "landscape",
    }))
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasMoreThan3Rows, setHasMoreThan3Rows] = useState(false);
  const [max3RowsHeight, setMax3RowsHeight] = useState<number | undefined>(undefined);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uniqueImages.length === 0) return;
    let isMounted = true;

    uniqueImages.forEach((url, idx) => {
      if (!url) return;
      const img = new window.Image();
      img.src = url;

      const handleLoaded = (w: number, h: number) => {
        if (!isMounted || w === 0 || h === 0) return;
        const aspect = w / h;
        const orientation: ImageOrientation =
          aspect < 0.88 ? "portrait" : aspect > 1.15 ? "landscape" : "square";

        setImageMetas((prev) => {
          const next = [...prev];
          next[idx] = { url, aspect, orientation };
          return next;
        });
      };

      if (img.complete && img.naturalWidth > 0) {
        handleLoaded(img.naturalWidth, img.naturalHeight);
      } else {
        img.onload = () => {
          handleLoaded(img.naturalWidth, img.naturalHeight);
        };
      }
    });

    return () => {
      isMounted = false;
    };
  }, [uniqueImages]);

  // Measure row offsets to detect if gallery exceeds 3 rows
  useEffect(() => {
    const calculate3RowsHeight = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const children = Array.from(grid.children) as HTMLElement[];
      if (children.length === 0) return;

      const rowTops: number[] = [];
      children.forEach((child) => {
        const top = child.offsetTop;
        if (!rowTops.some((t) => Math.abs(t - top) < 14)) {
          rowTops.push(top);
        }
      });

      rowTops.sort((a, b) => a - b);

      if (rowTops.length > 3 && typeof rowTops[2] === "number") {
        setHasMoreThan3Rows(true);
        const thirdRowTop = rowTops[2];
        let maxBottom = 0;
        children.forEach((child) => {
          if (child.offsetTop <= thirdRowTop + 18) {
            const bottom = child.offsetTop + child.offsetHeight;
            if (bottom > maxBottom) {
              maxBottom = bottom;
            }
          }
        });

        if (maxBottom > 0) {
          setMax3RowsHeight(maxBottom);
        }
      } else {
        setHasMoreThan3Rows(false);
        setMax3RowsHeight(undefined);
      }
    };

    calculate3RowsHeight();
    window.addEventListener("resize", calculate3RowsHeight);
    const timer = setTimeout(calculate3RowsHeight, 350);
    return () => {
      window.removeEventListener("resize", calculate3RowsHeight);
      clearTimeout(timer);
    };
  }, [uniqueImages, imageMetas]);

  if (uniqueImages.length === 0) return null;

  // Single Image Case
  if (uniqueImages.length === 1 && uniqueImages[0]) {
    const meta0 = imageMetas[0] || { url: uniqueImages[0], orientation: "landscape", aspect: 1.5 };
    const isPortrait = meta0.orientation === "portrait";
    const isSquare = meta0.orientation === "square";

    return (
      <div className="pt-2 w-full">
        <div
          onClick={() => onImageClick?.(meta0.url, 0)}
          className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200 ${
            isPortrait
              ? "max-w-sm sm:max-w-md mx-auto aspect-[3/4] sm:aspect-[4/5] max-h-[500px]"
              : isSquare
              ? "max-w-md sm:max-w-lg mx-auto aspect-square max-h-[440px]"
              : "w-full aspect-[16/9] sm:aspect-[21/9] max-h-[380px]"
          }`}
        >
          <img
            src={meta0.url}
            alt={`${productTitle} showcase 1`}
            className={`w-full h-full transition-transform duration-300 group-hover:scale-103 ${
              isPortrait ? "object-contain p-2 sm:p-4" : "object-cover"
            }`}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2 Images Case (Dimension Aware)
  if (uniqueImages.length === 2 && uniqueImages[0] && uniqueImages[1]) {
    const meta0 = imageMetas[0] || { url: uniqueImages[0], orientation: "landscape", aspect: 1.33 };
    const meta1 = imageMetas[1] || { url: uniqueImages[1], orientation: "landscape", aspect: 1.33 };

    const is0Portrait = meta0.orientation === "portrait";
    const is1Portrait = meta1.orientation === "portrait";

    // Scenario 1: One landscape, one portrait
    if (!is0Portrait && is1Portrait) {
      return (
        <div className="pt-2 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-center">
            {/* Landscape (wide) Left */}
            <div
              onClick={() => onImageClick?.(meta0.url, 0)}
              className="sm:col-span-7 group relative aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta0.url}
                alt={`${productTitle} showcase 1`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>

            {/* Portrait (vertical) Right */}
            <div
              onClick={() => onImageClick?.(meta1.url, 1)}
              className="sm:col-span-5 group relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta1.url}
                alt={`${productTitle} showcase 2`}
                className="w-full h-full object-cover sm:object-contain p-0 sm:p-2 transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Scenario 2: Portrait left, landscape right
    if (is0Portrait && !is1Portrait) {
      return (
        <div className="pt-2 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-center">
            {/* Portrait (vertical) Left */}
            <div
              onClick={() => onImageClick?.(meta0.url, 0)}
              className="sm:col-span-5 group relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta0.url}
                alt={`${productTitle} showcase 1`}
                className="w-full h-full object-cover sm:object-contain p-0 sm:p-2 transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>

            {/* Landscape (wide) Right */}
            <div
              onClick={() => onImageClick?.(meta1.url, 1)}
              className="sm:col-span-7 group relative aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta1.url}
                alt={`${productTitle} showcase 2`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Scenario 3: Both are portrait
    if (is0Portrait && is1Portrait) {
      return (
        <div className="pt-2 w-full">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 max-w-2xl">
            {[meta0, meta1].map((m, idx) => (
              <div
                key={idx}
                onClick={() => onImageClick?.(m.url, idx)}
                className="group relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
              >
                <img
                  src={m.url}
                  alt={`${productTitle} showcase ${idx + 1}`}
                  className="w-full h-full object-cover sm:object-contain p-0 sm:p-2 transition-transform duration-300 group-hover:scale-103"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Scenario 4: Both are landscape or square
    return (
      <div className="pt-2 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          <div
            onClick={() => onImageClick?.(meta0.url, 0)}
            className="sm:col-span-7 group relative aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
          >
            <img
              src={meta0.url}
              alt={`${productTitle} showcase 1`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
            </div>
          </div>
          <div
            onClick={() => onImageClick?.(meta1.url, 1)}
            className="sm:col-span-5 group relative aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
          >
            <img
              src={meta1.url}
              alt={`${productTitle} showcase 2`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3 Images Case
  if (uniqueImages.length === 3 && uniqueImages[0] && uniqueImages[1] && uniqueImages[2]) {
    const meta0 = imageMetas[0] || { url: uniqueImages[0], orientation: "landscape" };
    const meta1 = imageMetas[1] || { url: uniqueImages[1], orientation: "landscape" };
    const meta2 = imageMetas[2] || { url: uniqueImages[2], orientation: "landscape" };

    if (meta0.orientation === "portrait" && meta1.orientation !== "portrait") {
      return (
        <div className="pt-2 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
            <div
              onClick={() => onImageClick?.(meta0.url, 0)}
              className="sm:col-span-5 sm:row-span-2 group relative aspect-[3/4] sm:aspect-auto sm:min-h-[300px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta0.url}
                alt={`${productTitle} showcase 1`}
                className="w-full h-full object-cover sm:object-contain p-0 sm:p-2 transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>

            <div
              onClick={() => onImageClick?.(meta1.url, 1)}
              className="sm:col-span-7 group relative aspect-[16/10] sm:h-[145px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta1.url}
                alt={`${productTitle} showcase 2`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            </div>

            <div
              onClick={() => onImageClick?.(meta2.url, 2)}
              className="sm:col-span-7 group relative aspect-[16/10] sm:h-[145px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={meta2.url}
                alt={`${productTitle} showcase 3`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="pt-2 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          <div
            onClick={() => onImageClick?.(meta0.url, 0)}
            className="sm:col-span-7 sm:row-span-2 group relative aspect-[4/3] sm:aspect-auto sm:min-h-[295px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
          >
            <img
              src={meta0.url}
              alt={`${productTitle} showcase 1`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
            </div>
          </div>

          <div
            onClick={() => onImageClick?.(meta1.url, 1)}
            className={`sm:col-span-5 group relative ${
              meta1.orientation === "portrait" ? "aspect-[3/4] sm:h-[145px]" : "aspect-[16/10] sm:h-[145px]"
            } rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200`}
          >
            <img
              src={meta1.url}
              alt={`${productTitle} showcase 2`}
              className={`w-full h-full transition-transform duration-300 group-hover:scale-103 ${
                meta1.orientation === "portrait" ? "object-contain p-1" : "object-cover"
              }`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
          </div>

          <div
            onClick={() => onImageClick?.(meta2.url, 2)}
            className={`sm:col-span-5 group relative ${
              meta2.orientation === "portrait" ? "aspect-[3/4] sm:h-[145px]" : "aspect-[16/10] sm:h-[145px]"
            } rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200`}
          >
            <img
              src={meta2.url}
              alt={`${productTitle} showcase 3`}
              className={`w-full h-full transition-transform duration-300 group-hover:scale-103 ${
                meta2.orientation === "portrait" ? "object-contain p-1" : "object-cover"
              }`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
          </div>
        </div>
      </div>
    );
  }

  // 4+ Images Case (Dimension & Orientation Aware Grid with 3-Row Clamp & Smooth Fade)
  return (
    <div className="pt-2 w-full space-y-3">
      <div
        className={`relative transition-[max-height] duration-500 ease-in-out ${
          hasMoreThan3Rows && !isExpanded ? "overflow-hidden" : ""
        }`}
        style={
          hasMoreThan3Rows && !isExpanded && max3RowsHeight
            ? { maxHeight: `${max3RowsHeight}px` }
            : undefined
        }
      >
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          {uniqueImages.map((imgUrl, idx) => {
            const meta = imageMetas[idx] || { url: imgUrl, orientation: "landscape", aspect: 1.33 };
            const isPortrait = meta.orientation === "portrait";
            const isSquare = meta.orientation === "square";

            let colSpan = "sm:col-span-6";
            let aspectClass = "aspect-[16/10]";

            if (uniqueImages.length === 4) {
              if (idx === 0 && !isPortrait) {
                colSpan = "sm:col-span-8 sm:row-span-2";
                aspectClass = "aspect-[4/3] sm:aspect-auto sm:min-h-[295px]";
              } else if (isPortrait) {
                colSpan = "sm:col-span-4";
                aspectClass = "aspect-[3/4] sm:h-[145px]";
              } else if (idx === 3) {
                colSpan = "sm:col-span-12";
                aspectClass = "aspect-[21/9] sm:aspect-[24/8] max-h-[190px]";
              } else {
                colSpan = "sm:col-span-4";
                aspectClass = "aspect-square sm:h-[145px]";
              }
            } else {
              // 5+ images
              if (isPortrait) {
                colSpan = "sm:col-span-4";
                aspectClass = "aspect-[3/4] sm:aspect-[4/5]";
              } else if (isSquare) {
                colSpan = "sm:col-span-4";
                aspectClass = "aspect-square";
              } else {
                // landscape
                colSpan = idx % 3 === 0 ? "sm:col-span-8" : "sm:col-span-6";
                aspectClass = "aspect-[16/10]";
              }
            }

            return (
              <div
                key={`${imgUrl}-${idx}`}
                onClick={() => onImageClick?.(imgUrl, idx)}
                className={`${colSpan} ${aspectClass} group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F9F8F5] border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200`}
              >
                <img
                  src={imgUrl}
                  alt={`${productTitle} showcase ${idx + 1}`}
                  className={`w-full h-full transition-transform duration-300 group-hover:scale-103 ${
                    isPortrait ? "object-contain p-2" : "object-cover"
                  }`}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Fade Gradient when collapsed */}
        {hasMoreThan3Rows && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none z-10" />
        )}
      </div>

      {/* Expand / Collapse Action Button */}
      {hasMoreThan3Rows && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#010101] text-white hover:bg-[#EDCF5D] hover:text-[#010101] text-xs sm:text-sm font-semibold transition-all duration-200 shadow-md active:scale-95 cursor-pointer z-20 group"
          >
            <span>{isExpanded ? "Show fewer images" : "See more images"}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : "group-hover:translate-y-0.5"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Blue Verified Checkmark Badge ──────────────────────────────────────────
function BlueVerifiedCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <span
      title="Verified Purchase"
      className="inline-flex items-center justify-center shrink-0 select-none align-middle cursor-help"
      aria-label="Verified Purchase"
    >
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.21.2-.5.31-1.04.31-1.61 0-2.48-2.02-4.5-4.5-4.5-.57 0-1.11.11-1.61.31C13.72 1.68 12.48.8 11.05.8c-1.43 0-2.67.88-3.21 2.19-.5-.2-1.04-.31-1.61-.31-2.48 0-4.5 2.02-4.5 4.5 0 .57.11 1.11.31 1.61C.73 9.33-.15 10.57-.15 12c0 1.43.88 2.67 2.19 3.21-.2.5-.31 1.04-.31 1.61 0 2.48 2.02 4.5 4.5 4.5.57 0 1.11-.11 1.61-.31.54 1.31 1.78 2.19 3.21 2.19 1.43 0 2.67-.88 3.21-2.19.5.2 1.04.31 1.61.31 2.48 0 4.5-2.02 4.5-4.5 0-.57-.11-1.11-.31-1.61 1.31-.54 2.19-1.78 2.19-3.21z"
          fill="#1D9BF0"
        />
        <path
          d="M9.6 16.5L5.8 12.7l1.4-1.4 2.4 2.4 6.8-6.8 1.4 1.4z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}

// ─── Product Tabs Component ──────────────────────────────────────────────────
interface ReviewReply {
  id: string;
  name: string;
  avatar?: string;
  date: string;
  comment: string;
  likes?: number;
  dislikes?: number;
  replyToName?: string;
}

interface DiscussionMessage {
  id: string;
  senderType: "customer" | "staff";
  body: string;
  sentAt: string;
}

interface ReviewItem {
  id: string;
  name: string;
  avatar: string;
  date: string;
  rating: number;
  comment: string;
  likes: number;
  dislikes: number;
  isVerified?: boolean;
  replies?: ReviewReply[];
}

function ProductTabs({
  product,
  rating: initialRating,
  reviewsCount: _initialReviewsCount,
  onOpenZoom,
}: {
  product?: ProductItem;
  rating: number;
  reviewsCount: number;
  onOpenZoom?: (imgUrl: string) => void;
}) {
  const { user, customer } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [activeTab, setActiveTab] = useState<"details" | "reviews" | "discussion">("details");
  const [sortOption, setSortOption] = useState("Newest");
  const searchParams = useSearchParams();

  // Switch to target tab and scroll into view when navigated with ?tab=discussion or ?tab=reviews
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "discussion" || tabParam === "reviews" || tabParam === "details") {
      setActiveTab(tabParam);
      setTimeout(() => {
        const el = document.getElementById("product-tabs-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 350);
    }
  }, [searchParams]);

  // Initial reviews with replies and verified tags
  const [reviews, setReviews] = useState<ReviewItem[]>([
    {
      id: "r1",
      name: "Helen M.",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      date: "Yesterday",
      rating: 5,
      comment: "Excellent running shoes. It turns very sharply on the foot.",
      likes: 42,
      dislikes: 0,
      isVerified: true,
      replies: [],
    },
    {
      id: "r2",
      name: "Ann D.",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      date: "2 days ago",
      rating: 4,
      comment: "Good shoes",
      likes: 35,
      dislikes: 2,
      isVerified: true,
      replies: [],
    },
    {
      id: "r3",
      name: "Andrew G.",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      date: "2 days ago",
      rating: 5,
      comment: "Is it suitable for running?",
      likes: 18,
      dislikes: 1,
      isVerified: true,
      replies: [],
    },
  ]);

  // Load reviews from localStorage & fetch approved reviews from API
  useEffect(() => {
    if (!product?.id) return;
    try {
      const saved = localStorage.getItem(`gts_reviews_${product.id}`);
      if (saved) {
        setReviews(JSON.parse(saved));
      }
    } catch {}

    const fetchLiveReviews = async () => {
      try {
        const res = await fetch(`/api/v1/reviews?productId=${encodeURIComponent(product.id)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            const mapped: ReviewItem[] = json.data.map((r: any) => ({
              id: r.id,
              name: r.user?.full_name || "Verified Customer",
              avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
              date: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              rating: r.rating || 5,
              comment: r.body || r.title || "",
              likes: 0,
              dislikes: 0,
              isVerified: true,
              replies: [],
            }));
            setReviews((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newItems = mapped.filter((m) => !existingIds.has(m.id));
              return [...newItems, ...prev];
            });
          }
        }
      } catch {
        // Silently fallback to mock / local state
      }
    };
    fetchLiveReviews();
  }, [product?.id]);

  const ratingCounts = [
    { stars: 5, count: 28, percentage: 65 },
    { stars: 4, count: 9, percentage: 21 },
    { stars: 3, count: 4, percentage: 9 },
    { stars: 2, count: 1, percentage: 2 },
    { stars: 1, count: 1, percentage: 2 },
  ];

  // Reactions state with localStorage persistence
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | null>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({
    r1: 42,
    r2: 35,
    r3: 18,
  });
  const [dislikeCounts, setDislikeCounts] = useState<Record<string, number>>({
    r1: 0,
    r2: 2,
    r3: 1,
  });

  // Discussion / Private Chat state
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);
  const [discussionInput, setDiscussionInput] = useState("");
  const [isSendingDiscussion, setIsSendingDiscussion] = useState(false);
  const [isLoadingDiscussion, setIsLoadingDiscussion] = useState(false);
  const [discussionTicketId, setDiscussionTicketId] = useState<string | null>(null);
  const discussionEndRef = useRef<HTMLDivElement>(null);
  const hasFetchedDiscussion = useRef<string | null>(null);
  const discussionChannelRef = useRef<any>(null);

  // Fetch private discussion messages for this product
  useEffect(() => {
    if (!product?.id || !user?.id) return;

    // Only show loading spinner on initial load for this product
    if (hasFetchedDiscussion.current !== product.id) {
      setIsLoadingDiscussion(true);
    }

    const fetchDiscussion = async () => {
      try {
        const res = await fetch(`/api/v1/inquiries?productId=${encodeURIComponent(product.id)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.messages) {
            setDiscussionMessages(json.data.messages);
            if (json.data.id) {
              setDiscussionTicketId(json.data.id);
            }
            hasFetchedDiscussion.current = product.id;
          }
        }
      } catch (err) {
        console.error("Failed to load discussion:", err);
      } finally {
        setIsLoadingDiscussion(false);
      }
    };

    fetchDiscussion();
  }, [product?.id, user?.id]);

  // Realtime WebSockets for Customer Discussion
  useEffect(() => {
    if (!discussionTicketId) return;

    const supabase = createClient() as any;
    const channel = supabase.channel(`inquiry_${discussionTicketId}`, {
      config: { broadcast: { self: false } },
    });
    discussionChannelRef.current = channel;

    const handleIncomingMsg = (msg: any) => {
      if (!msg || !msg.id) return;
      setDiscussionMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            senderType: msg.senderType || msg.sender_type,
            body: msg.body,
            sentAt: msg.sentAt || msg.sent_at || new Date().toISOString(),
          },
        ];
      });
    };

    channel.on("broadcast", { event: "new_message" }, ({ payload }: any) => {
      handleIncomingMsg(payload);
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${discussionTicketId}`,
      },
      (payload: any) => {
        const newRow = payload.new;
        if (newRow) {
          handleIncomingMsg({
            id: newRow.id,
            senderType: newRow.sender_type,
            body: newRow.body,
            sentAt: newRow.sent_at,
          });
        }
      }
    );

    channel.subscribe((subStatus: string) => {
      if (subStatus === "SUBSCRIBED") {
        console.log(`[Storefront Realtime] Subscribed to inquiry_${discussionTicketId}`);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      discussionChannelRef.current = null;
    };
  }, [discussionTicketId]);

  useEffect(() => {
    if (activeTab === "discussion" && discussionMessages.length > 0) {
      discussionEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [discussionMessages.length, activeTab]);

  const handleSendDiscussionMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      openAuthModal("login");
      return;
    }

    const text = discussionInput.trim();
    if (!text || isSendingDiscussion || !product?.id) return;

    setIsSendingDiscussion(true);
    try {
      const res = await fetch("/api/v1/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          productTitle: product.title,
          message: text,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const serverMsgId = json.data?.message?.id || "msg-" + Date.now();
        const tId = json.data?.ticketId || discussionTicketId;
        if (tId && tId !== discussionTicketId) {
          setDiscussionTicketId(tId);
        }
        const newMsg: DiscussionMessage = {
          id: serverMsgId,
          senderType: "customer",
          body: text,
          sentAt: new Date().toISOString(),
        };
        setDiscussionMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setDiscussionInput("");

        // Broadcast immediately over Realtime WebSocket
        try {
          discussionChannelRef.current?.send({
            type: "broadcast",
            event: "new_message",
            payload: {
              id: newMsg.id,
              senderType: "customer",
              body: newMsg.body,
              sentAt: newMsg.sentAt,
            },
          });
        } catch {}
      }
    } catch (err) {
      console.error("Failed to send discussion message:", err);
    } finally {
      setIsSendingDiscussion(false);
    }
  };

  useEffect(() => {
    try {
      const savedReactions = localStorage.getItem("gts_review_reactions");
      if (savedReactions) setReactions(JSON.parse(savedReactions));
      const savedLikes = localStorage.getItem("gts_review_likes");
      if (savedLikes) setLikeCounts((prev) => ({ ...prev, ...JSON.parse(savedLikes) }));
      const savedDislikes = localStorage.getItem("gts_review_dislikes");
      if (savedDislikes) setDislikeCounts((prev) => ({ ...prev, ...JSON.parse(savedDislikes) }));
    } catch {}
  }, []);

  const handleLike = (id: string) => {
    const current = reactions[id];
    let nextReaction: "like" | "dislike" | null = null;
    let nextLike = likeCounts[id] ?? 0;
    let nextDislike = dislikeCounts[id] ?? 0;

    if (current === "like") {
      nextReaction = null;
      nextLike = Math.max(0, nextLike - 1);
    } else {
      if (current === "dislike") {
        nextDislike = Math.max(0, nextDislike - 1);
      }
      nextReaction = "like";
      nextLike = nextLike + 1;
    }

    const newReactions = { ...reactions, [id]: nextReaction };
    const newLikes = { ...likeCounts, [id]: nextLike };
    const newDislikes = { ...dislikeCounts, [id]: nextDislike };

    setReactions(newReactions);
    setLikeCounts(newLikes);
    setDislikeCounts(newDislikes);

    try {
      localStorage.setItem("gts_review_reactions", JSON.stringify(newReactions));
      localStorage.setItem("gts_review_likes", JSON.stringify(newLikes));
      localStorage.setItem("gts_review_dislikes", JSON.stringify(newDislikes));
    } catch {}
  };

  const handleDislike = (id: string) => {
    const current = reactions[id];
    let nextReaction: "like" | "dislike" | null = null;
    let nextLike = likeCounts[id] ?? 0;
    let nextDislike = dislikeCounts[id] ?? 0;

    if (current === "dislike") {
      nextReaction = null;
      nextDislike = Math.max(0, nextDislike - 1);
    } else {
      if (current === "like") {
        nextLike = Math.max(0, nextLike - 1);
      }
      nextReaction = "dislike";
      nextDislike = nextDislike + 1;
    }

    const newReactions = { ...reactions, [id]: nextReaction };
    const newLikes = { ...likeCounts, [id]: nextLike };
    const newDislikes = { ...dislikeCounts, [id]: nextDislike };

    setReactions(newReactions);
    setLikeCounts(newLikes);
    setDislikeCounts(newDislikes);

    try {
      localStorage.setItem("gts_review_reactions", JSON.stringify(newReactions));
      localStorage.setItem("gts_review_likes", JSON.stringify(newLikes));
      localStorage.setItem("gts_review_dislikes", JSON.stringify(newDislikes));
    } catch {}
  };

  // Reply state
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const handlePostReply = (reviewId: string, replyToName?: string, targetReplyId?: string) => {
    const inputKey = targetReplyId || reviewId;
    const text = (replyTexts[inputKey] || "").trim();
    if (!text) return;

    const authorName = customer?.full_name || user?.user_metadata?.full_name || "Customer";
    const newReply: ReviewReply = {
      id: "reply-" + Date.now(),
      name: authorName,
      date: "Just now",
      comment: text,
      replyToName: replyToName,
      likes: 0,
      dislikes: 0,
    };

    setReviews((prev) => {
      const updated = prev.map((r) => {
        if (r.id === reviewId) {
          return {
            ...r,
            replies: [...(r.replies || []), newReply],
          };
        }
        return r;
      });
      if (typeof window !== "undefined" && product?.id) {
        try {
          localStorage.setItem(`gts_reviews_${product.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    setReplyTexts((prev) => ({ ...prev, [inputKey]: "" }));
    setOpenReplyId(null);

    // Save notification to customer inbox store
    try {
      const inboxNotification = {
        id: "notif-" + Date.now(),
        type: "review_reply",
        productId: product?.id,
        productName: product?.title || "Product",
        productSlug: (product as any)?.slug || product?.id || "",
        productImage: product?.image,
        replyAuthor: authorName,
        replyText: text,
        replyToName: replyToName,
        date: "Just now",
        createdAt: new Date().toISOString(),
      };
      const existingNotifs = JSON.parse(localStorage.getItem("gts_inbox_notifications") || "[]");
      localStorage.setItem("gts_inbox_notifications", JSON.stringify([inboxNotification, ...existingNotifs]));
    } catch {}
  };

  // Write Review & Verification gating state
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isNotEligibleModalOpen, setIsNotEligibleModalOpen] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | null>(null);

  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const ratingDescriptions: Record<number, string> = {
    1: "Poor experience",
    2: "Fair, below expectation",
    3: "Average product",
    4: "Very good, recommended",
    5: "Excellent, highly recommended!",
  };

  // Check if user has ordered this product
  const handleWriteReviewClick = async () => {
    if (!user) {
      openAuthModal("login");
      return;
    }

    setIsCheckingEligibility(true);
    try {
      const supabase = createClient() as any;

      // 1. Query customer profile
      const { data: custRecord } = await supabase
        .from("customers")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      if (!custRecord) {
        setIsNotEligibleModalOpen(true);
        return;
      }

      // 2. Query completed/paid orders for this customer
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, order_items(id, variant_id, product_snapshot)")
        .eq("customer_id", custRecord.id)
        .in("status", ["paid", "processing", "ready_for_pickup", "completed", "delivered"]);

      const targetId = product?.id?.toLowerCase();
      const targetSku = product?.sku?.toLowerCase();
      const targetTitle = product?.title?.toLowerCase();

      const matchingOrder = (orders || []).find((ord: any) =>
        ord.order_items?.some((item: any) => {
          const snap = item.product_snapshot || {};
          const snapId = (snap.id || "").toLowerCase();
          const snapSku = (snap.sku || "").toLowerCase();
          const snapName = (snap.name || snap.title || "").toLowerCase();
          return (
            (targetId && (snapId === targetId || item.variant_id === targetId)) ||
            (targetSku && (snapSku === targetSku || snapId === targetSku)) ||
            (targetTitle && snapName.includes(targetTitle))
          );
        })
      );

      if (matchingOrder) {
        setVerifiedOrderId(matchingOrder.id);
        setIsWriteModalOpen(true);
      } else {
        setIsNotEligibleModalOpen(true);
      }
    } catch (err) {
      console.error("Eligibility check error:", err);
      setIsNotEligibleModalOpen(true);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const authorName = customer?.full_name || user?.user_metadata?.full_name || "Verified Customer";
      const newReviewItem: ReviewItem = {
        id: "rev-" + Date.now(),
        name: authorName,
        avatar: customer?.avatar_url || user?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
        date: "Just now",
        rating: newRating,
        comment: newComment.trim(),
        likes: 0,
        dislikes: 0,
        isVerified: true,
        replies: [],
      };

      // Call API
      try {
        await fetch("/api/v1/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product?.id,
            orderId: verifiedOrderId,
            rating: newRating,
            title: newTitle.trim() || "Product Review",
            body: newComment.trim(),
          }),
        });
      } catch (apiErr) {
        console.warn("Reviews API post skipped or failed:", apiErr);
      }

      setReviews((prev) => {
        const updated = [newReviewItem, ...prev];
        if (typeof window !== "undefined" && product?.id) {
          try {
            localStorage.setItem(`gts_reviews_${product.id}`, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

      setIsWriteModalOpen(false);
      setNewTitle("");
      setNewComment("");
      setNewRating(5);
      setToastMessage("Thank you! Your verified review has been posted.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sorting
  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortOption === "Highest Rating") return b.rating - a.rating;
    if (sortOption === "Lowest Rating") return a.rating - b.rating;
    return 0; // default newest
  });

  return (
    <section id="product-tabs-section" className="w-full px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-4 mt-4 sm:mt-6 border-t border-gray-200/90 max-w-[1440px] mx-auto relative">
      {/* Toast message banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 bg-[#010101] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 font-sans text-xs sm:text-sm font-semibold border border-white/10">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Tabs Bar ── */}
      <div className="flex items-center gap-8 mb-3 sm:mb-4">
        {(["details", "reviews", "discussion"] as const).map((tab) => {
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-lg sm:text-xl font-bold transition-colors capitalize cursor-pointer ${
                isActive ? "text-[#010101]" : "text-gray-400 hover:text-gray-600 font-medium"
              }`}
            >
              {label} {tab === "reviews" ? `(${reviews.length})` : ""}
            </button>
          );
        })}
      </div>

      {/* ── Permanent 2-Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column: Dynamic Tab Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Tab Content: Reviews */}
          {activeTab === "reviews" && (
            <div className="space-y-6">
              {/* Reviews Controls: Sort Pill & Write Review Action */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <ReviewsSortDropdown value={sortOption} onChange={setSortOption} />

                <button
                  type="button"
                  onClick={handleWriteReviewClick}
                  disabled={isCheckingEligibility}
                  className="px-4 py-2 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white text-xs font-bold rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isCheckingEligibility ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  )}
                  <span>Write a Review</span>
                </button>
              </div>

              {/* User Reviews List */}
              <div className="space-y-6 divide-y divide-gray-100">
                {sortedReviews.map((rev, i) => (
                  <div key={rev.id} className={`${i > 0 ? "pt-6" : ""} flex gap-3.5 items-start`}>
                    {/* Avatar */}
                    {rev.avatar ? (
                      <Image
                        src={rev.avatar}
                        alt={rev.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#010101] text-white flex items-center justify-center font-bold text-sm shrink-0 border border-gray-200">
                        {rev.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Review Content */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Name, Verified Badge & Timestamp */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-[#010101]">{rev.name}</span>
                        {rev.isVerified && <BlueVerifiedCheck className="w-4 h-4" />}
                        <span className="text-xs text-gray-400 font-normal">{rev.date}</span>
                      </div>

                      {/* Star Rating */}
                      <div className="flex items-center text-[#EDCF5D] text-xs">
                        {"★".repeat(rev.rating)}
                        {"☆".repeat(5 - rev.rating)}
                      </div>

                      {/* Comment text */}
                      <p className="text-xs sm:text-sm text-[#010101] font-semibold pt-0.5 leading-relaxed break-words">
                        {rev.comment}
                      </p>

                      {/* Action Bar: Reply, Thumbs Up SVG, Thumbs Down SVG */}
                      <div className="flex items-center gap-4 text-xs text-gray-400 font-medium pt-1">
                        <button
                          type="button"
                          onClick={() => setOpenReplyId(openReplyId === rev.id ? null : rev.id)}
                          className={`transition-colors cursor-pointer flex items-center gap-1 ${
                            openReplyId === rev.id ? "text-[#010101] font-bold underline underline-offset-4" : "hover:text-gray-700"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                          </svg>
                          <span>Reply</span>
                        </button>

                        {/* Thumbs Up SVG Icon — Reactive */}
                        <button
                          type="button"
                          onClick={() => handleLike(rev.id)}
                          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                            reactions[rev.id] === "like"
                              ? "text-[#010101] font-bold"
                              : "hover:text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-current"
                            fill={reactions[rev.id] === "like" ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.5a4.5 4.5 0 01-4.5-4.5V10.5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.5H3.75a.75.75 0 00-.75.75v8.25c0 .414.336.75.75.75h3" />
                          </svg>
                          <span>{likeCounts[rev.id] ?? rev.likes}</span>
                        </button>

                        {/* Thumbs Down SVG Icon — Reactive */}
                        <button
                          type="button"
                          onClick={() => handleDislike(rev.id)}
                          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                            reactions[rev.id] === "dislike"
                              ? "text-[#010101] font-bold"
                              : "hover:text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-current"
                            fill={reactions[rev.id] === "dislike" ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75A2.25 2.25 0 017.5 19.5c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.825.976-5.424 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h5.996a4.5 4.5 0 014.5 4.5v5.25z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 13.5h3a.75.75 0 00.75-.75V4.5a.75.75 0 00-.75-.75h-3" />
                          </svg>
                          <span>{dislikeCounts[rev.id] ?? rev.dislikes}</span>
                        </button>
                      </div>

                      {/* Inline Reply Box */}
                      {openReplyId === rev.id && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-[#F9F8F5] border border-gray-200/90 space-y-2.5 animate-in fade-in duration-200 max-w-xl">
                          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>Replying to <strong className="text-[#010101]">{rev.name}</strong></span>
                            <button
                              type="button"
                              onClick={() => setOpenReplyId(null)}
                              className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                          <textarea
                            value={replyTexts[rev.id] || ""}
                            onChange={(e) => setReplyTexts((prev) => ({ ...prev, [rev.id]: e.target.value }))}
                            placeholder="Write a helpful reply..."
                            rows={2}
                            className="w-full text-xs sm:text-sm p-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-[#010101] font-sans resize-none placeholder:text-gray-400"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handlePostReply(rev.id)}
                              disabled={!replyTexts[rev.id]?.trim()}
                              className="px-4 py-1.5 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-2xs"
                            >
                              Post Reply
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Render Nested Replies */}
                      {rev.replies && rev.replies.length > 0 && (
                        <div className="mt-3.5 pl-4 sm:pl-6 border-l-2 border-gray-200 space-y-2.5 pt-1">
                          {rev.replies.map((reply) => (
                            <div key={reply.id} className="bg-[#F9F8F5]/90 border border-gray-200/60 p-3 rounded-2xl space-y-1.5 max-w-xl">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-5 h-5 rounded-full bg-[#010101] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {reply.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-xs text-[#010101]">{reply.name}</span>
                                {reply.replyToName && (
                                  <span className="text-[10.5px] text-gray-400 font-medium">
                                    replying to <strong className="text-[#010101]">@{reply.replyToName}</strong>
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400 font-normal">{reply.date}</span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed pl-7">{reply.comment}</p>

                              {/* Action Bar on Reply: Reply, Like, Dislike */}
                              <div className="flex items-center gap-3.5 text-[11px] text-gray-400 font-medium pt-1 pl-7">
                                <button
                                  type="button"
                                  onClick={() => setOpenReplyId(openReplyId === reply.id ? null : reply.id)}
                                  className={`transition-colors cursor-pointer flex items-center gap-1 ${
                                    openReplyId === reply.id ? "text-[#010101] font-bold underline underline-offset-2" : "hover:text-gray-700"
                                  }`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                  </svg>
                                  <span>Reply</span>
                                </button>

                                {/* Thumbs Up */}
                                <button
                                  type="button"
                                  onClick={() => handleLike(reply.id)}
                                  className={`flex items-center gap-1 transition-colors cursor-pointer ${
                                    reactions[reply.id] === "like" ? "text-[#010101] font-bold" : "hover:text-gray-700"
                                  }`}
                                >
                                  <svg
                                    className="w-3 h-3 stroke-current"
                                    fill={reactions[reply.id] === "like" ? "currentColor" : "none"}
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.8}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.5a4.5 4.5 0 01-4.5-4.5V10.5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.5H3.75a.75.75 0 00-.75.75v8.25c0 .414.336.75.75.75h3" />
                                  </svg>
                                  <span>{likeCounts[reply.id] ?? reply.likes ?? 0}</span>
                                </button>

                                {/* Thumbs Down */}
                                <button
                                  type="button"
                                  onClick={() => handleDislike(reply.id)}
                                  className={`flex items-center gap-1 transition-colors cursor-pointer ${
                                    reactions[reply.id] === "dislike" ? "text-[#010101] font-bold" : "hover:text-gray-700"
                                  }`}
                                >
                                  <svg
                                    className="w-3 h-3 stroke-current"
                                    fill={reactions[reply.id] === "dislike" ? "currentColor" : "none"}
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.8}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75A2.25 2.25 0 017.5 19.5c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.825.976-5.424 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h5.996a4.5 4.5 0 014.5 4.5v5.25z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 13.5h3a.75.75 0 00.75-.75V4.5a.75.75 0 00-.75-.75h-3" />
                                  </svg>
                                  <span>{dislikeCounts[reply.id] ?? reply.dislikes ?? 0}</span>
                                </button>
                              </div>

                              {/* Nested Inline Reply Box */}
                              {openReplyId === reply.id && (
                                <div className="mt-2.5 p-3 rounded-xl bg-white border border-gray-200/90 space-y-2 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                                    <span>Replying to <strong className="text-[#010101]">@{reply.name}</strong></span>
                                    <button
                                      type="button"
                                      onClick={() => setOpenReplyId(null)}
                                      className="text-gray-400 hover:text-gray-600 text-[10px] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  <textarea
                                    value={replyTexts[reply.id] || ""}
                                    onChange={(e) => setReplyTexts((prev) => ({ ...prev, [reply.id]: e.target.value }))}
                                    placeholder={`Reply to @${reply.name}...`}
                                    rows={2}
                                    className="w-full text-xs p-2.5 bg-[#F9F8F5] rounded-lg border border-gray-200 focus:outline-none focus:border-[#010101] font-sans resize-none placeholder:text-gray-400"
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handlePostReply(rev.id, reply.name, reply.id)}
                                      disabled={!replyTexts[reply.id]?.trim()}
                                      className="px-3 py-1 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] disabled:opacity-40 disabled:pointer-events-none text-white text-[11px] font-bold rounded-full transition-all cursor-pointer shadow-2xs"
                                    >
                                      Post Reply
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content: Details & Full Overview */}
          {activeTab === "details" && (
            <div className="space-y-6 w-full text-xs sm:text-sm text-gray-600 leading-relaxed pt-2">
              {product?.description ? (
                <div className="space-y-3">
                  <MarkdownContent content={product.description} />
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-bold text-base text-[#010101]">Product Specifications</h3>
                  <p className="text-gray-500 italic">No additional specifications provided for this product.</p>
                </div>
              )}

              {/* Bento Image Gallery */}
              {product?.descriptionImages && product.descriptionImages.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <ProductBentoGallery
                    images={product.descriptionImages}
                    productTitle={product.title || "Product"}
                    onImageClick={(imgUrl) => onOpenZoom?.(imgUrl)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Discussion (Private Product Q&A Chat) */}
          {activeTab === "discussion" && (
            <div className="space-y-4 max-w-3xl pt-2">
              {!user ? (
                /* Prompt to Sign In */
                <div className="border border-gray-200 rounded-3xl p-6 sm:p-8 bg-[#FAFAF8] text-center space-y-4 shadow-2xs">
                  <div className="w-14 h-14 rounded-2xl bg-[#010101] text-[#EDCF5D] flex items-center justify-center mx-auto shadow-xs">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.874-1.006l.732-1.755A7.838 7.838 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>

                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-base sm:text-lg font-extrabold text-[#010101]">
                      Have questions about this product?
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                      Ask about sizing, materials, delivery, or authenticity. Sign in to your GTS account to start a private conversation directly with our staff.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal("login")}
                      className="px-6 py-3 bg-[#010101] hover:bg-black text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-2 mx-auto"
                    >
                      <svg className="w-4 h-4 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      <span>Sign In to Ask a Question</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Authenticated Private Chat Stream (Borderless) */
                <div className="flex flex-col min-h-[380px]">
                  {/* Private & Confidential Chip */}
                  <div className="flex items-center justify-between pb-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-[#F2F0EA] border border-gray-200/90 px-3 py-1 rounded-full">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <span>Private & Confidential</span>
                    </span>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto max-h-[380px] sm:max-h-[440px] space-y-3 font-sans py-2 pr-1">
                    {isLoadingDiscussion ? (
                      <div className="text-center py-16 space-y-2">
                        <span className="inline-block w-5 h-5 border-2 border-[#010101] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-gray-400">Loading conversation...</p>
                      </div>
                    ) : discussionMessages.length === 0 ? (
                      <div className="text-center py-14 px-4 space-y-2.5 max-w-sm mx-auto">
                        <div className="w-10 h-10 rounded-2xl bg-[#F2F0EA] border border-gray-200/80 flex items-center justify-center text-lg mx-auto shadow-2xs">
                          💬
                        </div>
                        <h4 className="text-xs font-bold text-[#010101]">Start the Conversation</h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Ask anything about sizing, materials, delivery, or care instructions for this product. Our team will answer you directly here!
                        </p>
                      </div>
                    ) : (
                      discussionMessages.map((msg) => {
                        const isCustomer = msg.senderType === "customer";
                        return (
                          <div key={msg.id} className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}>
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[10px] font-bold text-gray-400">
                                {isCustomer ? "You" : "GTS Staff"}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            <div
                              className={`p-3.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words ${
                                isCustomer
                                  ? "bg-[#010101] text-white rounded-tr-xs"
                                  : "bg-[#F2F0EA] border border-gray-200 text-[#010101] rounded-tl-xs"
                              }`}
                            >
                              {msg.body}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={discussionEndRef} />
                  </div>

                  {/* Anchored Bottom Chat Bar in GTS Ash Color */}
                  <div className="pt-3">
                    <form
                      onSubmit={handleSendDiscussionMessage}
                      className="bg-[#F2F0EA] border border-gray-300/80 rounded-full p-1.5 pl-4 flex items-center gap-2 shadow-xs transition-all focus-within:border-[#010101] focus-within:ring-1 focus-within:ring-[#010101]/20"
                    >
                      <input
                        type="text"
                        value={discussionInput}
                        onChange={(e) => setDiscussionInput(e.target.value)}
                        placeholder="Ask a question about this product..."
                        className="flex-1 bg-transparent text-xs sm:text-sm text-[#010101] placeholder:text-gray-500 focus:outline-none font-sans"
                      />

                      <button
                        type="submit"
                        disabled={isSendingDiscussion || !discussionInput.trim()}
                        className="w-10 h-10 rounded-full bg-[#010101] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-35 disabled:pointer-events-none cursor-pointer shrink-0 shadow-sm active:scale-95"
                        title="Send Question"
                      >
                        {isSendingDiscussion ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                        )}
                      </button>
                    </form>

                    {/* Security & Privacy Notice */}
                    <p className="text-[11px] text-gray-500 text-center mt-2 flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                      </svg>
                      <span>Do not share personal info like account numbers even when asked.</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Permanent Rating Breakdown & Popular Brands Card (4 cols - pinned / sticky) */}
        <div className="lg:col-span-4 space-y-6 max-w-[320px] w-full ml-auto lg:sticky lg:top-24 self-start">
          {/* Rating Stars & Score */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-[#EDCF5D] text-xl tracking-wider">
                {"★".repeat(Math.floor(initialRating))}
                {"☆".repeat(5 - Math.floor(initialRating))}
              </div>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#010101]">{initialRating}</span>
            </div>

            {/* Progress Bars */}
            <div className="space-y-2">
              {ratingCounts.map((item) => (
                <div key={item.stars} className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="w-3 font-semibold text-gray-700">{item.stars}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#EDCF5D] rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-5 text-right font-medium text-gray-600">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Brands Promo Card */}
          <div
            className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 border border-black/5"
            style={{ background: "#E2DEC5" }}
          >
            <h3 className="text-base sm:text-lg font-extrabold text-[#010101] leading-snug">
              Popular brands<br />with discounts<br />over 25%
            </h3>

            {/* Overlapping Brand Icons */}
            <div className="flex items-center -space-x-2">
              <div className="w-7 h-7 rounded-full bg-black text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                DK
              </div>
              <div className="w-7 h-7 rounded-full bg-[#004725] text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                🐊
              </div>
              <div className="w-7 h-7 rounded-full bg-[#001489] text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                a
              </div>
              <div className="w-7 h-7 rounded-full bg-[#D40026] text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                TNF
              </div>
            </div>

            {/* Outlined Pill Button */}
            <Link
              href="/search"
              className="self-start px-4 py-1.5 rounded-xl border border-gray-800/50 text-[#010101] text-xs font-semibold hover:bg-black/5 transition-colors"
            >
              View more
            </Link>
          </div>
        </div>
      </div>

      {/* ════════════ MODAL 1: Verified Buyers Only (Not Eligible) ════════════ */}
      {isNotEligibleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-200 text-center space-y-4 animate-in zoom-in-95 duration-200">
            {/* Shield / Lock Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/90 flex items-center justify-center mx-auto shadow-xs">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="inline-block text-[11px] font-black uppercase tracking-widest text-amber-700 bg-amber-100/70 px-3 py-1 rounded-full">
                Verified Buyers Only
              </span>
              <h3 className="text-xl font-extrabold text-[#010101]">Review Eligibility</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                To guarantee genuine, authentic ratings on GTS, only customers who have purchased and ordered this item can leave a product review.
              </p>
              <p className="text-xs text-gray-500">
                Once your order for this product is placed and confirmed, you will be able to share your feedback with the community!
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setIsNotEligibleModalOpen(false)}
                className="flex-1 py-3 px-4 bg-[#010101] hover:bg-black text-white text-xs font-bold rounded-full transition-all cursor-pointer"
              >
                Understood
              </button>
              <Link
                href="/search"
                onClick={() => setIsNotEligibleModalOpen(false)}
                className="flex-1 py-3 px-4 border border-gray-300 hover:bg-gray-50 text-[#010101] text-xs font-bold rounded-full transition-all text-center flex items-center justify-center"
              >
                Browse Products
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL 2: Write a Verified Review (Eligible) ════════════ */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 border border-[#1D9BF0]/25 px-2.5 py-0.5 rounded-full mb-1.5">
                  <BlueVerifiedCheck className="w-3.5 h-3.5" />
                  <span>Verified Purchase Confirmed</span>
                </div>
                <h3 className="text-xl font-extrabold text-[#010101]">Write a Review</h3>
                <p className="text-xs text-gray-500 line-clamp-1">{product?.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star Rating Picker */}
              <div className="space-y-1.5 bg-[#F9F8F5] p-4 rounded-2xl border border-gray-200/80 text-center">
                <label className="text-xs font-bold text-[#010101] block">Your Overall Rating</label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const activeRating = hoverRating !== null ? hoverRating : newRating;
                    const isFilled = star <= activeRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setNewRating(star)}
                        className="text-3xl transition-transform hover:scale-115 active:scale-95 cursor-pointer focus:outline-none"
                      >
                        <span className={isFilled ? "text-[#EDCF5D]" : "text-gray-300"}>★</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-gray-600">
                  {ratingDescriptions[hoverRating !== null ? hoverRating : newRating]}
                </p>
              </div>

              {/* Review Headline */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#010101] block">Review Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Best purchase this year! Super comfortable."
                  className="w-full text-xs sm:text-sm p-3 bg-[#F9F8F5] rounded-xl border border-gray-200 focus:outline-none focus:border-[#010101] font-sans"
                />
              </div>

              {/* Review Body */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#010101] block">Your Review</label>
                <textarea
                  required
                  rows={4}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="What did you like or dislike? How is the fit, quality, and material? Share details that will help other shoppers make an informed choice."
                  className="w-full text-xs sm:text-sm p-3 bg-[#F9F8F5] rounded-xl border border-gray-200 focus:outline-none focus:border-[#010101] font-sans resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="py-2.5 px-5 rounded-full border border-gray-300 hover:bg-gray-100 text-xs font-bold text-gray-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="py-2.5 px-6 rounded-full bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>Publish Review</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Dynamic Similar Finds Component ─────────────────────────────────────────
interface SimilarFindsProps {
  currentProduct?: ProductItem | null;
}

function SimilarFinds({ currentProduct }: SimilarFindsProps) {
  const { products: catalogue } = useCatalogue();
  const [apiProducts, setApiProducts] = useState<ProductItem[]>([]);
  const [_loading, setLoading] = useState(false);
  const [_recommendationSource, setRecommendationSource] = useState<string>("co_purchase_and_affinity");
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Immediate zero-latency fallback: filter & rank catalogue items related to current product
  const fallbackProducts = useMemo(() => {
    if (!catalogue || catalogue.length === 0) return [];
    if (!currentProduct) return catalogue.slice(0, 10);

    const curId = (currentProduct.id || "").toLowerCase();
    const curSku = (currentProduct.sku || "").toLowerCase();
    const curTitle = (currentProduct.title || "").toLowerCase();
    const curCat = (currentProduct.category || "").toLowerCase();
    const curSub = (currentProduct.subCategory || "").toLowerCase();
    const curBrand = (currentProduct.brand || "").toLowerCase();

    // Strictly exclude the current product itself
    const eligible = catalogue.filter((p) => {
      const pId = (p.id || "").toLowerCase();
      const pSku = (p.sku || "").toLowerCase();
      const pTitle = (p.title || "").toLowerCase();
      if (pId === curId || (curSku && pSku === curSku) || pTitle === curTitle) return false;
      return true;
    });

    // Score based on subCategory, category, brand, and social proof
    const scored = eligible.map((p) => {
      let score = 0;
      const pCat = (p.category || "").toLowerCase();
      const pSub = (p.subCategory || "").toLowerCase();
      const pBrand = (p.brand || "").toLowerCase();

      if (curSub && pSub && pSub === curSub) score += 35;
      else if (curCat && pCat && pCat === curCat) score += 20;

      if (curBrand && pBrand && pBrand === curBrand) score += 18;

      score += Number(p.rating || 4) * 2;
      return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 12).map((s) => s.product);
  }, [catalogue, currentProduct]);

  // Live personalized & co-purchase query from backend recommendation engine
  useEffect(() => {
    if (!currentProduct?.id && !currentProduct?.sku) return;

    let mounted = true;
    setLoading(true);

    async function fetchSimilar() {
      try {
        const sessionId = getCartSessionId();
        const targetId = currentProduct?.id || currentProduct?.sku || "";
        const targetSlug = currentProduct?.sku || currentProduct?.id || "";

        const url = `/api/v1/storefront/similar-finds?product_id=${encodeURIComponent(
          targetId
        )}&slug=${encodeURIComponent(targetSlug)}&session_id=${encodeURIComponent(
          sessionId
        )}&limit=12`;

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (mounted && Array.isArray(json.data) && json.data.length > 0) {
            const mapped = json.data.map((p: ApiProduct) => dbProductToItem(p));

            // Strictly filter out current product
            const curId = (currentProduct?.id || "").toLowerCase();
            const curSku = (currentProduct?.sku || "").toLowerCase();
            const curTitle = (currentProduct?.title || "").toLowerCase();

            const clean = mapped.filter((p: ProductItem) => {
              const pId = (p.id || "").toLowerCase();
              const pSku = (p.sku || "").toLowerCase();
              const pTitle = (p.title || "").toLowerCase();
              return pId !== curId && (!curSku || pSku !== curSku) && pTitle !== curTitle;
            });

            if (clean.length > 0) {
              setApiProducts(clean);
              if (json.source) setRecommendationSource(json.source);
            }
          }
        }
      } catch {
        // Fallback products remain active seamlessly
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void fetchSimilar();

    return () => {
      mounted = false;
    };
  }, [currentProduct?.id, currentProduct?.sku, currentProduct?.category, currentProduct?.subCategory]);

  const displayProducts: ProductItem[] = apiProducts.length > 0 ? apiProducts : fallbackProducts;

  const updateScrollState = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      updateScrollState();
      container.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        container.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }
  }, [displayProducts]);

  const toggleWishlist = (id: string) =>
    setWishlisted((prev) => ({ ...prev, [id]: !prev[id] }));

  const scrollBy = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -290 : 290, behavior: "smooth" });

  if (displayProducts.length === 0) {
    return null;
  }

  const viewAllHref = currentProduct?.category
    ? `/search?category=${encodeURIComponent(currentProduct.category)}`
    : "/search";

  return (
    <section className="w-full px-5 md:px-8 pt-10 sm:pt-14 pb-10">
      {/* ── Section Header — matches landing page style ── */}
      <div className="flex justify-between items-end mb-6 sm:mb-8">
        <div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
            Similar{" "}
            <span className="text-[#EDCF5D] font-bold">✦</span>
            <span className="font-serif italic font-bold text-[#010101]">Finds</span>
          </h2>
        </div>

        <Link
          href={viewAllHref}
          className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
        >
          <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
            View all
          </span>
          <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
        </Link>
      </div>

      {/* ── Scrollable Cards Row ── */}
      <div className="relative group overflow-hidden">
        {/* Left Fade */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Left Arrow */}
        <button
          aria-label="Scroll similar finds left"
          onClick={() => scrollBy("left")}
          className={`absolute left-3 sm:left-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
            canScrollLeft ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth py-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayProducts.map((product: ProductItem) => {
            const badge =
              product.badge ||
              (product.discountPercent && product.discountPercent > 0
                ? `${product.discountPercent}% OFF`
                : undefined);

            return (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                price={product.price}
                originalPrice={product.originalPrice}
                badge={badge}
                rating={product.rating}
                reviews={product.reviews}
                image={product.image}
                hasTransparentBg={product.hasTransparentBg}
                isWishlisted={wishlisted[product.id]}
                onToggleWishlist={toggleWishlist}
                className="w-[180px] sm:w-[200px] md:w-[220px] shrink-0"
              />
            );
          })}
        </div>

        {/* Right Fade */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Right Arrow */}
        <button
          aria-label="Scroll similar finds right"
          onClick={() => scrollBy("right")}
          className={`absolute right-3 sm:right-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
            canScrollRight ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

// ─── Balanced 3-Pane Product Details Skeleton Loader ─────────────────────────
function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white text-[#010101]">
      {/* Top 3-Pane Section Skeleton */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 pb-6 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left 9-col container */}
          <div className="lg:col-span-9 flex flex-col gap-3">
            {/* Breadcrumb Skeleton */}
            <div className="flex items-center gap-2 py-0.5 animate-pulse">
              <div className="w-12 h-3.5 bg-gray-200 rounded" />
              <div className="w-2 h-3.5 bg-gray-200 rounded" />
              <div className="w-20 h-3.5 bg-gray-200 rounded" />
              <div className="w-2 h-3.5 bg-gray-200 rounded" />
              <div className="w-28 h-3.5 bg-gray-300 rounded font-bold" />
            </div>

            {/* 2-Pane Row: Pane 1 (Images & Share) + Pane 2 (Middle Details) */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-6 lg:gap-8 items-start pt-1">
              {/* Pane 1: Image Showcase (Full width on mobile, 320px on desktop) */}
              <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-0 md:gap-2.5 pb-0 md:pb-1">
                {/* Square Image Box Skeleton (Fills container width on mobile) */}
                <div className="w-full aspect-square rounded-2xl sm:rounded-3xl bg-[#ECEAE6] animate-pulse border border-gray-200/80 shrink-0" />

                {/* Share Section Skeleton (Desktop Only) */}
                <div className="hidden md:flex pt-2.5 border-t border-gray-200/90 flex-col gap-1.5">
                  <div className="w-24 h-2.5 bg-gray-200 rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-7.5 h-7.5 rounded-full bg-gray-200 animate-pulse shrink-0" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Pane 2: Middle Details Pane */}
              <div className="flex-1 min-w-0 space-y-2.5 sm:space-y-3.5 md:space-y-4 pt-1 md:pt-0">
                {/* Top Brand & SKU Row */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
                    <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-3.5 bg-gray-100 rounded animate-pulse" />
                </div>

                {/* Product Title Skeleton (2 lines) */}
                <div className="space-y-2">
                  <div className="w-11/12 h-6 sm:h-7 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="w-3/5 h-6 sm:h-7 bg-gray-200 rounded-lg animate-pulse" />
                </div>

                {/* Rating Row Skeleton */}
                <div className="flex items-center gap-2">
                  <div className="w-24 h-4 bg-amber-100 rounded animate-pulse" />
                  <div className="w-8 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-20 h-4 bg-gray-100 rounded animate-pulse" />
                </div>

                {/* Price Display Skeleton */}
                <div className="flex items-baseline gap-3 pt-0.5">
                  <div className="w-36 h-7 sm:h-8 bg-gray-300 rounded-lg animate-pulse" />
                  <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-rose-100 rounded-md animate-pulse" />
                </div>

                {/* Short Description Skeleton */}
                <div className="space-y-2 pt-0.5">
                  <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
                  <div className="w-11/12 h-3 bg-gray-100 rounded animate-pulse" />
                  <div className="w-3/4 h-3 bg-gray-100 rounded animate-pulse" />
                </div>

                {/* Colors Skeleton */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="w-28 h-3 bg-gray-200 rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-9 h-9 rounded-lg bg-gray-200 border border-gray-200 animate-pulse" />
                    ))}
                  </div>
                </div>

                {/* Sizes Skeleton */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-8 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
                    ))}
                  </div>
                </div>

                {/* Add to Cart & Stepper Skeleton */}
                <div className="pt-2 flex items-center gap-3">
                  <div className="w-24 h-10 rounded-full bg-gray-100 border border-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 h-10 rounded-full bg-gray-300 animate-pulse" />
                  <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 animate-pulse shrink-0" />
                </div>

                {/* Share Section (Mobile Only - beneath Add to Cart) */}
                <div className="md:hidden pt-3 border-t border-gray-200/90 flex flex-col gap-2">
                  <div className="w-24 h-2.5 bg-gray-200 rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-7.5 h-7.5 rounded-full bg-gray-200 animate-pulse shrink-0" />
                    ))}
                  </div>
                </div>

                {/* Promotions section skeleton */}
                <div className="pt-2.5 border-t border-gray-100 space-y-1.5">
                  <div className="w-20 h-2.5 bg-gray-200 rounded animate-pulse" />
                  <div className="w-full h-2.5 bg-gray-100 rounded animate-pulse" />
                  <div className="w-4/5 h-2.5 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Right 3-col container: Delivery & Returns Skeleton */}
          <div className="lg:col-span-3 border-t border-gray-200/90 lg:border-t-0 pt-4 sm:pt-5 lg:pt-0">
            <div className="lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:p-5 lg:shadow-xs space-y-4">
              <div className="space-y-2 pb-3 border-b border-gray-100">
                <div className="w-32 h-3 bg-gray-200 rounded animate-pulse" />
                <div className="w-20 h-4 bg-[#EDCF5D]/40 rounded animate-pulse" />
                <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="w-36 h-3 bg-gray-200 rounded animate-pulse" />
                <div className="w-full h-9 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
                <div className="w-full h-9 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
              </div>
              <div className="space-y-3.5 pt-1 border-t border-gray-100">
                <div className="flex gap-3 items-start mt-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-28 h-3.5 bg-gray-200 rounded animate-pulse" />
                    <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-28 h-3.5 bg-gray-200 rounded animate-pulse" />
                    <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-24 h-3.5 bg-gray-200 rounded animate-pulse" />
                    <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-36 h-3.5 bg-gray-200 rounded animate-pulse" />
                    <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-6 mt-4 sm:mt-6 max-w-[1440px] mx-auto border-t border-gray-200/90">
        <div className="flex items-center gap-8 mb-4">
          <div className="w-20 h-6 bg-gray-300 rounded-md animate-pulse" />
          <div className="w-20 h-6 bg-gray-200 rounded-md animate-pulse" />
          <div className="w-24 h-6 bg-gray-200 rounded-md animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-2xl bg-[#F9F8F5] border border-gray-100 space-y-2 animate-pulse">
                <div className="w-32 h-4 bg-gray-200 rounded" />
                <div className="w-full h-3 bg-gray-100 rounded" />
                <div className="w-3/4 h-3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-4 space-y-4 max-w-[320px] w-full ml-auto lg:sticky lg:top-24 self-start">
            <div className="w-28 h-12 bg-gray-200 rounded-xl animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-full h-3 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Similar Finds Skeleton */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12 max-w-[1440px] mx-auto border-t border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <div className="w-48 h-7 bg-gray-200 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
            <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-[#F9F8F5] p-3 space-y-3 border border-gray-100 animate-pulse">
              <div className="w-full aspect-square rounded-xl bg-gray-200" />
              <div className="w-3/4 h-4 bg-gray-200 rounded" />
              <div className="w-1/2 h-4 bg-gray-300 rounded" />
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}

