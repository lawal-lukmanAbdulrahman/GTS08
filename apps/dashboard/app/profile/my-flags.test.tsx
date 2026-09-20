import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MyFlags, { type MyFlag } from "./my-flags";

const FLAGS: MyFlag[] = [
  { id: "f1", reason: "wrong_price", note: "Shelf says ₦80,000", status: "open", resolution_note: null, resolved_at: null, created_at: "2026-09-19T09:00:00Z", product: { name: "Air Fryer" } },
  { id: "f2", reason: "damaged", note: null, status: "resolved", resolution_note: "Replaced the unit", resolved_at: "2026-09-19T11:00:00Z", created_at: "2026-09-18T09:00:00Z", product: { name: "Blender" } },
];

describe("MyFlags", () => {
  it("lists each flag with the product, the reason and its status", () => {
    render(<MyFlags flags={FLAGS} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Air Fryer");
    expect(rows[0]).toHaveTextContent("Wrong price");
    expect(rows[0]).toHaveTextContent("Open");
    expect(rows[0]).toHaveTextContent("Shelf says ₦80,000");
  });

  it("shows the admin's note once a flag is resolved", () => {
    render(<MyFlags flags={FLAGS} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[1]).toHaveTextContent("Resolved");
    expect(rows[1]).toHaveTextContent("Replaced the unit");
  });

  it("says so when there are none", () => {
    render(<MyFlags flags={[]} />);
    expect(screen.getByText(/haven't flagged anything/i)).toBeInTheDocument();
  });

  it("copes with a product that has since been removed", () => {
    render(<MyFlags flags={[{ ...FLAGS[0]!, product: null }]} />);
    expect(screen.getByText(/removed product/i)).toBeInTheDocument();
  });

  it("shows loading and error states", () => {
    const { rerender } = render(<MyFlags flags={[]} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    rerender(<MyFlags flags={[]} error="Couldn't load flags." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load flags.");
  });
});
