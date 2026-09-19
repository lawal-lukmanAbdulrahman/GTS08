import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PasswordForm from "./password-form";

const field = (l: RegExp) => screen.getByLabelText(l) as HTMLInputElement;
const type = (l: RegExp, v: string) => fireEvent.change(field(l), { target: { value: v } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /change password|changing/i }));

function fill(current = "OldPass123!", next = "NewPass456!", confirm = next) {
  type(/current password/i, current);
  type(/^new password/i, next);
  type(/confirm new password/i, confirm);
}

describe("PasswordForm (current + new + confirm)", () => {
  it("masks every field", () => {
    render(<PasswordForm onSubmit={vi.fn()} />);
    for (const l of [/current password/i, /^new password/i, /confirm new password/i]) expect(field(l)).toHaveAttribute("type", "password");
  });

  it("blocks a weak or mismatched password before calling the server, listing every problem", () => {
    const onSubmit = vi.fn();
    render(<PasswordForm onSubmit={onSubmit} />);
    fill("", "abc", "xyz");
    submit();
    expect(screen.getByText(/enter your current password/i)).toBeInTheDocument();
    expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/don't match/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses to 'change' to the same password", () => {
    render(<PasswordForm onSubmit={vi.fn()} />);
    fill("SamePass123", "SamePass123");
    submit();
    expect(screen.getByText(/different from your current/i)).toBeInTheDocument();
  });

  it("submits the three values, confirms, and clears the form", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<PasswordForm onSubmit={onSubmit} />);
    fill();
    submit();
    await waitFor(() => expect(screen.getByText(/password changed/i)).toBeInTheDocument());
    expect(onSubmit).toHaveBeenCalledWith({ current_password: "OldPass123!", new_password: "NewPass456!", confirm_password: "NewPass456!" });
    expect(field(/current password/i).value).toBe("");
    expect(field(/^new password/i).value).toBe("");
  });

  it("shows a wrong-current-password error on that field and keeps what they typed for the new one", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      message: "Your current password is incorrect.",
      fieldErrors: { current_password: "Your current password is incorrect." },
    });
    render(<PasswordForm onSubmit={onSubmit} />);
    fill();
    submit();
    expect(await screen.findByText("Your current password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText(/password changed/i)).not.toBeInTheDocument();
    expect(field(/current password/i).value).toBe("");
  });

  it("shows a general failure", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: "Couldn't update your password. Please try again." });
    render(<PasswordForm onSubmit={onSubmit} />);
    fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update your password");
  });

  it("prevents double submits", async () => {
    let finish!: (v: unknown) => void;
    const onSubmit = vi.fn(() => new Promise((res) => (finish = res)));
    render(<PasswordForm onSubmit={onSubmit as never} />);
    fill();
    submit();
    expect(screen.getByRole("button", { name: /changing/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /changing/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish({ ok: true });
  });
});
