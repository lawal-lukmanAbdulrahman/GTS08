import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FlagProductModal from "./flag-product-modal";

const base = { productName: "Air Fryer", onSubmit: vi.fn(), onClose: vi.fn() };
const submit = () => screen.getByRole("button", { name: /send flag|sending/i });
const pick = (label: RegExp | string) => fireEvent.click(screen.getByRole("radio", { name: label }));

describe("FlagProductModal", () => {
  it("names the product being flagged", () => {
    render(<FlagProductModal {...base} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Air Fryer");
  });

  it("offers each reason", () => {
    render(<FlagProductModal {...base} />);
    for (const label of ["Wrong price", "Stock count is off", "Damaged item", "Missing or wrong image", "Barcode won't scan", "Something else"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("can't be sent until a reason is chosen", () => {
    render(<FlagProductModal {...base} />);
    expect(submit()).toBeDisabled();
    pick("Wrong price");
    expect(submit()).toBeEnabled();
  });

  it("sends the reason, and a tidy note if there is one", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<FlagProductModal {...base} onSubmit={onSubmit} />);
    pick("Damaged item");
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: "  Box crushed  " } });
    fireEvent.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: "damaged", note: "Box crushed" }));
  });

  it("sends no note when none was written", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<FlagProductModal {...base} onSubmit={onSubmit} />);
    pick("Wrong price");
    fireEvent.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: "wrong_price", note: "" }));
  });

  it("insists on a note for 'Something else'", () => {
    const onSubmit = vi.fn();
    render(<FlagProductModal {...base} onSubmit={onSubmit} />);
    pick("Something else");
    fireEvent.click(submit());
    expect(screen.getByText(/tell us what's wrong/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("counts characters and stops at 500", () => {
    render(<FlagProductModal {...base} />);
    expect(screen.getByLabelText(/note/i)).toHaveAttribute("maxLength", "500");
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: "abc" } });
    expect(screen.getByText("3/500")).toBeInTheDocument();
  });

  it("confirms once sent and offers to close", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<FlagProductModal {...base} onSubmit={onSubmit} onClose={onClose} />);
    pick("Wrong price");
    fireEvent.click(submit());
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows why it failed (e.g. already flagged) and stays open to retry", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: "You've already flagged this for that reason and it hasn't been resolved yet." });
    render(<FlagProductModal {...base} onSubmit={onSubmit} />);
    pick("Wrong price");
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(/already flagged/i);
    expect(submit()).toBeEnabled();
  });

  it("prevents double submits", async () => {
    let finish!: (v: unknown) => void;
    const onSubmit = vi.fn(() => new Promise((res) => (finish = res)));
    render(<FlagProductModal {...base} onSubmit={onSubmit as never} />);
    pick("Wrong price");
    fireEvent.click(submit());
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /sending/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish({ ok: true });
  });

  it("closes with Cancel or Escape", () => {
    const onClose = vi.fn();
    render(<FlagProductModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
