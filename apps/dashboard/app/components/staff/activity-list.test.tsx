import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ActivityList from "./activity-list";

const ENTRIES = [
  { id: "a2", action: "pos.void", target_type: "order", target_id: "o1", changes: { reason: "wrong item" }, created_at: "2026-09-19T10:00:00Z" },
  { id: "a1", action: "pos.sale", target_type: "order", target_id: "o1", changes: { order_number: "GTS-1", total: 4500000, payment_method: "cash", item_count: 1 }, created_at: "2026-09-19T09:00:00Z" },
];

describe("ActivityList", () => {
  it("shows each action as a sentence with its details, newest first", () => {
    render(<ActivityList entries={ENTRIES} />);
    const titles = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(titles[0]).toContain("Voided a sale");
    expect(titles[0]).toContain("Reason: wrong item");
    expect(titles[1]).toContain("Sold order GTS-1");
    expect(titles[1]).toContain("₦45,000 · cash · 1 item");
  });

  it("shows when each thing happened, in Lagos time", () => {
    render(<ActivityList entries={ENTRIES} />);
    expect(screen.getByText(/19 Sept 2026, 11:00 am/)).toBeInTheDocument();
  });

  it("says so when there's nothing yet", () => {
    render(<ActivityList entries={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("shows a loading state and an error", () => {
    const { rerender } = render(<ActivityList entries={[]} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    rerender(<ActivityList entries={[]} error="Couldn't load activity." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load activity.");
  });

  it("offers 'Load more' only when there are more, and asks for them", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<ActivityList entries={ENTRIES} />);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    rerender(<ActivityList entries={ENTRIES} hasMore onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
