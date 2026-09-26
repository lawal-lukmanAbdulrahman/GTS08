import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PermissionEditor from "./permission-editor";
import type { PermissionsView } from "../../../lib/staff-types";

const PERMS: PermissionsView = {
  can_process_pos: true,
  can_manage_inventory: false,
  can_view_all_orders: false,
  can_manage_products: false,
  can_handle_tickets: false,
  can_void_orders: false,
  can_apply_discounts: false,
  can_manage_broadcasts: false,
};

function setup(over: Partial<React.ComponentProps<typeof PermissionEditor>> = {}) {
  const props = {
    name: "Ada Obi",
    permissions: PERMS,
    isAdminAccount: false,
    isBlocked: false,
    onSavePermissions: vi.fn().mockResolvedValue({ ok: true }),
    onSetBlocked: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  };
  render(<PermissionEditor {...props} />);
  return props;
}

describe("PermissionEditor", () => {
  it("has a switch for every grant, reflecting what's currently allowed", () => {
    setup();
    expect(screen.getAllByRole("checkbox")).toHaveLength(8);
    expect(screen.getByRole("checkbox", { name: /use the point of sale/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /void/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /discount/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /manage broadcasts/i })).not.toBeChecked();
  });

  it("keeps Save off until something changes", () => {
    setup();
    expect(screen.getByRole("button", { name: /save permissions/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /void/i }));
    expect(screen.getByRole("button", { name: /save permissions/i })).toBeEnabled();
  });

  it("sends only what changed", async () => {
    const { onSavePermissions } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: /void/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /discount/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /use the point of sale/i }));
    fireEvent.click(screen.getByRole("button", { name: /save permissions/i }));
    await waitFor(() =>
      expect(onSavePermissions).toHaveBeenCalledWith({ can_void_orders: true, can_apply_discounts: true, can_process_pos: false })
    );
  });

  it("stops being 'changed' when a switch is put back", () => {
    setup();
    const box = screen.getByRole("checkbox", { name: /void/i });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(screen.getByRole("button", { name: /save permissions/i })).toBeDisabled();
  });

  it("confirms a save, and shows why one failed", async () => {
    setup({ onSavePermissions: vi.fn().mockResolvedValue({ ok: false, message: "Admin access can't be edited here." }) });
    fireEvent.click(screen.getByRole("checkbox", { name: /void/i }));
    fireEvent.click(screen.getByRole("button", { name: /save permissions/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be edited/i);
  });

  it("says saved on success", async () => {
    setup();
    fireEvent.click(screen.getByRole("checkbox", { name: /void/i }));
    fireEvent.click(screen.getByRole("button", { name: /save permissions/i }));
    expect(await screen.findByText(/permissions saved/i)).toBeInTheDocument();
  });

  it("is read-only for an admin account", () => {
    setup({ isAdminAccount: true });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText(/full access/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /block/i })).not.toBeInTheDocument();
  });

  it("asks before blocking, then blocks", async () => {
    const { onSetBlocked } = setup();
    fireEvent.click(screen.getByRole("button", { name: /block ada obi/i }));
    expect(onSetBlocked).not.toHaveBeenCalled();
    expect(screen.getByText(/signed out.*can't sign in/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /yes, block/i }));
    await waitFor(() => expect(onSetBlocked).toHaveBeenCalledWith(true));
  });

  it("can back out of blocking", () => {
    const { onSetBlocked } = setup();
    fireEvent.click(screen.getByRole("button", { name: /block ada obi/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep active/i }));
    expect(onSetBlocked).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /block ada obi/i })).toBeInTheDocument();
  });

  it("unblocks straight away", async () => {
    const { onSetBlocked } = setup({ isBlocked: true });
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    await waitFor(() => expect(onSetBlocked).toHaveBeenCalledWith(false));
  });
});
