import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddStaffForm from "./add-staff-form";

const CREATED = { id: "n1", email: "ada@example.com", full_name: "Ada Obi", role: "cashier", temporary_password: "Xy12abc!" };

function setup(over: Partial<React.ComponentProps<typeof AddStaffForm>> = {}) {
  const props = { onCreate: vi.fn().mockResolvedValue({ ok: true, data: CREATED }), onClose: vi.fn(), onDone: vi.fn(), ...over };
  render(<AddStaffForm {...props} />);
  return props;
}
const fill = (name = "Ada Obi", email = "ada@example.com") => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
};

describe("AddStaffForm", () => {
  it("starts as a cashier with only POS access ticked", () => {
    setup();
    expect(screen.getByLabelText(/role/i)).toHaveValue("cashier");
    expect(screen.getByRole("checkbox", { name: /use the point of sale/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /void/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /manage broadcasts/i })).not.toBeChecked();
  });

  it("offers cashier and admin, but not inventory staff (that portal isn't built yet)", () => {
    setup();
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Cashier", "Admin"]);
  });

  it("explains that an admin has full access instead of showing switches", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: "admin" } });
    // Only the welcome-message option remains; no permission switches.
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: /include the one-time password/i })).toBeInTheDocument();
    expect(screen.getByText(/full access/i)).toBeInTheDocument();
  });

  it("won't submit until name and email are valid, and says what's wrong", async () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/enter their full name/i)).toBeInTheDocument();
    expect(screen.getByText(/enter their email/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("submits the cleaned details with the chosen grants", async () => {
    const { onCreate } = setup();
    fill("  Ada  Obi ", "Ada@Example.com");
    fireEvent.click(screen.getByRole("checkbox", { name: /void/i }));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect((onCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({
      email: "ada@example.com",
      full_name: "Ada Obi",
      role: "cashier",
      permissions: { can_process_pos: true, can_void_orders: true, can_apply_discounts: false },
    });
  });

  it("shows the one-time password after creating, and warns it won't be shown again", async () => {
    setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Xy12abc!")).toBeInTheDocument();
    expect(screen.getByText(/won't be shown again/i)).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("asks the server to email the password only when the box is ticked", async () => {
    const { onCreate } = setup();
    fill();
    const box = screen.getByRole("checkbox", { name: /include the one-time password/i });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect((onCreate as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toEqual({ emailCredentials: true });
  });

  it("does not ask for the password to be emailed by default", async () => {
    const { onCreate } = setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect((onCreate as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toEqual({ emailCredentials: false });
  });

  it("says whether the welcome email went out", async () => {
    setup({ onCreate: vi.fn().mockResolvedValue({ ok: true, data: { ...CREATED, email_delivery: { sent: true, skipped: false } } }) });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/welcome email sent to ada@example.com/i)).toBeInTheDocument();
  });

  it("tells the admin to hand over the password when email isn't set up", async () => {
    setup({ onCreate: vi.fn().mockResolvedValue({ ok: true, data: { ...CREATED, email_delivery: { sent: false, skipped: true } } }) });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/email isn't set up/i)).toBeInTheDocument();
  });

  it("refreshes the list only when the credentials are dismissed", async () => {
    const { onDone } = setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByText("Xy12abc!");
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onDone).toHaveBeenCalled();
  });

  it("puts a server refusal on the field it names", async () => {
    setup({ onCreate: vi.fn().mockResolvedValue({ ok: false, message: "Someone already has an account with that email.", errors: { email: "That email is already in use." } }) });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
    expect(screen.queryByText("Xy12abc!")).not.toBeInTheDocument();
  });

  it("shows a general failure and keeps what was typed", async () => {
    setup({ onCreate: vi.fn().mockResolvedValue({ ok: false, message: "Only the super admin can do this." }) });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/only the super admin/i);
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Ada Obi");
  });

  it("stops double submits while creating", async () => {
    let release!: (v: unknown) => void;
    const onCreate = vi.fn().mockReturnValue(new Promise((r) => (release = r)));
    setup({ onCreate });
    fill();
    const btn = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled());
    release({ ok: true, data: CREATED });
  });
});
