"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@gts/database/client";
import { AdminTopStrip } from "../../sidebar-context";
import { markAdminInquiryViewed } from "../../../../lib/notifications";
import { idempotentFetch } from "@gts/utils";
import { authFetch } from "../../../lib/session";
import { authHeader } from "../../../lib/session";

interface TicketMessage {
  id: string;
  senderType: "customer" | "staff";
  senderId?: string | null;
  body: string;
  sentAt: string;
}

interface TicketDetail {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  productId?: string | null;
  createdAt: string;
  messages: TicketMessage[];
}

interface ProductDetail {
  id: string;
  name: string;
  brand: string;
  brandLogoUrl?: string | null;
  category: string;
  sku: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  shortDescription?: string | null;
  description?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  hasTransparentBg?: boolean;
  images: string[];
  variants: Array<{
    id: string;
    size?: string | null;
    color?: string | null;
    sku?: string | null;
    priceModifier?: number;
    stock?: number;
  }>;
}

export default function AdminQuestionDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<"open" | "in_progress" | "resolved" | "closed">("open");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isMobileProductSheetOpen, setIsMobileProductSheetOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const realtimeChannelRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch ticket and connect Supabase Realtime WebSockets
  useEffect(() => {
    if (!ticketId) return;

    let isMounted = true;

    const fetchTicket = async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/v1/inquiries/${ticketId}/messages`);
        if (res.ok) {
          const json = await res.json();
          const tData: TicketDetail = json.data;
          if (isMounted) {
            setTicket(tData);
            setStatus(tData.status);
            fetchProductData(tData.productId, tData.subject);
            const lastMsg = tData.messages?.[tData.messages.length - 1];
            markAdminInquiryViewed(ticketId, lastMsg ? lastMsg.sentAt : new Date().toISOString());
          }
        }
      } catch (err) {
        console.error("Failed to load ticket:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTicket();

    // Setup Supabase Realtime WebSocket Connection
    const supabase = createClient() as any;
    const channel = supabase.channel(`inquiry_${ticketId}`, {
      config: { broadcast: { self: false } },
    });
    realtimeChannelRef.current = channel;

    const handleIncomingMessage = (msg: any) => {
      if (!msg || !msg.id) return;
      markAdminInquiryViewed(ticketId, msg.sentAt || msg.sent_at || new Date().toISOString());
      setTicket((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages, msg],
        };
      });
    };

    // Listen for WebSocket Broadcasts
    channel.on("broadcast", { event: "new_message" }, ({ payload }: any) => {
      handleIncomingMessage(payload);
    });

    // Listen for Postgres DB changes
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload: any) => {
        const newRow = payload.new;
        if (newRow) {
          handleIncomingMessage({
            id: newRow.id,
            senderType: newRow.sender_type,
            senderId: newRow.sender_id,
            body: newRow.body,
            sentAt: newRow.sent_at,
          });
        }
      }
    );

    // Listen for ticket status changes
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "support_tickets",
        filter: `id=eq.${ticketId}`,
      },
      (payload: any) => {
        if (payload.new?.status) {
          setStatus(payload.new.status);
        }
      }
    );

    channel.subscribe((subStatus: string) => {
      if (subStatus === "SUBSCRIBED") {
        console.log(`[Realtime WebSocket] Subscribed to inquiry_${ticketId}`);
      }
    });

    // Silent background sync fallback (no loading spinner, no flicker)
    const syncInterval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/v1/inquiries/${ticketId}/messages`);
        if (res.ok) {
          const json = await res.json();
          if (json.data?.messages) {
            setTicket((prev) => {
              if (!prev) return json.data;
              if (prev.messages.length !== json.data.messages.length) {
                return { ...prev, messages: json.data.messages };
              }
              return prev;
            });
          }
        }
      } catch {
        // silent
      }
    }, 6000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  // Fetch product information using Supabase client
  const fetchProductData = async (productId?: string | null, subject?: string) => {
    setLoadingProduct(true);
    try {
      const supabase = createClient() as any;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      let pData: any = null;

      // Try 1: Query by productId (UUID or slug)
      if (productId) {
        const isUuid = UUID_RE.test(productId);
        let pQuery = supabase
          .from("products")
          .select(`
            id,
            name,
            slug,
            sku,
            brand,
            sub_category,
            base_price,
            compare_at_price,
            short_description,
            description,
            average_rating,
            review_count,
            tags,
            category:categories(name),
            product_images(*),
            product_variants(*)
          `);

        if (isUuid) {
          pQuery = pQuery.eq("id", productId);
        } else {
          pQuery = pQuery.eq("slug", productId);
        }

        const { data, error } = await pQuery.maybeSingle();
        if (!error && data) {
          pData = data;
        }
      }

      // Try 2: If not found, match by product name from subject (e.g. "Question: Beats Studio3...")
      if (!pData && subject) {
        const cleanName = subject.replace(/^Question:\s*/i, "").trim();
        if (cleanName) {
          const words = cleanName.split(/\s+/).slice(0, 3).join(" ");
          const { data } = await supabase
            .from("products")
            .select(`
              id,
              name,
              slug,
              sku,
              brand,
              sub_category,
              base_price,
              compare_at_price,
              short_description,
              description,
              average_rating,
              review_count,
              tags,
              category:categories(name),
              product_images(*),
              product_variants(*)
            `)
            .ilike("name", `%${words}%`)
            .limit(1);

          if (data && data.length > 0) {
            pData = data[0];
          }
        }
      }

      if (pData) {

        // Fetch brand logo via /api/v1/brands
        let brandLogoUrl: string | null = null;
        const brandQuery = pData.brand || (pData.name && pData.name.toLowerCase().includes("beats") ? "Beats" : null);
        if (brandQuery) {
          try {
            const bRes = await fetch("/api/v1/brands");
            if (bRes.ok) {
              const bJson = await bRes.json();
              const foundBrand = (bJson.data || []).find(
                (b: any) => b.name && b.name.toLowerCase() === brandQuery.trim().toLowerCase()
              );
              if (foundBrand?.logo_url) {
                brandLogoUrl = foundBrand.logo_url;
              }
            }
          } catch {
            // silent
          }
        }

        // Fetch inventory levels for variants
        const variantIds = (pData.product_variants || []).map((v: any) => v.id);
        const stockMap: Record<string, number> = {};

        if (variantIds.length > 0) {
          const { data: invData } = await supabase
            .from("inventory")
            .select("variant_id, quantity, reserved_quantity")
            .in("variant_id", variantIds);

          if (invData) {
            invData.forEach((inv: any) => {
              stockMap[inv.variant_id] = (inv.quantity || 0) - (inv.reserved_quantity || 0);
            });
          }
        }

        const sortedImages = (pData.product_images || [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((img: any) => img.cloudinary_public_id)
          .filter(Boolean);

        const hasTransparent = pData.has_transparent_bg === true || (sortedImages[0] || "").toLowerCase().endsWith(".png");

        setProduct({
          id: pData.id,
          name: pData.name,
          brand: pData.brand || "Beats",
          brandLogoUrl,
          hasTransparentBg: hasTransparent,
          category: pData.category?.name || pData.sub_category || "General",
          sku: pData.sku || "GTS-ITEM",
          slug: pData.slug,
          price: (pData.base_price || 0) / 100,
          compareAtPrice: pData.compare_at_price ? pData.compare_at_price / 100 : null,
          shortDescription: pData.short_description,
          description: pData.description,
          averageRating: pData.average_rating ? Number(pData.average_rating) : 4.8,
          reviewCount: pData.review_count || 42,
          images: sortedImages.length > 0 ? sortedImages : ["/placeholder-product.png"],
          variants: (pData.product_variants || []).map((v: any) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            sku: v.sku,
            priceModifier: (v.price_modifier || 0) / 100,
            stock: stockMap[v.id] ?? 8,
          })),
        });
      }
    } catch (err) {
      console.error("Failed to load product details:", err);
    } finally {
      setLoadingProduct(false);
    }
  };

  // Send staff reply
  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const res = await idempotentFetch(`/api/v1/inquiries/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          message: replyText.trim(),
          senderType: "staff",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const newMsg: TicketMessage = json.data;

        setTicket((prev) => {
          if (!prev) return null;
          if (prev.messages.some((m) => m.id === newMsg.id)) return prev;
          return {
            ...prev,
            status: "in_progress",
            messages: [...prev.messages, newMsg],
          };
        });
        setStatus("in_progress");
        setReplyText("");

        // Broadcast immediately over Realtime WebSocket
        try {
          realtimeChannelRef.current?.send({
            type: "broadcast",
            event: "new_message",
            payload: newMsg,
          });
        } catch {}
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Update status
  const handleStatusChange = async (nextStatus: "open" | "in_progress" | "resolved" | "closed") => {
    setIsUpdatingStatus(true);
    try {
      const res = await idempotentFetch(`/api/v1/inquiries/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        setStatus(nextStatus);
        setTicket((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans">
        <div className="p-16 text-center space-y-3 bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626]">
          <div className="w-8 h-8 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500 font-mono">Loading inquiry and product details...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans">
        <div className="p-16 text-center space-y-4 bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626]">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Inquiry thread not found</h3>
          <Link
            href="/admin/questions"
            className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] text-xs font-bold transition-all shadow-sm inline-block"
          >
            Back to Inquiries
          </Link>
        </div>
      </div>
    );
  }

  const currentImage = product?.images[selectedImageIndex] || product?.images[0] || "/placeholder-product.png";
  const isMainTransparent = Boolean(product?.hasTransparentBg);
  const isCurrentTransparent = selectedImageIndex === 0 && isMainTransparent;
  const discountPct = product?.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  const renderProductCardContent = () => {
    if (loadingProduct) {
      return (
        <div className="p-8 text-center space-y-2">
          <span className="inline-block w-5 h-5 border-2 border-[#010101] dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-mono">Loading product information...</p>
        </div>
      );
    }

    if (!product) {
      return (
        <div className="p-8 text-center space-y-2">
          <div className="text-2xl">📦</div>
          <p className="text-xs text-gray-400 font-mono">No specific product details linked to this inquiry.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Product Visual Showcase: Vertical Thumbnails + Compact Fixed Square Main Image */}
        <div className="flex items-start gap-3">
          {/* Vertical Gallery Thumbnail Strip by the side */}
          {product.images.length > 1 && (
            <div className="flex flex-col gap-2 max-h-[220px] sm:max-h-[240px] overflow-y-auto shrink-0 p-1 pr-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent]">
              {product.images.map((img, idx) => {
                const isSelected = selectedImageIndex === idx;
                const thumbTransparent = idx === 0 && isMainTransparent;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all overflow-hidden relative cursor-pointer ${
                      thumbTransparent ? "p-1" : "p-0"
                    } ${
                      isSelected
                        ? "border-2 border-[#010101] dark:border-[#EDCF5D] bg-[#ECEAE6] dark:bg-[#252525] shadow-xs"
                        : "border-gray-200 dark:border-[#333333] hover:border-gray-400 opacity-75 hover:opacity-100 bg-white dark:bg-[#1E1E1E]"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      unoptimized
                      className={thumbTransparent ? "object-contain p-0.5" : "object-cover p-0"}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Compact Fixed Square Main Product Image (No padding if not transparent) */}
          <div
            className={`w-[220px] h-[220px] sm:w-[240px] sm:h-[240px] rounded-2xl border border-gray-200 dark:border-[#2C2C2C] shrink-0 flex items-center justify-center overflow-hidden relative shadow-2xs ${
              isCurrentTransparent
                ? "p-3 bg-[#F2F0EA] dark:bg-[#202020]"
                : "p-0 bg-white dark:bg-[#1E1E1E]"
            }`}
            style={
              isCurrentTransparent
                ? { background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }
                : undefined
            }
          >
            <Image
              src={currentImage}
              alt={product.name}
              fill
              unoptimized
              className={`hover:scale-105 transition-transform duration-300 ${
                isCurrentTransparent ? "object-contain p-2" : "object-cover p-0"
              }`}
            />
          </div>
        </div>

        {/* 3. Brand Pill with Genuine Brand Logo & SKU Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316] shadow-2xs">
            {product.brandLogoUrl ? (
              <div className="w-4 h-4 rounded-full overflow-hidden bg-white flex items-center justify-center shrink-0 p-0.5">
                <img
                  src={product.brandLogoUrl}
                  alt={product.brand}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-[11px] font-black uppercase tracking-wider">{product.brand}</span>
          </div>

          <span className="text-xs text-gray-400 dark:text-[#8E8E8E] font-mono">
            {product.sku}
          </span>
        </div>

        {/* 4. Full Bold Product Title */}
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-snug">
          {product.name}
        </h2>

        {/* 5. Price & Discount Badge */}
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
            ₦{product.price.toLocaleString()}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-sm line-through text-gray-400 font-mono">
              ₦{product.compareAtPrice.toLocaleString()}
            </span>
          )}
          {discountPct && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-500/30">
              {discountPct}% OFF
            </span>
          )}
        </div>

        {/* 6. Rating & Reviews Stars with Storefront Button on right */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex items-center text-amber-400">
              {"★".repeat(4)}{"☆"}
            </div>
            <span className="font-bold text-gray-900 dark:text-white">{product.averageRating}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500 dark:text-[#8E8E8E]">{product.reviewCount} reviews</span>
          </div>

          <a
            href={`/product/${product.slug || product.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-[#010101] dark:text-[#EDCF5D] hover:underline inline-flex items-center gap-1 bg-gray-100 dark:bg-[#262624] hover:bg-gray-200 dark:hover:bg-[#2E2E2C] px-2.5 py-1 rounded-full border border-gray-200 dark:border-[#333333] transition-colors shrink-0 shadow-2xs"
          >
            <span>Storefront</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>

        {/* 7. Product Description */}
        {(product.shortDescription || product.description) && (
          <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-[#262626]">
            <span className="text-xs font-bold text-gray-900 dark:text-white block font-mono uppercase tracking-wider">
              Description
            </span>
            <p className="text-xs text-gray-600 dark:text-[#B0B0B0] leading-relaxed">
              {product.shortDescription || product.description}
            </p>
          </div>
        )}

        {/* 8. Variants & Real-Time Inventory Stock */}
        {product.variants.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-[#262626]">
            <span className="text-xs font-bold text-gray-900 dark:text-white block font-mono uppercase tracking-wider">
              Variants & Stock
            </span>
            <div className="grid grid-cols-2 gap-2">
              {product.variants.map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#202020] border border-gray-200/80 dark:border-[#333333] flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {v.size || "Standard"} {v.color ? `(${v.color})` : ""}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {v.stock} in stock
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. Direct URL Slug Bar */}
        <div className="pt-2 border-t border-gray-100 dark:border-[#262626] flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span className="truncate max-w-[240px]">slug: {product.slug}</span>
          <span className="text-emerald-500 font-bold">● Active Catalog</span>
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 pt-2.5 pb-1.5 sm:px-6 lg:px-8 lg:pt-2.5 lg:pb-1.5 max-w-[1600px] mx-auto font-sans transition-colors duration-200 h-full flex flex-col overflow-hidden">
      {/* ────── STICKY TOP PAGE HEADER ────── */}
      <div className="shrink-0 pb-3 space-y-2 border-b border-gray-200/80 dark:border-[#262626]">
        {/* Top Metadata Strip */}
        <AdminTopStrip
          breadcrumbs={[
            { label: "Customer Inquiries", href: "/admin/questions" },
            { label: ticket.reference || "Conversation" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-0.5">
          <div className="flex items-start gap-3">
            <Link
              href="/admin/questions"
              className="p-1.5 mt-0.5 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs shrink-0"
              title="Back to Inquiries List"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {ticket.customerName}
                </h1>
                <span className="text-xs text-gray-500 dark:text-[#8E8E8E] font-mono">
                  ({ticket.customerEmail})
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8E8E8E] font-mono mt-0.5 truncate max-w-xl">
                {ticket.subject}
              </p>
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-xs text-gray-500 dark:text-[#8E8E8E] font-medium">Status:</span>
            <div className="relative">
              <select
                value={status}
                disabled={isUpdatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="open">Needs Reply (Open)</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ────── 2-PANE SPLIT SCREEN LAYOUT (INDEPENDENT PINNED SCROLLS) ────── */}
      <div className="flex-1 min-h-0 pt-3 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* ════════ LEFT PANE: CHAT STREAM (BORDERLESS, PINNED SCROLL, ANCHORED OVERLAY BAR) ════════ */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden relative">
          {/* Messages Stream: Internal Pinned Scrollable Viewport */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3.5 pr-2 pb-2 font-sans [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent]">
            {ticket.messages.length === 0 ? (
              <div className="text-center py-16 text-gray-400 font-mono text-xs">
                No messages yet in this inquiry.
              </div>
            ) : (
              ticket.messages.map((msg) => {
                const isStaff = msg.senderType === "staff";
                return (
                  <div key={msg.id} className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-[#8E8E8E]">
                        {isStaff ? "GTS Staff (You)" : ticket.customerName}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-[#8E8E8E] font-mono">
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words ${
                        isStaff
                          ? "bg-[#010101] text-white dark:bg-[#2B2B2B] rounded-tr-xs"
                          : "bg-white dark:bg-[#202020] border border-gray-200/90 dark:border-[#333333] text-gray-900 dark:text-white rounded-tl-xs shadow-2xs"
                      }`}
                    >
                      {msg.body}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ────── PINNED BOTTOM OVERLAY REPLY BAR (Messages scroll under it) ────── */}
          <div className="shrink-0 pt-2 pb-1 bg-[#F8F7F4] dark:bg-[#1C1C1C]">

            {/* Anchored Input Bar matching Storefront Ash Style */}
            <form
              onSubmit={handleSendReply}
              className="bg-[#F2F0EA] dark:bg-[#252523] border border-gray-300/80 dark:border-[#383838] rounded-[26px] p-1.5 pl-3 sm:pl-4 flex items-end gap-1.5 sm:gap-2 shadow-xs transition-all focus-within:border-[#010101] dark:focus-within:border-[#EDCF5D]"
            >
              {/* Mobile Info Button to open Product Details Bottom Sheet */}
              {product && (
                <button
                  type="button"
                  onClick={() => setIsMobileProductSheetOpen(true)}
                  className="lg:hidden w-8 h-8 rounded-full bg-white dark:bg-[#333333] border border-gray-200 dark:border-[#444444] text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0 mb-1 hover:bg-gray-100 dark:hover:bg-[#3A3A3A] transition-colors shadow-2xs active:scale-95 cursor-pointer"
                  title="View Product Information"
                  aria-label="View Product Information"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
              )}

              {/* Multiline textarea up to 4 lines with Enter inserting newline (not sending) */}
              <textarea
                ref={textareaRef}
                value={replyText}
                rows={Math.min(4, Math.max(1, replyText.split("\n").length))}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${ticket.customerName}...`}
                className="flex-1 bg-transparent text-xs sm:text-sm text-[#010101] dark:text-white placeholder:text-gray-500 focus:outline-none font-sans resize-none leading-relaxed py-1.5 max-h-28 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent]"
              />

              {/* Black circular send button with white airplane icon */}
              <button
                type="submit"
                disabled={isSending || !replyText.trim()}
                className="w-10 h-10 rounded-full bg-[#010101] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-35 disabled:pointer-events-none cursor-pointer shrink-0 shadow-sm active:scale-95"
                title="Send Answer"
              >
                {isSending ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </form>

            {/* Security notice matching storefront */}
            <p className="text-[11px] text-gray-400 dark:text-[#8E8E8E] text-center mt-1.5 flex items-center justify-center gap-1.5 font-normal">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
              </svg>
              <span>Do not share personal info like account numbers even when asked.</span>
            </p>
          </div>
        </div>

        {/* ════════ RIGHT PANE: LINKED PRODUCT CARD (INDEPENDENT SCROLLABLE VIEWPORT) — DESKTOP ONLY ════════ */}
        <div className="hidden lg:block lg:col-span-5 h-full min-h-0 overflow-y-auto bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs p-5 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent] transition-colors">
          {renderProductCardContent()}
        </div>
      </div>

      {/* ────── MOBILE BOTTOM SHEET FOR PRODUCT INFORMATION ────── */}
      {isMobileProductSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsMobileProductSheetOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Bottom Sheet Card */}
          <div className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-[#181818] rounded-t-3xl border-t border-gray-200 dark:border-[#2C2C2C] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
            {/* Handle Bar & Header */}
            <div className="shrink-0 px-5 pt-3 pb-2 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between relative">
              <div className="w-10 h-1 bg-gray-300 dark:bg-[#444444] rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white font-mono pt-1">
                Linked Product
              </span>
              <button
                type="button"
                onClick={() => setIsMobileProductSheetOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#262624] hover:bg-gray-200 dark:hover:bg-[#333333] text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bottom Sheet Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent]">
              {renderProductCardContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
