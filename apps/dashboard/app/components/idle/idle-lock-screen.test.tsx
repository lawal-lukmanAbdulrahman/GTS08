import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import IdleLockScreen from "./idle-lock-screen";

const base = { name: "Ada Cashier", onStay: vi.fn(), onUnlock: vi.fn(), onSignOut: vi.fn() };

describe("IdleLockScreen", () => {
  it("renders nothing while the person is active", () => {
    const { container } = render(<IdleLockScreen {...base} state="active" />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("warning", () => {
    it("warns without blocking the till, and lets them stay logged in", () => {
      const onStay = vi.fn();
      render(<IdleLockScreen {...base} state="warning" onStay={onStay} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/lock in 5 minutes/i);
      fireEvent.click(screen.getByRole("button", { name: /stay logged in/i }));
      expect(onStay).toHaveBeenCalled();
    });
  });

  describe("locked", () => {
    it("covers the page with a modal that names the person and reassures about the cart", () => {
      render(<IdleLockScreen {...base} state="locked" />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveTextContent(/screen locked/i);
      expect(dialog).toHaveTextContent("Ada Cashier");
      expect(dialog).toHaveTextContent(/cart is kept/i);
    });

    it("keeps Unlock disabled until a password is typed", () => {
      render(<IdleLockScreen {...base} state="locked" />);
      expect(screen.getByRole("button", { name: /unlock/i })).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "x" } });
      expect(screen.getByRole("button", { name: /unlock/i })).toBeEnabled();
    });

    it("unlocks with the right password", async () => {
      const onUnlock = vi.fn().mockResolvedValue({ ok: true });
      render(<IdleLockScreen {...base} state="locked" onUnlock={onUnlock} />);
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Secret123!" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
      await waitFor(() => expect(onUnlock).toHaveBeenCalledWith("Secret123!"));
    });

    it("also unlocks when Enter is pressed in the password field", async () => {
      const onUnlock = vi.fn().mockResolvedValue({ ok: true });
      render(<IdleLockScreen {...base} state="locked" onUnlock={onUnlock} />);
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Secret123!" } });
      fireEvent.submit(screen.getByLabelText(/password/i).closest("form")!);
      await waitFor(() => expect(onUnlock).toHaveBeenCalled());
    });

    it("shows why a wrong password failed and stays locked", async () => {
      const onUnlock = vi.fn().mockResolvedValue({ ok: false, message: "That password isn't right. Try again." });
      render(<IdleLockScreen {...base} state="locked" onUnlock={onUnlock} />);
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "nope" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent("That password isn't right.");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("prevents double submits while checking", async () => {
      let finish!: (v: unknown) => void;
      const onUnlock = vi.fn(() => new Promise((res) => (finish = res)));
      render(<IdleLockScreen {...base} state="locked" onUnlock={onUnlock as never} />);
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
      expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: /checking/i }));
      expect(onUnlock).toHaveBeenCalledTimes(1);
      finish({ ok: true });
    });

    it("clears the typed password after a failed attempt", async () => {
      const onUnlock = vi.fn().mockResolvedValue({ ok: false, message: "nope" });
      render(<IdleLockScreen {...base} state="locked" onUnlock={onUnlock} />);
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "bad" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
      await screen.findByRole("alert");
      expect((screen.getByLabelText(/password/i) as HTMLInputElement).value).toBe("");
    });

    it("lets them sign out instead", () => {
      const onSignOut = vi.fn();
      render(<IdleLockScreen {...base} state="locked" onSignOut={onSignOut} />);
      fireEvent.click(screen.getByRole("button", { name: /sign out instead/i }));
      expect(onSignOut).toHaveBeenCalled();
    });
  });
});
