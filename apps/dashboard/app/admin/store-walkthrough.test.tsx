import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StoreWalkthrough from "./store-walkthrough";

// Mock authFetch
const mockAuthFetch = vi.fn();
vi.mock("../lib/session", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe("StoreWalkthrough", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthFetch.mockReset().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it("renders the floating bottom dialog with the initial steps left", async () => {
    render(<StoreWalkthrough />);
    expect(screen.getByText("Store Setup Guide")).toBeInTheDocument();
    expect(screen.getByText("6 steps remaining")).toBeInTheDocument();
    expect(screen.getByText("0 of 6 done")).toBeInTheDocument();
  });

  it("opens the left panel drawer when clicking View Checklist", async () => {
    render(<StoreWalkthrough />);
    const viewBtn = screen.getByRole("button", { name: /view checklist/i });
    fireEvent.click(viewBtn);

    expect(screen.getByText("Store Setup Checklist")).toBeInTheDocument();
    expect(screen.getByText("Add your first product")).toBeInTheDocument();
    expect(screen.getByText("Manage inventory & stock")).toBeInTheDocument();
    expect(screen.getByText("Setup employees & staff")).toBeInTheDocument();
    expect(screen.getByText("Configure pickup stations")).toBeInTheDocument();
    expect(screen.getByText("Launch your first promo code")).toBeInTheDocument();
    expect(screen.getByText("Store profile & contact details")).toBeInTheDocument();
  });

  it("toggles step completion and updates progress", async () => {
    render(<StoreWalkthrough />);
    fireEvent.click(screen.getByRole("button", { name: /view checklist/i }));

    const markButtons = screen.getAllByTitle("Mark completed");
    expect(markButtons.length).toBeGreaterThan(0);

    // Toggle the first step (Add product)
    fireEvent.click(markButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText("1 / 6 (17%)")).toBeInTheDocument();
      expect(screen.getAllByText("5 steps remaining").length).toBeGreaterThanOrEqual(1);
    });

    // Check localStorage saved state
    const saved = JSON.parse(localStorage.getItem("gts_store_walkthrough_state") || "{}");
    expect(saved.add_product).toBe(true);
  });

  it("can minimize and restore the floating bottom widget", async () => {
    render(<StoreWalkthrough />);
    const minBtn = screen.getByTitle("Minimize guide");
    fireEvent.click(minBtn);

    // Should be in minimized pill state
    expect(screen.getByTitle("Open Store Setup Guide")).toBeInTheDocument();
    expect(screen.queryByText("Store Setup Guide")).not.toBeInTheDocument();

    // Click pill to restore
    fireEvent.click(screen.getByTitle("Open Store Setup Guide"));
    expect(screen.getByText("Store Setup Guide")).toBeInTheDocument();
  });

  it("resets checklist on clicking Reset Checklist", async () => {
    localStorage.setItem("gts_store_walkthrough_state", JSON.stringify({ add_product: true, setup_staff: true }));
    render(<StoreWalkthrough />);

    fireEvent.click(screen.getByRole("button", { name: /view checklist/i }));
    expect(screen.getByText("2 / 6 (33%)")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /reset checklist/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText("0 / 6 (0%)")).toBeInTheDocument();
    expect(screen.getAllByText("6 steps remaining").length).toBeGreaterThanOrEqual(1);
  });
});
