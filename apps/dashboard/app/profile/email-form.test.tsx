import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import EmailForm from "./email-form";

const field = (l: RegExp) => screen.getByLabelText(l) as HTMLInputElement;
const type = (l: RegExp, v: string) => fireEvent.change(field(l), { target: { value: v } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /update email|updating/i }));

describe("EmailForm", () => {
  it("renders new email and password inputs", () => {
    render(<EmailForm currentEmail="admin@gts.ng" onSave={vi.fn()} />);

    expect(screen.getByLabelText(/New email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Current password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update email/i })).toBeInTheDocument();
  });

  it("validates empty or invalid email", async () => {
    const onSave = vi.fn();
    render(<EmailForm currentEmail="admin@gts.ng" onSave={onSave} />);

    type(/New email address/i, "not-an-email");
    type(/Current password/i, "secret123");
    submit();

    expect(await screen.findByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("prevents submitting the current email address", async () => {
    const onSave = vi.fn();
    render(<EmailForm currentEmail="admin@gts.ng" onSave={onSave} />);

    type(/New email address/i, "admin@gts.ng");
    type(/Current password/i, "secret123");
    submit();

    expect(await screen.findByText(/New email must be different from your current email/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits successfully and displays updated status banner", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, email: "newadmin@gts.ng" });
    render(<EmailForm currentEmail="admin@gts.ng" onSave={onSave} />);

    type(/New email address/i, "newadmin@gts.ng");
    type(/Current password/i, "validpassword");
    submit();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        new_email: "newadmin@gts.ng",
        current_password: "validpassword",
      });
    });

    expect(await screen.findByText(/Email address successfully updated to/i)).toBeInTheDocument();
    expect(screen.getByText("newadmin@gts.ng")).toBeInTheDocument();
  });

  it("shows server error on incorrect password or rejection", async () => {
    const onSave = vi.fn().mockResolvedValue({
      ok: false,
      message: "Your current password is incorrect.",
      fieldErrors: { current_password: "Your current password is incorrect." },
    });
    render(<EmailForm currentEmail="admin@gts.ng" onSave={onSave} />);

    type(/New email address/i, "newadmin@gts.ng");
    type(/Current password/i, "wrongpass");
    submit();

    expect(await screen.findByText(/Your current password is incorrect/i)).toBeInTheDocument();
  });
});
