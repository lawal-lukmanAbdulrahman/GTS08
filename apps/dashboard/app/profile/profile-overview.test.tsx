import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileOverview from "./profile-overview";
import type { SalesRecordView } from "../lib/staff-types";

const RECORD = {
  range: "today",
  since: "2026-09-20T00:00:00Z",
  summary: {
    sales: { count: 4, total: 6000000, average: 1500000 },
    by_payment_method: { cash: { count: 3, total: 4500000 }, pos_terminal: { count: 1, total: 1500000 } },
    by_channel: { walk_in: { count: 3, total: 4500000 }, whatsapp: { count: 1, total: 1500000 } },
    voided: { count: 1, total: 800000 },
    discounts_given: { count: 2, total: 250000 },
  },
  recent: [],
} as unknown as SalesRecordView;

const props = { name: "Dev", sales: RECORD, salesError: null, openFlags: 1, recentActivity: [], onOpen: vi.fn() };

describe("ProfileOverview", () => {
  it("greets the person by first name", () => {
    render(<ProfileOverview {...props} name="Dev Olareign" />);
    expect(screen.getByRole("heading", { name: /hello, dev/i })).toBeInTheDocument();
  });

  it("shows today's key figures", () => {
    render(<ProfileOverview {...props} />);
    expect(screen.getByText("₦60,000")).toBeInTheDocument(); // total sales
    expect(screen.getByText(/4 sales/i)).toBeInTheDocument();
    expect(screen.getByText("₦15,000")).toBeInTheDocument(); // average
    expect(screen.getByText("₦2,500")).toBeInTheDocument(); // discounts
    expect(screen.getByText("₦8,000")).toBeInTheDocument(); // voided
  });

  it("shows open flags and takes you to them", () => {
    const onOpen = vi.fn();
    render(<ProfileOverview {...props} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /1 open flag/i }));
    expect(onOpen).toHaveBeenCalledWith("flags");
  });

  it("links through to the full sales and activity views", () => {
    const onOpen = vi.fn();
    render(<ProfileOverview {...props} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /see all sales/i }));
    expect(onOpen).toHaveBeenCalledWith("sales");
    fireEvent.click(screen.getByRole("button", { name: /see all activity/i }));
    expect(onOpen).toHaveBeenCalledWith("activity");
  });

  it("shows the latest activity in words", () => {
    render(
      <ProfileOverview
        {...props}
        recentActivity={[{ id: "a1", action: "pos.sale", target_type: "order", target_id: "o", changes: { order_number: "GTS-202609-000001", total: 100000 }, created_at: "2026-09-20T10:00:00Z" }]}
      />
    );
    expect(screen.getByText(/GTS-202609-000001/)).toBeInTheDocument();
  });

  it("says so when there is nothing yet", () => {
    render(<ProfileOverview {...props} sales={null} recentActivity={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("shows a sales error instead of empty figures", () => {
    render(<ProfileOverview {...props} sales={null} salesError="Couldn't load your sales." />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load your sales/i);
  });
});
