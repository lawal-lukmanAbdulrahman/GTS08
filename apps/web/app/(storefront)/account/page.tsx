"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../_components/auth-context";
import { useAuthModal } from "../_components/auth-modal-context";
import { Footer } from "../_components/landing/footer";
import { createClient } from "@gts/database/client";
import {
  registerPasskey,
  fetchUserPasskeys,
  deleteUserPasskey,
  type PasskeyItem,
} from "../_components/auth/passkey-client";
import { checkPasskeySupport } from "../_components/auth/webauthn-utils";
import { PinInput } from "../_components/auth/pin-input";
import { validateSqlSafe, sanitizeSafeText, idempotentFetch } from "@gts/utils";
import {
  getStoredCookiePreferences,
  saveCookiePreferences,
} from "@/../lib/cookie-preferences";
import {
  getCustomerNotifications,
  markCustomerInboxSeen,
} from "../../../lib/notifications";

interface OrderItem {
  id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_snapshot: {
    name?: string;
    title?: string;
    image?: string;
    size?: string;
    color?: string;
    sku?: string;
  };
}

interface OrderRecord {
  id: string;
  order_number: string;
  channel: string;
  status: "pending_payment" | "paid" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "completed";
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  created_at: string;
  carrier_name?: string | null;
  tracking_number?: string | null;
  items?: OrderItem[];
  address?: any;
}

import { NIGERIAN_STATES } from "../_data/nigerian-locations";

const GTS_PICKUP_STATIONS = [
  { id: "ps_1", name: "GTS Hub - Ikeja", address: "14 Medical Road, Ikeja", state: "Lagos", hours: "Mon - Sat (8am - 6pm)" },
  { id: "ps_2", name: "GTS Station - Victoria Island", address: "Plot 8 Adeola Odeku, VI", state: "Lagos", hours: "Mon - Sat (9am - 7pm)" },
  { id: "ps_3", name: "GTS Hub - Lekki Phase 1", address: "Admiralty Way, Lekki", state: "Lagos", hours: "Mon - Sat (8am - 6pm)" },
  { id: "ps_4", name: "GTS Station - Wuse 2", address: "Aminu Kano Crescent, Wuse 2", state: "Abuja (FCT)", hours: "Mon - Sat (8am - 6pm)" },
  { id: "ps_5", name: "GTS Hub - Port Harcourt", address: "23 Aba Road, Port Harcourt", state: "Rivers", hours: "Mon - Sat (8am - 6pm)" },
  { id: "ps_6", name: "GTS Hub - Tanke, Ilorin", address: "10 Rex Alaya Str, Balogun, Tanke", state: "Kwara", hours: "Mon - Sat (8am - 6pm)" },
];

function ScallopedTicket({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    };
    updateSize();

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dimensions;
  const cr = 14; // corner radius
  const nr = 5;  // scallop notch radius
  const count = 5; // number of scallops

  let pathData = "";
  if (w > 0 && h > 0) {
    const availH = h - 2 * cr;
    let d = `M ${cr} 0 L ${w - cr} 0 A ${cr} ${cr} 0 0 1 ${w} ${cr} `;

    // Right edge notches (top to bottom)
    for (let i = 0; i < count; i++) {
      const centerY = cr + (i + 0.5) * (availH / count);
      const y1 = centerY - nr;
      const y2 = centerY + nr;
      d += `L ${w} ${y1} A ${nr} ${nr} 0 0 0 ${w} ${y2} `;
    }

    d += `L ${w} ${h - cr} A ${cr} ${cr} 0 0 1 ${w - cr} ${h} L ${cr} ${h} A ${cr} ${cr} 0 0 1 0 ${h - cr} `;

    // Left edge notches (bottom to top)
    for (let i = count - 1; i >= 0; i--) {
      const centerY = cr + (i + 0.5) * (availH / count);
      const y1 = centerY - nr;
      const y2 = centerY + nr;
      d += `L 0 ${y2} A ${nr} ${nr} 0 0 0 0 ${y1} `;
    }

    d += `L 0 ${cr} A ${cr} ${cr} 0 0 1 ${cr} 0 Z`;
    pathData = d;
  }

  return (
    <div
      ref={containerRef}
      className={`relative p-2.5 sm:p-3.5 transition-all hover:scale-[1.008] ${className}`}
    >
      {/* Background SVG Ticket with Scalloped Border Tracing the Ticket */}
      {w > 0 && h > 0 ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
        >
          <path
            d={pathData}
            fill="#FEF9EE"
            stroke="#D1BA8E"
            strokeWidth={2}
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-[#FEF9EE] rounded-2xl border-2 border-[#D1BA8E]" />
      )}

      {/* Content inside the ticket */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const subParam = searchParams.get("sub");
  const initialTab = tabParam || "overview";

  const tabTitleMap: Record<string, string> = {
    overview: "Account Overview",
    orders: "Orders History",
    inbox: "Customer Inbox",
    addresses: "Address Book",
    profile: "Account Management",
    vouchers: "Vouchers & Promos",
    reviews: "Pending Reviews",
  };

  const subTitleMap: Record<string, string> = {
    basic: "Basic Details",
    phone: "Phone Number",
    passkeys: "Manage Passkeys",
    password: "Change Password",
    pin: "PIN Settings",
    delete: "Delete Account",
    marketing: "Marketing Preferences",
  };

  const { user, customer, savedAddresses, isLoading, signOut, addSavedAddress, deleteSavedAddress, refreshCustomer } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const ordersLoadedRef = useRef(false);
  const inboxLoadedRef = useRef(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [showPackageHistory, setShowPackageHistory] = useState(false);
  const [ordersSubTab, setOrdersSubTab] = useState<"ongoing" | "canceled">("ongoing");

  // Add / Edit Address Modal state
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressSubTab, setAddressSubTab] = useState<"pickup" | "door">("door");
  const [showAddPickupStationModal, setShowAddPickupStationModal] = useState(false);
  const [savedPickupStations, setSavedPickupStations] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("gts_saved_pickup_stations") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });
  const [newAddrName, setNewAddrName] = useState("");
  const [newAddrPhone, setNewAddrPhone] = useState("");
  const [newAddrLine1, setNewAddrLine1] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrState, setNewAddrState] = useState("Lagos");
  const [newAddrDefault, setNewAddrDefault] = useState(false);
  const [addrSubmitting, setAddrSubmitting] = useState(false);

  // Account Management state
  const [accountSubTab, setAccountSubTab] = useState<"basic" | "phone" | "password" | "passkeys" | "pin" | "delete" | "marketing">("basic");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);
  const [phoneSavedMsg, setPhoneSavedMsg] = useState(false);

  // Cookie preferences state
  const [cookiePrefType, setCookiePrefType] = useState<"essential" | "optional">("optional");
  const [cookieAdvertising, setCookieAdvertising] = useState(true);
  const [cookieAnalytics, setCookieAnalytics] = useState(true);
  const [cookiePersonalization, setCookiePersonalization] = useState(true);
  const [cookieSavedMsg, setCookieSavedMsg] = useState(false);

  const handleSaveCookiePreferences = () => {
    saveCookiePreferences({
      type: cookiePrefType,
      advertising: cookiePrefType === "optional" ? cookieAdvertising : false,
      analytics: cookiePrefType === "optional" ? cookieAnalytics : false,
      personalization: cookiePrefType === "optional" ? cookiePersonalization : false,
    });
    setCookieSavedMsg(true);
    setTimeout(() => setCookieSavedMsg(false), 3500);
  };

  // Phone OTP verification state
  const [showPhoneOtpModal, setShowPhoneOtpModal] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState<string | null>(null);
  const [phoneOtpDevCode, setPhoneOtpDevCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Profile details form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("Male");
  const [birthDate, setBirthDate] = useState("2005-08-07");
  const [newPhone, setNewPhone] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Login PIN state
  const [hasSavedPin, setHasSavedPin] = useState(false);
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);
  const [authPin, setAuthPin] = useState("");
  const [pinTicket, setPinTicket] = useState<string | null>(null);
  const [_authPinLoading, setAuthPinLoading] = useState(false);
  const [setupPin, setSetupPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("I would rather not say");
  const [deleteNotes, setDeleteNotes] = useState("");
  const [understoodPermanent, setUnderstoodPermanent] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Marketing preferences state
  const [newsletterEmail, setNewsletterEmail] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [promoDeals, setPromoDeals] = useState(true);

  // Sidebar accordion states
  const [isProfileAccordionOpen, setIsProfileAccordionOpen] = useState(true);
  const [isSecurityAccordionOpen, setIsSecurityAccordionOpen] = useState(true);

  // Passkeys state
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<{ supported: boolean; platformAuthenticator: boolean }>({
    supported: true,
    platformAuthenticator: true,
  });
  const [passkeyMsg, setPasskeyMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Check passkey device capabilities and fetch registered keys
  useEffect(() => {
    checkPasskeySupport().then(setPasskeyStatus);
    if (customer?.id || user?.id) {
      setLoadingPasskeys(true);
      fetchUserPasskeys()
        .then(setPasskeys)
        .finally(() => setLoadingPasskeys(false));
    }
  }, [customer, user]);

  // Copy coupon toast
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  // Inbox & Replies state
  interface InboxItem {
    id: string;
    type: "inquiry" | "review_reply" | "order_advance";
    reference?: string;
    orderNumber?: string;
    orderStatus?: string;
    productId: string;
    productName: string;
    productSlug: string;
    productImage?: string | null;
    subject: string;
    lastMessage: string;
    lastMessageAt: string;
    lastSenderType: "customer" | "staff";
    status?: string;
    hasStaffReply?: boolean;
    lastSenderIsStaff?: boolean;
    messageCount?: number;
    senderName?: string;
    targetTab: "discussion" | "reviews" | "tracking";
  }

  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<"inquiries" | "orders" | "replies">("inquiries");

  // Automatically clear notification badges when user visits inbox
  useEffect(() => {
    if (activeTab === "inbox") {
      markCustomerInboxSeen();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchParams.get("tab")) {
      setActiveTab(searchParams.get("tab")!);
    } else {
      setActiveTab("overview");
    }

    const sub = searchParams.get("sub");
    if (sub && ["basic", "phone", "password", "passkeys", "pin", "delete", "marketing"].includes(sub)) {
      setAccountSubTab(sub as any);
    }
  }, [searchParams]);

  // Load stored cookie preferences
  useEffect(() => {
    const stored = getStoredCookiePreferences();
    if (stored) {
      setCookiePrefType(stored.type);
      setCookieAdvertising(stored.advertising);
      setCookieAnalytics(stored.analytics);
      setCookiePersonalization(stored.personalization);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Security hygiene: Purge any legacy plaintext PIN from browser localStorage
      localStorage.removeItem("gts_login_pin");
      localStorage.removeItem("gts_checkout_pin");

      const emailPref = localStorage.getItem("gts_pref_email");
      if (emailPref !== null) setNewsletterEmail(emailPref === "true");
      const smsPref = localStorage.getItem("gts_pref_sms");
      if (smsPref !== null) setSmsAlerts(smsPref === "true");
      const promoPref = localStorage.getItem("gts_pref_promos");
      if (promoPref !== null) setPromoDeals(promoPref === "true");
    }
  }, []);

  useEffect(() => {
    const meta = user?.user_metadata || {};
    const hasPinSet = Boolean(meta.has_pin || meta.login_pin_hash || meta.login_pin || meta.checkout_pin);
    if (hasPinSet) {
      setHasSavedPin(true);
      setIsPinAuthenticated(false);
    } else {
      setHasSavedPin(false);
      setIsPinAuthenticated(true);
    }
  }, [user]);

  useEffect(() => {
    if (accountSubTab === "delete") {
      setDeletePassword("");
      setShowDeletePassword(false);
      setDeleteAccountError(null);
      setUnderstoodPermanent(false);
    }
  }, [accountSubTab]);

  // Phone OTP cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (customer || user) {
      const fullName = customer?.full_name || (user?.user_metadata?.full_name as string) || "";
      const parts = fullName.trim().split(/\s+/);
      const meta = (user?.user_metadata as any) || {};

      setFirstName(meta.first_name || parts[0] || "");
      setMiddleName(meta.middle_name || (parts.length > 2 ? parts.slice(1, -1).join(" ") : ""));
      setLastName(meta.last_name || (parts.length > 1 ? parts[parts.length - 1] : ""));
      setGender(meta.gender || "Male");
      setBirthDate(meta.birth_date || "2005-08-07");
      const rawPhone = customer?.phone || meta.phone || "";
      setNewPhone(rawPhone.replace(/^\+234\s*/, "").replace(/^234\s*/, "").replace(/^0/, ""));
    }
  }, [customer, user]);

  // Fetch Customer Inbox from API & Realtime WebSockets
  useEffect(() => {
    const customerId = customer?.id;
    const userId = user?.id;

    if (!customerId && !userId) return;

    const supabase = createClient() as any;

    const loadInbox = async (silent = false) => {
      if (!silent && !inboxLoadedRef.current) {
        setInboxLoading(true);
      }
      try {
        const res = await fetch("/api/v1/inquiries");
        let inquiries: InboxItem[] = [];
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            inquiries = json.data.map((item: any) => ({
              id: item.id,
              type: "inquiry",
              reference: item.reference,
              productId: item.productId,
              productName: item.productName,
              productSlug: item.productSlug,
              productImage: item.productImage,
              subject: item.subject,
              lastMessage: item.lastMessage,
              lastMessageAt: item.lastMessageAt,
              lastSenderType: item.lastSenderType,
              status: item.status,
              hasStaffReply: item.hasStaffReply,
              lastSenderIsStaff: item.lastSenderIsStaff,
              messageCount: item.messageCount,
              targetTab: "discussion" as const,
            }));
          }
        }

        let reviewNotifs: InboxItem[] = [];
        try {
          const savedNotifs = JSON.parse(localStorage.getItem("gts_inbox_notifications") || "[]");
          if (Array.isArray(savedNotifs)) {
            reviewNotifs = savedNotifs.map((notif: any) => ({
              id: notif.id,
              type: "review_reply",
              productId: notif.productId,
              productName: notif.productName || "Product Review",
              productSlug: notif.productSlug || notif.productId,
              productImage: notif.productImage || null,
              subject: `Reply from @${notif.replyAuthor}`,
              lastMessage: notif.replyText,
              lastMessageAt: notif.createdAt || new Date().toISOString(),
              lastSenderType: "customer" as const,
              senderName: notif.replyAuthor,
              targetTab: "reviews" as const,
            }));
          }
        } catch {}

        // Order advancement notifications & extra customer notifications
        const customerNotifs = getCustomerNotifications();
        const orderNotifs: InboxItem[] = customerNotifs
          .filter((n: any) => n.type === "order_advance")
          .map((n: any) => ({
            id: n.id,
            type: "order_advance" as const,
            orderNumber: n.orderNumber,
            orderStatus: n.orderStatus,
            productId: "",
            productName: `Order #${n.orderNumber || ""}`,
            productSlug: n.orderNumber || "",
            productImage: null,
            subject: n.title,
            lastMessage: n.message,
            lastMessageAt: n.createdAt,
            lastSenderType: "staff" as const,
            targetTab: "tracking" as const,
          }));

        const combined = [...inquiries, ...reviewNotifs, ...orderNotifs].sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );

        setInboxItems(combined);
        inboxLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load inbox items:", err);
      } finally {
        setInboxLoading(false);
      }
    };

    loadInbox(inboxLoadedRef.current);

    // ── Supabase Realtime WebSocket for Inbox / Discussions ──
    const inboxChannel = supabase.channel(`customer_inbox_${customerId || userId}`, {
      config: { broadcast: { ack: false } },
    });

    inboxChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ticket_messages",
      },
      () => {
        loadInbox(true);
      }
    );

    inboxChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_tickets",
      },
      () => {
        loadInbox(true);
      }
    );

    inboxChannel.on("broadcast", { event: "new_inquiry_message" }, () => {
      loadInbox(true);
    });

    inboxChannel.on("broadcast", { event: "new_message" }, () => {
      loadInbox(true);
    });

    inboxChannel.subscribe();

    return () => {
      supabase.removeChannel(inboxChannel);
    };
  }, [customer?.id, user?.id]);

  const filteredInboxItems = inboxItems.filter((it) => {
    if (inboxFilter === "inquiries") return it.type === "inquiry";
    if (inboxFilter === "orders") return it.type === "order_advance";
    if (inboxFilter === "replies") return it.type === "review_reply";
    return true;
  });

  // Fetch Customer Orders from API & Subscribe via WebSockets (Realtime)
  useEffect(() => {
    const customerId = customer?.id;
    const userId = user?.id;
    const email = customer?.email || user?.email;

    if (!customerId && !userId && !email) {
      setOrdersLoading(false);
      return;
    }

    const supabase = createClient() as any;

    async function loadOrders(silent = false) {
      if (!silent && !ordersLoadedRef.current) {
        setOrdersLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (customerId) params.set("customerId", customerId);
        if (email) params.set("email", email);
        if (userId) params.set("userId", userId);

        const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
        const res = await fetch(`/api/v1/orders/customer?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            setOrders(json.data as OrderRecord[]);
            ordersLoadedRef.current = true;
          }
        } else {
          console.warn("Orders API returned non-OK status:", res.status);
        }
      } catch (err) {
        console.warn("Failed to load customer orders:", err);
      } finally {
        setOrdersLoading(false);
      }
    }

    // Initial load
    loadOrders(ordersLoadedRef.current);

    // Listen for local order placement events
    const handleLocalOrderPlaced = () => {
      loadOrders(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("gts_order_placed", handleLocalOrderPlaced);
    }

    // ── Supabase Realtime WebSocket for Orders ──
    const ordersChannel = supabase.channel(`customer_orders_${customerId || userId || email}`, {
      config: { broadcast: { ack: false } },
    });

    ordersChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        ...(customerId ? { filter: `customer_id=eq.${customerId}` } : {}),
      },
      () => {
        loadOrders(true);
      }
    );

    ordersChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_items",
      },
      () => {
        loadOrders(true);
      }
    );

    ordersChannel.on("broadcast", { event: "order_updated" }, () => {
      loadOrders(true);
    });

    ordersChannel.subscribe();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("gts_order_placed", handleLocalOrderPlaced);
      }
      supabase.removeChannel(ordersChannel);
    };
  }, [customer?.id, user?.id, customer?.email, user?.email]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrName || !newAddrPhone || !newAddrLine1 || !newAddrCity) return;

    // SQL Injection Prevention across all address inputs
    for (const [val, label] of [
      [newAddrName, "Full name"],
      [newAddrPhone, "Phone number"],
      [newAddrLine1, "Address line 1"],
      [newAddrCity, "City"],
      [newAddrState, "State"],
    ] as const) {
      const check = validateSqlSafe(val, label);
      if (!check.isSafe) {
        alert(check.error);
        return;
      }
    }

    const cleanName = sanitizeSafeText(newAddrName, 100);
    const cleanPhone = sanitizeSafeText(newAddrPhone, 25);
    const cleanLine1 = sanitizeSafeText(newAddrLine1, 200);
    const cleanCity = sanitizeSafeText(newAddrCity, 100);
    const cleanState = sanitizeSafeText(newAddrState, 100);

    setAddrSubmitting(true);

    if (editingAddressId) {
      const supabase = createClient() as any;
      const { error } = await supabase
        .from("addresses")
        .update({
          full_name: cleanName,
          phone: cleanPhone,
          address_line1: cleanLine1,
          city: cleanCity,
          state: cleanState,
          is_default: newAddrDefault,
        })
        .eq("id", editingAddressId);

      setAddrSubmitting(false);
      if (!error) {
        setShowAddAddressModal(false);
        setEditingAddressId(null);
        setNewAddrName("");
        setNewAddrPhone("");
        setNewAddrLine1("");
        setNewAddrCity("");
        setNewAddrDefault(false);
        await refreshCustomer();
      } else {
        alert(error.message);
      }
    } else {
      const res = await addSavedAddress({
        full_name: cleanName,
        phone: cleanPhone,
        address_line1: cleanLine1,
        city: newAddrCity,
        state: newAddrState,
        is_default: newAddrDefault,
      });

      setAddrSubmitting(false);
      if (!res.error) {
        setShowAddAddressModal(false);
        setNewAddrName("");
        setNewAddrPhone("");
        setNewAddrLine1("");
        setNewAddrCity("");
        setNewAddrDefault(false);
      } else {
        alert(res.error);
      }
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    if (!customer?.id) return;
    const supabase = createClient() as any;
    try {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("customer_id", customer.id);
      await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", id);
      await refreshCustomer();
    } catch (err) {
      console.error("Failed to set default address:", err);
    }
  };

  const handleOpenEditAddress = (addr: any) => {
    setEditingAddressId(addr.id);
    setNewAddrName(addr.full_name);
    setNewAddrPhone(addr.phone);
    setNewAddrLine1(addr.address_line1);
    setNewAddrCity(addr.city);
    setNewAddrState(addr.state);
    setNewAddrDefault(addr.is_default);
    setShowAddAddressModal(true);
  };

  const handleSelectPickupStation = (station: any) => {
    const updated = [station, ...savedPickupStations.filter((s: any) => s.id !== station.id)];
    setSavedPickupStations(updated);
    try {
      localStorage.setItem("gts_saved_pickup_stations", JSON.stringify(updated));
    } catch {}
    setShowAddPickupStationModal(false);
  };

  const handleRemovePickupStation = (id: string) => {
    const updated = savedPickupStations.filter((s: any) => s.id !== id);
    setSavedPickupStations(updated);
    try {
      localStorage.setItem("gts_saved_pickup_stations", JSON.stringify(updated));
    } catch {}
  };

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  const handleSaveBasicProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id && !user?.id) return;

    // SQL Injection Prevention across all name inputs
    const fnCheck = validateSqlSafe(firstName, "First name");
    if (!fnCheck.isSafe) { alert(fnCheck.error); return; }
    const mnCheck = validateSqlSafe(middleName, "Middle name");
    if (!mnCheck.isSafe) { alert(mnCheck.error); return; }
    const lnCheck = validateSqlSafe(lastName, "Last name");
    if (!lnCheck.isSafe) { alert(lnCheck.error); return; }

    const cleanFirst = sanitizeSafeText(firstName, 50);
    const cleanMiddle = sanitizeSafeText(middleName, 50);
    const cleanLast = sanitizeSafeText(lastName, 50);

    const supabase = createClient() as any;
    setSavingProfile(true);
    try {
      const compiledFullName = [cleanFirst, cleanMiddle, cleanLast]
        .filter(Boolean)
        .join(" ");

      // Update Supabase Auth user metadata
      await supabase.auth.updateUser({
        data: {
          first_name: cleanFirst,
          middle_name: cleanMiddle,
          last_name: cleanLast,
          gender,
          birth_date: birthDate,
          full_name: compiledFullName,
        },
      });

      // Update customers table
      if (customer?.id) {
        await supabase
          .from("customers")
          .update({
            full_name: compiledFullName,
          })
          .eq("id", customer.id);
      }

      await refreshCustomer();
      setIsEditingProfile(false);
      setProfileSavedMsg(true);
      setTimeout(() => setProfileSavedMsg(false), 3500);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id && !user?.id) return;

    // SQL Injection Prevention
    const phoneCheck = validateSqlSafe(newPhone, "Phone number");
    if (!phoneCheck.isSafe) { alert(phoneCheck.error); return; }

    const digitsOnly = newPhone.replace(/\D/g, "").replace(/^234/, "").replace(/^0/, "");
    // Check legit Nigerian mobile prefix: 70, 71, 80, 81, 90, 91 with exactly 10 digits
    if (!/^[789][01]\d{8}$/.test(digitsOnly)) {
      alert("Please enter a valid Nigerian mobile phone number (e.g. 080..., 081..., 090..., 091...).");
      return;
    }

    const currentDigits = (customer?.phone || user?.phone || (user?.user_metadata?.phone as string) || "")
      .replace(/\D/g, "")
      .replace(/^234/, "")
      .replace(/^0/, "");

    if (currentDigits && digitsOnly === currentDigits) {
      alert("New phone number cannot be the same as your current phone number.");
      return;
    }

    const cleanPhone = `+234${digitsOnly}`;
    setSavingPhone(true);
    setPhoneOtpError(null);
    setPhoneOtp("");
    try {
      const res = await idempotentFetch("/api/v1/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResendCooldown(60);
        if (data.devCode) {
          setPhoneOtpDevCode(data.devCode);
        }
        setShowPhoneOtpModal(true);
      } else {
        alert(data.error || "Failed to send verification code. Please try again.");
      }
    } catch {
      alert("Network error sending verification code.");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleVerifyPhoneOtp = async (code: string) => {
    setPhoneOtp(code);
    if (code.length !== 4) return;

    const digitsOnly = newPhone.replace(/^\+234\s*/, "").replace(/^234\s*/, "").replace(/^0/, "").trim();
    const cleanPhone = `+234${digitsOnly}`;

    setPhoneOtpLoading(true);
    setPhoneOtpError(null);
    try {
      const res = await idempotentFetch("/api/v1/auth/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          code,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowPhoneOtpModal(false);
        setIsEditingPhone(false);
        setPhoneOtp("");
        await refreshCustomer();
        setPhoneSavedMsg(true);
        setTimeout(() => setPhoneSavedMsg(false), 3500);
      } else {
        setPhoneOtpError(data.error || "Invalid verification code.");
        setPhoneOtp("");
      }
    } catch {
      setPhoneOtpError("Failed to verify code. Please check your connection.");
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const handleResendPhoneCode = async () => {
    if (resendCooldown > 0 || savingPhone) return;
    const digitsOnly = newPhone.replace(/^\+234\s*/, "").replace(/^234\s*/, "").replace(/^0/, "").trim();
    const cleanPhone = `+234${digitsOnly}`;
    setSavingPhone(true);
    setPhoneOtpError(null);
    try {
      const res = await idempotentFetch("/api/v1/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResendCooldown(60);
        if (data.devCode) {
          setPhoneOtpDevCode(data.devCode);
        }
      } else {
        setPhoneOtpError(data.error || "Failed to resend code.");
      }
    } catch {
      setPhoneOtpError("Network error resending code.");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    const supabase = createClient() as any;
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err?.message || "Failed to update password." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
    setPasskeyMsg(null);
    try {
      const res = await registerPasskey();
      if (res.success && res.passkey) {
        setPasskeys((prev) => [res.passkey!, ...prev]);
        setPasskeyMsg({ text: "Passkey registered successfully! You can now use your passkey to sign in.", type: "success" });
      } else {
        setPasskeyMsg({ text: res.error || "Failed to register passkey.", type: "error" });
      }
    } catch (err: any) {
      setPasskeyMsg({ text: err.message || "Failed to register passkey.", type: "error" });
    } finally {
      setRegisteringPasskey(false);
      setTimeout(() => setPasskeyMsg(null), 5000);
    }
  };

  const handleDeletePasskey = async (passkeyId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from your trusted passkeys?`)) return;
    try {
      const ok = await deleteUserPasskey(passkeyId);
      if (ok) {
        setPasskeys((prev) => prev.filter((p) => p.id !== passkeyId && p.credential_id !== passkeyId));
        setPasskeyMsg({ text: "Passkey removed from your account.", type: "success" });
      } else {
        setPasskeyMsg({ text: "Could not remove passkey. Please try again.", type: "error" });
      }
    } catch {
      setPasskeyMsg({ text: "Failed to remove passkey.", type: "error" });
    } finally {
      setTimeout(() => setPasskeyMsg(null), 4000);
    }
  };

  const handleVerifyCurrentPin = async (enteredPin: string) => {
    setAuthPin(enteredPin);
    if (enteredPin.length !== 6) return;

    setAuthPinLoading(true);
    setPinMsg(null);
    try {
      const res = await idempotentFetch("/api/v1/auth/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPinTicket(data.ticket);
        setIsPinAuthenticated(true);
        setAuthPin("");
        setSetupPin("");
        setConfirmPin("");
        setPinMsg({ type: "success", text: "PIN authenticated. You can now change your PIN below." });
        setTimeout(() => setPinMsg(null), 3500);
      } else {
        setPinMsg({ type: "error", text: data.error || "Incorrect PIN. Please enter your existing 6-digit PIN." });
        setAuthPin("");
      }
    } catch {
      setPinMsg({ type: "error", text: "Network error verifying PIN. Please try again." });
      setAuthPin("");
    } finally {
      setAuthPinLoading(false);
    }
  };

  const handleResetPinWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordInput) return;
    setResetPasswordLoading(true);
    try {
      const res = await idempotentFetch("/api/v1/auth/pin/reset-with-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPinTicket(data.ticket);
        setIsPinAuthenticated(true);
        setShowForgotPinModal(false);
        setResetPasswordInput("");
        setAuthPin("");
        setSetupPin("");
        setConfirmPin("");
        setPinMsg({ type: "success", text: "Identity verified. Set your new 6-digit PIN below." });
        setTimeout(() => setPinMsg(null), 4000);
      } else {
        setPinMsg({ type: "error", text: data.error || "Incorrect password. Please try again." });
      }
    } catch {
      setPinMsg({ type: "error", text: "Failed to verify password. Please try again." });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPin.length !== 6 || !/^\d{6}$/.test(setupPin)) {
      setPinMsg({ type: "error", text: "Please enter a complete 6-digit PIN." });
      return;
    }
    if (setupPin !== confirmPin) {
      setPinMsg({ type: "error", text: "The confirmed PIN does not match. Please re-enter." });
      return;
    }

    setSavingPin(true);
    setPinMsg(null);
    try {
      const res = await idempotentFetch("/api/v1/auth/pin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPin: setupPin,
          ticket: pinTicket,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHasSavedPin(true);
        setIsPinAuthenticated(false);
        setPinTicket(null);
        setSetupPin("");
        setConfirmPin("");
        setPinMsg({ type: "success", text: "Your 6-digit login PIN has been updated successfully and cryptographically secured!" });
        setTimeout(() => setPinMsg(null), 5000);
      } else {
        setPinMsg({ type: "error", text: data.error || "Failed to save PIN." });
      }
    } catch {
      setPinMsg({ type: "error", text: "Failed to save PIN." });
    } finally {
      setSavingPin(false);
    }
  };

  const handleInitiateDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteAccountError("Please enter your password to confirm.");
      return;
    }
    setDeleteAccountError(null);
    setUnderstoodPermanent(false);
    setShowDeleteReasonModal(true);
  };

  const handleConfirmPermanentDelete = async () => {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const res = await idempotentFetch("/api/v1/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          reason: deleteReason,
          notes: deleteNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowDeleteReasonModal(false);
        await signOut();
        router.push("/?account_deleted=true");
      } else {
        setShowDeleteReasonModal(false);
        setDeleteAccountError(data.error || "Failed to delete account. Please verify your password.");
      }
    } catch {
      setShowDeleteReasonModal(false);
      setDeleteAccountError("Network error deleting account. Please try again.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const toggleMarketing = (key: "email" | "sms" | "promos") => {
    if (key === "email") {
      setNewsletterEmail((prev) => {
        const next = !prev;
        localStorage.setItem("gts_pref_email", String(next));
        return next;
      });
    } else if (key === "sms") {
      setSmsAlerts((prev) => {
        const next = !prev;
        localStorage.setItem("gts_pref_sms", String(next));
        return next;
      });
    } else if (key === "promos") {
      setPromoDeals((prev) => {
        const next = !prev;
        localStorage.setItem("gts_pref_promos", String(next));
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !customer) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-16 text-center font-sans">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5 text-gray-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h1 className="font-athelas text-3xl sm:text-4xl font-extrabold text-[#010101] mb-2">
          Sign In to Your Account
        </h1>
        <p className="text-gray-500 max-w-md text-sm mb-8">
          Sign in to view your active orders, track live deliveries, manage saved shipping addresses, and unlock exclusive member perks.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal("login")}
          className="px-8 py-3.5 rounded-full bg-[#010101] text-white font-bold text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md active:scale-95 cursor-pointer"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  const _getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
      case "confirmed":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Confirmed</span>;
      case "processing":
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Processing</span>;
      case "shipped":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Shipped</span>;
      case "delivered":
      case "completed":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Delivered</span>;
      case "cancelled":
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Cancelled</span>;
      default:
        return <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Pending Payment</span>;
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#010101] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-4 sm:pb-24">

        {/* ── MOBILE ACCOUNT OVERVIEW HUB (GTS Brand UI) ── */}
        {!tabParam && (
          <div className="lg:hidden space-y-4 pb-4">
            {/* Welcome Card (Clean light background with Gold Avatar) */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-[#EDCF5D] text-[#010101] font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                  {(customer?.full_name || user?.email || "M").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#010101]">
                    Welcome, {customer?.full_name?.split(" ")[0] || (user?.user_metadata?.full_name as string)?.split(" ")[0] || user?.email?.split("@")[0] || "Customer"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {customer?.email || user?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 1: MY GTS ACCOUNT (Card with subtle border radius) */}
            <div className="space-y-1.5">
              <div className="px-1 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                My GTS Account
              </div>
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                {/* Orders */}
                <button
                  type="button"
                  onClick={() => router.push("/account?tab=orders")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Orders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {orders.length > 0 && (
                      <span className="bg-gray-200 text-gray-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {orders.length}
                      </span>
                    )}
                    <span className="text-gray-400 text-base">›</span>
                  </div>
                </button>

                {/* Inbox */}
                <button
                  type="button"
                  onClick={() => router.push("/account?tab=inbox")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Inbox</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {inboxItems.length > 0 && (
                      <span className="bg-[#010101] text-white text-xs font-extrabold px-2 py-0.5 rounded-full">
                        {inboxItems.length}
                      </span>
                    )}
                    <span className="text-gray-400 text-base">›</span>
                  </div>
                </button>

                {/* Pending Reviews */}
                <button
                  type="button"
                  onClick={() => router.push("/account?tab=reviews")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.502 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Pending Reviews</span>
                  </div>
                  <span className="text-gray-400 text-base">›</span>
                </button>

                {/* Voucher */}
                <button
                  type="button"
                  onClick={() => router.push("/account?tab=vouchers")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18M3 7.5h18a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 013 7.5z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Voucher</span>
                  </div>
                  <span className="text-gray-400 text-base">›</span>
                </button>

                {/* Wishlist */}
                <button
                  type="button"
                  onClick={() => router.push("/wishlist")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Wishlist</span>
                  </div>
                  <span className="text-gray-400 text-base">›</span>
                </button>

                {/* Saved Addresses */}
                <button
                  type="button"
                  onClick={() => router.push("/account?tab=addresses")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Saved Addresses</span>
                  </div>
                  <span className="text-gray-400 text-base">›</span>
                </button>

                {/* Recently Viewed */}
                <button
                  type="button"
                  onClick={() => router.push("/search")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Recently Viewed</span>
                  </div>
                  <span className="text-gray-400 text-base">›</span>
                </button>
              </div>
            </div>

            {/* SECTION 2: ACCOUNT SETTINGS (Card with subtle border radius) */}
            <div className="space-y-1.5">
              <div className="px-1 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                Account Settings
              </div>
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                {/* Account Management */}
                <button
                  type="button"
                  onClick={() => router.push("/account?tab=profile")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-800">Account Management</span>
                  <span className="text-gray-400 text-base">›</span>
                </button>


                {/* Cookie Preferences */}
                <button
                  type="button"
                  onClick={() => alert("Cookie preferences: Essential and analytical cookies are active.")}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-800">Cookie Preferences</span>
                  <span className="text-gray-400 text-base">›</span>
                </button>

                {/* Close Account */}
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Are you sure you want to sign out and clear your active account session?")) {
                      await signOut();
                      router.push("/");
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-800">Close Account</span>
                  <span className="text-gray-400 text-base">›</span>
                </button>
              </div>
            </div>

            {/* ── SIGN OUT BUTTON (Matches Drawer Style) ── */}
            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-red-400 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold text-sm py-3 px-4 rounded-xl transition-all cursor-pointer shadow-2xs bg-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Breadcrumb (Desktop) ── */}
        <nav className="hidden lg:flex items-center gap-2 text-xs font-semibold text-gray-500 mb-6">
          <Link href="/" className="hover:text-[#010101] transition-colors">Home</Link>
          <span>›</span>
          <span className="text-[#010101] font-bold">
            {activeTab === "overview" ? "My Account" : tabTitleMap[activeTab] || "My Account"}
          </span>
        </nav>

        {/* ── Main Layout: Sidebar Navigation & Content Panel ── */}
        <div className={`${!tabParam ? "hidden lg:grid" : "grid"} grid-cols-1 lg:grid-cols-12 gap-8 items-start`}>
          
          {/* Left Navigation Sidebar (Desktop - Pinned with Independent Scroll) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-1 bg-[#F9F8F5] p-3 rounded-2xl border border-gray-200/80 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto [scrollbar-width:thin]">
            {/* My GTS Account (Overview) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("overview");
                router.push("/account?tab=overview");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span>My GTS Account</span>
            </button>
            {/* Orders */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("orders");
                router.push("/account?tab=orders");
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span>Orders</span>
              </div>
              {orders.length > 0 && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === "orders" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-800"
                }`}>
                  {orders.length}
                </span>
              )}
            </button>

            {/* Inbox */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("inbox");
                router.push("/account?tab=inbox");
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "inbox"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span>Inbox</span>
              </div>
              {inboxItems.length > 0 && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === "inbox" ? "bg-white/20 text-white" : "bg-[#010101] text-white"
                }`}>
                  {inboxItems.length}
                </span>
              )}
            </button>

            {/* Pending Reviews */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("reviews");
                router.push("/account?tab=reviews");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "reviews"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.502 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <span>Pending Reviews</span>
            </button>

            {/* Voucher */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("vouchers");
                router.push("/account?tab=vouchers");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "vouchers"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18M3 7.5h18a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 013 7.5z" />
              </svg>
              <span>Vouchers & Promos</span>
            </button>

            {/* Wishlist */}
            <button
              type="button"
              onClick={() => router.push("/wishlist")}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-white hover:text-[#010101] transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <span>Wishlist</span>
            </button>

            {/* Saved Addresses */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("addresses");
                router.push("/account?tab=addresses");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "addresses"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>Saved Addresses</span>
            </button>

            {/* Recently Viewed */}
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-white hover:text-[#010101] transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Recently Viewed</span>
            </button>

            {/* Subtle Divider */}
            <div className="pt-1.5 border-t border-gray-200/80 my-1" />

            {/* Account Management */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("profile");
                router.push("/account?tab=profile");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "profile"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span>Account Management</span>
            </button>

            {/* Cookie Preferences */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("cookies");
                router.push("/account?tab=cookies");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "cookies"
                  ? "bg-[#010101] text-white shadow-xs font-bold"
                  : "text-gray-700 hover:bg-white hover:text-[#010101]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span>Cookie Preferences</span>
            </button>

            {/* Close Account */}
            <button
              type="button"
              onClick={async () => {
                if (confirm("Are you sure you want to sign out and clear your active account session?")) {
                  await signOut();
                  router.push("/");
                }
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-white hover:text-red-600 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>Close Account</span>
            </button>

            {/* Sign Out */}
            <div className="pt-2 border-t border-gray-200/60 mt-2">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-white hover:text-red-600 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          </aside>

          {/* Right Content Panel */}
          <div className="lg:col-span-9 min-w-0">

            {/* TAB 0: ACCOUNT OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                <div className="pb-3 border-b border-gray-100">
                  <h2 className="font-bold text-base sm:text-lg text-[#010101]">Account Overview</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Account Details */}
                  <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Account Details
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("profile");
                          router.push("/account?tab=profile");
                        }}
                        className="text-gray-400 hover:text-[#010101] transition-colors p-1 cursor-pointer"
                        title="Edit Account Details"
                        aria-label="Edit Account Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        {customer?.full_name || (user?.user_metadata?.full_name as string) || "GTS Shopper"}
                      </p>
                      <p className="text-gray-500">
                        {customer?.email || user?.email || "No email linked"}
                      </p>
                      {customer?.phone && (
                        <p className="text-gray-500">{customer.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Address Book */}
                  {(() => {
                    const defaultAddr = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
                    return (
                      <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                            Address Book
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("addresses");
                              router.push("/account?tab=addresses");
                            }}
                            className="text-gray-400 hover:text-[#010101] transition-colors p-1 cursor-pointer"
                            title="Edit Address Book"
                            aria-label="Edit Address Book"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-xs space-y-1 text-gray-600">
                          <p className="font-semibold text-gray-800">Your default shipping address:</p>
                          {defaultAddr ? (
                            <>
                              <p className="text-gray-800 font-medium">
                                {defaultAddr.full_name || customer?.full_name}
                              </p>
                              <p className="line-clamp-2">
                                {defaultAddr.address_line1}
                                {defaultAddr.address_line2 ? `, ${defaultAddr.address_line2}` : ""}
                              </p>
                              <p>
                                {[defaultAddr.city, defaultAddr.state].filter(Boolean).join(", ")}
                              </p>
                              {(defaultAddr.phone || customer?.phone) && (
                                <p>{defaultAddr.phone || customer?.phone}</p>
                              )}
                            </>
                          ) : (
                            <div className="space-y-2 pt-1">
                              <p className="text-gray-400 italic">No default shipping address saved yet.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab("addresses");
                                  router.push("/account?tab=addresses");
                                }}
                                className="text-xs font-bold text-[#010101] underline decoration-[#EDCF5D] decoration-2 underline-offset-4 cursor-pointer"
                              >
                                + Add Address
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}


                </div>
              </div>
            )}

            {/* TAB 1: ORDERS & TRACKING */}
            {activeTab === "orders" && (
              selectedOrder && showPackageHistory ? (
                /* ── PACKAGE HISTORY VIEW MATCHING REFERENCE SCREENSHOT ── */
                <div className="space-y-6">
                  {/* Header: ← Package History */}
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowPackageHistory(false)}
                      className="p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                      aria-label="Back to Order Details"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                    </button>
                    <h2 className="text-base sm:text-lg font-bold text-[#010101]">Package History</h2>
                  </div>

                  {/* Vertical Timeline */}
                  <div className="pl-1 sm:pl-2 pt-2">
                    {(() => {
                      const dateShort = (() => {
                        try {
                          const d = new Date(selectedOrder.created_at);
                          const day = String(d.getDate()).padStart(2, "0");
                          const month = String(d.getMonth() + 1).padStart(2, "0");
                          return `${day}-${month}`;
                        } catch {
                          return "";
                        }
                      })();

                      const events: Array<{
                        id: string;
                        badgeText: string;
                        badgeType: "blue" | "gray" | "upcoming";
                        iconType: "check" | "dot" | "upcoming";
                        date?: string | null;
                        description?: string;
                      }> = [];

                      if (selectedOrder.status === "cancelled") {
                        events.push(
                          { id: "placed", badgeText: "ORDER PLACED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "pending", badgeText: "PENDING CONFIRMATION", badgeType: "blue", iconType: "check", date: dateShort },
                          {
                            id: "cancelled",
                            badgeText: "CANCELLED - PAYMENT UNSUCCESSFUL",
                            badgeType: "gray",
                            iconType: "dot",
                            date: dateShort,
                            description:
                              "Unfortunately, this item/order has been cancelled because your payment could not be completed. - If you consider this to be an error and you have been charged, kindly reach out to our customer service in order to receive the appropriate assistance.",
                          }
                        );
                      } else if (selectedOrder.status === "pending_payment") {
                        events.push(
                          { id: "placed", badgeText: "ORDER PLACED", badgeType: "blue", iconType: "check", date: dateShort },
                          {
                            id: "pending",
                            badgeText: "PENDING CONFIRMATION",
                            badgeType: "blue",
                            iconType: "dot",
                            date: dateShort,
                            description: "Your order has been recorded. Awaiting payment verification before dispatch.",
                          }
                        );
                      } else if (selectedOrder.status === "paid" || selectedOrder.status === "confirmed") {
                        events.push(
                          { id: "placed", badgeText: "ORDER PLACED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "confirmed", badgeText: "PAYMENT CONFIRMED", badgeType: "blue", iconType: "check", date: dateShort },
                          {
                            id: "processing",
                            badgeText: "WAITING TO BE SHIPPED",
                            badgeType: "blue",
                            iconType: "dot",
                            date: dateShort,
                            description: "Your order is currently being prepared and packaged at our fulfillment hub.",
                          },
                          { id: "shipped", badgeText: "SHIPPED", badgeType: "upcoming", iconType: "upcoming", date: null },
                          { id: "delivered", badgeText: "DELIVERED", badgeType: "upcoming", iconType: "upcoming", date: null }
                        );
                      } else if (selectedOrder.status === "processing") {
                        events.push(
                          { id: "placed", badgeText: "ORDER PLACED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "confirmed", badgeText: "PAYMENT CONFIRMED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "processing", badgeText: "PROCESSING & PACKAGING", badgeType: "blue", iconType: "check", date: dateShort },
                          {
                            id: "shipped",
                            badgeText: "WAITING FOR DISPATCH",
                            badgeType: "blue",
                            iconType: "dot",
                            date: dateShort,
                            description: "Package is at the dispatch bay awaiting courier pickup.",
                          },
                          { id: "delivered", badgeText: "DELIVERED", badgeType: "upcoming", iconType: "upcoming", date: null }
                        );
                      } else if (selectedOrder.status === "shipped") {
                        events.push(
                          { id: "placed", badgeText: "ORDER PLACED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "confirmed", badgeText: "PAYMENT CONFIRMED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "processing", badgeText: "PROCESSING & PACKAGING", badgeType: "blue", iconType: "check", date: dateShort },
                          {
                            id: "shipped",
                            badgeText: "SHIPPED - IN TRANSIT",
                            badgeType: "blue",
                            iconType: "check",
                            date: dateShort,
                            description: "Package is in transit with our logistics partner to the delivery destination.",
                          },
                          {
                            id: "delivered",
                            badgeText: "OUT FOR DELIVERY",
                            badgeType: "blue",
                            iconType: "dot",
                            date: dateShort,
                            description: "Package is out for final delivery / ready for pickup.",
                          }
                        );
                      } else {
                        // delivered / completed
                        events.push(
                          { id: "placed", badgeText: "ORDER PLACED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "confirmed", badgeText: "PAYMENT CONFIRMED", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "processing", badgeText: "PROCESSING & PACKAGING", badgeType: "blue", iconType: "check", date: dateShort },
                          { id: "shipped", badgeText: "SHIPPED - IN TRANSIT", badgeType: "blue", iconType: "check", date: dateShort },
                          {
                            id: "delivered",
                            badgeText: "DELIVERED",
                            badgeType: "blue",
                            iconType: "check",
                            date: dateShort,
                            description: "Package was successfully delivered. Thank you for shopping with GTS!",
                          }
                        );
                      }

                      return events.map((ev, i, arr) => {
                        const isLast = i === arr.length - 1;
                        return (
                          <div key={ev.id} className="flex items-start gap-4 sm:gap-5 relative">
                            {/* Left Column: Milestone Icon + Vertical Connecting Line */}
                            <div className="flex flex-col items-center shrink-0">
                              {ev.iconType === "check" ? (
                                <div className="w-6 h-6 rounded-full bg-[#0094D9] text-white flex items-center justify-center shrink-0 z-10 shadow-2xs">
                                  <svg className="w-3.5 h-3.5 stroke-white" fill="none" viewBox="0 0 24 24" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                </div>
                              ) : ev.iconType === "dot" ? (
                                <div className="w-6 h-6 rounded-full bg-[#5A6268] flex items-center justify-center shrink-0 z-10 shadow-2xs">
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center shrink-0 z-10">
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                </div>
                              )}

                              {!isLast && (
                                <div
                                  className={`w-[1.5px] min-h-[50px] ${
                                    ev.iconType === "check" ? "bg-[#0094D9]" : "bg-gray-300"
                                  }`}
                                />
                              )}
                            </div>

                            {/* Right Column: Pill Badge, Date, and Description */}
                            <div className={`flex-1 min-w-0 ${!isLast ? "pb-6" : "pb-2"}`}>
                              {ev.badgeType === "blue" ? (
                                <span className="bg-[#0094D9] text-white text-[11px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                  {ev.badgeText}
                                </span>
                              ) : ev.badgeType === "gray" ? (
                                <span className="bg-[#5A6268] text-white text-[11px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                  {ev.badgeText}
                                </span>
                              ) : (
                                <span className="bg-gray-200 text-gray-500 text-[11px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                  {ev.badgeText}
                                </span>
                              )}

                              {ev.date && (
                                <p className="text-xs text-gray-700 font-normal mt-1">
                                  {ev.date}
                                </p>
                              )}

                              {ev.description && (
                                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed max-w-xl">
                                  {ev.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : selectedOrder ? (
                /* ── DEDICATED ORDER DETAILS VIEW MATCHING REFERENCE ── */
                <div className="space-y-4">
                  {/* Header / Back Navigation: ← Order Details */}
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setShowPackageHistory(false);
                      }}
                      className="p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                      aria-label="Back to Orders List"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                    </button>
                    <h2 className="text-base sm:text-lg font-bold text-[#010101]">Order Details</h2>
                  </div>

                  {/* Order Meta Header */}
                  <div className="space-y-1 text-xs pt-1">
                    <h3 className="text-sm sm:text-base font-bold text-[#010101]">
                      Order nº {selectedOrder.order_number}
                    </h3>
                    <p className="text-gray-500 font-normal">
                      {selectedOrder.items?.reduce((s, i) => s + i.quantity, 0) || 1} {((selectedOrder.items?.reduce((s, i) => s + i.quantity, 0) || 1) === 1) ? "Item" : "Items"}
                    </p>
                    <p className="text-gray-500 font-normal">
                      Placed on {(() => {
                        try {
                          const d = new Date(selectedOrder.created_at);
                          const day = String(d.getDate()).padStart(2, "0");
                          const month = String(d.getMonth() + 1).padStart(2, "0");
                          return `${day}-${month}-${d.getFullYear()}`;
                        } catch {
                          return "";
                        }
                      })()}
                    </p>
                    <p className="text-gray-500 font-normal">
                      Total: ₦ {((selectedOrder.total || 0) / 100).toLocaleString()}
                    </p>
                  </div>

                  {/* SECTION 1: ITEMS IN YOUR ORDER */}
                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-[#010101] uppercase tracking-wider mb-2">
                      ITEMS IN YOUR ORDER
                    </h4>

                    <div className="rounded-md border border-gray-200 bg-white p-4 space-y-4">
                      {/* Top Bar inside Item Box: Status Pill + Date on left, See Status History on right */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {(() => {
                            switch (selectedOrder.status) {
                              case "cancelled":
                                return (
                                  <span className="bg-[#5A6268] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    CANCELLED - PAYMENT UNSUCCESSFUL
                                  </span>
                                );
                              case "pending_payment":
                                return (
                                  <span className="bg-[#EDCF5D] text-[#010101] text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    PENDING - AWAITING PAYMENT
                                  </span>
                                );
                              case "paid":
                              case "confirmed":
                                return (
                                  <span className="bg-[#15803D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    CONFIRMED
                                  </span>
                                );
                              case "processing":
                                return (
                                  <span className="bg-[#2563EB] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    PROCESSING
                                  </span>
                                );
                              case "shipped":
                                return (
                                  <span className="bg-[#4F46E5] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    SHIPPED - IN TRANSIT
                                  </span>
                                );
                              case "delivered":
                              case "completed":
                                return (
                                  <span className="bg-[#15803D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    DELIVERED
                                  </span>
                                );
                              default:
                                return (
                                  <span className="bg-[#5A6268] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    {String(selectedOrder.status).replace(/_/g, " ").toUpperCase()}
                                  </span>
                                );
                            }
                          })()}
                          <p className="text-xs text-[#010101] font-bold mt-1.5">
                            On {(() => {
                              try {
                                const d = new Date(selectedOrder.created_at);
                                const day = String(d.getDate()).padStart(2, "0");
                                const month = String(d.getMonth() + 1).padStart(2, "0");
                                return `${day}-${month}`;
                              } catch {
                                return "";
                              }
                            })()}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowPackageHistory(true)}
                          className="text-[#010101] hover:text-[#8D730C] text-xs font-bold underline decoration-[#EDCF5D] decoration-2 underline-offset-4 cursor-pointer transition-colors"
                        >
                          See Status History
                        </button>
                      </div>

                      {/* Items in the box */}
                      <div className="divide-y divide-gray-100">
                        {selectedOrder.items?.map((it, idx) => {
                          const snap = it.product_snapshot;
                          const title = snap?.name || snap?.title || `Product Item`;
                          const variation = [snap?.size, snap?.color].filter(Boolean).join(" / ");
                          const priceNaira = Math.round((it.unit_price || 0) / 100);
                          const originalPriceNaira = Math.round(priceNaira * 1.25);

                          return (
                            <div key={it.id || idx} className="pt-2 flex items-start gap-3.5 sm:gap-4">
                              {/* Product Thumbnail */}
                              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-sm bg-gray-50 border border-gray-100 relative overflow-hidden shrink-0 flex items-center justify-center">
                                {snap?.image ? (
                                  <Image src={snap.image} alt={title} fill className="object-contain p-1" />
                                ) : (
                                  <span className="text-gray-400 font-bold text-xs">GTS</span>
                                )}
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <h5 className="text-xs sm:text-sm font-medium text-[#010101] leading-snug line-clamp-2">
                                  {title}
                                </h5>
                                {variation && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Variation: {variation}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-0.5">
                                  QTY: {it.quantity}
                                </p>
                                <div className="flex items-baseline gap-2 mt-1">
                                  <span className="text-xs sm:text-sm font-bold text-[#010101]">
                                    ₦ {priceNaira.toLocaleString()}
                                  </span>
                                  {selectedOrder.discount_amount > 0 && (
                                    <span className="text-xs text-gray-400 line-through">
                                      ₦ {originalPriceNaira.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Return policy note with return icon */}
                      <div className="pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-600">
                        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>
                          Product no longer eligible for return.{" "}
                          <Link href="/faqs" className="text-blue-600 hover:underline font-medium">
                            Access our Return Policy.
                          </Link>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: 2-COLUMN GRID (PAYMENT INFORMATION & DELIVERY INFORMATION) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Left Card: PAYMENT INFORMATION */}
                    <div className="rounded-md border border-gray-200 bg-white p-4 text-xs font-sans space-y-4">
                      <h4 className="font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
                        PAYMENT INFORMATION
                      </h4>

                      <div>
                        <h5 className="font-bold text-gray-900">Payment Method</h5>
                        <p className="text-gray-500 mt-1">
                          Pay with Cards, Bank Transfer or USSD
                        </p>
                      </div>

                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <h5 className="font-bold text-gray-900 mb-1">Payment Details</h5>
                        <div className="flex justify-between text-gray-600">
                          <span>Items total:</span>
                          <span>₦ {((selectedOrder.subtotal || 0) / 100).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Delivery Fees:</span>
                          <span>₦ {((selectedOrder.delivery_fee || 0) / 100).toLocaleString()}</span>
                        </div>
                        {selectedOrder.discount_amount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>Discount:</span>
                            <span>-₦ {((selectedOrder.discount_amount || 0) / 100).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-[#010101] pt-1.5 border-t border-gray-100">
                          <span>Total:</span>
                          <span>₦ {((selectedOrder.total || 0) / 100).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Card: DELIVERY INFORMATION */}
                    <div className="rounded-md border border-gray-200 bg-white p-4 text-xs font-sans space-y-4">
                      <h4 className="font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
                        DELIVERY INFORMATION
                      </h4>

                      {(() => {
                        const addr = selectedOrder.address || {};
                        const isPickup =
                          selectedOrder.delivery_fee === 50000 ||
                          selectedOrder.delivery_fee === 110000 ||
                          (addr.address_line1 || "").toLowerCase().includes("station") ||
                          (addr.address_line1 || "").toLowerCase().includes("pickup") ||
                          !addr.address_line1;

                        const deliveryMethodLabel = isPickup ? "Pick-up Station" : (selectedOrder.delivery_fee === 450000 ? "Express Delivery" : "Door Delivery");
                        const addressTitle = isPickup
                          ? (addr.full_name || "GTS Pickup Station Ilorin")
                          : (addr.full_name || customer?.full_name || "Customer Delivery Address");
                        const addressLine1 = addr.address_line1 || "Suite A, Adebayo Yusuf House, opposite International Airport";
                        const addressLine2 = addr.address_line2 || "Close to Beside Donrich Educational Services";
                        const cityState = [addr.city || "Ilorin", addr.state || "Kwara"].filter(Boolean).join(", ");

                        // Estimated delivery text
                        const estText = (() => {
                          try {
                            const d = new Date(selectedOrder.created_at);
                            const start = new Date(d);
                            start.setDate(start.getDate() + 1);
                            const end = new Date(d);
                            end.setDate(end.getDate() + 3);
                            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                            return `Delivery between ${start.getDate()} ${months[start.getMonth()]} and ${end.getDate()} ${months[end.getMonth()]}.`;
                          } catch {
                            return "Delivery between 2 and 4 business days.";
                          }
                        })();

                        return (
                          <>
                            <div>
                              <h5 className="font-bold text-gray-900">Delivery Method</h5>
                              <p className="text-gray-500 mt-1">{deliveryMethodLabel}</p>
                            </div>

                            <div className="pt-2 border-t border-gray-100 space-y-1">
                              <h5 className="font-bold text-gray-900 mb-1">
                                {isPickup ? "Pick-up Station Address" : "Delivery Address"}
                              </h5>
                              <p className="text-gray-700 font-medium">{addressTitle}</p>
                              <p className="text-gray-500">{addressLine1}</p>
                              {addressLine2 && <p className="text-gray-500">{addressLine2}</p>}
                              <p className="text-gray-500">{cityState}</p>
                              {isPickup && (
                                <p className="text-gray-500 pt-1">
                                  Opening Hours:<br />
                                  Mon-Fri 8 AM - 6PM; SAT 8 AM - 5PM
                                </p>
                              )}
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(`${addressLine1}, ${cityState}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-semibold pt-1 inline-block"
                              >
                                See Location
                              </a>
                            </div>

                            <div className="pt-2 border-t border-gray-100 space-y-1">
                              <h5 className="font-bold text-gray-900 mb-1">Shipping Details</h5>
                              <p className="text-gray-600">
                                {isPickup ? "Pickup Station. Fulfilled by GTS" : "Door Delivery. Fulfilled by GTS Logistics"}
                              </p>
                              <p className="text-gray-500">{estText}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Centered Footer: Need Help? */}
                  <div className="pt-6 pb-2 text-center">
                    <Link
                      href="/account?tab=inbox"
                      className="text-[#010101] hover:text-[#8D730C] text-xs sm:text-sm font-bold underline decoration-[#EDCF5D] decoration-2 underline-offset-4 inline-block cursor-pointer transition-colors"
                    >
                      Need Help?
                    </Link>
                  </div>
                </div>
              ) : (
                /* ── ORDERS HISTORY LIST ── */
                <div className="space-y-4">
                  {/* Header matching reference screenshot: Orders */}
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => router.push("/account")}
                      className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                      aria-label="Back to Account"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                    </button>
                    <h2 className="font-bold text-base sm:text-lg text-[#010101]">Orders</h2>
                  </div>

                  {/* Sub-tabs: ONGOING/DELIVERED (X) | CANCELED/RETURNED (Y) */}
                  {(() => {
                    const ongoingOrders = orders.filter((o) =>
                      ["pending_payment", "paid", "confirmed", "processing", "shipped", "delivered", "completed"].includes(o.status)
                    );
                    const canceledOrders = orders.filter((o) =>
                      ["cancelled", "refunded", "returned"].includes(o.status)
                    );
                    const currentOrdersList = ordersSubTab === "ongoing" ? ongoingOrders : canceledOrders;

                    return (
                      <>
                        <div className="grid grid-cols-2 border-b border-gray-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setOrdersSubTab("ongoing")}
                            className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                              ordersSubTab === "ongoing"
                                ? "text-[#010101] border-[#EDCF5D]"
                                : "text-gray-400 border-transparent hover:text-gray-700"
                            }`}
                          >
                            Ongoing / Delivered ({ongoingOrders.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrdersSubTab("canceled")}
                            className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                              ordersSubTab === "canceled"
                                ? "text-[#010101] border-[#EDCF5D]"
                                : "text-gray-400 border-transparent hover:text-gray-700"
                            }`}
                          >
                            Canceled / Returned ({canceledOrders.length})
                          </button>
                        </div>

                        {ordersLoading ? (
                          <div className="py-16 text-center">
                            <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-xs font-semibold text-gray-500">Loading your orders...</p>
                          </div>
                        ) : currentOrdersList.length === 0 ? (
                          <div className="py-12 px-4 text-center max-w-md mx-auto">
                            <div className="w-16 h-16 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                            </div>
                            <h3 className="font-bold text-base text-[#010101] mb-1">
                              {ordersSubTab === "ongoing" ? "No Ongoing Orders" : "No Canceled Orders"}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-6">
                              {ordersSubTab === "ongoing"
                                ? "You haven't placed any ongoing or delivered orders yet. Discover trending groceries, fashion, and home appliances today!"
                                : "You have no canceled or returned orders."}
                            </p>
                            {ordersSubTab === "ongoing" && (
                              <Link
                                href="/"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#010101] text-white font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md cursor-pointer"
                              >
                                Start Shopping
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {currentOrdersList.flatMap((order) => {
                        const dateShort = (() => {
                          try {
                            const d = new Date(order.created_at);
                            const day = String(d.getDate()).padStart(2, "0");
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            return `${day}-${month}`;
                          } catch {
                            return "";
                          }
                        })();

                        const itemsList = order.items && order.items.length > 0 ? order.items : [null];

                        return itemsList.map((item, idx) => {
                          const snap = item?.product_snapshot;
                          const title = snap?.name || snap?.title || `Order ${order.order_number}`;
                          const variation = [snap?.size, snap?.color].filter(Boolean).join(" / ");
                          const qty = item?.quantity || 1;

                          const getStatusPill = () => {
                            switch (order.status) {
                              case "cancelled":
                                return (
                                  <span className="bg-[#5A6268] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    CANCELLED - PAYMENT UNSUCCESSFUL
                                  </span>
                                );
                              case "pending_payment":
                                return (
                                  <span className="bg-[#EDCF5D] text-[#010101] text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    PENDING - AWAITING PAYMENT
                                  </span>
                                );
                              case "paid":
                              case "confirmed":
                                return (
                                  <span className="bg-[#15803D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    CONFIRMED
                                  </span>
                                );
                              case "processing":
                                return (
                                  <span className="bg-[#2563EB] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    PROCESSING
                                  </span>
                                );
                              case "shipped":
                                return (
                                  <span className="bg-[#4F46E5] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    SHIPPED - IN TRANSIT
                                  </span>
                                );
                              case "delivered":
                              case "completed":
                                return (
                                  <span className="bg-[#15803D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    DELIVERED
                                  </span>
                                );
                              default:
                                return (
                                  <span className="bg-[#5A6268] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    {String(order.status).replace(/_/g, " ").toUpperCase()}
                                  </span>
                                );
                            }
                          };

                          return (
                            <div
                              key={`${order.id}-${item?.id || idx}`}
                              className="rounded-md border border-gray-200 bg-white p-3.5 sm:p-4 hover:border-gray-300 transition-all flex items-start justify-between gap-3.5 sm:gap-4 relative"
                            >
                              <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                                {/* Left Thumbnail */}
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-sm bg-gray-50 border border-gray-100 relative overflow-hidden shrink-0 flex items-center justify-center">
                                  {snap?.image ? (
                                    <Image
                                      src={snap.image}
                                      alt={title}
                                      fill
                                      className="object-contain p-1"
                                    />
                                  ) : (
                                    <span className="text-gray-400 font-bold text-xs">GTS</span>
                                  )}
                                </div>

                                {/* Middle Details */}
                                <div className="min-w-0 flex-1 pr-2">
                                  <h4 className="text-xs sm:text-sm font-medium text-[#010101] leading-snug line-clamp-2">
                                    {title}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-1 font-normal">
                                    Order {order.order_number}
                                  </p>
                                  {variation && (
                                    <p className="text-xs text-gray-500 mt-0.5 font-normal">
                                      Variation: {variation}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500 mt-0.5 font-normal">
                                    Qty: {qty}
                                  </p>
                                  <div className="mt-1.5">
                                    {getStatusPill()}
                                  </div>
                                  <p className="text-xs font-semibold text-[#010101] mt-1.5">
                                    On {dateShort}
                                  </p>
                                </div>
                              </div>

                              {/* Top Right Action */}
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                className="text-[#010101] hover:text-[#8D730C] text-xs sm:text-sm font-bold shrink-0 cursor-pointer underline decoration-[#EDCF5D] decoration-2 underline-offset-4 self-start pt-0.5 transition-colors"
                              >
                                See Details
                              </button>
                            </div>
                          );
                        });
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )
      )}

            {/* TAB 2: SAVED ADDRESSES (ADDRESS BOOK) */}
            {activeTab === "addresses" && (
              <div className="space-y-4">
                {/* Header matching reference image: ← Address Book */}
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/account")}
                    className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Back to Account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <h2 className="font-bold text-base sm:text-lg text-[#010101]">Address Book</h2>
                </div>

                {/* Sub-tabs: PICKUP STATION | DOOR DELIVERY */}
                <div className="grid grid-cols-2 border-b border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setAddressSubTab("pickup")}
                    className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                      addressSubTab === "pickup"
                        ? "text-[#010101] border-[#EDCF5D]"
                        : "text-gray-400 border-transparent hover:text-gray-700"
                    }`}
                  >
                    Pickup Station
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressSubTab("door")}
                    className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                      addressSubTab === "door"
                        ? "text-[#010101] border-[#EDCF5D]"
                        : "text-gray-400 border-transparent hover:text-gray-700"
                    }`}
                  >
                    Door Delivery
                  </button>
                </div>

                {/* TAB CONTENT: DOOR DELIVERY */}
                {addressSubTab === "door" && (
                  <div>
                    {savedAddresses.length === 0 ? (
                      <div className="py-12 px-4 text-center max-w-sm mx-auto space-y-4">
                        <div className="w-16 h-16 rounded-full bg-[#F2F0EA] flex items-center justify-center mx-auto text-[#010101]">
                          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <h3 className="font-bold text-base text-[#010101]">You have no saved addresses yet!</h3>
                        <p className="text-xs text-gray-500">All your saved delivery addresses will appear here.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAddressId(null);
                            setNewAddrName(customer?.full_name || "");
                            setNewAddrPhone(customer?.phone || "");
                            setNewAddrLine1("");
                            setNewAddrCity("");
                            setNewAddrState("Lagos");
                            setNewAddrDefault(false);
                            setShowAddAddressModal(true);
                          }}
                          className="w-full py-3.5 px-6 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm uppercase tracking-wide transition-all shadow-md cursor-pointer"
                        >
                          Add new address
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        {savedAddresses.map((addr) => (
                          <div
                            key={addr.id}
                            className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-2 relative"
                          >
                            <h4 className="font-bold text-sm text-[#010101]">{addr.full_name}</h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}
                            </p>
                            <p className="text-xs text-gray-600">
                              {addr.city} | {addr.state}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">
                              {addr.phone}
                            </p>

                            {addr.is_default && (
                              <span className="inline-block bg-[#F2F0EA] text-[#010101] text-[10px] font-bold px-2.5 py-0.5 rounded tracking-wide">
                                DEFAULT ADDRESS
                              </span>
                            )}

                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                              {!addr.is_default ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultAddress(addr.id)}
                                  className="text-xs text-gray-500 hover:text-[#010101] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" />
                                  Make default
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-700">
                                  ✓ Default address
                                </span>
                              )}

                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAddress(addr)}
                                  className="text-[#EDCF5D] hover:text-[#c4a638] transition-colors p-1 cursor-pointer"
                                  title="Edit address"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSavedAddress(addr.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                  title="Delete address"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAddressId(null);
                              setNewAddrName(customer?.full_name || "");
                              setNewAddrPhone(customer?.phone || "");
                              setNewAddrLine1("");
                              setNewAddrCity("");
                              setNewAddrState("Lagos");
                              setNewAddrDefault(false);
                              setShowAddAddressModal(true);
                            }}
                            className="w-full py-3.5 px-6 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm uppercase tracking-wide transition-all shadow-md cursor-pointer text-center"
                          >
                            Add new address
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: PICKUP STATION */}
                {addressSubTab === "pickup" && (
                  <div>
                    {savedPickupStations.length === 0 ? (
                      <div className="py-12 px-4 text-center max-w-sm mx-auto space-y-4">
                        <div className="w-20 h-20 mx-auto relative flex items-center justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-[#EDCF5D]/20 border border-[#EDCF5D] flex items-center justify-center shadow-xs">
                            <svg className="w-9 h-9 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.31c-.317-.158-.69-.158-1.006 0L3.623 5.748C3.242 5.938 3 6.328 3 6.754v11.428c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                            </svg>
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#010101] text-white flex items-center justify-center shadow-md">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>

                        <h3 className="font-bold text-base text-[#010101]">You have not added any pickup station yet!</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          All your saved pickup stations will appear here.
                        </p>

                        <button
                          type="button"
                          onClick={() => setShowAddPickupStationModal(true)}
                          className="w-full py-3.5 px-6 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm uppercase tracking-wide transition-all shadow-md cursor-pointer"
                        >
                          Add new pickup station
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        {savedPickupStations.map((station: any) => (
                          <div
                            key={station.id}
                            className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-2 relative"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm text-[#010101]">{station.name}</h4>
                              <span className="bg-[#EDCF5D]/30 text-[#010101] border border-[#EDCF5D] text-[10px] font-bold px-2 py-0.5 rounded">
                                Pickup Station
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">{station.address}</p>
                            <p className="text-xs text-gray-500">{station.state} · {station.hours}</p>
                            <div className="pt-2 border-t border-gray-100 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemovePickupStation(station.id)}
                                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddPickupStationModal(true)}
                            className="w-full py-3.5 px-6 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm uppercase tracking-wide transition-all shadow-md cursor-pointer text-center"
                          >
                            Add new pickup station
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ACCOUNT MANAGEMENT (Profile, Phone, Security, Marketing) */}
            {activeTab === "profile" && (
              <div className="space-y-6 w-full max-w-5xl">
                {/* Mobile / Desktop Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (subParam) {
                        router.push("/account?tab=profile");
                      } else {
                        router.push("/account");
                      }
                    }}
                    className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label={subParam ? "Back to Account Management" : "Back to Account"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-[#010101]">
                      {subParam ? (
                        <>
                          <span className="lg:hidden">{subTitleMap[accountSubTab] || "Account Setting"}</span>
                          <span className="hidden lg:inline">Account Management</span>
                        </>
                      ) : (
                        "Account Management"
                      )}
                    </h2>
                  </div>
                </div>

                {/* ── Mobile Account Management Menu List (Shown on mobile when no sub-setting is active) ── */}
                <div className={`${subParam ? "hidden" : "block"} lg:hidden space-y-4`}>
                  {/* Section 1: Profile & Contact */}
                  <div className="space-y-1.5">
                    <div className="px-1 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      Profile & Contact
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("basic");
                          router.push("/account?tab=profile&sub=basic");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-800">Basic Details</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("phone");
                          router.push("/account?tab=profile&sub=phone");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                          </svg>
                          <span className="text-sm font-medium text-gray-800">Phone Number</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Security Settings */}
                  <div className="space-y-1.5">
                    <div className="px-1 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      Security Settings
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("passkeys");
                          router.push("/account?tab=profile&sub=passkeys");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-800">Manage passkeys</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("password");
                          router.push("/account?tab=profile&sub=password");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-800">Change Password</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("pin");
                          router.push("/account?tab=profile&sub=pin");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-800">Pin Settings</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("delete");
                          router.push("/account?tab=profile&sub=delete");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-50/50 active:bg-red-100/50 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          <span className="text-sm font-medium text-[#DC2626]">Delete Account</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Preferences */}
                  <div className="space-y-1.5">
                    <div className="px-1 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      Preferences
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountSubTab("marketing");
                          router.push("/account?tab=profile&sub=marketing");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                          </svg>
                          <span className="text-sm font-medium text-gray-800">Marketing Preferences</span>
                        </div>
                        <span className="text-gray-400 text-base">›</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Account Management Layout (Desktop always, Mobile only when a sub-setting is active) */}
                <div className={`${!subParam ? "hidden lg:grid" : "grid"} grid-cols-1 lg:grid-cols-12 gap-6 items-start`}>
                  {/* Left Column: Member Card + Sub-Menu (matching reference images) */}
                  <div className="hidden lg:flex lg:col-span-4 flex-col gap-4">
                    {/* Hello Member Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center shadow-2xs">
                      <div className="w-16 h-16 rounded-full bg-[#FAF5E8] border-2 border-[#EDCF5D] flex items-center justify-center text-[#010101] font-black text-2xl mb-3 shadow-xs">
                        <svg className="w-8 h-8 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-base text-[#010101]">
                        Hello {customer?.full_name || (user?.user_metadata?.full_name as string) || "GTS Member"}
                      </h3>
                      <p className="text-xs text-gray-500 truncate max-w-[210px] mt-0.5">
                        {customer?.email || user?.email || "Shopper"}
                      </p>
                    </div>

                    {/* Sub-Navigation Menu Card */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-gray-100 font-sans">
                      {/* Accordion 1: Profile Details */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsProfileAccordionOpen(!isProfileAccordionOpen)}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-xs font-bold text-[#010101] hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            <span>Profile Details</span>
                          </div>
                          <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isProfileAccordionOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>

                        {isProfileAccordionOpen && (
                          <div className="bg-[#FAF9F6] border-t border-gray-100 divide-y divide-gray-100">
                            <button
                              type="button"
                              onClick={() => setAccountSubTab("basic")}
                              style={{ paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                              className={`relative w-full flex items-center justify-between text-xs transition-all cursor-pointer group ${
                                accountSubTab === "basic"
                                  ? "bg-[#EAE8E3] text-[#010101] font-bold"
                                  : "text-gray-600 hover:text-[#010101] hover:bg-gray-100/80 font-medium"
                              }`}
                            >
                              {accountSubTab === "basic" && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#010101]" />
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform ${
                                  accountSubTab === "basic" ? "bg-[#010101] scale-125" : "bg-gray-400 group-hover:bg-[#010101]"
                                }`} />
                                <span>Basic Details</span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "basic" ? "text-[#010101] translate-x-0.5" : "text-gray-300 group-hover:text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAccountSubTab("phone")}
                              style={{ paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                              className={`relative w-full flex items-center justify-between text-xs transition-all cursor-pointer group ${
                                accountSubTab === "phone"
                                  ? "bg-[#EAE8E3] text-[#010101] font-bold"
                                  : "text-gray-600 hover:text-[#010101] hover:bg-gray-100/80 font-medium"
                              }`}
                            >
                              {accountSubTab === "phone" && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#010101]" />
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform ${
                                  accountSubTab === "phone" ? "bg-[#010101] scale-125" : "bg-gray-400 group-hover:bg-[#010101]"
                                }`} />
                                <span>Edit Phone Number</span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "phone" ? "text-[#010101] translate-x-0.5" : "text-gray-300 group-hover:text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Accordion 2: Security Settings */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsSecurityAccordionOpen(!isSecurityAccordionOpen)}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-xs font-bold text-[#010101] hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            <span>Security Settings</span>
                          </div>
                          <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isSecurityAccordionOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>

                        {isSecurityAccordionOpen && (
                          <div className="bg-[#FAF9F6] border-t border-gray-100 divide-y divide-gray-100">
                            <button
                              type="button"
                              onClick={() => setAccountSubTab("passkeys")}
                              style={{ paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                              className={`relative w-full flex items-center justify-between text-xs transition-all cursor-pointer group ${
                                accountSubTab === "passkeys"
                                  ? "bg-[#EAE8E3] text-[#010101] font-bold"
                                  : "text-gray-600 hover:text-[#010101] hover:bg-gray-100/80 font-medium"
                              }`}
                            >
                              {accountSubTab === "passkeys" && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#010101]" />
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform ${
                                  accountSubTab === "passkeys" ? "bg-[#010101] scale-125" : "bg-gray-400 group-hover:bg-[#010101]"
                                }`} />
                                <span>Manage passkeys</span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "passkeys" ? "text-[#010101] translate-x-0.5" : "text-gray-300 group-hover:text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAccountSubTab("password")}
                              style={{ paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                              className={`relative w-full flex items-center justify-between text-xs transition-all cursor-pointer group ${
                                accountSubTab === "password"
                                  ? "bg-[#EAE8E3] text-[#010101] font-bold"
                                  : "text-gray-600 hover:text-[#010101] hover:bg-gray-100/80 font-medium"
                              }`}
                            >
                              {accountSubTab === "password" && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#010101]" />
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform ${
                                  accountSubTab === "password" ? "bg-[#010101] scale-125" : "bg-gray-400 group-hover:bg-[#010101]"
                                }`} />
                                <span>Change Password</span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "password" ? "text-[#010101] translate-x-0.5" : "text-gray-300 group-hover:text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAccountSubTab("pin")}
                              style={{ paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                              className={`relative w-full flex items-center justify-between text-xs transition-all cursor-pointer group ${
                                accountSubTab === "pin"
                                  ? "bg-[#EAE8E3] text-[#010101] font-bold"
                                  : "text-gray-600 hover:text-[#010101] hover:bg-gray-100/80 font-medium"
                              }`}
                            >
                              {accountSubTab === "pin" && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#010101]" />
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform ${
                                  accountSubTab === "pin" ? "bg-[#010101] scale-125" : "bg-gray-400 group-hover:bg-[#010101]"
                                }`} />
                                <span>Pin Settings</span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "pin" ? "text-[#010101] translate-x-0.5" : "text-gray-300 group-hover:text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAccountSubTab("delete")}
                              style={{ paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                              className={`relative w-full flex items-center justify-between text-xs transition-all cursor-pointer group ${
                                accountSubTab === "delete"
                                  ? "bg-[#FEF2F2] text-[#DC2626] font-bold"
                                  : "text-[#DC2626] hover:bg-red-50/60 font-medium"
                              }`}
                            >
                              {accountSubTab === "delete" && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#DC2626]" />
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform ${
                                  accountSubTab === "delete" ? "bg-[#DC2626] scale-125" : "bg-gray-400 group-hover:bg-[#DC2626]"
                                }`} />
                                <span>Delete Account</span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "delete" ? "text-[#DC2626] translate-x-0.5" : "text-gray-300 group-hover:text-[#DC2626]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Item 3: Marketing Preferences */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setAccountSubTab("marketing")}
                          className={`relative w-full flex items-center justify-between px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
                            accountSubTab === "marketing"
                              ? "bg-[#EAE8E3] text-[#010101]"
                              : "text-[#010101] hover:bg-gray-50"
                          }`}
                        >
                          {accountSubTab === "marketing" && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#010101]" />
                          )}
                          <div className="flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                            <span>Marketing Preferences</span>
                          </div>
                          <svg className={`w-3.5 h-3.5 transition-transform ${accountSubTab === "marketing" ? "text-[#010101] translate-x-0.5" : "text-gray-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Active Sub-Panel (lg:col-span-8) */}
                  <div className="lg:col-span-8 bg-transparent lg:bg-white border-0 lg:border lg:border-gray-200 rounded-none lg:rounded-xl p-0 sm:p-0 lg:p-7 shadow-none lg:shadow-2xs">
                    {/* SUB-VIEW 1: BASIC DETAILS (Images 2 & 3) */}
                    {accountSubTab === "basic" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pb-3 lg:pb-4 border-b border-gray-100">
                          <h3 className="hidden lg:block font-bold text-base sm:text-lg text-[#010101]">Profile Details</h3>
                          {!isEditingProfile && (
                            <button
                              type="button"
                              onClick={() => setIsEditingProfile(true)}
                              className="text-xs sm:text-sm font-bold text-[#010101] hover:text-[#8D730C] flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                            >
                              <span>Edit Profile</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {profileSavedMsg && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Profile details updated successfully!</span>
                          </div>
                        )}

                        {/* Read-Only Mode (Image 2) */}
                        {!isEditingProfile ? (
                          <div className="space-y-4">
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">First Name</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{firstName || "-"}</span>
                            </div>
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">Middle Name</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{middleName || "-"}</span>
                            </div>
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">Last Name</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{lastName || "-"}</span>
                            </div>
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">Email</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{customer?.email || user?.email || "-"}</span>
                            </div>
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">Gender</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{gender || "Male"}</span>
                            </div>
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">Birth date</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{birthDate || "-"}</span>
                            </div>
                            <div className="pb-3 border-b border-gray-200">
                              <span className="text-[11px] text-gray-500 font-medium block">Phone Number</span>
                              <span className="text-sm font-semibold text-[#010101] mt-0.5 block">{customer?.phone || newPhone || "-"}</span>
                            </div>
                          </div>
                        ) : (
                          /* Edit Mode (Image 3) */
                          <form onSubmit={handleSaveBasicProfile} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">First Name*</label>
                              <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#010101]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Middle Name</label>
                              <input
                                type="text"
                                value={middleName}
                                onChange={(e) => setMiddleName(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#010101]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Last Name*</label>
                              <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#010101]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                              <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#010101]"
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Birth date</label>
                              <input
                                type="date"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#010101]"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                              <button
                                type="button"
                                onClick={() => setIsEditingProfile(false)}
                                className="px-5 py-2 rounded-md border border-gray-300 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={savingProfile}
                                className="px-6 py-2 rounded-md bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                {savingProfile ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* SUB-VIEW 2: EDIT PHONE NUMBER */}
                    {accountSubTab === "phone" && (
                      <div className="space-y-6 text-center max-w-lg mx-auto py-4">
                        <div className="hidden lg:block space-y-2">
                          <h3 className="font-bold text-base sm:text-lg text-[#010101]">Current phone number</h3>
                          <p className="text-xs text-gray-600 leading-relaxed max-w-md mx-auto">
                            This is the phone number currently associated to your profile. You can change it by clicking on the button below.
                          </p>
                        </div>

                        {phoneSavedMsg && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-center gap-2 max-w-xs mx-auto">
                            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Phone number updated successfully!</span>
                          </div>
                        )}

                        {!isEditingPhone ? (
                          <div className="space-y-5">
                            <div className="flex items-center justify-center max-w-xs mx-auto border border-gray-300 rounded-md bg-gray-50 overflow-hidden">
                              <div className="px-3 py-2.5 border-r border-gray-300 text-xs font-bold text-gray-700 bg-gray-100 flex items-center gap-1">
                                <span>+234</span>
                                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </div>
                              <div className="px-4 py-2.5 text-sm font-bold text-[#010101] tracking-wide flex-1 text-left">
                                {(() => {
                                  const raw = customer?.phone || newPhone || "";
                                  const digits = raw.replace(/^\+234\s*/, "").replace(/^234\s*/, "").replace(/^0/, "");
                                  return digits || "9126433601";
                                })()}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingPhone(true);
                                setNewPhone("");
                              }}
                              className="w-full max-w-xs mx-auto py-2.5 rounded-md bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs"
                            >
                              Edit Phone Number
                            </button>
                          </div>
                        ) : (
                          (() => {
                            const currentPhoneRaw = customer?.phone || user?.phone || (user?.user_metadata?.phone as string) || "";
                            const currentPhoneDigits = currentPhoneRaw.replace(/\D/g, "").replace(/^234/, "").replace(/^0/, "");
                            const inputPhoneDigits = newPhone.replace(/\D/g, "").replace(/^234/, "").replace(/^0/, "");

                            // Legit Nigerian mobile phone format: exactly 10 digits starting with 70, 71, 80, 81, 90, 91
                            const isLegitPhone = /^[789][01]\d{8}$/.test(inputPhoneDigits);
                            const isSameAsCurrentPhone = inputPhoneDigits.length > 0 && inputPhoneDigits === currentPhoneDigits;
                            const canSendCode = isLegitPhone && !isSameAsCurrentPhone && !savingPhone;

                            return (
                              <form onSubmit={handleSendPhoneCode} className="space-y-4 max-w-xs mx-auto text-left">
                                <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">New Phone Number</label>
                                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:border-[#010101]">
                                    <span className="px-3 py-2.5 bg-gray-100 border-r border-gray-300 text-xs font-bold text-gray-700">+234</span>
                                    <input
                                      type="tel"
                                      required
                                      value={inputPhoneDigits}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                        setNewPhone(val);
                                      }}
                                      placeholder="9126433601"
                                      className="w-full px-3 py-2 text-sm font-semibold outline-none"
                                    />
                                  </div>

                                  {/* Validation feedback */}
                                  {isSameAsCurrentPhone && (
                                    <p className="text-[11px] text-amber-600 font-semibold mt-1.5 flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                      </svg>
                                      <span>This is already your current phone number.</span>
                                    </p>
                                  )}
                                  {!isSameAsCurrentPhone && inputPhoneDigits.length >= 10 && !isLegitPhone && (
                                    <p className="text-[11px] text-red-600 font-semibold mt-1.5 flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                      </svg>
                                      <span>Invalid prefix. Use a valid Nigerian number (e.g. 080, 081, 090, 091).</span>
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingPhone(false)}
                                    className="flex-1 py-2 rounded-md border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={!canSendCode}
                                    className="flex-1 py-2 rounded-md bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:hover:bg-[#010101] disabled:hover:text-white disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {savingPhone ? "Sending..." : "Send"}
                                  </button>
                                </div>
                              </form>
                            );
                          })()
                        )}

                        {/* 4-DIGIT PHONE OTP VERIFICATION MODAL */}
                        {showPhoneOtpModal && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl max-w-sm w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-gray-100 text-center animate-in zoom-in-95 duration-200">
                              <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[#010101]">
                                <svg className="w-6 h-6 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                                </svg>
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-base sm:text-lg font-bold text-[#010101]">
                                  Confirm your phone number
                                </h4>
                                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                                  We sent a 4-digit verification code to{" "}
                                  <span className="font-bold text-[#010101]">
                                    +234 {newPhone.replace(/^\+234\s*/, "").replace(/^234\s*/, "").replace(/^0/, "")}
                                  </span>
                                </p>
                              </div>

                              {phoneOtpError && (
                                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
                                  {phoneOtpError}
                                </div>
                              )}

                              {phoneOtpDevCode && (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-mono">
                                  [TEST CODE]: <strong>{phoneOtpDevCode}</strong>
                                </div>
                              )}

                              <div className="py-2 flex justify-center">
                                <PinInput
                                  value={phoneOtp}
                                  onChange={handleVerifyPhoneOtp}
                                  length={4}
                                  autoFocus
                                  disabled={phoneOtpLoading}
                                  idPrefix="phone-otp-box"
                                />
                              </div>

                              {phoneOtpLoading && (
                                <p className="text-xs text-gray-500 font-semibold animate-pulse">
                                  Verifying code...
                                </p>
                              )}

                              <div className="pt-1 flex items-center justify-between text-xs text-gray-500">
                                <button
                                  type="button"
                                  onClick={() => setShowPhoneOtpModal(false)}
                                  className="text-xs font-medium hover:text-black hover:underline cursor-pointer"
                                >
                                  Change number
                                </button>
                                {resendCooldown > 0 ? (
                                  <span className="text-gray-400 font-medium">
                                    Resend in {resendCooldown}s
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleResendPhoneCode}
                                    className="font-bold text-[#010101] hover:underline cursor-pointer"
                                  >
                                    Resend code
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-VIEW 3: CHANGE PASSWORD */}
                    {accountSubTab === "password" && (
                      <div className="space-y-6 max-w-md">
                        <div className="hidden lg:block pb-4 border-b border-gray-100">
                          <h3 className="font-bold text-base sm:text-lg text-[#010101]">Change Password</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Ensure your account is using a long, random password to stay secure.
                          </p>
                        </div>

                        {passwordMsg && (
                          <div className={`p-3 rounded-md text-xs font-bold flex items-center gap-2 ${
                            passwordMsg.type === "success"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                              : "bg-red-50 border border-red-200 text-red-800"
                          }`}>
                            <span>{passwordMsg.text}</span>
                          </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Current Password</label>
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#010101]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">New Password</label>
                            <input
                              type="password"
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="At least 6 characters"
                              className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#010101]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                            <input
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#010101]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={passwordLoading}
                            className="px-6 py-2.5 rounded-md bg-[#010101] text-white text-xs sm:text-sm font-bold hover:bg-[#EDCF5D] hover:text-[#010101] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            {passwordLoading ? "Updating..." : "Update Password"}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* SUB-VIEW 4: MANAGE PASSKEYS */}
                    {accountSubTab === "passkeys" && (
                      <div className="space-y-6 max-w-lg">
                        <div className="hidden lg:block pb-4 border-b border-gray-100">
                          <h3 className="font-bold text-base sm:text-lg text-[#010101]">Manage Passkeys</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Passkeys let you sign in safely using your fingerprint, face, device PIN, or screen lock.
                          </p>
                        </div>

                        {/* Status notification toast */}
                        {passkeyMsg && (
                          <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            passkeyMsg.type === "success"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                              : "bg-red-50 border border-red-200 text-red-800"
                          }`}>
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              {passkeyMsg.type === "success" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                              )}
                            </svg>
                            <span>{passkeyMsg.text}</span>
                          </div>
                        )}

                        {/* Registered Passkeys List */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-gray-700">Registered Devices ({passkeys.length})</h4>

                          {loadingPasskeys ? (
                            <div className="py-8 text-center text-xs text-gray-400">Loading registered passkeys...</div>
                          ) : passkeys.length === 0 ? (
                            <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50/50">
                              <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                                </svg>
                              </div>
                              <p className="text-xs font-bold text-[#010101] mb-1">No passkeys registered yet</p>
                              <p className="text-[11px] text-gray-500 max-w-xs mx-auto mb-4">
                                Register this device to sign in instantly with a passkey without typing passwords.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {passkeys.map((pk) => (
                                <div
                                  key={pk.id || pk.credential_id}
                                  className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between hover:border-gray-300 transition-colors shadow-2xs"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] border border-gray-200 flex items-center justify-center text-[#010101] shrink-0">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-2.18-5.742a7.465 7.465 0 00-4.57 2.056m10.14 0a7.465 7.465 0 00-4.57-2.056m0 0A7.472 7.472 0 0012 3a7.472 7.472 0 00-3.81 1.014" />
                                      </svg>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[#010101]">{pk.device_name || "Passkey Device"}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active" />
                                      </div>
                                      <span className="text-[10px] text-gray-400 block mt-0.5">
                                        Added {new Date(pk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDeletePasskey(pk.id || pk.credential_id, pk.device_name || "Device")}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                    title="Remove this passkey"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Add Passkey Action */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleRegisterPasskey}
                            disabled={registeringPasskey || !passkeyStatus.supported}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#010101] text-white text-xs sm:text-sm font-bold hover:bg-[#EDCF5D] hover:text-[#010101] transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {registeringPasskey ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                <span>Confirming on your device...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span>{passkeys.length > 0 ? "Add Another Passkey" : "Register This Device as Passkey"}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Security Explainer */}
                        <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100 text-[11px] text-gray-500 leading-relaxed">
                          <div className="font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            <span>Hardware-Grade Enclave Security</span>
                          </div>
                          Your passkey credentials never leave your device and are never stored on GTS servers. Passkeys protect against phishing, credential theft, and keylogging.
                        </div>
                      </div>
                    )}

                    {/* SUB-VIEW 5: PIN SETTINGS */}
                    {accountSubTab === "pin" && (
                      <div className="space-y-6 max-w-lg mx-auto py-2">
                        {/* Status notification toast */}
                        {pinMsg && (
                          <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 max-w-md mx-auto ${
                            pinMsg.type === "success"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                              : "bg-red-50 border border-red-200 text-red-800"
                          }`}>
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              {pinMsg.type === "success" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                              )}
                            </svg>
                            <span>{pinMsg.text}</span>
                          </div>
                        )}

                        {hasSavedPin && !isPinAuthenticated ? (
                          /* Screen 1: Authenticate with your PIN (matches user reference image) */
                          <div className="space-y-6 text-center max-w-md mx-auto py-6">
                            <div className="space-y-2">
                              <h3 className="font-bold text-lg sm:text-xl text-[#010101]">Authenticate with your PIN</h3>
                              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
                                Use your PIN for an easy and secure login
                              </p>
                            </div>

                            <div className="pt-2">
                              <PinInput
                                value={authPin}
                                onChange={handleVerifyCurrentPin}
                                length={6}
                                autoFocus
                                idPrefix="auth-pin"
                              />
                            </div>

                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={() => setShowForgotPinModal(true)}
                                className="text-xs font-bold text-gray-500 hover:text-[#010101] hover:underline transition-colors cursor-pointer"
                              >
                                Forgot your PIN? Reset with password
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Screen 2: Set up / Change your PIN */
                          <form onSubmit={handleSavePin} className="space-y-8 text-center">
                            {/* Row 1: Set up your PIN */}
                            <div className="space-y-3">
                              <h3 className="font-bold text-lg sm:text-xl text-[#010101]">
                                {hasSavedPin ? "Change your PIN" : "Set up your PIN"}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
                                Setup your PIN for an easy and secure login on GTS.
                              </p>
                              <div className="pt-2">
                                <PinInput
                                  value={setupPin}
                                  onChange={setSetupPin}
                                  length={6}
                                  autoFocus
                                  idPrefix="setup-pin"
                                />
                              </div>
                            </div>

                            {/* Row 2: Confirm your PIN */}
                            <div className="space-y-3 pt-2">
                              <h4 className="font-bold text-base sm:text-lg text-[#010101]">Confirm your PIN</h4>
                              <div className="pt-1">
                                <PinInput
                                  value={confirmPin}
                                  onChange={setConfirmPin}
                                  length={6}
                                  idPrefix="confirm-pin"
                                />
                              </div>
                            </div>

                            <div className="pt-2 flex items-center justify-center gap-3">
                              {hasSavedPin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPinAuthenticated(false);
                                    setSetupPin("");
                                    setConfirmPin("");
                                  }}
                                  className="px-6 py-3 rounded-md border border-gray-300 text-gray-700 text-xs sm:text-sm font-bold hover:bg-gray-100 transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                type="submit"
                                disabled={savingPin || setupPin.length !== 6 || confirmPin.length !== 6}
                                className="px-10 py-3 rounded-md bg-[#010101] text-white text-xs sm:text-sm font-bold hover:bg-[#EDCF5D] hover:text-[#010101] transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingPin ? "Saving PIN..." : "Save PIN"}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Forgot PIN Modal with Password Verification */}
                        {showForgotPinModal && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
                              <h4 className="text-sm font-bold text-[#010101]">Verify with Password</h4>
                              <p className="text-xs text-gray-500">
                                Enter your account password to unlock PIN reset.
                              </p>
                              <form onSubmit={handleResetPinWithPassword} className="space-y-3">
                                <input
                                  type="password"
                                  required
                                  placeholder="Your account password"
                                  value={resetPasswordInput}
                                  onChange={(e) => setResetPasswordInput(e.target.value)}
                                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:border-[#010101]"
                                />
                                <div className="flex items-center justify-end gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowForgotPinModal(false)}
                                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-black font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={resetPasswordLoading}
                                    className="px-4 py-1.5 text-xs font-bold bg-[#010101] text-white hover:bg-[#EDCF5D] hover:text-[#010101] rounded-md transition-colors cursor-pointer"
                                  >
                                    {resetPasswordLoading ? "Verifying..." : "Verify"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-VIEW 6: DELETE ACCOUNT */}
                    {accountSubTab === "delete" && (
                      <div className="max-w-xl mx-auto py-2 space-y-6">
                        <div className="text-center space-y-2">
                          <h3 className="hidden lg:block font-extrabold text-xl sm:text-2xl text-[#010101]">
                            We hate to see you go.
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                            Before you delete your account, we would want you to know that this action will delete your data across all GTS platforms. If that’s what you want, please proceed with entering your password to confirm that it’s you.
                          </p>
                        </div>

                        {deleteAccountError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{deleteAccountError}</span>
                          </div>
                        )}

                        <form onSubmit={handleInitiateDelete} autoComplete="off" className="space-y-4">
                          {/* Read-only email display (non-input to block browser credential autofill pairing) */}
                          <div className="w-full px-4 py-3 bg-gray-100/90 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-600 font-medium select-none">
                            {user?.email || customer?.email || ""}
                          </div>

                          {/* Password input with autofill prevention and eye toggle */}
                          <div className="relative">
                            <input
                              type={showDeletePassword ? "text" : "password"}
                              name="delete_confirm_verification_code"
                              id="delete_account_password_field"
                              autoComplete="new-password"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              data-form-type="other"
                              required
                              placeholder="Password"
                              value={deletePassword}
                              onChange={(e) => setDeletePassword(e.target.value)}
                              className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#010101] transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowDeletePassword(!showDeletePassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
                            >
                              {showDeletePassword ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              )}
                            </button>
                          </div>

                          {/* Close my account button */}
                          <button
                            type="submit"
                            className="w-full py-3.5 px-6 rounded-lg bg-[#010101] hover:bg-red-600 text-white font-bold text-sm sm:text-base transition-all duration-200 cursor-pointer shadow-xs"
                          >
                            Close my account
                          </button>
                        </form>

                        {/* Disclaimer Section */}
                        <div className="pt-2 border-t border-gray-100 space-y-3 text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                          <div>
                            <h5 className="font-bold text-gray-700 mb-0.5">Please read this carefully:</h5>
                            <p>
                              You are about to submit a request for us to permanently close your GTS account and delete your data. Once your account has been closed, all of the products and services accessed through your account will no longer be available to you, across any GTS sites globally.
                            </p>
                          </div>

                          <div>
                            <h5 className="font-bold text-gray-700 mb-1">
                              If you proceed with this request you will not be able to access products and services associated with your closed account, including:
                            </h5>
                            <ul className="list-disc pl-4 space-y-0.5 text-gray-500">
                              <li>GTS marketplace Account</li>
                              <li>GTS Orders & Purchase History</li>
                              <li>Saved Delivery Addresses & Preferences</li>
                              <li>Loyalty Rewards & Promotional Coupons</li>
                              <li>Account Reviews & Support Inquiries</li>
                            </ul>
                          </div>
                        </div>

                        {/* REASON DIALOG MODAL (with "rather not say" option) */}
                        {showDeleteReasonModal && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 overflow-hidden">
                              {/* Modal Header */}
                              <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-start justify-between border-b border-gray-100">
                                <div className="space-y-1">
                                  <h4 className="text-base sm:text-lg font-bold text-[#010101]">
                                    Why are you closing your account?
                                  </h4>
                                  <p className="text-xs text-gray-500 leading-relaxed">
                                    Help us understand your reason for leaving GTS so we can improve.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowDeleteReasonModal(false)}
                                  className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              {/* Scrollable Body */}
                              <div className="p-5 sm:p-6 py-4 overflow-y-auto flex-1 space-y-3.5">
                                <div className="space-y-2">
                                  {[
                                    "I no longer need this account",
                                    "I found a better alternative",
                                    "Too many emails or notifications",
                                    "Privacy or security concerns",
                                    "I had a bad customer experience",
                                    "I would rather not say",
                                  ].map((option) => (
                                    <label
                                      key={option}
                                      onClick={() => setDeleteReason(option)}
                                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                        deleteReason === option
                                          ? "border-[#010101] bg-gray-50/80 text-[#010101] shadow-xs"
                                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="delete_reason"
                                        value={option}
                                        checked={deleteReason === option}
                                        onChange={() => setDeleteReason(option)}
                                        className="w-4 h-4 text-[#010101] accent-[#010101] cursor-pointer"
                                      />
                                      <span>{option}</span>
                                    </label>
                                  ))}
                                </div>

                                {/* Optional notes textarea */}
                                <div className="space-y-1 pt-1">
                                  <label className="text-[11px] font-semibold text-gray-600">
                                    Tell us more (optional)
                                  </label>
                                  <textarea
                                    rows={2}
                                    placeholder="Any additional feedback for our team..."
                                    value={deleteNotes}
                                    onChange={(e) => setDeleteNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:border-[#010101] resize-none"
                                  />
                                </div>

                                {/* Confirmation Checkbox (Deliberate Cognitive Friction) */}
                                <label className="flex items-start gap-2.5 pt-1 text-xs text-gray-600 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={understoodPermanent}
                                    onChange={(e) => setUnderstoodPermanent(e.target.checked)}
                                    className="w-4 h-4 mt-0.5 rounded text-[#010101] accent-[#010101] cursor-pointer shrink-0"
                                  />
                                  <span className="text-[11px] text-gray-500 leading-tight">
                                    I understand that closing my account will permanently delete all order history and reward points.
                                  </span>
                                </label>

                                {/* Action Buttons: Inverted Visual Hierarchy */}
                                <div className="pt-3 border-t border-gray-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                  {/* Subdued Destructive Action (Low Affordance) */}
                                  <button
                                    type="button"
                                    disabled={!understoodPermanent || deletingAccount}
                                    onClick={handleConfirmPermanentDelete}
                                    className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-center"
                                  >
                                    {deletingAccount ? (
                                      <>
                                        <svg className="w-3.5 h-3.5 animate-spin text-red-600" viewBox="0 0 24 24" fill="none">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        <span className="text-red-600">Closing account...</span>
                                      </>
                                    ) : (
                                      <span>I still want to close my account</span>
                                    )}
                                  </button>

                                  {/* Hero Retention Button (Dominant Primary Action) */}
                                  <button
                                    type="button"
                                    disabled={deletingAccount}
                                    onClick={() => setShowDeleteReasonModal(false)}
                                    className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center text-center"
                                  >
                                    Keep my account
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-VIEW 7: MARKETING PREFERENCES */}
                    {accountSubTab === "marketing" && (
                      <div className="space-y-5 max-w-lg">
                        <div className="hidden lg:block pb-4 border-b border-gray-100">
                          <h3 className="font-bold text-base sm:text-lg text-[#010101]">Marketing Preferences</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Choose which notifications and updates you would like to receive.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                              <h4 className="text-xs font-bold text-[#010101]">Email Newsletters & Drops</h4>
                              <p className="text-[11px] text-gray-500 mt-0.5">Weekly curated edits and exclusive member early access.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleMarketing("email")}
                              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                newsletterEmail ? "bg-[#010101]" : "bg-gray-300"
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                                newsletterEmail ? "left-[22px]" : "left-0.5"
                              }`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                              <h4 className="text-xs font-bold text-[#010101]">Order SMS Alerts</h4>
                              <p className="text-[11px] text-gray-500 mt-0.5">Instant delivery and dispatch updates sent directly to your phone.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleMarketing("sms")}
                              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                smsAlerts ? "bg-[#010101]" : "bg-gray-300"
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                                smsAlerts ? "left-[22px]" : "left-0.5"
                              }`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                              <h4 className="text-xs font-bold text-[#010101]">Special Offers & Vouchers</h4>
                              <p className="text-[11px] text-gray-500 mt-0.5">Personalized discounts and seasonal flash sale alerts.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleMarketing("promos")}
                              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                promoDeals ? "bg-[#010101]" : "bg-gray-300"
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                                promoDeals ? "left-[22px]" : "left-0.5"
                              }`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: COOKIE PREFERENCES (Root Sidebar Tab) */}
            {activeTab === "cookies" && (
              <div className="space-y-6 max-w-4xl w-full">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/account")}
                    className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Back to Account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-[#010101]">Cookies Preferences</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Choose which cookies and tracking technologies you are comfortable with.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
                  <div className="space-y-6 pt-1">
                    {/* Option 1: Essential cookies */}
                    <label
                      onClick={() => setCookiePrefType("essential")}
                      className="flex items-start gap-3.5 cursor-pointer select-none group"
                    >
                      <input
                        type="radio"
                        name="cookie_choice_root"
                        value="essential"
                        checked={cookiePrefType === "essential"}
                        onChange={() => setCookiePrefType("essential")}
                        className="w-4 h-4 mt-1 text-[#010101] accent-[#010101] cursor-pointer"
                      />
                      <div className="space-y-1">
                        <h4 className="text-xs sm:text-sm font-bold text-[#010101] group-hover:text-[#010101]">
                          Essential cookies
                        </h4>
                        <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
                          Essential for the website to function. Enable shopping cart, secure checkout, and account access.
                        </p>
                      </div>
                    </label>

                    {/* Option 2: Optional Cookies */}
                    <div className="space-y-4">
                      <label
                        onClick={() => setCookiePrefType("optional")}
                        className="flex items-start gap-3.5 cursor-pointer select-none group"
                      >
                        <input
                          type="radio"
                          name="cookie_choice_root"
                          value="optional"
                          checked={cookiePrefType === "optional"}
                          onChange={() => setCookiePrefType("optional")}
                          className="w-4 h-4 mt-1 text-[#010101] accent-[#010101] cursor-pointer"
                        />
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-[#010101] group-hover:text-[#010101]">
                            Optional Cookies
                          </h4>
                        </div>
                      </label>

                      {/* Sub-toggles indented */}
                      <div className="pl-7 space-y-4 pt-1">
                        {/* Advertising Cookies */}
                        <div className="flex items-start gap-3.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={cookiePrefType === "optional" && cookieAdvertising}
                            disabled={cookiePrefType === "essential"}
                            onClick={() => setCookieAdvertising(!cookieAdvertising)}
                            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              cookiePrefType === "optional" && cookieAdvertising ? "bg-[#010101]" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                                cookiePrefType === "optional" && cookieAdvertising ? "left-[22px]" : "left-0.5"
                              }`}
                            />
                          </button>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-[#010101]">Advertising Cookies</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                              Allow us to show you relevant ads and promotional offers based on your interests.
                            </p>
                          </div>
                        </div>

                        {/* Analytics Cookies */}
                        <div className="flex items-start gap-3.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={cookiePrefType === "optional" && cookieAnalytics}
                            disabled={cookiePrefType === "essential"}
                            onClick={() => setCookieAnalytics(!cookieAnalytics)}
                            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              cookiePrefType === "optional" && cookieAnalytics ? "bg-[#010101]" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                                cookiePrefType === "optional" && cookieAnalytics ? "left-[22px]" : "left-0.5"
                              }`}
                            />
                          </button>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-[#010101]">Analytics Cookies</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                              Help us understand how you use our website so we can improve your shopping experience.
                            </p>
                          </div>
                        </div>

                        {/* Personalization Cookies */}
                        <div className="flex items-start gap-3.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={cookiePrefType === "optional" && cookiePersonalization}
                            disabled={cookiePrefType === "essential"}
                            onClick={() => setCookiePersonalization(!cookiePersonalization)}
                            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              cookiePrefType === "optional" && cookiePersonalization ? "bg-[#010101]" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                                cookiePrefType === "optional" && cookiePersonalization ? "left-[22px]" : "left-0.5"
                              }`}
                            />
                          </button>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-[#010101]">Personalization Cookies</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                              Remember your preferences like language, currency, and favorite products for a tailored experience.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notice paragraph with Privacy Policy link */}
                  <div className="pt-6 border-t border-gray-100 text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                    <p>
                      We use cookies and similar technologies to enhance your browsing experience, personalize content and ads, provide social media features, and analyze our traffic. Necessary cookies are essential for the website to function properly. Other cookies help us understand how you interact with our website, remember your preferences, and show you relevant offers. You can choose which cookies you&apos;re comfortable with. For more details, visit our{" "}
                      <Link href="/privacy" className="font-bold text-[#010101] hover:underline">
                        Privacy and Cookie Policy
                      </Link>
                    </p>
                  </div>

                  {/* Save Changes Button */}
                  <div className="pt-2 space-y-3">
                    {cookieSavedMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
                        <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Cookie preferences saved successfully!</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveCookiePreferences}
                      className="w-full py-3 rounded-lg bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer text-center"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: VOUCHERS & PROMOS */}
            {activeTab === "vouchers" && (
              <div className="space-y-6 max-w-4xl w-full">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/account")}
                    className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Back to Account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-[#010101]">Vouchers & Discounts</h2>
                    <p className="text-xs text-gray-500">
                      Copy and apply these active promo codes upon checkout.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      code: "GIFT50",
                      title: "GIFT VOUCHER",
                      discount: "50% OFF",
                      description: "Present this gift voucher upon payment and enjoy discount on any items.",
                      issuer: "Berry Clothing Co",
                      validity: "VALID UNTIL DECEMBER 2050",
                    },
                    {
                      code: "WELCOME10",
                      title: "GIFT VOUCHER",
                      discount: "10% OFF",
                      description: "Present this gift voucher upon payment and enjoy discount on your first order.",
                      issuer: "GTS Luxe Collection",
                      validity: "VALID UNTIL DECEMBER 2026",
                    },
                    {
                      code: "GTS20",
                      title: "GIFT VOUCHER",
                      discount: "20% OFF",
                      description: "Special seasonal promo for household appliances, lifestyle & groceries.",
                      issuer: "GTS Living Store",
                      validity: "VALID UNTIL DECEMBER 2026",
                    },
                  ].map((voucher) => (
                    <ScallopedTicket key={voucher.code}>
                      <div className="flex gap-2 sm:gap-3 mx-1 sm:mx-2">
                        {/* Main Left Frame */}
                        <div className="flex-1 border-2 border-[#D1BA8E] rounded-xl p-2.5 sm:p-3 relative flex flex-col justify-between min-h-[96px] sm:min-h-[108px] bg-[#FEF9EE]">
                          {/* Top-left Sparkles */}
                          <div className="absolute top-1.5 left-2 text-[#D1BA8E] flex gap-1 select-none pointer-events-none">
                            <span className="text-[10px]">✦</span>
                            <span className="text-[7px] translate-y-0.5">✦</span>
                          </div>

                          {/* Bottom-right Sparkles */}
                          <div className="absolute bottom-1.5 right-2 text-[#D1BA8E] flex gap-1 select-none pointer-events-none">
                            <span className="text-[7px] -translate-y-0.5">✦</span>
                            <span className="text-[10px]">✦</span>
                          </div>

                          {/* Title & Description */}
                          <div className="text-center px-2">
                            <h3 className="font-serif font-extrabold text-base sm:text-xl text-[#4A2E2B] tracking-wider uppercase">
                              {voucher.title}
                            </h3>
                            <p className="text-[10px] sm:text-[11.5px] text-gray-600 font-medium max-w-lg mx-auto mt-0.5 leading-snug">
                              {voucher.description}
                            </p>
                          </div>

                          {/* Footer / Copy Code */}
                          <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-[#D1BA8E]/30 mt-1 px-1">
                            <span className="text-[10px] sm:text-xs font-serif italic text-[#4A2E2B] font-semibold">
                              {voucher.issuer}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCoupon(voucher.code)}
                              className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full bg-[#4A2E2B] hover:bg-[#010101] text-white text-[10px] sm:text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <span>{voucher.code}</span>
                              <span className="text-[#EDCF5D]">
                                {copiedCoupon === voucher.code ? "✓ Copied" : "Copy"}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Right Stub Frame */}
                        <div className="w-20 sm:w-28 border-2 border-[#D1BA8E] rounded-xl p-1.5 sm:p-2.5 flex items-center justify-center gap-1 sm:gap-2 bg-[#FAF5E8] shrink-0">
                          <span className="text-base sm:text-lg font-black text-[#4A2E2B] font-serif tracking-wider [writing-mode:vertical-rl] rotate-180 select-none">
                            {voucher.discount}
                          </span>
                          <span className="text-[7px] sm:text-[8px] uppercase tracking-widest text-gray-500 font-bold [writing-mode:vertical-rl] rotate-180 select-none whitespace-nowrap">
                            {voucher.validity}
                          </span>
                        </div>
                      </div>
                    </ScallopedTicket>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: INBOX & REPLIES */}
            {activeTab === "inbox" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/account")}
                    className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Back to Account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-[#010101]">Inbox & Messages</h2>
                  </div>
                </div>

                {/* Sub-tabs: Messages | Order Updates | Replies */}
                <div className="grid grid-cols-3 border-b border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setInboxFilter("inquiries")}
                    className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                      inboxFilter === "inquiries"
                        ? "text-[#010101] border-[#EDCF5D]"
                        : "text-gray-400 border-transparent hover:text-gray-700"
                    }`}
                  >
                    Messages ({inboxItems.filter((it) => it.type === "inquiry").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilter("orders")}
                    className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                      inboxFilter === "orders"
                        ? "text-[#010101] border-[#EDCF5D]"
                        : "text-gray-400 border-transparent hover:text-gray-700"
                    }`}
                  >
                    Orders ({inboxItems.filter((it) => it.type === "order_advance").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilter("replies")}
                    className={`py-3 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                      inboxFilter === "replies"
                        ? "text-[#010101] border-[#EDCF5D]"
                        : "text-gray-400 border-transparent hover:text-gray-700"
                    }`}
                  >
                    Replies ({inboxItems.filter((it) => it.type === "review_reply").length})
                  </button>
                </div>

                {inboxLoading ? (
                  <div className="py-16 text-center">
                    <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-semibold text-gray-500">Loading your inbox...</p>
                  </div>
                ) : filteredInboxItems.length === 0 ? (
                  <div className="py-12 px-4 text-center max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-base text-[#010101] mb-1">
                      {inboxFilter === "inquiries"
                        ? "No Messages Yet"
                        : inboxFilter === "orders"
                        ? "No Order Notifications"
                        : "No Replies Yet"}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-6">
                      {inboxFilter === "inquiries"
                        ? "When you ask a question or chat on any product page, customer support messages will show up here."
                        : inboxFilter === "orders"
                        ? "When your order status advances (confirmed, processing, shipped, delivered), live tracking updates will appear here."
                        : "When someone or our team replies to your product reviews, notifications will appear here."}
                    </p>
                    <Link
                      href="/shop"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#010101] text-white font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md cursor-pointer"
                    >
                      Browse Products
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredInboxItems.map((item) => {
                      const isReview = item.type === "review_reply";
                      const isOrder = item.type === "order_advance";

                      const handleItemClick = () => {
                        if (isOrder) {
                          if (item.orderNumber) {
                            router.push(`/track?order_number=${encodeURIComponent(item.orderNumber)}`);
                          } else {
                            router.push("/account?tab=orders");
                          }
                        } else {
                          router.push(`/product/${item.productSlug}?tab=${item.targetTab}#${item.targetTab}`);
                        }
                      };

                      return (
                        <div
                          key={item.id}
                          onClick={handleItemClick}
                          className="group rounded-md border border-gray-200 bg-white p-3.5 sm:p-4 hover:border-gray-300 transition-all flex items-start justify-between gap-3.5 sm:gap-4 cursor-pointer relative"
                        >
                          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                            {/* Left Thumbnail */}
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-sm bg-gray-50 border border-gray-100 relative overflow-hidden shrink-0 flex items-center justify-center">
                              {isOrder ? (
                                <div className="w-full h-full bg-[#010101] text-[#EDCF5D] flex items-center justify-center">
                                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0c-.565.058-.987.538-.987 1.106v.958m12 0A2.25 2.25 0 0116.5 9.75v5.25m-12 0V9.75A2.25 2.25 0 016.75 7.5h7.5" />
                                  </svg>
                                </div>
                              ) : item.productImage ? (
                                <Image
                                  src={item.productImage}
                                  alt={item.productName}
                                  fill
                                  unoptimized
                                  className="object-contain p-1"
                                />
                              ) : (
                                <span className="text-xl">🛍️</span>
                              )}
                            </div>

                            {/* Middle Details */}
                            <div className="min-w-0 flex-1 pr-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {isOrder ? (
                                  <span className="bg-[#010101] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block font-mono">
                                    {item.orderStatus ? `Order ${item.orderStatus}` : "Order Update"}
                                  </span>
                                ) : isReview ? (
                                  <span className="bg-[#010101] text-[#EDCF5D] text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    Review Reply
                                  </span>
                                ) : item.lastSenderIsStaff ? (
                                  <span className="bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    Staff Replied
                                  </span>
                                ) : (
                                  <span className="bg-gray-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                                    Inquiry Sent
                                  </span>
                                )}
                                <span className="text-[11px] text-gray-400 font-normal">
                                  {new Date(item.lastMessageAt).toLocaleDateString("en-NG", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              <h4 className="text-xs sm:text-sm font-semibold text-[#010101] leading-snug line-clamp-1">
                                {item.productName}
                              </h4>

                              <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                                {item.lastSenderIsStaff && (
                                  <strong className="text-[#010101] font-semibold">GTS Staff: </strong>
                                )}
                                {isReview && (
                                  <strong className="text-[#010101] font-semibold">@{item.senderName || "User"}: </strong>
                                )}
                                {!item.lastSenderIsStaff && !isReview && !isOrder && (
                                  <strong className="text-gray-500 font-normal">You: </strong>
                                )}
                                <span>{item.lastMessage || "No message content"}</span>
                              </p>
                            </div>
                          </div>

                          {/* Top Right Action */}
                          <div className="shrink-0 self-start pt-0.5">
                            <span className="text-[#010101] group-hover:text-[#8D730C] text-xs sm:text-sm font-bold underline decoration-[#EDCF5D] decoration-2 underline-offset-4 flex items-center gap-1 transition-colors">
                              <span>{isOrder ? "Track Order" : isReview ? "View Reply" : "Open Chat"}</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: PENDING REVIEWS */}
            {activeTab === "reviews" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/account")}
                    className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-[#010101] rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Back to Account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-[#010101]">Pending Reviews</h2>
                  </div>
                </div>
                <div className="py-12 px-4 text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-full bg-[#EDCF5D]/30 text-[#010101] flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-base text-[#010101] mb-1">No Pending Reviews</h3>
                  <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-6">
                    You have reviewed all your delivered purchases, or haven&apos;t completed any orders yet.
                  </p>
                  <Link
                    href="/account?tab=orders"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#010101] text-white font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md cursor-pointer"
                  >
                    View Orders History
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD NEW ADDRESS ── */}
      {showAddAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base sm:text-lg text-[#010101]">
                {editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAddressModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Micah Okoh"
                  value={newAddrName}
                  onChange={(e) => setNewAddrName(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 font-medium outline-none focus:border-[#010101]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 913 511 8669"
                  value={newAddrPhone}
                  onChange={(e) => setNewAddrPhone(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 font-medium outline-none focus:border-[#010101]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12 Balogun Street, Victoria Island"
                  value={newAddrLine1}
                  onChange={(e) => setNewAddrLine1(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 font-medium outline-none focus:border-[#010101]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Victoria Island"
                    value={newAddrCity}
                    onChange={(e) => setNewAddrCity(e.target.value)}
                    className="w-full border rounded-xl px-3.5 py-2.5 font-medium outline-none focus:border-[#010101]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">State</label>
                  <select
                    value={newAddrState}
                    onChange={(e) => setNewAddrState(e.target.value)}
                    className="w-full border rounded-xl px-3.5 py-2.5 font-medium outline-none focus:border-[#010101] bg-white"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="defAddress"
                  checked={newAddrDefault}
                  onChange={(e) => setNewAddrDefault(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="defAddress" className="font-semibold text-gray-700 cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAddressModal(false)}
                  className="px-4 py-2.5 rounded-full border text-gray-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addrSubmitting}
                  className="px-6 py-2.5 rounded-full bg-[#010101] text-white font-bold hover:bg-[#EDCF5D] hover:text-[#010101] transition-all disabled:opacity-50"
                >
                  {addrSubmitting ? "Saving..." : editingAddressId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SELECT PICKUP STATION ── */}
      {showAddPickupStationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base sm:text-lg text-[#010101]">Select Pickup Station</h3>
              <button
                type="button"
                onClick={() => setShowAddPickupStationModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {GTS_PICKUP_STATIONS.map((station) => (
                <div
                  key={station.id}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-[#010101] transition-all flex items-center justify-between gap-3 bg-white hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectPickupStation(station)}
                >
                  <div>
                    <p className="font-bold text-sm text-[#010101]">{station.name}</p>
                    <p className="text-xs text-gray-600">{station.address}, {station.state}</p>
                    <p className="text-[11px] text-gray-400">{station.hours}</p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-[#010101] text-white font-bold text-xs shrink-0"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}



      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>}>
      <AccountContent />
    </Suspense>
  );
}
