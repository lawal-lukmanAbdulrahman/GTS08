import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RemoveStaff from "./remove-staff";

describe("RemoveStaff", () => {
  it("asks first, then removes and goes back to the staff list", async () => {
    const onRemove = vi.fn().mockResolvedValue({ ok: true });
    const onRemoved = vi.fn();
    render(<RemoveStaff name="Ada Obi" onRemove={onRemove} onRemoved={onRemoved} />);
    fireEvent.click(screen.getByRole("button", { name: /remove ada obi/i }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText(/can't sign in again/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /yes, remove/i }));
    await waitFor(() => expect(onRemove).toHaveBeenCalled());
    expect(onRemoved).toHaveBeenCalled();
  });

  it("can be called off", () => {
    const onRemove = vi.fn();
    render(<RemoveStaff name="Ada Obi" onRemove={onRemove} onRemoved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /remove ada obi/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep/i }));
    expect(screen.getByRole("button", { name: /remove ada obi/i })).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("shows why it was refused", async () => {
    const onRemove = vi.fn().mockResolvedValue({ ok: false, message: "Only the super admin can do this." });
    const onRemoved = vi.fn();
    render(<RemoveStaff name="Ada Obi" onRemove={onRemove} onRemoved={onRemoved} />);
    fireEvent.click(screen.getByRole("button", { name: /remove ada obi/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, remove/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/super admin/);
    expect(onRemoved).not.toHaveBeenCalled();
  });
});
