import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";

const live: Record<string, { data: unknown; error: string | null; updatedAt: number | null; refresh: () => void }> = {};
vi.mock("../lib/use-live", () => ({
  useLive: (path: string) => live[path] ?? { data: null, error: null, updatedAt: null, refresh: () => undefined },
}));
vi.mock("next/link", () => ({ default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => <a href={href} onClick={onClick}>{children}</a> }));
vi.mock("../../lib/notifications", () => ({ isAdminInquiryUnread: (t: { lastSenderType: string }) => t.lastSenderType === "customer" }));

import { buildNotifications, NotificationBell, OnShiftAvatars } from "./live-status";

const COUNTS = { orders_to_ship: 3, whatsapp_waiting: 0, open_flags: 1, low_stock: 2 };

describe("buildNotifications", () => {
  it("lists only what needs attention, with real numbers and where to go", () => {
    const items = buildNotifications(COUNTS, 1);
    expect(items.map((i) => [i.title, i.href])).toEqual([
      ["3 orders ready to ship", "/admin/orders"],
      ["2 items running low", "/admin/inventory"],
      ["1 product flag open", "/admin/flags"],
      ["1 customer message waiting", "/admin/questions"],
    ]);
  });

  it("uses singular and plural correctly and skips zero counts", () => {
    expect(buildNotifications({ orders_to_ship: 0, whatsapp_waiting: 1, open_flags: 0, low_stock: 0 }, 0).map((i) => i.title)).toEqual(["1 WhatsApp order waiting for payment"]);
  });

  it("is empty when there is nothing to do", () => {
    expect(buildNotifications({ orders_to_ship: 0, whatsapp_waiting: 0, open_flags: 0, low_stock: 0 }, 0)).toEqual([]);
  });
});

describe("NotificationBell", () => {
  beforeEach(() => {
    for (const k of Object.keys(live)) delete live[k];
  });

  it("shows no badge before data arrives rather than a made-up number", () => {
    render(<NotificationBell />);
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("badges the total that needs attention, and follows the data", () => {
    live["/live/summary"] = { data: { counts: COUNTS, active_staff: [] }, error: null, updatedAt: 1, refresh: () => undefined };
    live["/inquiries?all=true"] = { data: [{ id: "t1", lastSenderType: "customer" }], error: null, updatedAt: 1, refresh: () => undefined };
    const { rerender } = render(<NotificationBell />);
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("7");
    live["/live/summary"] = { data: { counts: { ...COUNTS, orders_to_ship: 0 }, active_staff: [] }, error: null, updatedAt: 2, refresh: () => undefined };
    rerender(<NotificationBell />);
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("4");
  });

  it("opens a list of real items that link to their screens, and says when all is clear", () => {
    live["/live/summary"] = { data: { counts: COUNTS, active_staff: [] }, error: null, updatedAt: 1, refresh: () => undefined };
    const first = render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    const list = screen.getByRole("list", { name: /things to do/i });
    expect(within(list).getByRole("link", { name: /3 orders ready to ship/i })).toHaveAttribute("href", "/admin/orders");

    live["/live/summary"] = { data: { counts: { orders_to_ship: 0, whatsapp_waiting: 0, open_flags: 0, low_stock: 0 }, active_staff: [] }, error: null, updatedAt: 2, refresh: () => undefined };
    first.unmount();
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("says when it can't refresh, so a stale number isn't trusted", () => {
    live["/live/summary"] = { data: { counts: COUNTS, active_staff: [] }, error: "down", updatedAt: 1, refresh: () => undefined };
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/couldn't refresh/i)).toBeInTheDocument();
  });
});

describe("OnShiftAvatars", () => {
  it("shows the people who are actually on shift, by initial, with a tooltip of name and role", () => {
    live["/live/summary"] = {
      data: { counts: COUNTS, active_staff: [{ id: "u1", full_name: "Ada Obi", role: "cashier", last_action: "pos.sale", last_seen: "x" }, { id: "u2", full_name: null, role: "cashier", last_action: "auth.login", last_seen: "x" }] },
      error: null, updatedAt: 1, refresh: () => undefined,
    };
    render(<OnShiftAvatars />);
    expect(screen.getByTitle("Ada Obi · cashier")).toHaveTextContent("A");
    expect(screen.getAllByTestId("on-shift-avatar")).toHaveLength(2);
  });

  it("shows nothing when nobody is on shift", () => {
    live["/live/summary"] = { data: { counts: COUNTS, active_staff: [] }, error: null, updatedAt: 1, refresh: () => undefined };
    render(<OnShiftAvatars />);
    expect(screen.queryAllByTestId("on-shift-avatar")).toHaveLength(0);
  });

  it("collapses a long list to a +N chip", () => {
    live["/live/summary"] = {
      data: { counts: COUNTS, active_staff: Array.from({ length: 7 }, (_, i) => ({ id: `u${i}`, full_name: `P${i}`, role: "cashier", last_action: "pos.sale", last_seen: "x" })) },
      error: null, updatedAt: 1, refresh: () => undefined,
    };
    render(<OnShiftAvatars />);
    expect(screen.getAllByTestId("on-shift-avatar")).toHaveLength(4);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });
});
