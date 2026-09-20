import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SalesPanel from "./sales-panel";
import type { SalesRecordView } from "../../lib/staff-types";

const RECORD: SalesRecordView = {
  range: "today",
  since: "2026-09-18T23:00:00.000Z",
  summary: {
    sales: { count: 3, total: 4000000, average: 1333333 },
    by_payment_method: { cash: { count: 2, total: 1500000 }, pos_terminal: { count: 1, total: 2500000 } },
    by_channel: { walk_in: { count: 2, total: 1500000 }, whatsapp: { count: 1, total: 2500000 } },
    voided: { count: 1, total: 700000 },
    discounts_given: { count: 1, total: 150000 },
  },
  recent: [
    { order_number: "GTS-2", channel: "whatsapp", status: "completed", payment_method: "pos_terminal", amount: 2500000, created_at: "2026-09-19T09:00:00Z" },
    { order_number: "GTS-9", channel: "walk_in", status: "voided", payment_method: "cash", amount: 700000, created_at: "2026-09-19T08:00:00Z" },
  ],
};

const base = { range: "today" as const, onRangeChange: vi.fn(), record: RECORD };

describe("SalesPanel", () => {
  it("shows total sales, count and average", () => {
    render(<SalesPanel {...base} />);
    const total = screen.getByTestId("stat-sales");
    expect(total).toHaveTextContent("₦40,000");
    expect(total).toHaveTextContent("3 sales");
    expect(total).toHaveTextContent("₦13,333.33 average");
  });

  it("splits sales by how they were paid and where they came from", () => {
    render(<SalesPanel {...base} />);
    expect(screen.getByTestId("stat-cash")).toHaveTextContent("₦15,000");
    expect(screen.getByTestId("stat-card")).toHaveTextContent("₦25,000");
    expect(screen.getByTestId("stat-walk_in")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-whatsapp")).toHaveTextContent("₦25,000");
  });

  it("reports voids and discounts separately from sales", () => {
    render(<SalesPanel {...base} />);
    expect(screen.getByTestId("stat-voided")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-voided")).toHaveTextContent("₦7,000");
    expect(screen.getByTestId("stat-discounts")).toHaveTextContent("₦1,500");
  });

  it("lists recent sales and marks voided ones", () => {
    render(<SalesPanel {...base} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("GTS-2");
    expect(rows[0]).toHaveTextContent("₦25,000");
    expect(within(rows[1]!).getByText("Voided")).toBeInTheDocument();
  });

  it("switches range", () => {
    const onRangeChange = vi.fn();
    render(<SalesPanel {...base} onRangeChange={onRangeChange} />);
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(onRangeChange).toHaveBeenCalledWith("week");
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    expect(onRangeChange).toHaveBeenCalledWith("month");
  });

  it("shows zeros, not blanks, when there are no sales", () => {
    const empty: SalesRecordView = {
      ...RECORD,
      summary: {
        sales: { count: 0, total: 0, average: 0 },
        by_payment_method: { cash: { count: 0, total: 0 }, pos_terminal: { count: 0, total: 0 } },
        by_channel: { walk_in: { count: 0, total: 0 }, whatsapp: { count: 0, total: 0 } },
        voided: { count: 0, total: 0 },
        discounts_given: { count: 0, total: 0 },
      },
      recent: [],
    };
    render(<SalesPanel {...base} record={empty} />);
    expect(screen.getByTestId("stat-sales")).toHaveTextContent("₦0");
    expect(screen.getByText(/no sales in this period/i)).toBeInTheDocument();
  });

  it("uses the singular for one sale", () => {
    render(<SalesPanel {...base} record={{ ...RECORD, summary: { ...RECORD.summary, sales: { count: 1, total: 100, average: 100 } } }} />);
    expect(screen.getByTestId("stat-sales")).toHaveTextContent("1 sale");
    expect(screen.getByTestId("stat-sales")).not.toHaveTextContent("1 sales");
  });

  it("shows loading and error states", () => {
    const { rerender } = render(<SalesPanel {...base} record={null} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    rerender(<SalesPanel {...base} record={null} error="Couldn't load sales." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load sales.");
  });
});
