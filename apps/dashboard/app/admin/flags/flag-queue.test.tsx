import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FlagQueue, { type QueueFlag } from "./flag-queue";

const FLAG: QueueFlag = {
  id: "f1",
  reason: "wrong_price",
  note: "Tag says 15k, till says 18k",
  status: "open",
  resolution_note: null,
  resolved_at: null,
  created_at: "2026-09-19T09:00:00Z",
  product: { id: "p1", name: "Oxford Shirt" },
  raiser: { full_name: "Ada Obi", email: "ada@x.com" },
};
const COUNTS = { open: 3, in_review: 1, resolved: 7, dismissed: 2 };

function setup(over: Partial<React.ComponentProps<typeof FlagQueue>> = {}) {
  const props = {
    flags: [FLAG],
    counts: COUNTS,
    status: "open" as const,
    onStatusChange: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  };
  render(<FlagQueue {...props} />);
  return props;
}

describe("FlagQueue", () => {
  it("shows each flag with the product, who raised it, why, and their note", () => {
    setup();
    expect(screen.getByText(/Oxford Shirt/)).toBeInTheDocument();
    expect(screen.getByText(/Ada Obi/)).toBeInTheDocument();
    expect(screen.getByText(/wrong price/i)).toBeInTheDocument();
    expect(screen.getByText(/tag says 15k/i)).toBeInTheDocument();
  });

  it("has a tab per status with its count, and switching asks for that status", () => {
    const { onStatusChange } = setup();
    expect(screen.getByRole("tab", { name: /open.*3/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /resolved.*7/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /in review.*1/i }));
    expect(onStatusChange).toHaveBeenCalledWith("in_review");
  });

  it("says when the queue is empty", () => {
    setup({ flags: [], counts: { ...COUNTS, open: 0 } });
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument();
  });

  it("starts a review straight away, with no note needed", () => {
    const { onUpdate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /start review/i }));
    expect(onUpdate).toHaveBeenCalledWith("f1", { status: "in_review", resolution_note: null });
  });

  it("makes the admin write a note before resolving", async () => {
    const { onUpdate } = setup({ status: "open" });
    fireEvent.click(screen.getByRole("button", { name: /^resolve$/i }));
    const confirm = screen.getByRole("button", { name: /confirm resolve/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/note for the cashier/i), { target: { value: "Price fixed to 15k" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("f1", { status: "resolved", resolution_note: "Price fixed to 15k" }));
  });

  it("makes the admin write a note before dismissing", async () => {
    const { onUpdate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^dismiss$/i }));
    fireEvent.change(screen.getByLabelText(/note for the cashier/i), { target: { value: "Not an issue" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm dismiss/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("f1", { status: "dismissed", resolution_note: "Not an issue" }));
  });

  it("can back out of writing a note", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /^resolve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByLabelText(/note for the cashier/i)).not.toBeInTheDocument();
  });

  it("offers Reopen on a closed flag, showing what was said", () => {
    const { onUpdate } = setup({
      status: "resolved",
      flags: [{ ...FLAG, status: "resolved", resolution_note: "Fixed", resolved_at: "2026-09-19T10:00:00Z" }],
    });
    expect(screen.getByText(/fixed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^resolve$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reopen/i }));
    expect(onUpdate).toHaveBeenCalledWith("f1", { status: "open", resolution_note: null });
  });

  it("shows why an update failed and keeps the note the admin typed", async () => {
    setup({ onUpdate: vi.fn().mockResolvedValue({ ok: false, message: "Flag not found." }) });
    fireEvent.click(screen.getByRole("button", { name: /^resolve$/i }));
    fireEvent.change(screen.getByLabelText(/note for the cashier/i), { target: { value: "Fixed it" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm resolve/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/flag not found/i);
    expect(screen.getByLabelText(/note for the cashier/i)).toHaveValue("Fixed it");
  });

  it("shows a load error", () => {
    setup({ flags: [], error: "Couldn't load flags." });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load flags/i);
  });
});
