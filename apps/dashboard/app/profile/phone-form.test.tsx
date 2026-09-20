import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PhoneForm from "./phone-form";

const input = () => screen.getByLabelText(/phone number/i) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: /save|saving/i });

describe("PhoneForm", () => {
  it("shows the current number", () => {
    render(<PhoneForm initialPhone="0803 123 4567" onSave={vi.fn()} />);
    expect(input().value).toBe("0803 123 4567");
  });

  it("starts empty when there's no number", () => {
    render(<PhoneForm initialPhone={null} onSave={vi.fn()} />);
    expect(input().value).toBe("");
  });

  it("keeps Save disabled until the number changes", () => {
    render(<PhoneForm initialPhone="0803 123 4567" onSave={vi.fn()} />);
    expect(save()).toBeDisabled();
    fireEvent.change(input(), { target: { value: "0801 234 5678" } });
    expect(save()).toBeEnabled();
  });

  it("refuses an invalid number without calling the server", () => {
    const onSave = vi.fn();
    render(<PhoneForm initialPhone={null} onSave={onSave} />);
    fireEvent.change(input(), { target: { value: "call me" } });
    fireEvent.click(save());
    expect(screen.getByText(/can only contain digits/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the trimmed number and confirms", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, phone: "0801 234 5678" });
    render(<PhoneForm initialPhone={null} onSave={onSave} />);
    fireEvent.change(input(), { target: { value: "  0801 234 5678 " } });
    fireEvent.click(save());
    await waitFor(() => expect(screen.getByText(/phone number saved/i)).toBeInTheDocument());
    expect(onSave).toHaveBeenCalledWith("0801 234 5678");
    expect(save()).toBeDisabled();
  });

  it("lets them clear the number", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, phone: null });
    render(<PhoneForm initialPhone="0803 123 4567" onSave={onSave} />);
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(""));
  });

  it("shows a server error and stays editable", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, message: "That phone number isn't valid.", fieldErrors: { phone: "Enter a valid phone number." } });
    render(<PhoneForm initialPhone={null} onSave={onSave} />);
    fireEvent.change(input(), { target: { value: "0801 234 5678" } });
    fireEvent.click(save());
    expect(await screen.findByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it("says email and role are managed by an admin", () => {
    render(<PhoneForm initialPhone={null} onSave={vi.fn()} />);
    expect(screen.getByText(/email and role are managed by an admin/i)).toBeInTheDocument();
  });
});
