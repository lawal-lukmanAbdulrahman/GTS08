import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isAdminInquiryUnread,
  markAdminInquiryViewed,
  getAdminViewedInquiries,
  getCustomerInboxSeenAt,
  markCustomerInboxSeen,
  getCustomerNotifications,
  addCustomerNotification,
  DEFAULT_BROADCAST,
} from "../lib/notifications";

describe("GTS Notification System", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("Admin Inquiry Badging & Read State", () => {
    it("marks customer message as unread when not yet viewed", () => {
      const ticket = {
        id: "tkt-001",
        lastSenderType: "customer",
        lastMessageAt: "2026-09-04T08:00:00.000Z",
      };
      expect(isAdminInquiryUnread(ticket)).toBe(true);
    });

    it("does not mark staff message as unread for admin", () => {
      const ticket = {
        id: "tkt-001",
        lastSenderType: "staff",
        lastMessageAt: "2026-09-04T08:00:00.000Z",
      };
      expect(isAdminInquiryUnread(ticket)).toBe(false);
    });

    it("clears unread badge once ticket is marked as viewed at latest message timestamp", () => {
      const ticket = {
        id: "tkt-002",
        lastSenderType: "customer",
        lastMessageAt: "2026-09-04T08:00:00.000Z",
      };
      expect(isAdminInquiryUnread(ticket)).toBe(true);

      // Admin views the inquiry
      markAdminInquiryViewed("tkt-002", "2026-09-04T08:00:00.000Z");

      expect(isAdminInquiryUnread(ticket)).toBe(false);
    });

    it("re-flags ticket as unread if customer sends a newer reply after admin viewed", () => {
      const ticket = {
        id: "tkt-003",
        lastSenderType: "customer",
        lastMessageAt: "2026-09-04T08:00:00.000Z",
      };
      markAdminInquiryViewed("tkt-003", "2026-09-04T08:00:00.000Z");
      expect(isAdminInquiryUnread(ticket)).toBe(false);

      // Customer sends a new message 10 minutes later
      const updatedTicket = {
        ...ticket,
        lastMessageAt: "2026-09-04T08:10:00.000Z",
      };
      expect(isAdminInquiryUnread(updatedTicket)).toBe(true);
    });
  });

  describe("Storefront Customer Inbox Seen Lifecycle", () => {
    it("records seen timestamp and dispatches gts_inbox_read", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      expect(getCustomerInboxSeenAt()).toBeNull();

      markCustomerInboxSeen();

      expect(getCustomerInboxSeenAt()).not.toBeNull();
      expect(dispatchSpy).toHaveBeenCalled();
    });
  });

  describe("Customer Notifications (Order Advancement & Reviews)", () => {
    it("adds an order advance notification and retrieves it", () => {
      const notif = addCustomerNotification({
        type: "order_advance",
        title: "Order #GTS-202609-000100 SHIPPED",
        message: "Your order has been dispatched with courier.",
        link: "/track?order_number=GTS-202609-000100",
        orderNumber: "GTS-202609-000100",
        orderStatus: "shipped",
      });

      expect(notif.id).toMatch(/^notif-/);
      expect(notif.orderNumber).toBe("GTS-202609-000100");

      const all = getCustomerNotifications();
      expect(all.length).toBe(1);
      expect(all[0]?.title).toContain("SHIPPED");
    });
  });

  describe("Broadcast Notification Config", () => {
    it("provides valid default broadcast parameters", () => {
      expect(DEFAULT_BROADCAST.ctaLabel).toBe("Visit Collection");
      expect(DEFAULT_BROADCAST.imageUrl).toBeTruthy();
      expect(DEFAULT_BROADCAST.isActive).toBe(true);
    });
  });
});
