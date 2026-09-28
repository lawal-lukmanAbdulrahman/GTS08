import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminDetailsForm from "./admin-details-form";

const saved = (o: Record<string, unknown> = {}) => vi.fn().mockResolvedValue({ ok: true, saved: { full_name: "Olareign Lawal", avatar_cloudinary_id: null, ...o } });

describe("AdminDetailsForm", () => {
  it("renames the admin", async () => {
    const onSave = saved();
    render(<AdminDetailsForm initial={{ full_name: "Admin User", avatar_cloudinary_id: null }} onSave={onSave} onUpload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Olareign Lawal" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ full_name: "Olareign Lawal" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/saved/i);
  });

  it("uploads a new photo and saves it", async () => {
    const onSave = saved({ avatar_cloudinary_id: "gts/avatars/abc" });
    const onUpload = vi.fn().mockResolvedValue({ ok: true, publicId: "gts/avatars/abc" });
    render(<AdminDetailsForm initial={{ full_name: "Admin", avatar_cloudinary_id: null }} onSave={onSave} onUpload={onUpload} />);
    const file = new File(["x"], "me.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/change photo/i), { target: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ avatar_cloudinary_id: "gts/avatars/abc" }));
  });

  it("removes the photo", async () => {
    const onSave = saved();
    render(<AdminDetailsForm initial={{ full_name: "Admin", avatar_cloudinary_id: "gts/avatars/abc" }} onSave={onSave} onUpload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /remove photo/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ avatar_cloudinary_id: null }));
  });

  it("won't save a blank name, and shows the server's reason on failure", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, message: "Please fix the highlighted fields.", fieldErrors: { full_name: "Keep your name to 100 characters or fewer." } });
    render(<AdminDetailsForm initial={{ full_name: "Admin", avatar_cloudinary_id: null }} onSave={onSave} onUpload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "x".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/100 characters/)).toBeInTheDocument();
  });

  it("says why a photo couldn't be uploaded", async () => {
    const onUpload = vi.fn().mockResolvedValue({ ok: false, message: "Only PNG, JPEG, WebP or AVIF images are allowed." });
    render(<AdminDetailsForm initial={{ full_name: "Admin", avatar_cloudinary_id: null }} onSave={vi.fn()} onUpload={onUpload} />);
    fireEvent.change(screen.getByLabelText(/change photo/i), { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/only png/i);
  });
});
