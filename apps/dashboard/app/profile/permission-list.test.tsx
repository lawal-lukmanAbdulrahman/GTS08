import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PermissionList from "./permission-list";
import type { PermissionsView } from "../lib/staff-types";

const NONE: PermissionsView = {
  can_process_pos: false,
  can_manage_inventory: false,
  can_view_all_orders: false,
  can_manage_products: false,
  can_handle_tickets: false,
  can_void_orders: false,
  can_apply_discounts: false,
  can_manage_broadcasts: false,
};

describe("PermissionList (what this person can access)", () => {
  it("lists what a cashier can do and what needs an admin's approval", () => {
    render(<PermissionList permissions={{ ...NONE, can_process_pos: true, can_void_orders: true }} isAdmin={false} />);
    const can = screen.getByRole("list", { name: /you can/i });
    expect(can).toHaveTextContent("Use the point of sale");
    expect(can).toHaveTextContent("Void your own sales");
    const cannot = screen.getByRole("list", { name: /ask an admin/i });
    expect(cannot).toHaveTextContent("Apply manual discounts");
    expect(cannot).not.toHaveTextContent("Use the point of sale");
  });

  it("always includes what every staff member can do", () => {
    render(<PermissionList permissions={NONE} isAdmin={false} />);
    const can = screen.getByRole("list", { name: /you can/i });
    expect(can).toHaveTextContent(/update your phone number/i);
    expect(can).toHaveTextContent(/change your password/i);
  });

  it("only offers flagging a product to people who can use the POS", () => {
    const { rerender } = render(<PermissionList permissions={NONE} isAdmin={false} />);
    expect(screen.getByRole("list", { name: /you can/i })).not.toHaveTextContent(/flag a product/i);
    rerender(<PermissionList permissions={{ ...NONE, can_process_pos: true }} isAdmin={false} />);
    expect(screen.getByRole("list", { name: /you can/i })).toHaveTextContent(/flag a product/i);
  });

  it("says admins have full access and shows no 'ask an admin' list", () => {
    render(<PermissionList permissions={{ ...NONE, can_process_pos: true }} isAdmin />);
    expect(screen.getByText(/full access/i)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /ask an admin/i })).not.toBeInTheDocument();
  });

  it("explains the discount limit", () => {
    render(<PermissionList permissions={{ ...NONE, can_process_pos: true, can_apply_discounts: true }} isAdmin={false} />);
    expect(screen.getByRole("list", { name: /you can/i })).toHaveTextContent(/up to 20%/i);
  });
});
