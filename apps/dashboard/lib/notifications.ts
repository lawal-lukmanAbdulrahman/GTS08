/**
 * GTS Notification System Core Models & Local Storage Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides unified helper functions for:
 * 1. Admin Inquiry viewed state tracking & instant badging
 * 2. Customer inbox seen timestamp & notification badge lifecycle
 * 3. Order advancement notifications
 * 4. Broadcast popups configuration
 */

export interface CustomerNotification {
  id: string;
  type: "inquiry" | "review_reply" | "order_advance";
  title: string;
  message: string;
  link: string;
  orderNumber?: string;
  orderStatus?: string;
  productId?: string;
  productSlug?: string;
  productName?: string;
  productImage?: string | null;
  replyAuthor?: string;
  replyText?: string;
  createdAt: string;
  isRead?: boolean;
}

export interface CanvasElement {
  id: string;
  type:
    | "badge"
    | "title"
    | "subtitle"
    | "button"
    | "custom_text"
    | "container"
    | "circle"
    | "image"
    | "seal"
    | "burst"
    | "speech"
    | "cloud"
    | "arrow"
    | "shadow_overlay";
  text: string;
  imageUrl?: string;
  opacity?: number;
  x: number; // percentage 0-100 or px within banner
  y: number; // percentage 0-100 or px within banner
  width?: number; // px
  height?: number; // px
  rotation?: number; // degrees
  flipX?: boolean;
  flipY?: boolean;
  fontSize?: number; // px
  fontWeight?: "normal" | "medium" | "bold" | "black";
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase";
  textAlign?: "left" | "center" | "right";
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: string;
  ctaLink?: string;
  isPill?: boolean;
  isLocked?: boolean;
  isBackground?: boolean;
  groupId?: string; // identifier for grouped elements
  boxShadow?: string;
  shadowPreset?: "none" | "subtle" | "medium" | "floating" | "deep" | "glow" | "custom";
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowColor?: string;
  shadowOffsetY?: number;
}

export interface BroadcastDesignConfig {
  borderRadius?: number;
  showBottomShadow?: boolean;
  isFrameless?: boolean;
  elements?: CanvasElement[];
  bgScale?: number;
  bgOffsetX?: number;
  bgOffsetY?: number;
  backgroundColor?: string;
}

export function computeElementShadow(el: CanvasElement): {
  boxShadow?: string;
  filter?: string;
} {
  if (el.shadowPreset === "none" && !el.shadowBlur) {
    return { boxShadow: "none", filter: "none" };
  }

  if (el.boxShadow && el.boxShadow !== "none" && !el.shadowPreset && el.shadowBlur === undefined) {
    return {
      boxShadow: el.boxShadow,
      filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.5))`,
    };
  }

  const preset = el.shadowPreset || "none";
  const blur =
    el.shadowBlur !== undefined
      ? el.shadowBlur
      : preset === "subtle"
      ? 8
      : preset === "medium"
      ? 20
      : preset === "floating"
      ? 32
      : preset === "deep"
      ? 48
      : preset === "glow"
      ? 25
      : 0;

  if (blur <= 0) {
    return { boxShadow: "none", filter: "none" };
  }

  const offsetY =
    el.shadowOffsetY !== undefined
      ? el.shadowOffsetY
      : Math.round(blur * 0.45);

  let opacity =
    el.shadowOpacity !== undefined
      ? el.shadowOpacity
      : preset === "subtle"
      ? 0.25
      : preset === "medium"
      ? 0.45
      : preset === "floating"
      ? 0.65
      : preset === "deep"
      ? 0.85
      : preset === "glow"
      ? 0.55
      : 0.5;

  if (opacity > 1) {
    opacity = opacity / 100;
  }

  const color = el.shadowColor || (preset === "glow" ? "#EDCF5D" : "#000000");

  let r = 0, g = 0, b = 0;
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16) || 0;
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16) || 0;
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16) || 0;
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16) || 0;
      g = parseInt(hex.substring(2, 4), 16) || 0;
      b = parseInt(hex.substring(4, 6), 16) || 0;
    }
  }

  const rgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  const shadowStr = `0 ${offsetY}px ${blur}px ${rgba}`;
  const dropShadowFilter = `drop-shadow(0 ${Math.round(offsetY * 0.7)}px ${Math.round(blur * 0.5)}px ${rgba})`;

  return {
    boxShadow: shadowStr,
    filter: dropShadowFilter,
  };
}

const generateStarPoints = (numPoints: number, outerR: number, innerR: number, cx = 50, cy = 50): string => {
  const total = numPoints * 2;
  const pts: string[] = [];
  for (let i = 0; i < total; i++) {
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = (cx + r * Math.cos(angle)).toFixed(1);
    const y = (cy + r * Math.sin(angle)).toFixed(1);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
};

export const SHAPE_SEAL_POINTS = generateStarPoints(24, 49, 43);
export const SHAPE_BURST_POINTS = generateStarPoints(16, 49, 32);
export const SHAPE_SPEECH_PATH =
  "M 28,6 C 14,6 4,16 4,30 C 4,44 14,54 28,54 L 18,74 L 42,54 L 72,54 C 86,54 96,44 96,30 C 96,16 86,6 72,6 Z";
export const SHAPE_CLOUD_PATH =
  "M 24,52 L 14,72 L 30,55 C 33,57 37,58 41,58 C 47,58 52,55 55,51 C 59,55 65,58 71,58 C 77,58 82,54 84,49 C 88,51 92,50 95,46 C 98,42 98,36 96,31 C 97,24 93,18 86,16 C 84,10 78,6 71,6 C 66,6 61,9 58,13 C 55,8 48,5 42,5 C 33,5 25,12 24,20 C 18,22 13,28 13,36 C 13,43 18,50 24,52 Z";
export const SHAPE_ARROW_PATH = "M 4,20 L 56,20 L 56,4 L 96,35 L 56,66 L 56,50 L 4,50 Z";

export interface BroadcastNotification {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  isActive: boolean;
  updatedAt: string;
  designConfig?: BroadcastDesignConfig;
}

export interface BroadcastAnalytics {
  impressions: number;
  uniqueVisitors: number;
  avgAttentionSeconds: number;
  clicks: number;
  ctrPct: number;
  dismissals: number;
  desktopPct: number;
  mobilePct: number;
  retentionBreakdown: {
    under2s: number;
    twoTo5s: number;
    fiveTo10s: number;
    over10s: number;
  };
}

export interface BroadcastItem extends BroadcastNotification {
  status: "active" | "disabled" | "archived";
  createdAt: string;
  /** ISO datetime after which the broadcast auto-archives */
  expiresAt?: string;
  /** ISO datetime set/bumped when admin re-broadcasts; storefront uses this in the dismissal key so all users see it again */
  rebroadcastedAt?: string;
  analytics: BroadcastAnalytics;
}

const ADMIN_VIEWED_INQUIRIES_KEY = "gts_admin_viewed_inquiries";
const CUSTOMER_INBOX_SEEN_KEY = "gts_customer_inbox_seen_at";
const CUSTOMER_NOTIFS_KEY = "gts_customer_notifications";
const BROADCAST_CONFIG_KEY = "gts_broadcast_config";

/**
 * Get map of ticketId -> lastViewedAt timestamp for admin
 */
export function getAdminViewedInquiries(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ADMIN_VIEWED_INQUIRIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Mark an inquiry thread as viewed by the admin
 */
export function markAdminInquiryViewed(ticketId: string, timestamp?: string): void {
  if (typeof window === "undefined" || !ticketId) return;
  try {
    const current = getAdminViewedInquiries();
    const viewedAt = timestamp || new Date().toISOString();
    current[ticketId] = viewedAt;
    localStorage.setItem(ADMIN_VIEWED_INQUIRIES_KEY, JSON.stringify(current));
    // Dispatch reactive event so sidebar, hamburger, and lists update immediately
    window.dispatchEvent(
      new CustomEvent("gts_inquiry_read", {
        detail: { ticketId, viewedAt },
      })
    );
  } catch (err) {
    console.error("Failed to mark inquiry as viewed:", err);
  }
}

/**
 * Determine if an inquiry has an unread customer reply for the admin
 */
export function isAdminInquiryUnread(
  ticket: { id: string; lastSenderType: string; lastMessageAt?: string },
  viewedMap?: Record<string, string>
): boolean {
  if (!ticket || ticket.lastSenderType !== "customer") return false;
  const map = viewedMap || getAdminViewedInquiries();
  const lastViewed = map[ticket.id];
  if (!lastViewed) return true;
  if (!ticket.lastMessageAt) return false;
  return new Date(ticket.lastMessageAt).getTime() > new Date(lastViewed).getTime();
}

/**
 * Get timestamp when customer last viewed their inbox
 */
export function getCustomerInboxSeenAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CUSTOMER_INBOX_SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Mark the customer inbox as viewed/seen, clearing mobile hamburger & inbox badges
 */
export function markCustomerInboxSeen(): void {
  if (typeof window === "undefined") return;
  try {
    const now = new Date().toISOString();
    localStorage.setItem(CUSTOMER_INBOX_SEEN_KEY, now);
    window.dispatchEvent(
      new CustomEvent("gts_inbox_read", {
        detail: { seenAt: now },
      })
    );
  } catch (err) {
    console.error("Failed to mark customer inbox as seen:", err);
  }
}

/**
 * Retrieve saved customer notifications (order updates, review replies, inquiries)
 */
export function getCustomerNotifications(): CustomerNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new customer notification
 */
export function addCustomerNotification(
  notif: Omit<CustomerNotification, "id" | "createdAt">
): CustomerNotification {
  const newNotif: CustomerNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getCustomerNotifications();
      const updated = [newNotif, ...existing.filter((n) => n.id !== newNotif.id)].slice(0, 100);
      localStorage.setItem(CUSTOMER_NOTIFS_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent("gts_notification_received", {
          detail: { notification: newNotif },
        })
      );
    } catch (err) {
      console.error("Failed to save customer notification:", err);
    }
  }

  return newNotif;
}

/**
 * Default fallback broadcast configuration
 */
export const DEFAULT_BROADCAST: BroadcastNotification = {
  id: "broadcast-default",
  title: "EXCLUSIVE EDIT",
  subtitle: "Explore the newest seasonal arrivals curated for the modern gentleman.",
  imageUrl:
    "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1200&auto=format&fit=crop",
  ctaLabel: "Visit Collection",
  ctaLink: "/shop",
  isActive: true,
  updatedAt: new Date().toISOString(),
};

/**
 * Get client-stored broadcast config fallback
 */
export function getLocalBroadcastConfig(): BroadcastNotification {
  if (typeof window === "undefined") return DEFAULT_BROADCAST;
  try {
    const raw = localStorage.getItem(BROADCAST_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_BROADCAST;
  } catch {
    return DEFAULT_BROADCAST;
  }
}

/**
 * Save client-stored broadcast config
 */
export function setLocalBroadcastConfig(config: BroadcastNotification): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROADCAST_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(
      new CustomEvent("gts_broadcast_updated", {
        detail: { broadcast: config },
      })
    );
  } catch (err) {
    console.error("Failed to save broadcast config:", err);
  }
}

export const INITIAL_BROADCAST_ITEMS: BroadcastItem[] = [
  {
    id: "broadcast-default",
    title: "EXCLUSIVE EDIT",
    subtitle: "Explore the newest seasonal arrivals curated for the modern gentleman.",
    imageUrl:
      "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1200&auto=format&fit=crop",
    ctaLabel: "Visit Collection",
    ctaLink: "/shop",
    isActive: true,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analytics: {
      impressions: 1240,
      uniqueVisitors: 980,
      avgAttentionSeconds: 4.2,
      clicks: 182,
      ctrPct: 14.7,
      dismissals: 42,
      desktopPct: 62,
      mobilePct: 38,
      retentionBreakdown: {
        under2s: 15,
        twoTo5s: 50,
        fiveTo10s: 25,
        over10s: 10,
      },
    },
  },
];

export function getLocalBroadcastItems(): BroadcastItem[] {
  if (typeof window === "undefined") return INITIAL_BROADCAST_ITEMS;
  try {
    const raw = localStorage.getItem("gts_broadcast_items_list");
    return raw ? JSON.parse(raw) : INITIAL_BROADCAST_ITEMS;
  } catch {
    return INITIAL_BROADCAST_ITEMS;
  }
}

export function setLocalBroadcastItems(items: BroadcastItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("gts_broadcast_items_list", JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("gts_broadcast_items_updated", { detail: items }));
  } catch (err) {
    console.error("Failed to save broadcast items:", err);
  }
}

