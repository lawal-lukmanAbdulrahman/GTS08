import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const loadEmailStatus = vi.fn();
const sendTestEmail = vi.fn();
vi.mock("../../lib/email-status-api", () => ({ loadEmailStatus: () => loadEmailStatus(), sendTestEmail: () => sendTestEmail() }));

import EmailStatusCard from "./email-status-card";

beforeEach(() => {
  loadEmailStatus.mockReset().mockResolvedValue({ ok: true, configured: true, from: "GTS Wears <hello@gts.ng>", missing: [] });
  sendTestEmail.mockReset().mockResolvedValue({ ok: true, to: "boss@gts.ng" });
});

describe("EmailStatusCard", () => {
  it("shows the sender when email is set up", async () => {
    render(<EmailStatusCard />);
    expect(await screen.findByText(/hello@gts.ng/)).toBeInTheDocument();
  });

  it("names what is missing when it isn't", async () => {
    loadEmailStatus.mockResolvedValue({ ok: true, configured: false, from: null, missing: ["EMAIL_FROM"] });
    render(<EmailStatusCard />);
    expect(await screen.findByText(/EMAIL_FROM/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send a test/i })).not.toBeInTheDocument();
  });

  it("sends a test to the admin and says where it went", async () => {
    render(<EmailStatusCard />);
    fireEvent.click(await screen.findByRole("button", { name: /send a test email/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("boss@gts.ng");
  });

  it("shows why a test failed", async () => {
    sendTestEmail.mockResolvedValue({ ok: false, message: "Resend answered 403: The gts.ng domain is not verified." });
    render(<EmailStatusCard />);
    fireEvent.click(await screen.findByRole("button", { name: /send a test email/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not verified/);
  });
});
