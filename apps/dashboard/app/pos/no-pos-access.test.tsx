import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import NoPosAccess from "./no-pos-access";

describe("NoPosAccess", () => {
  it("says plainly what's wrong and what to do", () => {
    render(<NoPosAccess name="Ada" isAdmin={false} onSignOut={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /don.t have access to the point of sale/i })).toBeInTheDocument();
    expect(screen.getByText(/ask an admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
  });

  it("lets them sign out", () => {
    const onSignOut = vi.fn();
    render(<NoPosAccess name="" isAdmin={false} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("points an admin at the staff screen where access is granted", () => {
    render(<NoPosAccess name="Boss" isAdmin onSignOut={vi.fn()} />);
    expect(screen.getByRole("link", { name: /staff/i })).toHaveAttribute("href", "/admin/staff");
  });
});
