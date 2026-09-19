import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import StaffMenu from "./staff-menu";

const cashier = { name: "Ada Cashier", role: "cashier", isAdmin: false, canUsePos: true, onSignOut: vi.fn() };

describe("StaffMenu", () => {
  it("shows who is signed in, with a role badge, and starts closed", () => {
    render(<StaffMenu {...cashier} />);
    expect(screen.getByRole("button", { name: /ada cashier/i })).toBeInTheDocument();
    expect(screen.getByText("cashier")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows initials as the avatar", () => {
    render(<StaffMenu {...cashier} />);
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("falls back gracefully when the name isn't known", () => {
    render(<StaffMenu {...cashier} name="" />);
    expect(screen.getByRole("button", { name: /staff member/i })).toBeInTheDocument();
  });

  it("opens to profile, POS and sign out for a cashier — no admin link", () => {
    render(<StaffMenu {...cashier} current="profile" />);
    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /my profile/i })).toHaveAttribute("href", "/profile");
    expect(within(menu).getByRole("menuitem", { name: /point of sale/i })).toHaveAttribute("href", "/pos");
    expect(within(menu).queryByRole("menuitem", { name: /admin/i })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("only shows the POS link to people who can use it", () => {
    render(<StaffMenu {...cashier} canUsePos={false} />);
    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    expect(screen.queryByRole("menuitem", { name: /point of sale/i })).not.toBeInTheDocument();
  });

  it("doesn't link to the page you're already on", () => {
    render(<StaffMenu {...cashier} current="pos" />);
    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    expect(screen.queryByRole("menuitem", { name: /point of sale/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /my profile/i })).toBeInTheDocument();
  });

  it("shows the admin dashboard link to admins only", () => {
    render(<StaffMenu {...cashier} role="admin" isAdmin />);
    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    expect(screen.getByRole("menuitem", { name: /admin dashboard/i })).toHaveAttribute("href", "/admin");
  });

  it("signs out and closes", () => {
    const onSignOut = vi.fn();
    render(<StaffMenu {...cashier} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and on a click elsewhere", () => {
    render(
      <div>
        <StaffMenu {...cashier} />
        <p>elsewhere</p>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ada cashier/i }));
    fireEvent.mouseDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("tells assistive tech whether it's expanded", () => {
    render(<StaffMenu {...cashier} />);
    const button = screen.getByRole("button", { name: /ada cashier/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
