import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StoreSettingsForm, { type StoreDetails } from "./store-settings-form";

const INITIAL: StoreDetails = {
  store_name: "GTS",
  store_address: "12 Allen Avenue, Ikeja, Lagos",
  support_phone: "0803 123 4567",
  whatsapp_number: null,
  support_email: "hello@gts.ng",
};

const ok = (saved: StoreDetails) => vi.fn().mockResolvedValue({ ok: true, saved });

function field(label: RegExp) {
  return screen.getByLabelText(label) as HTMLInputElement;
}
function type(label: RegExp, value: string) {
  fireEvent.change(field(label), { target: { value } });
}
const saveButton = () => screen.getByRole("button", { name: /save|saving/i });

describe("StoreSettingsForm", () => {
  it("shows the current store details, with empty fields for anything unset", () => {
    render(<StoreDetailsForm />);
    expect(field(/store name/i).value).toBe("GTS");
    expect(field(/address/i).value).toBe("12 Allen Avenue, Ikeja, Lagos");
    expect(field(/^phone/i).value).toBe("0803 123 4567");
    expect(field(/whatsapp/i).value).toBe("");
    expect(field(/support email/i).value).toBe("hello@gts.ng");
  });

  it("keeps Save disabled until something changes, and again if the change is reverted", () => {
    render(<StoreDetailsForm />);
    expect(saveButton()).toBeDisabled();
    type(/address/i, "New address");
    expect(saveButton()).toBeEnabled();
    type(/address/i, "12 Allen Avenue, Ikeja, Lagos");
    expect(saveButton()).toBeDisabled();
  });

  it("blocks saving a blank store name and says why", () => {
    const onSave = vi.fn();
    render(<StoreDetailsForm onSave={onSave} />);
    type(/store name/i, "   ");
    fireEvent.click(saveButton());
    expect(screen.getByText(/store name is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks an invalid phone number or email before calling the server", () => {
    const onSave = vi.fn();
    render(<StoreDetailsForm onSave={onSave} />);
    type(/^phone/i, "call me");
    type(/support email/i, "nope");
    fireEvent.click(saveButton());
    expect(screen.getByText(/phone number can only contain/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves trimmed values and confirms, then disables Save until the next edit", async () => {
    const saved = { ...INITIAL, store_address: "5 Broad Street, Lagos" };
    const onSave = ok(saved);
    render(<StoreDetailsForm onSave={onSave} />);
    type(/address/i, "  5 Broad Street, Lagos  ");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(/store details saved/i)).toBeInTheDocument());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ store_address: "5 Broad Street, Lagos" }));
    expect(saveButton()).toBeDisabled();
  });

  it("shows a saving state and prevents double submits", async () => {
    let finish!: (v: unknown) => void;
    const onSave = vi.fn(() => new Promise((res) => (finish = res)));
    render(<StoreDetailsForm onSave={onSave as never} />);
    type(/address/i, "New address");
    fireEvent.click(saveButton());
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /saving/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    finish({ ok: true, saved: { ...INITIAL, store_address: "New address" } });
    await waitFor(() => expect(screen.getByText(/store details saved/i)).toBeInTheDocument());
  });

  it("shows field errors returned by the server next to the field", async () => {
    const onSave = vi.fn().mockResolvedValue({
      ok: false,
      message: "Some store details are invalid.",
      fieldErrors: { support_phone: "Phone number can only contain digits." },
    });
    render(<StoreDetailsForm onSave={onSave} />);
    type(/address/i, "x");
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText(/phone number can only contain digits/i)).toBeInTheDocument());
    expect(screen.queryByText(/store details saved/i)).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("shows a general error, e.g. when the admin lacks permission", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, message: "Only admins can change store settings." });
    render(<StoreDetailsForm onSave={onSave} />);
    type(/address/i, "x");
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/only admins/i));
  });

  it("previews the receipt header live as the admin types", () => {
    render(<StoreDetailsForm />);
    const preview = () => screen.getByTestId("receipt-header-preview").textContent!;
    expect(preview()).toContain("GTS");
    expect(preview()).toContain("12 Allen Avenue, Ikeja, Lagos");
    expect(preview()).toContain("Tel: 0803 123 4567");

    type(/store name/i, "Acme Stores");
    type(/address/i, "");
    expect(preview()).toContain("ACME STORES");
    expect(preview()).not.toContain("Allen Avenue");
  });
});

function StoreDetailsForm({ onSave = ok(INITIAL) }: { onSave?: (v: StoreDetails) => Promise<never> } = {}) {
  return <StoreSettingsForm initial={INITIAL} onSave={onSave as never} />;
}
