import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ForgotPasswordPage from "./page";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: { sent: true } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

const enter = (value: string) => fireEvent.change(screen.getByLabelText(/staff email/i), { target: { value } });
const send = () => fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

describe("Forgot password (staff)", () => {
  it("asks the API for a reset link and says to check the inbox, without saying whether the address has an account", async () => {
    render(<ForgotPasswordPage />);
    enter("Ada@GTS.ng ");
    send();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/if that address has an account/i));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/auth\/forgot-password$/);
    expect(JSON.parse(init.body)).toEqual({ email: "ada@gts.ng" });
  });

  it("rejects a malformed address without calling the API", () => {
    render(<ForgotPasswordPage />);
    enter("nope");
    send();
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tells the person to wait when they ask too often", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Too many reset requests.", code: "RATE_LIMIT_EXCEEDED" }), { status: 429 }));
    render(<ForgotPasswordPage />);
    enter("ada@gts.ng");
    send();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/too many/i));
  });

  it("copes with the network being down", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<ForgotPasswordPage />);
    enter("ada@gts.ng");
    send();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/connect/i));
  });

  it("links back to sign in", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/login");
  });
});
