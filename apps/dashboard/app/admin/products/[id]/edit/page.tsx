"use client";

import { API_BASE } from "../../../../lib/api-base";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SidebarToggle } from "../../../sidebar-context";
import { VariantRow } from "../../product-form-modal";
import { uploadToCloudinary, uploadBrandLogo } from "../../cloudinary-upload";
import { MarkdownDescriptionEditor } from "../../markdown-description-editor";

function getVariantImageForColor(colorName: string, defaultImg: string, productName: string): string {
  if (defaultImg && defaultImg !== "/products/denim_jacket.png") return defaultImg;
  return "";
}

const STANDARD_SIZE_CATEGORIES = [
  {
    category: "General",
    options: ["Standard", "One Size"],
  },
  {
    category: "Clothing & Apparel",
    options: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
  },
  {
    category: "Footwear / Shoe Sizes",
    options: ["EU 38", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46", "US 7", "US 8", "US 9", "US 10", "US 11", "US 12"],
  },
  {
    category: "Weight / Mass (kg / g / lb)",
    options: ["250g", "500g", "1 kg", "2 kg", "5 kg", "10 kg", "25 kg", "50 kg", "1 lb", "5 lbs"],
  },
  {
    category: "Dimensions & Length (Feet / Inches / Meters)",
    options: ["3 ft", "4 ft", "5 ft", "6 ft", "10 ft", "12 ft", "24 inch", "32 inch", "43 inch", "50 inch", "55 inch", "65 inch", "75 inch", "85 inch", "1 meter", "2 meters"],
  },
  {
    category: "Volume & Capacity (Liters / cu. ft. / ml)",
    options: ["250 ml", "500 ml", "750 ml", "1 L", "1.5 L", "2 L", "5 L", "10 L", "50 L", "100 L", "200 L", "300 L", "400 L", "6.5 cu. ft.", "10 cu. ft.", "15 cu. ft.", "18 cu. ft.", "20 cu. ft.", "24 cu. ft.", "28 cu. ft.", "30 cu. ft."],
  },
  {
    category: "Tech Storage & Memory",
    options: ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "8GB RAM", "16GB RAM", "32GB RAM"],
  },
  {
    category: "Packs & Bundles",
    options: ["Pack of 1", "Pack of 2", "Pack of 3", "Pack of 6", "Pack of 12"],
  },
];

const ALL_STANDARD_OPTIONS_SET = new Set(STANDARD_SIZE_CATEGORIES.flatMap((c) => c.options));

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Validation & Violent Shake State
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [showIncompleteDraftModal, setShowIncompleteDraftModal] = useState(false);
  const [showExitDraftModal, setShowExitDraftModal] = useState(false);

  // Cloud Auto-Save State
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Change tracking — prevents dialog / auto-save firing on initial load
  const hasUnsavedChanges = useRef(false);
  const initialLoadSettled = useRef(false);

  // ── Input sanitisation helper ─────────────────────────────────────────────
  // Strips control characters and enforces maximum length.
  // Does NOT strip quotes/dashes (needed for product names), only dangerous
  // characters that could be used for injection.
  const sanitiseText = (val: string, maxLen = 500): string =>
    val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLen);

  // Slugify — allow only URL-safe characters
  const sanitiseSlug = (val: string): string =>
    val.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 200);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("GTS");
  const [categoryName, setCategoryName] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [basePriceNaira, setBasePriceNaira] = useState("");
  const [compareAtNaira, setCompareAtNaira] = useState("");
  const [costPriceNaira, setCostPriceNaira] = useState("");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [isFeatured, setIsFeatured] = useState(false);
  const [hasTransparentBg, setHasTransparentBg] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = (rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    if (!tagsList.includes(trimmed)) {
      const updated = [...tagsList, trimmed];
      setTagsList(updated);
      setTags(updated.join(", "));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tagsList.filter((t) => t !== tagToRemove);
    setTagsList(updated);
    setTags(updated.join(", "));
  };

  const handleTagInputChange = (val: string) => {
    if (val.includes(",")) {
      const parts = val.split(",");
      parts.forEach((p) => {
        if (p.trim()) handleAddTag(p.trim());
      });
      setTagInput("");
    } else {
      setTagInput(val);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
        setTagInput("");
      }
    } else if (e.key === "Backspace" && !tagInput && tagsList.length > 0) {
      handleRemoveTag(tagsList[tagsList.length - 1]!);
    }
  };

  const handleTagInputBlur = () => {
    if (tagInput.trim()) {
      handleAddTag(tagInput);
      setTagInput("");
    }
  };

  const [variants, setVariants] = useState<VariantRow[]>([]);

  // ────── FETCH PRODUCT DETAILS FROM API ──────
  useEffect(() => {
    if (!productId) return;
    let isMounted = true;

    const fetchProduct = async () => {
      setLoading(true);
      hasUnsavedChanges.current = false;
      initialLoadSettled.current = false;
      try {
        const token = localStorage.getItem("gts_token");
        const res = await fetch(`${API_BASE}/products/${productId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          const p = json.data;
          if (p && isMounted) {
            setName(p.name || "");
            setSlug(p.slug || "");
            setSku(p.sku || "");
            setBrand(p.brand || "GTS");
            setCategoryName(p.category?.name || "General");
            setSubCategory(p.sub_category || "");
            setBasePriceNaira(p.base_price ? String(p.base_price / 100) : "");
            setCompareAtNaira(p.compare_at_price ? String(p.compare_at_price / 100) : "");
            setCostPriceNaira(p.cost_price ? String(p.cost_price / 100) : "");
            setStatus(p.status || "active");
            setIsFeatured(Boolean(p.is_featured));
            setHasTransparentBg(Boolean(p.has_transparent_bg));

            // Primary hero image
            const primaryImg =
              p.images?.find((img: any) => img.is_primary)?.cloudinary_public_id ||
              p.image_url ||
              "";
            setImageUrl(primaryImg);

            setShortDescription(p.short_description || "");
            setDescription(p.description || "");

            // Tags
            if (Array.isArray(p.tags) && p.tags.length > 0) {
              setTagsList(p.tags);
              setTags(p.tags.join(", "));
            } else {
              setTagsList([]);
              setTags("");
            }

            // Variants
            if (Array.isArray(p.variants) && p.variants.length > 0) {
              const formattedVariants: VariantRow[] = p.variants.map((v: any) => {
                const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
                return {
                  id: v.id,
                  size: v.size || "Standard",
                  color: v.color || "Default",
                  color_hex: v.color_hex || "#111827",
                  sku: v.sku || "",
                  quantity: inv?.quantity !== undefined ? inv.quantity : 10,
                  variant_image_url: v.image_url || undefined,
                  has_transparent_bg: v.has_transparent_bg,
                };
              });
              setVariants(formattedVariants);
            } else {
              setVariants([]);
            }

            // Description images
            if (Array.isArray(p.description_images)) {
              setDescriptionImages(p.description_images);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load product details for editing:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          // Allow a tick for all the setState calls above to settle before
          // marking the load as complete — this prevents the auto-save and
          // change-tracking from treating the initial hydration as user edits.
          setTimeout(() => {
            if (isMounted) initialLoadSettled.current = true;
          }, 300);
        }
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Description Images State & Reordering
  interface DescriptionImageItem {
    id?: string;
    url: string;
    alt_text?: string;
    sort_order?: number;
    width?: number;
    height?: number;
    sizeKb?: number;
  }
  const [descriptionImages, setDescriptionImages] = useState<DescriptionImageItem[]>([]);

  // Upload & Image Optimization Stats
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isDraggingHero, setIsDraggingHero] = useState(false);
  const [heroImageStats, setHeroImageStats] = useState<{
    originalSize?: number;
    optimizedSize?: number;
    width?: number;
    height?: number;
  } | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  // Add Color Dialog State
  const [showAddColorModal, setShowAddColorModal] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const [newColorImage, setNewColorImage] = useState("");
  const [newColorQuantity, setNewColorQuantity] = useState(10);
  const [newColorSize, setNewColorSize] = useState("Standard");
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [customSizeText, setCustomSizeText] = useState("");
  const [isUploadingColorImage, setIsUploadingColorImage] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const [colorImageStats, setColorImageStats] = useState<{
    width?: number;
    height?: number;
    hasTransparentBg?: boolean;
    sizeKb?: number;
  } | null>(null);
  const colorFileInputRef = useRef<HTMLInputElement>(null);
  const variantZoneFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingVariantZone, setIsDraggingVariantZone] = useState(false);

  // Edit Color Dialog State
  const [showEditColorModal, setShowEditColorModal] = useState(false);
  const [editColorOldName, setEditColorOldName] = useState("");
  const [editColorNewName, setEditColorNewName] = useState("");
  const [editColorImage, setEditColorImage] = useState("");
  const [editColorStats, setEditColorStats] = useState<{
    width?: number;
    height?: number;
    hasTransparentBg?: boolean;
    sizeKb?: number;
  } | null>(null);
  const [isUploadingEditColorImage, setIsUploadingEditColorImage] = useState(false);
  const [isDraggingEditColor, setIsDraggingEditColor] = useState(false);
  const editColorFileInputRef = useRef<HTMLInputElement>(null);

  // Drag-to-reorder Color Variants State
  const [draggedColor, setDraggedColor] = useState<string | null>(null);
  const [dragOverColor, setDragOverColor] = useState<string | null>(null);
  const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);
  const [dragOverColorIndex, setDragOverColorIndex] = useState<number | null>(null);

  // Brands Registry & Selection State
  interface BrandOption {
    id?: string;
    name: string;
    slug?: string;
    logo_url?: string | null;
  }
  const [brandsList, setBrandsList] = useState<BrandOption[]>([
    { name: "GTS", slug: "gts", logo_url: "/logo.png" },
    { name: "Apple", slug: "apple", logo_url: "" },
    { name: "Samsung", slug: "samsung", logo_url: "" },
    { name: "Nexus", slug: "nexus", logo_url: "" },
    { name: "Nike", slug: "nike", logo_url: "" },
    { name: "Haier", slug: "haier", logo_url: "" },
    { name: "Google", slug: "google", logo_url: "" },
    { name: "Sony", slug: "sony", logo_url: "" },
    { name: "LG", slug: "lg", logo_url: "" },
    { name: "Philips", slug: "philips", logo_url: "" },
    { name: "Ninja", slug: "ninja", logo_url: "" },
    { name: "Zara", slug: "zara", logo_url: "" },
    { name: "Adidas", slug: "adidas", logo_url: "" },
    { name: "TCL", slug: "tcl", logo_url: "" },
    { name: "Hisense", slug: "hisense", logo_url: "" },
    { name: "Polystar", slug: "polystar", logo_url: "" },
    { name: "Hurom", slug: "hurom", logo_url: "" },
  ]);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Add Brand Modal State
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandLogo, setNewBrandLogo] = useState("");
  const [isUploadingBrandLogo, setIsUploadingBrandLogo] = useState(false);
  const [isDraggingBrandLogo, setIsDraggingBrandLogo] = useState(false);
  const [brandLogoStats, setBrandLogoStats] = useState<{
    sizeKb?: number;
    width?: number;
    height?: number;
  } | null>(null);
  const [savingNewBrand, setSavingNewBrand] = useState(false);
  const brandLogoFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Brands from Database
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await fetch(`${API_BASE}/brands`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            setBrandsList(json.data);
          }
        }
      } catch (err) {
        console.warn("Could not load brands:", err);
      }
    };
    fetchBrands();
  }, []);

  // Close brand dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setIsBrandDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Dirty-watcher: flip hasUnsavedChanges on any user edit ────────────────
  // This single effect monitors all form fields. Once the initial load has
  // settled (initialLoadSettled.current = true), any state change means the
  // user has edited something. We use a ref to avoid adding it to the
  // auto-save dependency array (which would cause infinite loops).
  useEffect(() => {
    if (initialLoadSettled.current) {
      hasUnsavedChanges.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name, slug, sku, brand, categoryName, subCategory,
    basePriceNaira, compareAtNaira, costPriceNaira,
    status, isFeatured, hasTransparentBg,
    imageUrl, shortDescription, description, tags, tagsList,
    variants, descriptionImages,
  ]);

  // Auto-Save Changes to Dedicated Drafts Store (debounced 1500ms)
  // Saves to /api/v1/products/drafts without mutating the live product in `products`
  useEffect(() => {
    if (!productId || loading || !initialLoadSettled.current || !hasUnsavedChanges.current) return;
    const timer = setTimeout(async () => {
      if (name.trim() || basePriceNaira.trim() || variants.length > 0 || imageUrl || description.trim()) {
        setAutoSaveStatus("saving");
        try {
          const baseNumVal = parseFloat(basePriceNaira) || 0;
          const baseKobo = Math.round(baseNumVal * 100);
          const compareKobo = compareAtNaira ? Math.round(parseFloat(compareAtNaira) * 100) : null;
          const costKobo = costPriceNaira ? Math.round(parseFloat(costPriceNaira) * 100) : null;

          const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
          if (brand && !parsedTags.includes(brand)) parsedTags.push(brand);
          if (hasTransparentBg && !parsedTags.includes("transparent-bg")) parsedTags.push("transparent-bg");

          const draftPayload = {
            id: productId,
            name: sanitiseText(name || "Untitled Draft Product", 200),
            slug: sanitiseSlug(slug || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : `draft-${Date.now()}`)),
            sku: sku.trim() ? sanitiseText(sku, 100) : undefined,
            brand: sanitiseText(brand || "GTS", 100),
            category_name: sanitiseText(categoryName || "General", 100),
            sub_category: sanitiseText(subCategory, 100),
            base_price: baseKobo,
            compare_at_price: compareKobo,
            cost_price: costKobo,
            status: status,
            is_featured: isFeatured,
            has_transparent_bg: hasTransparentBg,
            image_url: imageUrl.trim() || undefined,
            short_description: sanitiseText(shortDescription, 500),
            description: description.trim().slice(0, 50000),
            tags: parsedTags.map((t) => sanitiseText(t, 80)),
            variants,
            description_images: descriptionImages,
          };

          const token = localStorage.getItem("gts_token");
          await fetch(`${API_BASE}/products/drafts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              product_id: productId,
              title: draftPayload.name,
              draft_type: "revision",
              draft_data: draftPayload,
            }),
          });
          setAutoSaveStatus("saved");
        } catch {
          setAutoSaveStatus("idle");
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    productId,
    loading,
    name,
    slug,
    sku,
    brand,
    categoryName,
    subCategory,
    basePriceNaira,
    compareAtNaira,
    costPriceNaira,
    imageUrl,
    shortDescription,
    description,
    tags,
    tagsList,
    variants,
    descriptionImages,
    hasTransparentBg,
    isFeatured,
    status,
  ]);

  // Categories Registry & Selection State
  interface CategoryOption {
    id?: string;
    name: string;
    slug?: string;
    sub_categories?: string[];
  }
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([
    {
      name: "Appliances",
      slug: "appliances",
      sub_categories: ["Washing Machines", "Fridges", "Freezers", "Air Conditioners", "Heaters", "Fans", "Air Purifiers", "Water Dispensers", "Generators & Inverters", "Blenders", "Deep Fryers", "Juicers", "Air Fryers", "Rice Cookers", "Toasters & Ovens", "Microwaves", "Bundles", "Vacuum Cleaners", "Kettles", "Yam Pounders", "Irons", "Electric Cookware", "Electric Drink Mixers", "Food Processors", "Coffee Makers", "Electric Pressure Cookers", "Air Quality Control", "Cleaning Equipment", "Sewing Machines", "Water Heaters"],
    },
    {
      name: "Phones & Tablets",
      slug: "phones-tablets",
      sub_categories: ["Smartphones", "iOS Phones", "Android Phones", "Basic Phones", "Refurbished Phones", "iPads", "Android Tablets", "Educational Tablets", "Graphics Tablets", "Cases & Covers", "Screen Protectors", "Power Banks", "Chargers & Cables", "Earphones & Headsets", "Smartwatches & Bands"],
    },
    {
      name: "Health & Beauty",
      slug: "health-beauty",
      sub_categories: ["Face Cleansers", "Moisturizers & Creams", "Sunscreen & SPF", "Serums & Oils", "Face Masks", "Men's Perfumes", "Women's Perfumes", "Body Mists & Sprays", "Deodorants", "Shampoos & Conditioners", "Styling Tools & Irons", "Wigs & Extensions"],
    },
    {
      name: "Home & Office",
      slug: "home-office",
      sub_categories: ["Office Chairs", "Executive Desks", "Living Room Sofas", "Bed Frames & Tables", "Bed Sheets & Pillowcases", "Duvets & Comforters", "Bath Towels", "Table Lamps & Bulbs", "Wall Art & Clocks", "Rugs & Carpets"],
    },
    {
      name: "Electronics",
      slug: "electronics",
      sub_categories: ["Smart TVs", "OLED & QLED TVs", "4K UHD TVs", "Projectors & Screens", "Soundbars & Subwoofers", "Home Theatre Systems", "Bluetooth Speakers"],
    },
    {
      name: "Fashion",
      slug: "fashion",
      sub_categories: ["Dresses", "Tops & Blouses", "Footwear & Heels", "Handbags & Clutches", "Casual T-Shirts", "Formal Shirts", "Jeans & Trousers", "Sneakers & Boots"],
    },
    {
      name: "Supermarket",
      slug: "supermarket",
      sub_categories: ["Juices & Drinks", "Coffee & Tea", "Energy & Soft Drinks", "Rice & Grains", "Pasta & Noodles", "Cooking Oils"],
    },
    {
      name: "Computing",
      slug: "computing",
      sub_categories: ["Gaming Laptops", "MacBooks", "Ultrabooks & Slims", "Business Laptops", "Monitors & Screens", "External Hard Drives", "SSDs & Flash Drives", "Keyboards & Mice"],
    },
    {
      name: "Baby Products",
      slug: "baby-products",
      sub_categories: ["Diapers & Wipes", "Baby Bottles", "High Chairs", "Strollers & Prams", "Car Seats", "Walkers"],
    },
    {
      name: "Gaming",
      slug: "gaming",
      sub_categories: ["PlayStation 5", "Xbox Series X/S", "Nintendo Switch", "Wireless Controllers", "Gaming Headsets", "Gaming Chairs"],
    },
    {
      name: "Automotive & Sports",
      slug: "automotive-sports",
      sub_categories: ["Car Care & Polish", "Auto Electronics", "Fitness Equipment"],
    },
  ]);

  // Add Category Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySubCategories, setNewCategorySubCategories] = useState("");
  const [savingNewCategory, setSavingNewCategory] = useState(false);

  // Fetch Categories from Backend API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            setCategoriesList(json.data);
          }
        }
      } catch (err) {
        console.warn("Could not load categories:", err);
      }
    };
    fetchCategories();
  }, []);

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) {
      setErrorMsg("Please enter a category name.");
      return;
    }
    setSavingNewCategory(true);
    try {
      const parsedSubs = newCategorySubCategories
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const token = localStorage.getItem("gts_token");
      const res = await fetch(`${API_BASE}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          sub_categories: parsedSubs,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const createdCategory: CategoryOption = json.data || {
        name: newCategoryName.trim(),
        slug: newCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        sub_categories: parsedSubs,
      };

      setCategoriesList((prev) => {
        const exists = prev.some((c) => c.name.toLowerCase() === createdCategory.name.toLowerCase());
        if (exists) return prev;
        return [createdCategory, ...prev];
      });

      setCategoryName(createdCategory.name);
      setShowAddCategoryModal(false);
      setNewCategoryName("");
      setNewCategorySubCategories("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save category.");
    } finally {
      setSavingNewCategory(false);
    }
  };

  const handleUploadBrandLogoFile = async (file: File) => {
    if (!file) return;
    setIsUploadingBrandLogo(true);
    setErrorMsg("");
    try {
      const res = await uploadBrandLogo(file);
      setNewBrandLogo(res.url);
      setBrandLogoStats({
        sizeKb: Math.round((res.optimizedSize || 0) / 1024),
        width: res.width,
        height: res.height,
      });
    } catch (err: any) {
      setErrorMsg("Failed to upload brand logo: " + (err.message || "Please check network connection."));
    } finally {
      setIsUploadingBrandLogo(false);
    }
  };

  const handleSaveNewBrand = async () => {
    if (!newBrandName.trim()) {
      setErrorMsg("Please enter a brand name.");
      return;
    }
    setSavingNewBrand(true);
    try {
      const token = localStorage.getItem("gts_token");
      const res = await fetch(`${API_BASE}/brands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newBrandName.trim(),
          logo_url: newBrandLogo.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const createdBrand: BrandOption = json.data || {
        name: newBrandName.trim(),
        slug: newBrandName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        logo_url: newBrandLogo.trim() || undefined,
      };

      setBrandsList((prev) => {
        const exists = prev.some((b) => b.name.toLowerCase() === createdBrand.name.toLowerCase());
        if (exists) return prev;
        return [createdBrand, ...prev];
      });

      setBrand(createdBrand.name);
      setShowAddBrandModal(false);
      setNewBrandName("");
      setNewBrandLogo("");
      setBrandLogoStats(null);
      setIsBrandDropdownOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save brand.");
    } finally {
      setSavingNewBrand(false);
    }
  };

  // Description Images State & Reordering
  const [isUploadingDescImages, setIsUploadingDescImages] = useState(false);
  const [isDraggingDescZone, setIsDraggingDescZone] = useState(false);
  const descFileInputRef = useRef<HTMLInputElement>(null);
  const [draggedDescIndex, setDraggedDescIndex] = useState<number | null>(null);
  const [dragOverDescIndex, setDragOverDescIndex] = useState<number | null>(null);

  const handleUploadDescriptionImages = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    setIsUploadingDescImages(true);
    setErrorMsg("");
    try {
      const uploadedItems: DescriptionImageItem[] = [];
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        if (!file) continue;
        const res = await uploadToCloudinary(file, "gts/products/description");
        uploadedItems.push({
          url: res.url,
          alt_text: "",
          sort_order: descriptionImages.length + i,
          width: res.width,
          height: res.height,
          sizeKb: Math.round((res.optimizedSize || 0) / 1024),
        });
      }
      setDescriptionImages((prev) => [...prev, ...uploadedItems]);
    } catch (err: any) {
      setErrorMsg("Failed to upload description image: " + (err.message || "Please check network connection."));
    } finally {
      setIsUploadingDescImages(false);
    }
  };

  const handleReorderDescImages = (srcIdx: number, targetIdx: number) => {
    if (srcIdx === targetIdx || srcIdx < 0 || targetIdx < 0) return;
    setDescriptionImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(srcIdx, 1);
      if (moved) copy.splice(targetIdx, 0, moved);
      return copy.map((item, idx) => ({ ...item, sort_order: idx }));
    });
  };

  const handleUpdateDescAlt = (idx: number, alt: string) => {
    setDescriptionImages((prev) => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], alt_text: alt };
      }
      return copy;
    });
  };

  const handleRemoveDescImage = (idx: number) => {
    setDescriptionImages((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sort_order: i })));
  };

  // Per-color file input ref map for quick replacement
  const colorGroupFileRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Auto slugify name if slug empty
  const handleNameChange = (val: string) => {
    hasUnsavedChanges.current = true;
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  // Upload hero image with auto compression & transparency verification
  const handleUploadHeroOrColor = async (file: File) => {
    if (!file) return;
    setIsUploadingHero(true);
    setErrorMsg("");
    try {
      const res = await uploadToCloudinary(file, "gts/products/colors");
      if (!imageUrl) {
        setImageUrl(res.url);
        setHasTransparentBg(res.hasTransparentBg);
        setHeroImageStats({
          originalSize: res.originalSize,
          optimizedSize: res.optimizedSize,
          width: res.width,
          height: res.height,
        });
      }

      setNewColorImage(res.url);
      setColorImageStats({
        width: res.width,
        height: res.height,
        hasTransparentBg: res.hasTransparentBg,
        sizeKb: Math.round((res.optimizedSize || 0) / 1024),
      });

      hasUnsavedChanges.current = true;

      if (variants.length === 0) {
        setShowAddColorModal(true);
      }
    } catch (err: any) {
      setErrorMsg("Image upload failed: " + (err.message || "Please try again."));
    } finally {
      setIsUploadingHero(false);
    }
  };

  const handleUploadHero = handleUploadHeroOrColor;

  // Upload color variant image in dialog with auto compression & transparency check
  const handleUploadColorImage = async (file: File) => {
    if (!file) return;
    setIsUploadingColorImage(true);
    setErrorMsg("");
    try {
      const res = await uploadToCloudinary(file, "gts/products/colors");
      setNewColorImage(res.url);
      setColorImageStats({
        width: res.width,
        height: res.height,
        hasTransparentBg: res.hasTransparentBg,
        sizeKb: Math.round((res.optimizedSize || 0) / 1024),
      });
      if (!imageUrl) {
        setImageUrl(res.url);
        setHasTransparentBg(res.hasTransparentBg);
      }
      hasUnsavedChanges.current = true;
    } catch (err: any) {
      setErrorMsg("Color image upload failed: " + (err.message || "Please try again."));
    } finally {
      setIsUploadingColorImage(false);
    }
  };

  // Upload image in Edit Color Modal
  const handleUploadEditColorImage = async (file: File) => {
    if (!file) return;
    setIsUploadingEditColorImage(true);
    setErrorMsg("");
    try {
      const res = await uploadToCloudinary(file, "gts/products/colors");
      setEditColorImage(res.url);
      setEditColorStats({
        width: res.width,
        height: res.height,
        hasTransparentBg: res.hasTransparentBg,
        sizeKb: Math.round((res.optimizedSize || 0) / 1024),
      });
    } catch (err: any) {
      setErrorMsg("Color image upload failed: " + (err.message || "Please try again."));
    } finally {
      setIsUploadingEditColorImage(false);
    }
  };

  const handleOpenEditColorModal = (colorName: string, currentImg?: string) => {
    setEditColorOldName(colorName);
    setEditColorNewName(colorName);
    setEditColorImage(currentImg || "");
    setEditColorStats(null);
    setShowEditColorModal(true);
  };

  const handleSaveEditColor = () => {
    if (!editColorNewName.trim()) {
      setErrorMsg("Color name cannot be empty.");
      return;
    }

    setVariants((prev) =>
      prev.map((v) => {
        if (v.color === editColorOldName) {
          return {
            ...v,
            color: editColorNewName.trim(),
            variant_image_url: editColorImage || v.variant_image_url,
            has_transparent_bg: editColorStats?.hasTransparentBg ?? v.has_transparent_bg,
          };
        }
        return v;
      })
    );

    if (imageUrl === editColorImage || !imageUrl) {
      setImageUrl(editColorImage);
    }

    setShowEditColorModal(false);
  };

  const handleDeleteColorGroup = (colorName: string) => {
    setVariants((prev) => prev.filter((v) => v.color !== colorName));
    setShowEditColorModal(false);
  };

  // Upload image for existing color group
  const handleUploadExistingColorImage = async (colorName: string, file: File) => {
    if (!file) return;
    try {
      const res = await uploadToCloudinary(file, "gts/products/colors");
      setVariants((prev) =>
        prev.map((v) => (v.color === colorName ? { ...v, variant_image_url: res.url, has_transparent_bg: res.hasTransparentBg } : v))
      );
    } catch (err: any) {
      setErrorMsg("Color image upload failed: " + (err.message || "Please try again."));
    }
  };

  const handleDeduplicateVariants = () => {
    const map = new Map<string, any>();
    variants.forEach((v) => {
      const key = `${(v.size || "").trim().toUpperCase()}__${(v.color || "").trim().toUpperCase()}`;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity = (existing.quantity || 0) + (v.quantity || 0);
      } else {
        map.set(key, { ...v });
      }
    });
    setVariants(Array.from(map.values()));
  };

  const handleUpdateGroupColorName = (oldColor: string, newColor: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.color === oldColor ? { ...v, color: newColor } : v))
    );
  };

  const handleAddSizeToColor = (colorName: string, colorImg?: string) => {
    setVariants((prev) => [
      ...prev,
      {
        size: "Standard",
        color: colorName,
        color_hex: "#111827",
        sku: "",
        quantity: 10,
        variant_image_url: colorImg,
      },
    ]);
  };

  const handleConfirmAddColor = () => {
    if (!newColorName.trim()) {
      setErrorMsg("Please enter a color name.");
      return;
    }

    setVariants((prev) => [
      ...prev,
      {
        size: newColorSize.trim() || "Standard",
        color: newColorName.trim(),
        color_hex: "#111827",
        sku: "",
        quantity: Number(newColorQuantity) || 10,
        variant_image_url: newColorImage || undefined,
      },
    ]);

    // Reset dialog
    setNewColorName("");
    setNewColorImage("");
    setNewColorQuantity(10);
    setNewColorSize("Standard");
    setColorImageStats(null);
    setShowAddColorModal(false);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateVariant = (index: number, field: keyof VariantRow, val: any) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: val } : v))
    );
  };

  // Drag and drop color reordering
  const handleReorderColors = (draggedCol: string, targetCol: string) => {
    if (!draggedCol || !targetCol || draggedCol === targetCol) return;

    // Get unique ordered list of colors currently in variants
    const currentColors: string[] = [];
    variants.forEach((v) => {
      const c = (v.color || "Default").trim();
      if (!currentColors.includes(c)) currentColors.push(c);
    });

    const fromIndex = currentColors.indexOf(draggedCol);
    const toIndex = currentColors.indexOf(targetCol);
    if (fromIndex === -1 || toIndex === -1) return;

    // Reorder the color sequence
    const newColors = [...currentColors];
    const removed = newColors.splice(fromIndex, 1)[0];
    if (removed) {
      newColors.splice(toIndex, 0, removed);
    }

    // Reorder variants array according to new sequence
    const reorderedVariants: VariantRow[] = [];
    newColors.forEach((c) => {
      const matching = variants.filter((v) => (v.color || "Default").trim() === c);
      reorderedVariants.push(...matching);
    });

    setVariants(reorderedVariants);

    // Set first color image as active showcase image if available
    const firstGroup = reorderedVariants.find((v) => v.variant_image_url);
    if (firstGroup?.variant_image_url) {
      setImageUrl(firstGroup.variant_image_url);
    }
  };

  // Group variants by color name
  interface ColorGroup {
    color: string;
    image_url?: string;
    variantIndices: number[];
  }

  const groupedColorsMap = new Map<string, ColorGroup>();
  variants.forEach((v, index) => {
    const colorKey = (v.color || "Default").trim();
    if (!groupedColorsMap.has(colorKey)) {
      groupedColorsMap.set(colorKey, {
        color: colorKey,
        image_url: v.variant_image_url || imageUrl || "",
        variantIndices: [index],
      });
    } else {
      const g = groupedColorsMap.get(colorKey)!;
      if (!g.image_url && v.variant_image_url) {
        g.image_url = v.variant_image_url;
      }
      g.variantIndices.push(index);
    }
  });

  // Resolve Color Variant Thumbnails
  const colorVariantThumbnails = Array.from(
    new Map(
      variants
        .filter((v) => v.color && v.color.trim())
        .map((v) => {
          const colorName = v.color.trim();
          const img = v.variant_image_url || imageUrl || "";
          return [colorName, { color: colorName, img }];
        })
    ).values()
  );

  const executeSaveProduct = async (targetStatus: "active" | "draft") => {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    setShowIncompleteDraftModal(false);

    const baseKobo = Math.round(parseFloat(basePriceNaira || "0") * 100);
    const compareKobo = compareAtNaira ? Math.round(parseFloat(compareAtNaira) * 100) : null;
    const costKobo = costPriceNaira ? Math.round(parseFloat(costPriceNaira) * 100) : null;

    const parsedTags = tags.split(",").map((t) => sanitiseText(t.trim(), 80)).filter(Boolean);
    if (brand && !parsedTags.includes(brand)) parsedTags.push(sanitiseText(brand, 80));
    if (hasTransparentBg && !parsedTags.includes("transparent-bg")) parsedTags.push("transparent-bg");

    const cleanName = sanitiseText(name, 200) || (targetStatus === "draft" ? "Untitled Draft Product" : "");
    const cleanSlug = sanitiseSlug(slug || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : `draft-${Date.now()}`));

    const effectiveImageUrl = imageUrl.trim() || descriptionImages[0]?.url || undefined;
    const finalVariants = variants.length > 0 ? variants.map((v) => ({
      ...v,
      size: sanitiseText(v.size || "Standard", 100),
      color: sanitiseText(v.color || "Default", 100),
      sku: v.sku ? sanitiseText(v.sku, 100) : undefined,
      quantity: Math.max(0, Math.min(Number(v.quantity) || 0, 1_000_000)),
    })) : [
      {
        size: "Standard",
        color: "Default",
        color_hex: "#111827",
        sku: sku.trim() ? sanitiseText(sku, 100) : undefined,
        quantity: 100,
        variant_image_url: effectiveImageUrl || "",
        has_transparent_bg: hasTransparentBg,
      }
    ];

    const payload = {
      id: productId,
      name: cleanName,
      slug: cleanSlug,
      sku: sku.trim() ? sanitiseText(sku, 100) : undefined,
      brand: sanitiseText(brand || "GTS", 100),
      category_name: sanitiseText(categoryName || "General", 100),
      sub_category: sanitiseText(subCategory, 100),
      base_price: baseKobo,
      compare_at_price: compareKobo,
      cost_price: costKobo,
      status: targetStatus,
      is_featured: isFeatured,
      has_transparent_bg: hasTransparentBg,
      primary_image_url: effectiveImageUrl,
      short_description: sanitiseText(shortDescription, 500),
      description: description.trim().slice(0, 50000),
      tags: parsedTags,
      variants: finalVariants,
      description_images: descriptionImages,
    };

    try {
      const token = localStorage.getItem("gts_token");

      if (targetStatus === "draft") {
        // ── SAVE WORKING REVISION TO DEDICATED DRAFTS STORE ───────────────────
        // Leaves live product Active and published on storefront
        const res = await fetch(`${API_BASE}/products/drafts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            product_id: productId,
            title: payload.name || "Untitled Revision Draft",
            draft_type: "revision",
            draft_data: payload,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || `Failed to save working draft (${res.status}).`);
        }

        hasUnsavedChanges.current = false;
        setSuccessMsg("Working revision saved to Drafts! Live product remains Active on storefront.");
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        // ── PUBLISH LIVE CHANGES TO PRODUCTS TABLE ────────────────────────────
        const res = await fetch(`${API_BASE}/products`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ...payload, status: "active" }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || `Failed to save product updates (${res.status}).`);
        }

        // Clean up any working draft revision since it is now published live
        try {
          await fetch(`${API_BASE}/products/drafts?product_id=${productId}`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        } catch {}

        hasUnsavedChanges.current = false;
        try { localStorage.removeItem(`gts_product_edit_draft_${productId}`); } catch {}

        setSuccessMsg("Product changes published successfully!");
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save product updates.");
    } finally {
      setSaving(false);
    }
  };

  const hasImagesOrVariants = variants.length > 0 || descriptionImages.length > 0 || Boolean(imageUrl.trim());
  const isEligibleToPublish = Boolean(name.trim()) && Boolean(categoryName.trim()) && (parseFloat(basePriceNaira) || 0) > 0 && hasImagesOrVariants;

  const handleValidateAndPublish = (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    const invalid: string[] = [];

    if (!name.trim()) {
      missing.push("Product Title / Name");
      invalid.push("name");
    }
    if (!brand.trim()) {
      missing.push("Brand");
      invalid.push("brand");
    }
    if (!categoryName.trim()) {
      missing.push("Category");
      invalid.push("category");
    }
    const baseNum = parseFloat(basePriceNaira) || 0;
    if (!basePriceNaira || isNaN(baseNum) || baseNum <= 0) {
      missing.push("Selling Price (Base Price)");
      invalid.push("basePrice");
    }
    if (!hasImagesOrVariants) {
      missing.push("Product Images / Media (Please add at least one color variant image or product description image)");
      invalid.push("imageUrl");
    }
    if (!description.trim() && !shortDescription.trim()) {
      missing.push("Full Description or Short Catchy Highlight");
      invalid.push("description");
    }

    if (missing.length > 0) {
      setInvalidFields(invalid);
      setMissingItems(missing);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 750);
      setShowIncompleteDraftModal(true);
      return;
    }

    executeSaveProduct("active");
  };

  const handleAttemptBack = () => {
    if (hasUnsavedChanges.current) {
      setShowExitDraftModal(true);
    } else {
      router.push("/admin/products");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white flex items-center justify-center p-8 font-sans transition-colors">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
          <svg className="w-5 h-5 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading product details for editing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white font-sans flex flex-col lg:overflow-hidden">
      
      {/* ────── STICKY PAGE HEADER ────── */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#181818]/90 backdrop-blur-md border-b border-gray-200 dark:border-[#262626] px-4 pt-3 pb-3 lg:px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SidebarToggle className="-ml-1" />
            <button
              type="button"
              onClick={handleAttemptBack}
              className="p-1.5 rounded-[6px] bg-gray-100 dark:bg-[#242424] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Back to Products"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#8E8E8E]">
              <button
                type="button"
                onClick={handleAttemptBack}
                className="text-gray-500 hover:text-gray-900 dark:text-[#8E8E8E] dark:hover:text-white transition-colors font-medium cursor-pointer"
              >
                Product
              </button>
              <svg className="w-3 h-3 text-gray-300 dark:text-[#444444] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[240px]">
                {name || "Edit Product"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {autoSaveStatus === "saving" && (
              <span className="text-[10px] text-amber-400 font-mono animate-pulse hidden sm:inline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Auto-saving draft...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="text-[10px] text-emerald-400 font-mono hidden sm:inline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Draft auto-saved
              </span>
            )}

            <button
              type="button"
              onClick={handleAttemptBack}
              className="px-4 py-2 rounded-[6px] bg-gray-100 hover:bg-gray-200 dark:bg-[#242424] dark:hover:bg-[#2C2C2C] text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => executeSaveProduct("draft")}
              disabled={saving}
              className="px-3.5 py-2 rounded-[6px] border border-amber-400/40 hover:bg-amber-400/10 text-xs font-semibold text-amber-400 dark:text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              onClick={handleValidateAndPublish}
              disabled={!isEligibleToPublish || saving}
              title={
                !isEligibleToPublish
                  ? "To save changes, provide product name, category, price, and at least one color or description image"
                  : "Save Changes"
              }
              className={`px-5 py-2 rounded-[6px] text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                !isEligibleToPublish
                  ? "bg-gray-200 dark:bg-[#2A2A2A] text-gray-400 dark:text-gray-500 border border-gray-300/40 dark:border-[#383838] cursor-not-allowed shadow-none"
                  : "bg-[#EDCF5D] hover:bg-[#e2c34d] text-black cursor-pointer"
              }`}
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ────── MAIN EDITING CONTENT GRID ────── */}
      <div className="max-w-[1600px] mx-auto px-4 pt-6 lg:px-6 lg:flex-1 lg:flex lg:flex-col lg:min-h-0 pb-6">
        
        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-[6px] bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium flex items-center justify-between gap-2">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-500 hover:text-red-700 font-bold">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-[6px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
            ✓ {successMsg}
          </div>
        )}

        <form onSubmit={handleValidateAndPublish} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:flex-1 lg:min-h-0">
          
          {/* ────── LEFT COLUMN: MAIN FORM CARDS (2 COLS) ────── */}
          <div className="lg:col-span-2 space-y-6 lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.15)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.1)_transparent]">
            
            {/* Card 1: Basic Information */}
            <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl p-6 shadow-2xs space-y-5">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-gray-100 dark:border-[#262626] pb-3">
                General Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Product Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      handleNameChange(e.target.value);
                      if (invalidFields.includes("name")) {
                        setInvalidFields((prev) => prev.filter((f) => f !== "name"));
                      }
                    }}
                    placeholder="e.g. Haier Thermocool Refrigerator"
                    className={`w-full px-3.5 py-2.5 rounded-[6px] bg-gray-50 dark:bg-[#202020] border text-xs font-bold text-gray-900 dark:text-white focus:outline-none transition-all ${
                      invalidFields.includes("name") && isShaking
                        ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
                        : invalidFields.includes("name")
                        ? "border-red-500"
                        : "border-gray-200 dark:border-[#303030] focus:border-[#EDCF5D]"
                    }`}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="haier-thermocool-refrigerator"
                      className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        SKU (Stock Keeping Unit)
                      </label>
                      <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        Auto-generated
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={sku || "GTS-PRD-0000"}
                        className="w-full pl-3.5 pr-8 py-2 rounded-[6px] bg-gray-100 dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2C2C2C] text-xs font-mono text-gray-500 dark:text-gray-400 cursor-not-allowed select-all focus:outline-none"
                      />
                      <svg className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Brand Selector Dropdown */}
                  <div className="relative" ref={brandDropdownRef}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Brand
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBrandModal(true);
                          setIsBrandDropdownOpen(false);
                        }}
                        className="text-[11px] text-[#9E7B00] dark:text-[#EDCF5D] hover:underline font-bold cursor-pointer"
                      >
                        + New Brand
                      </button>
                    </div>

                    {/* Selected Brand Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsBrandDropdownOpen((prev) => !prev)}
                      className={`w-full px-3 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border text-xs font-medium text-gray-900 dark:text-white flex items-center justify-between hover:border-[#EDCF5D] transition-all cursor-pointer ${
                        invalidFields.includes("brand") && isShaking
                          ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
                          : invalidFields.includes("brand")
                          ? "border-red-500"
                          : "border-gray-200 dark:border-[#303030]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {(() => {
                          const currentBrandObj = brandsList.find((b) => b.name.toLowerCase() === brand.toLowerCase());
                          return (
                            <>
                              <div className="w-5 h-5 rounded bg-black text-white text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0 border border-gray-300 dark:border-[#383838]">
                                {currentBrandObj?.logo_url ? (
                                  <img src={currentBrandObj.logo_url} alt={brand} className="w-full h-full object-contain" />
                                ) : (
                                  brand.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <span className="truncate">{brand || "Select brand"}</span>
                            </>
                          );
                        })()}
                      </div>
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isBrandDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isBrandDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full sm:w-[260px] bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] rounded-xl shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                        <div className="relative">
                          <input
                            type="text"
                            value={brandSearchQuery}
                            onChange={(e) => setBrandSearchQuery(e.target.value)}
                            placeholder="Search brand..."
                            autoFocus
                            className="w-full pl-7 pr-2.5 py-1.5 rounded-[6px] bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2E2E2E] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                          />
                          <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>

                        <div className="max-h-44 overflow-y-auto space-y-0.5 [scrollbar-width:thin]">
                          {brandsList
                            .filter((b) => b.name.toLowerCase().includes(brandSearchQuery.toLowerCase()))
                            .map((b) => {
                              const isSelected = brand.toLowerCase() === b.name.toLowerCase();
                              return (
                                <button
                                  key={b.name}
                                  type="button"
                                  onClick={() => {
                                    setBrand(b.name);
                                    if (invalidFields.includes("brand")) {
                                      setInvalidFields((prev) => prev.filter((f) => f !== "brand"));
                                    }
                                    setIsBrandDropdownOpen(false);
                                    setBrandSearchQuery("");
                                  }}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-xs text-left transition-colors cursor-pointer ${
                                    isSelected
                                      ? "bg-[#EDCF5D] text-black font-bold"
                                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282828]"
                                  }`}
                                >
                                  <div className="w-5 h-5 rounded bg-black text-white text-[9px] font-black flex items-center justify-center overflow-hidden shrink-0 border border-gray-400/30">
                                    {b.logo_url ? (
                                      <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain" />
                                    ) : (
                                      b.name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <span className="truncate flex-1">{b.name}</span>
                                  {isSelected && <span className="text-xs">✓</span>}
                                </button>
                              );
                            })}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAddBrandModal(true);
                            setIsBrandDropdownOpen(false);
                          }}
                          className="w-full pt-2 border-t border-gray-100 dark:border-[#2A2A2A] text-center text-xs font-bold text-[#9E7B00] dark:text-[#EDCF5D] hover:underline cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>+ Create &quot;{brandSearchQuery || "New Brand"}&quot;</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Category Field with + New Category Button */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Category
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryModal(true)}
                        className="text-[11px] text-[#9E7B00] dark:text-[#EDCF5D] hover:underline font-bold cursor-pointer"
                      >
                        + New Category
                      </button>
                    </div>
                    <select
                      value={categoryName}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setCategoryName(newCat);
                        if (invalidFields.includes("category")) {
                          setInvalidFields((prev) => prev.filter((f) => f !== "category"));
                        }
                        const found = categoriesList.find((c) => c.name.toLowerCase() === newCat.toLowerCase());
                        if (found && found.sub_categories && found.sub_categories.length > 0) {
                          if (!found.sub_categories.includes(subCategory)) {
                            setSubCategory(found.sub_categories[0] || "");
                          }
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border text-xs font-medium text-gray-900 dark:text-white focus:outline-none transition-all cursor-pointer ${
                        invalidFields.includes("category") && isShaking
                          ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
                          : invalidFields.includes("category")
                          ? "border-red-500"
                          : "border-gray-200 dark:border-[#303030] focus:border-[#EDCF5D]"
                      }`}
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-Category with Presets Datalist */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Sub-Category
                    </label>
                    <input
                      type="text"
                      list="edit-subcategory-presets-list"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      placeholder="e.g. Refrigerators, Sneakers"
                      className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                    />
                    <datalist id="edit-subcategory-presets-list">
                      {(
                        categoriesList.find(
                          (c) => c.name.toLowerCase() === categoryName.toLowerCase()
                        )?.sub_categories || []
                      ).map((sub) => (
                        <option key={sub} value={sub} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Short Summary Description
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Brief 3–7 line product summary highlight (e.g. Next-generation AI computational photography, pro-level triple camera system with 5x telephoto zoom, and ultra-smooth OLED display powered by the Tensor G5 chip)..."
                    className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs leading-relaxed text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] resize-y"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Full Storefront Overview Description
                    </label>
                  </div>
                  <MarkdownDescriptionEditor
                    value={description}
                    onChange={(val) => {
                      setDescription(val);
                      if (invalidFields.includes("description")) {
                        setInvalidFields((prev) => prev.filter((f) => f !== "description"));
                      }
                    }}
                    isInvalid={invalidFields.includes("description")}
                    isShaking={isShaking}
                    placeholder="Write detailed specifications, warranty, materials, subheadings (## Feature), and bullet points (- Feature 1)..."
                  />
                </div>

                {/* Interactive Product Tags Field with Chip Badges */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Product Tags & Keywords
                    </label>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Type and press comma to create tag chips
                    </span>
                  </div>

                  <div className="w-full min-h-[42px] px-3 py-1.5 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] flex flex-wrap items-center gap-1.5 focus-within:border-[#EDCF5D] transition-colors">
                    {tagsList.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#EDCF5D]/15 text-[#9E7B00] dark:text-[#EDCF5D] border border-[#EDCF5D]/30 text-xs font-semibold animate-in fade-in zoom-in-95 duration-100"
                      >
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="text-[#9E7B00] dark:text-[#EDCF5D] hover:text-red-500 ml-0.5 cursor-pointer font-bold"
                          title="Remove tag"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => handleTagInputChange(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      onBlur={handleTagInputBlur}
                      placeholder={
                        tagsList.length === 0
                          ? "Type a tag and press comma (e.g. Fashion, Premium, Sale)..."
                          : "Add tag..."
                      }
                      className="flex-1 min-w-[130px] bg-transparent border-none outline-none text-xs text-gray-900 dark:text-white placeholder-gray-400 py-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Pricing & Margins */}
            <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl p-6 shadow-2xs space-y-5">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-gray-100 dark:border-[#262626] pb-3">
                Pricing & Financial Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Base Price (₦) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">₦</span>
                    <input
                      type="number"
                      step="0.01"
                      value={basePriceNaira}
                      onChange={(e) => {
                        setBasePriceNaira(e.target.value);
                        if (invalidFields.includes("basePrice")) {
                          setInvalidFields((prev) => prev.filter((f) => f !== "basePrice"));
                        }
                      }}
                      placeholder="120000"
                      className={`w-full pl-7 pr-3 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border text-xs font-bold text-gray-900 dark:text-white focus:outline-none transition-all ${
                        invalidFields.includes("basePrice") && isShaking
                          ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
                          : invalidFields.includes("basePrice")
                          ? "border-red-500"
                          : "border-gray-200 dark:border-[#303030] focus:border-[#EDCF5D]"
                      }`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Compare-At Price (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">₦</span>
                    <input
                      type="number"
                      step="0.01"
                      value={compareAtNaira}
                      onChange={(e) => setCompareAtNaira(e.target.value)}
                      placeholder="150000"
                      className="w-full pl-7 pr-3 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Cost Price / Unit (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">₦</span>
                    <input
                      type="number"
                      step="0.01"
                      value={costPriceNaira}
                      onChange={(e) => setCostPriceNaira(e.target.value)}
                      placeholder="95000"
                      className="w-full pl-7 pr-3 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>
                </div>
              </div>
            </div>


            {/* Card 2: Variants Matrix (Grouped by Color - Zero Repetition) */}
            <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#262626] pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Product Variants & Color Groups
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeduplicateVariants}
                    className="px-3 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#242424] text-xs font-semibold transition-all cursor-pointer"
                  >
                    Consolidate Duplicates
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddColorModal(true)}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Add New Color</span>
                  </button>
                </div>
              </div>

              {/* Empty State: Drag & Drop Dropzone to Add First Color */}
              {variants.length === 0 ? (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={variantZoneFileInputRef}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadHeroOrColor(f);
                    }}
                    className="hidden"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingVariantZone(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingVariantZone(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingVariantZone(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleUploadHeroOrColor(f);
                    }}
                    onClick={() => variantZoneFileInputRef.current?.click()}
                    className={`rounded-[14px] border-2 border-dashed p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                      invalidFields.includes("variants") && isShaking
                        ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
                        : invalidFields.includes("variants")
                        ? "border-red-500 bg-red-500/5"
                        : isDraggingVariantZone
                        ? "border-[#EDCF5D] bg-[#EDCF5D]/10 scale-[1.01]"
                        : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#1E1E1E]/50 hover:bg-gray-100/50 dark:hover:bg-[#242424]"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Drag & drop a color variant photo, or <span className="text-[#9E7B00] dark:text-[#EDCF5D] underline">click to upload</span>
                      </p>
                      <p className="text-[11px] text-gray-400 font-mono">
                        Automatically opens color configuration with custom size & inventory options
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Color Groups List */
                <div className="space-y-4">
                  {Array.from(groupedColorsMap.values()).map((group, groupIdx) => (
                    <div
                      key={groupIdx}
                      className="p-4 rounded-xl bg-gray-50 dark:bg-[#1C1C1C] border border-gray-200/80 dark:border-[#2A2A2A] space-y-3"
                    >
                      {/* Master Color Header Row */}
                      <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-[#262626] pb-2.5 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          {/* Image Swatch Thumbnail */}
                          <div className="relative group/swatch w-11 h-11 rounded-[8px] border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#141414] overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                            {group.image_url || imageUrl ? (
                              <img
                                src={group.image_url || imageUrl}
                                alt={group.color}
                                className="w-full h-full object-contain rounded-[6px]"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400">GTS</span>
                            )}
                          </div>

                          {/* Color Name Badge */}
                          <span className="text-xs font-bold text-gray-900 dark:text-white px-2.5 py-1 rounded-[6px] bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#333333]">
                            {group.color}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Edit Button Next to Add Size Variant */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditColorModal(group.color, group.image_url)}
                            className="px-3 py-1 rounded-[6px] border border-gray-300 dark:border-[#383838] bg-white dark:bg-[#1E1E1E] hover:bg-gray-100 dark:hover:bg-[#282828] text-gray-800 dark:text-gray-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                            <span>Edit</span>
                          </button>

                          {/* Add Size Variant Button */}
                          <button
                            type="button"
                            onClick={() => handleAddSizeToColor(group.color, group.image_url)}
                            className="px-3 py-1 rounded-[6px] bg-gray-200/80 dark:bg-[#282828] hover:bg-gray-300 dark:hover:bg-[#333333] text-gray-800 dark:text-gray-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            + Add Size Variant
                          </button>
                        </div>
                      </div>

                    {/* Sub-Table of Sizes for this Color */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-[10px] font-mono uppercase text-gray-400 dark:text-gray-500 border-b border-gray-200/40 dark:border-[#262626]">
                            <th className="py-1.5 px-2">Size / Variant Option</th>
                            <th className="py-1.5 px-2">Inventory Stock</th>
                            <th className="py-1.5 px-2 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/30 dark:divide-[#242424]">
                          {group.variantIndices.map((vIdx) => {
                            const v = variants[vIdx];
                            if (!v) return null;
                            return (
                              <tr key={vIdx} className="hover:bg-gray-100/50 dark:hover:bg-[#222222] transition-colors">
                                <td className="py-1.5 px-2 w-52">
                                  <select
                                    value={v.size || "Standard"}
                                    onChange={(e) => handleUpdateVariant(vIdx, "size", e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-[6px] bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#333333] text-xs font-bold text-gray-900 dark:text-white focus:border-[#EDCF5D] cursor-pointer"
                                  >
                                    {v.size && !ALL_STANDARD_OPTIONS_SET.has(v.size) && (
                                      <optgroup label="Custom / Current Value">
                                        <option value={v.size}>{v.size}</option>
                                      </optgroup>
                                    )}
                                    {STANDARD_SIZE_CATEGORIES.map((cat, idx) => (
                                      <optgroup key={idx} label={cat.category}>
                                        {cat.options.map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                </td>

                                <td className="py-1.5 px-2 w-40">
                                  <input
                                    type="number"
                                    value={v.quantity}
                                    onChange={(e) => handleUpdateVariant(vIdx, "quantity", parseInt(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1 rounded-[6px] bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#333333] text-xs font-bold text-gray-900 dark:text-white focus:border-[#EDCF5D]"
                                  />
                                </td>

                                <td className="py-1.5 px-2 text-right w-16">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(vIdx)}
                                    className="w-6 h-6 rounded-md text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors text-xs font-bold flex items-center justify-center ml-auto cursor-pointer"
                                    title="Remove Size"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* Card 3: Product Description Images & Media */}
            <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#262626] pb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Product Description Images & Media
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Infographic banners, detail shots, and feature diagrams displayed under the product description
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    ref={descFileInputRef}
                    onChange={(e) => {
                      if (e.target.files) handleUploadDescriptionImages(e.target.files);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => descFileInputRef.current?.click()}
                    disabled={isUploadingDescImages}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUploadingDescImages ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span>Add Description Images</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingDescZone(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingDescZone(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingDescZone(false);
                  if (e.dataTransfer.files) handleUploadDescriptionImages(e.dataTransfer.files);
                }}
                onClick={() => descFileInputRef.current?.click()}
                className={`rounded-[14px] border-2 border-dashed p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  isDraggingDescZone
                    ? "border-[#EDCF5D] bg-[#EDCF5D]/10 scale-[1.01]"
                    : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#1E1E1E]/50 hover:bg-gray-100/50 dark:hover:bg-[#242424]"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Drag & drop description images here, or <span className="text-[#9E7B00] dark:text-[#EDCF5D] underline">browse files</span>
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Supports multiple files • Auto-compressed • Drag thumbnails to reorder sequence
                  </p>
                </div>
              </div>

              {/* Description Images List / Grid */}
              {descriptionImages.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                    <span>{descriptionImages.length} Description Image{descriptionImages.length > 1 ? "s" : ""}</span>
                    <span>Drag items to reorder sequence</span>
                  </div>

                  <div className="space-y-2.5">
                    {descriptionImages.map((item, idx) => {
                      const isDraggingThis = draggedDescIndex === idx;

                      // Card slot swap sliding animation
                      let swapTransform = "translate-y-0";
                      if (draggedDescIndex !== null && dragOverDescIndex !== null && draggedDescIndex !== dragOverDescIndex) {
                        if (idx === draggedDescIndex) {
                          swapTransform = "scale-[1.02] shadow-xl ring-2 ring-[#EDCF5D] z-30 opacity-90";
                        } else if (draggedDescIndex < dragOverDescIndex && idx > draggedDescIndex && idx <= dragOverDescIndex) {
                          swapTransform = "-translate-y-2 scale-98 opacity-80";
                        } else if (draggedDescIndex > dragOverDescIndex && idx >= dragOverDescIndex && idx < draggedDescIndex) {
                          swapTransform = "translate-y-2 scale-98 opacity-80";
                        }
                      }

                      return (
                        <div
                          key={idx}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", String(idx));
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedDescIndex(idx);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverDescIndex !== idx) {
                              setDragOverDescIndex(idx);
                            }
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setDragOverDescIndex(idx);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedDescIndex !== null) {
                              handleReorderDescImages(draggedDescIndex, idx);
                            }
                            setDraggedDescIndex(null);
                            setDragOverDescIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedDescIndex(null);
                            setDragOverDescIndex(null);
                          }}
                          className={`flex items-center gap-3.5 p-3 rounded-[12px] bg-gray-50/80 dark:bg-[#202020]/80 border border-gray-200 dark:border-[#2C2C2C] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${swapTransform} ${
                            isDraggingThis
                              ? "opacity-50 border-dashed border-[#EDCF5D]"
                              : "hover:border-gray-300 dark:hover:border-[#383838]"
                          }`}
                        >
                          {/* Drag Handle */}
                          <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                          </div>

                          {/* Image Thumbnail */}
                          <div className="w-16 h-16 rounded-[8px] border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#141414] overflow-hidden shrink-0 p-1 flex items-center justify-center">
                            <img
                              src={item.url}
                              alt={item.alt_text || `Description image ${idx + 1}`}
                              className="w-full h-full object-contain rounded-[6px]"
                            />
                          </div>

                          {/* Image Details & Caption Input */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 font-mono">
                                #{idx + 1}
                              </span>
                              {item.sizeKb && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200/60 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400 font-mono">
                                  {item.sizeKb} KB
                                </span>
                              )}
                              {item.width && item.height && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {item.width}×{item.height}px
                                </span>
                              )}
                            </div>

                            <input
                              type="text"
                              value={item.alt_text || ""}
                              onChange={(e) => handleUpdateDescAlt(idx, e.target.value)}
                              placeholder="Caption or Alt text (e.g. Dimensions diagram, Material close-up)..."
                              className="w-full px-2.5 py-1.5 rounded-[6px] bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#303030] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                            />
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveDescImage(idx)}
                            className="p-1.5 rounded-[6px] text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                            title="Remove image"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

           
          </div>

          {/* ────── RIGHT COLUMN: SIDEBAR SETTINGS (1 COL) ────── */}
          <div className="space-y-6 lg:overflow-y-auto lg:pl-1 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.15)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.1)_transparent]">
            
            {/* Sidebar Card 0: Product Showcase & Color Variant Thumbnails */}
            <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl p-4 shadow-2xs space-y-3">
              
              <input
                type="file"
                accept="image/*"
                ref={heroFileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadHeroOrColor(f);
                }}
                className="hidden"
              />

              {imageUrl ? (
                /* Main Showcase Image Box */
                <div className="w-full aspect-square rounded-2xl bg-white dark:bg-[#141414] border border-gray-200/80 dark:border-[#2C2C2C] overflow-hidden relative group flex items-center justify-center p-4">
                  {/* Delete / Remove Color Group Button Stuck at Top Right */}
                  <button
                    type="button"
                    onClick={() => {
                      const activeColor = variants.find((v) => (v.variant_image_url || imageUrl) === imageUrl)?.color || Array.from(groupedColorsMap.keys())[0];
                      if (activeColor) {
                        handleDeleteColorGroup(activeColor);
                      } else {
                        setImageUrl("");
                        setHeroImageStats(null);
                      }
                    }}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 dark:bg-[#222222]/95 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#383838] shadow-md transition-all flex items-center justify-center cursor-pointer z-20"
                    title="Delete / Remove Color"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>

                  {/* Edit Color Button Top Left */}
                  <button
                    type="button"
                    onClick={() => {
                      const activeColor = variants.find((v) => (v.variant_image_url || imageUrl) === imageUrl)?.color || Array.from(groupedColorsMap.keys())[0] || "Default";
                      handleOpenEditColorModal(activeColor, imageUrl);
                    }}
                    className="absolute top-2.5 left-2.5 px-3 py-1 rounded-[6px] bg-white/95 dark:bg-[#222222]/95 hover:bg-[#EDCF5D] hover:text-black text-gray-700 dark:text-gray-200 text-xs font-bold border border-gray-200 dark:border-[#383838] shadow-md transition-all flex items-center gap-1.5 cursor-pointer z-20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                    <span>Edit</span>
                  </button>

                  <img
                    src={imageUrl}
                    alt={name || "Product Image"}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ) : (
                /* Drag & Drop Upload Zone when empty */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingHero(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingHero(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingHero(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleUploadHeroOrColor(f);
                  }}
                  onClick={() => heroFileInputRef.current?.click()}
                  className={`w-full aspect-square rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                    invalidFields.includes("imageUrl") && isShaking
                      ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
                      : invalidFields.includes("imageUrl")
                      ? "border-red-500 bg-red-500/5"
                      : isDraggingHero
                      ? "border-[#EDCF5D] bg-[#EDCF5D]/10 scale-[1.01]"
                      : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#1C1C1C]/50 hover:bg-gray-100/50 dark:hover:bg-[#222222]"
                  }`}
                >
                  {isUploadingHero ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <svg className="w-8 h-8 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Uploading image...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          Drag & drop product image, or <span className="text-[#9E7B00] dark:text-[#EDCF5D] underline">click to upload</span>
                        </p>
                        <p className="text-[11px] text-[#9E7B00] dark:text-[#EDCF5D] font-medium">
                          ★ Recommended: Square (1:1 ratio, 800×800px+) image for optimal display
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          Auto-compressed to crisp 1200px max
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Color Variant Thumbnails Strip (Draggable to Reorder) */}
              {colorVariantThumbnails.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Color Variants ({colorVariantThumbnails.length})
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono">
                      Drag to reorder
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto p-1 py-1.5" style={{ scrollbarWidth: "none" }}>
                    {colorVariantThumbnails.map((item, idx) => {
                      const isSelected = imageUrl === item.img;
                      const isDraggingThis = draggedColorIndex === idx;

                      // Card slot swap sliding animation
                      let swapTransform = "translate-x-0";
                      if (draggedColorIndex !== null && dragOverColorIndex !== null && draggedColorIndex !== dragOverColorIndex) {
                        if (idx === draggedColorIndex) {
                          swapTransform = "scale-105 shadow-xl ring-2 ring-[#EDCF5D] z-30 opacity-90";
                        } else if (draggedColorIndex < dragOverColorIndex && idx > draggedColorIndex && idx <= dragOverColorIndex) {
                          swapTransform = "-translate-x-4 scale-95 opacity-80";
                        } else if (draggedColorIndex > dragOverColorIndex && idx >= dragOverColorIndex && idx < draggedColorIndex) {
                          swapTransform = "translate-x-4 scale-95 opacity-80";
                        }
                      }

                      return (
                        <div
                          key={item.color}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", item.color);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedColor(item.color);
                            setDraggedColorIndex(idx);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverColorIndex !== idx) {
                              setDragOverColorIndex(idx);
                              setDragOverColor(item.color);
                            }
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setDragOverColor(item.color);
                            setDragOverColorIndex(idx);
                          }}
                          onDragLeave={() => {
                            // Keep last hovered index for smooth swap transition
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const srcCol = draggedColor || e.dataTransfer.getData("text/plain");
                            handleReorderColors(srcCol, item.color);
                            setDraggedColor(null);
                            setDragOverColor(null);
                            setDraggedColorIndex(null);
                            setDragOverColorIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedColor(null);
                            setDragOverColor(null);
                            setDraggedColorIndex(null);
                            setDragOverColorIndex(null);
                          }}
                          onClick={() => setImageUrl(item.img)}
                          className={`w-14 h-14 rounded-[10px] border flex items-center justify-center shrink-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative p-1 cursor-grab active:cursor-grabbing select-none ${swapTransform} ${
                            isDraggingThis
                              ? "opacity-50 border-dashed border-[#EDCF5D] scale-95"
                              : isSelected
                              ? "border-2 border-[#EDCF5D] bg-[#ECEAE6] dark:bg-[#252525] shadow-md scale-105"
                              : "border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#1E1E1E] opacity-75 hover:opacity-100 hover:scale-105"
                          }`}
                          title={`${item.color} (Drag to reorder)`}
                        >
                          {item.img ? (
                            <img
                              src={item.img}
                              alt={item.color}
                              className="w-full h-full object-contain rounded-[6px] pointer-events-none"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400">GTS</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Card 1: Product Status */}
            <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl p-6 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-gray-100 dark:border-[#262626] pb-3">
                Product Status
              </h2>

              <div className="space-y-2">
                {[
                  { id: "active", label: "Active", desc: "Live on storefront catalog", color: "text-emerald-500" },
                  { id: "draft", label: "Draft", desc: "Incomplete setup / hidden", color: "text-amber-500" },
                  { id: "archived", label: "Archived", desc: "Inactive / disabled item", color: "text-gray-400" },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition-all ${
                      status === item.id
                        ? "border-[#EDCF5D] bg-amber-500/5 dark:bg-[#EDCF5D]/5"
                        : "border-gray-200 dark:border-[#303030] hover:bg-gray-50 dark:hover:bg-[#202020]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="productStatus"
                      checked={status === item.id}
                      onChange={() => setStatus(item.id as any)}
                      className="mt-0.5 text-[#EDCF5D] focus:ring-0"
                    />
                    <div>
                      <span className={`text-xs font-bold block ${item.color}`}>
                        {item.label}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                        {item.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {hasTransparentBg && (
                <div className="pt-2 border-t border-gray-100 dark:border-[#262626]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Feature on Storefront Homepage
                    </span>
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="rounded border-gray-300 dark:border-[#444444] text-[#EDCF5D] focus:ring-0 cursor-pointer w-4 h-4"
                    />
                  </label>
                </div>
              )}
            </div>

          </div>

        </form>
      </div>

      {/* ────── ADD COLOR MODAL DIALOG ────── */}
      {showAddColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#2C2C2C] shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#262626]">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Add Color Variant
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-[#8E8E8E]">
                  Upload photo (auto-optimized resolution) and set initial stock level
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddColorModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#333333] text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Top: Drag & Drop File Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Color Variant Image
                </label>
                
                <input
                  type="file"
                  accept="image/*"
                  ref={colorFileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadColorImage(f);
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingColor(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingColor(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingColor(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleUploadColorImage(f);
                  }}
                  onClick={() => colorFileInputRef.current?.click()}
                  className={`p-4 rounded-[12px] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center min-h-[130px] ${
                    isDraggingColor
                      ? "border-[#EDCF5D] bg-[#EDCF5D]/10"
                      : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#202020]/50"
                  }`}
                >
                  {isUploadingColorImage ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <svg className="w-6 h-6 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        Optimizing & uploading image...
                      </span>
                    </div>
                  ) : newColorImage ? (
                    <div className="relative w-full aspect-square max-h-52 rounded-[10px] bg-white dark:bg-[#141414] border border-gray-200/80 dark:border-[#2C2C2C] overflow-hidden flex items-center justify-center p-3 group/preview" onClick={(e) => e.stopPropagation()}>
                      {/* Delete Icon Stuck at Top Right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewColorImage("");
                          setColorImageStats(null);
                        }}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 dark:bg-[#222222]/95 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#383838] shadow-md transition-all flex items-center justify-center cursor-pointer z-20"
                        title="Delete Image"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>

                      <img
                        src={newColorImage}
                        alt="Color preview"
                        className="w-full h-full object-contain"
                      />

                      {colorImageStats && (
                        <div className="absolute bottom-2 inset-x-2 bg-black/70 backdrop-blur-xs rounded-[6px] px-2 py-1 text-[10px] text-white font-mono text-center">
                          {colorImageStats.sizeKb} KB · {colorImageStats.width}×{colorImageStats.height}px ({colorImageStats.hasTransparentBg ? "Transparent PNG" : "WebP"})
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Drag & drop color photo, or <span className="text-[#9E7B00] dark:text-[#EDCF5D] underline">click to upload</span>
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        Auto-scaled to crisp 1200px max
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom: Color Name & Inventory Level */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Color Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="e.g. Royal Blue, Matte Black, Solar Yellow"
                    className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Initial Size / Option
                    </label>
                    <select
                      value={isCustomSize ? "__custom__" : newColorSize}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__custom__") {
                          setIsCustomSize(true);
                          setNewColorSize(customSizeText || "Standard");
                        } else {
                          setIsCustomSize(false);
                          setNewColorSize(val);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                    >
                      {STANDARD_SIZE_CATEGORIES.map((cat, idx) => (
                        <optgroup key={idx} label={cat.category}>
                          {cat.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="Custom Option">
                        <option value="__custom__">Custom / Enter manually...</option>
                      </optgroup>
                    </select>

                    {isCustomSize && (
                      <input
                        type="text"
                        value={customSizeText}
                        onChange={(e) => {
                          setCustomSizeText(e.target.value);
                          setNewColorSize(e.target.value);
                        }}
                        placeholder="e.g. 100W, Extra Long, Custom..."
                        className="mt-1.5 w-full px-3 py-1.5 rounded-[6px] bg-white dark:bg-[#141414] border border-[#EDCF5D] text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
                        autoFocus
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Inventory Quantity
                    </label>
                    <input
                      type="number"
                      value={newColorQuantity}
                      onChange={(e) => setNewColorQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50">
              <button
                type="button"
                onClick={() => setShowAddColorModal(false)}
                className="px-4 py-2 rounded-[6px] bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#303030] text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddColor}
                disabled={!newColorName.trim() || isUploadingColorImage}
                className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Add Color Variant</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────── EDIT COLOR MODAL DIALOG ────── */}
      {showEditColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#2C2C2C] shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#262626]">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Edit Color Group: {editColorOldName}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-[#8E8E8E]">
                  Modify color title or replace the variant image
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditColorModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#333333] text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Color Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editColorNewName}
                  onChange={(e) => setEditColorNewName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#303030] text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                  required
                />
              </div>

              {/* Color Image Upload/Replace Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Color Image
                </label>
                
                <input
                  type="file"
                  accept="image/*"
                  ref={editColorFileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadEditColorImage(f);
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingEditColor(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingEditColor(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingEditColor(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleUploadEditColorImage(f);
                  }}
                  onClick={() => {
                    if (!editColorImage) editColorFileInputRef.current?.click();
                  }}
                  className={`p-3 rounded-[12px] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 text-center ${
                    isDraggingEditColor
                      ? "border-[#EDCF5D] bg-[#EDCF5D]/10"
                      : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#202020]/50"
                  } ${editColorImage ? "p-2" : "p-6 cursor-pointer"}`}
                >
                  {isUploadingEditColorImage ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <svg className="w-6 h-6 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        Uploading replacement...
                      </span>
                    </div>
                  ) : editColorImage ? (
                    <div className="relative w-full aspect-square max-h-48 rounded-[10px] bg-white dark:bg-[#141414] border border-gray-200/80 dark:border-[#2C2C2C] overflow-hidden flex items-center justify-center p-3 group/preview" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => editColorFileInputRef.current?.click()}
                        className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-[6px] bg-white/95 dark:bg-[#222222]/95 hover:bg-[#EDCF5D] hover:text-black text-gray-700 dark:text-gray-200 text-[10px] font-bold border border-gray-200 dark:border-[#383838] shadow-md transition-all flex items-center gap-1 cursor-pointer z-20"
                      >
                        Replace
                      </button>

                      <img
                        src={editColorImage}
                        alt="Color preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Upload photo for this color
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        Click or drag image file
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer with Delete and Save */}
            <div className="flex items-center justify-between gap-2.5 p-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50">
              <button
                type="button"
                onClick={() => handleDeleteColorGroup(editColorOldName)}
                className="px-3.5 py-2 rounded-[6px] bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-xs font-bold transition-all border border-red-500/20 flex items-center gap-1 cursor-pointer"
              >
                Delete Color Group
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditColorModal(false)}
                  className="px-3.5 py-2 rounded-[6px] bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#303030] text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditColor}
                  disabled={!editColorNewName.trim() || isUploadingEditColorImage}
                  className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ────── ADD NEW BRAND MODAL ────── */}
      {showAddBrandModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2C2C2C] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2C2C2C] pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Add New Brand
                </h3>
                <p className="text-[11px] text-gray-400">
                  Register a new brand with a compressed logo icon
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddBrandModal(false);
                  setNewBrandName("");
                  setNewBrandLogo("");
                  setBrandLogoStats(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Nexus, Dyson, Apple"
                  className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              {/* Brand Logo Upload Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Brand Logo Image (Auto-Compressed)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={brandLogoFileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadBrandLogoFile(f);
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingBrandLogo(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingBrandLogo(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingBrandLogo(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleUploadBrandLogoFile(f);
                  }}
                  onClick={() => brandLogoFileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    isDraggingBrandLogo
                      ? "border-[#EDCF5D] bg-[#EDCF5D]/10"
                      : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#202020]/50"
                  }`}
                >
                  {isUploadingBrandLogo ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                      <svg className="w-4 h-4 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Compressing & uploading logo...</span>
                    </div>
                  ) : newBrandLogo ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center p-1 overflow-hidden shrink-0 border border-gray-300 dark:border-[#383838]">
                        <img src={newBrandLogo} alt="Brand Logo Preview" className="w-full h-full object-contain" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block truncate">Logo Uploaded</span>
                        {brandLogoStats && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            {brandLogoStats.sizeKb} KB • {brandLogoStats.width}×{brandLogoStats.height}px
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewBrandLogo("");
                          setBrandLogoStats(null);
                        }}
                        className="text-red-500 hover:text-red-600 text-xs font-bold px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 py-2">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Drag & drop brand logo, or <span className="text-[#9E7B00] dark:text-[#EDCF5D] underline">click to upload</span>
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        PNG / WebP / SVG • Auto-compressed to &lt; 30KB icon
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#2C2C2C]">
              <button
                type="button"
                onClick={() => {
                  setShowAddBrandModal(false);
                  setNewBrandName("");
                  setNewBrandLogo("");
                  setBrandLogoStats(null);
                }}
                className="px-3.5 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#242424] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewBrand}
                disabled={savingNewBrand || !newBrandName.trim()}
                className="px-4 py-1.5 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {savingNewBrand ? "Saving..." : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── ADD NEW CATEGORY MODAL ────── */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2C2C2C] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2C2C2C] pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Create New Category
                </h3>
                <p className="text-[11px] text-gray-400">
                  Add a new department with optional subcategory suggestions
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddCategoryModal(false);
                  setNewCategoryName("");
                  setNewCategorySubCategories("");
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Sports & Outdoors, Kitchenware"
                  className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Preset Sub-Categories (Comma-Separated)
                </label>
                <input
                  type="text"
                  value={newCategorySubCategories}
                  onChange={(e) => setNewCategorySubCategories(e.target.value)}
                  placeholder="e.g. Tents, Hiking Boots, Backpacks"
                  className="w-full px-3.5 py-2 rounded-[6px] bg-gray-50 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                  Separate with commas. These appear in subcategory autocomplete.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#2C2C2C]">
              <button
                type="button"
                onClick={() => {
                  setShowAddCategoryModal(false);
                  setNewCategoryName("");
                  setNewCategorySubCategories("");
                }}
                className="px-3.5 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#242424] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewCategory}
                disabled={savingNewCategory || !newCategoryName.trim()}
                className="px-4 py-1.5 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {savingNewCategory ? "Saving..." : "Save Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── INCOMPLETE PRODUCT ALERT MODAL (SAVE AS DRAFT) ────── */}
      {showIncompleteDraftModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1C] border border-red-500/30 dark:border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 border-b border-gray-100 dark:border-[#2C2C2C] pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Incomplete Product Details
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Some mandatory catalog fields were left empty:
                </p>
              </div>
            </div>

            {/* List of Missing Fields */}
            <div className="space-y-1.5 p-3 rounded-xl bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 text-xs">
              {missingItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-[11px]">
                  <span>•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Since some parts were not completed, this product cannot remain active. Would you like to save it as a <strong>Draft</strong> so you can finish it later?
            </p>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#2C2C2C]">
              <button
                type="button"
                onClick={() => setShowIncompleteDraftModal(false)}
                className="px-3.5 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#242424] cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => executeSaveProduct("draft")}
                disabled={saving}
                className="px-4 py-1.5 rounded-[6px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? "Saving Draft..." : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── EXIT CONFIRMATION MODAL (SAVE TO DRAFTS) ────── */}
      {showExitDraftModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2C2C2C] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Save progress to Drafts?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Your unsaved changes will be saved to cloud drafts so you can resume whenever you return.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#2C2C2C]">
              <button
                type="button"
                onClick={() => {
                  setShowExitDraftModal(false);
                  router.push("/admin/products");
                }}
                className="px-3.5 py-2 rounded-[6px] text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                Discard & Exit
              </button>
              <button
                type="button"
                onClick={() => setShowExitDraftModal(false)}
                className="px-3.5 py-2 rounded-[6px] border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#242424] text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={async () => {
                  await executeSaveProduct("draft");
                  setShowExitDraftModal(false);
                  router.push("/admin/products");
                }}
                className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-black hover:bg-[#e2c34d] text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Save to Drafts & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── GLOBAL DATALIST FOR ALL SIZE INPUTS ────── */}
      <datalist id="standard-size-presets">
        {STANDARD_SIZE_CATEGORIES.flatMap((cat) => cat.options).map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>

      {/* ────── VIOLENT SHAKE GLOBAL KEYFRAMES ────── */}
      <style jsx global>{`
        @keyframes violentShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-12px) rotate(-1.5deg); }
          30% { transform: translateX(12px) rotate(1.5deg); }
          45% { transform: translateX(-10px) rotate(-1deg); }
          60% { transform: translateX(10px) rotate(1deg); }
          75% { transform: translateX(-6px) rotate(-0.5deg); }
          90% { transform: translateX(6px) rotate(0.5deg); }
        }
        .shake-violent {
          animation: violentShake 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97) both !important;
        }
      `}</style>

    </div>
  );
}
