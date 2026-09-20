import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileSidebar, { PROFILE_SECTIONS } from "./profile-sidebar";

const base = {
  name: "Dev Olareign",
  email: "dev@gts.ng",
  phone: "0803 123 4567",
  role: "cashier",
  section: "overview" as const,
  onSelect: vi.fn(),
  onSignOut: vi.fn(),
  todayTotal: 4500000,
  todayCount: 3,
  openFlags: 0,
  showFlags: true,
};

describe("ProfileSidebar", () => {
  it("introduces the person: initials, name, role, email and phone", () => {
    render(<ProfileSidebar {...base} />);
    expect(screen.getByText("DO")).toBeInTheDocument();
    expect(screen.getByText("Dev Olareign")).toBeInTheDocument();
    expect(screen.getByText(/cashier/i)).toBeInTheDocument();
    expect(screen.getByText("dev@gts.ng")).toBeInTheDocument();
    expect(screen.getByText("0803 123 4567")).toBeInTheDocument();
  });

  it("shows today's takings at a glance", () => {
    render(<ProfileSidebar {...base} />);
    expect(screen.getByText("₦45,000")).toBeInTheDocument();
    expect(screen.getByText(/3 sales today/i)).toBeInTheDocument();
  });

  it("lists every section and marks the current one", () => {
    render(<ProfileSidebar {...base} section="sales" />);
    const nav = screen.getByRole("navigation", { name: /profile sections/i });
    for (const s of PROFILE_SECTIONS) expect(within(nav).getByRole("button", { name: new RegExp(s.label, "i") })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /my sales/i })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: /overview/i })).not.toHaveAttribute("aria-current");
  });

  it("switches section when one is chosen", () => {
    const onSelect = vi.fn();
    render(<ProfileSidebar {...base} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /activity/i }));
    expect(onSelect).toHaveBeenCalledWith("activity");
  });

  it("badges the number of open flags", () => {
    render(<ProfileSidebar {...base} openFlags={2} />);
    expect(screen.getByRole("button", { name: /product flags/i })).toHaveTextContent("2");
  });

  it("hides the flags section for someone who can't use the till", () => {
    render(<ProfileSidebar {...base} showFlags={false} />);
    expect(screen.queryByRole("button", { name: /product flags/i })).not.toBeInTheDocument();
  });

  it("lets them sign out", () => {
    const onSignOut = vi.fn();
    render(<ProfileSidebar {...base} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("copes with no name, phone or figures yet", () => {
    render(<ProfileSidebar {...base} name="" phone={null} todayTotal={null} todayCount={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText(/no phone number/i)).toBeInTheDocument();
    expect(screen.queryByText(/sales today/i)).not.toBeInTheDocument();
  });
});
