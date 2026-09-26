import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

let search = "token=abc123";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

import ResetPasswordPage from "./page";

const fetchMock = vi.fn();
beforeEach(() => {
  search = "token=abc123";
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: { reset: true } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

const field = (l: RegExp) => screen.getByLabelText(l) as HTMLInputElement;
const fill = (next: string, confirm = next) => {
  fireEvent.change(field(/^new password/i), { target: { value: next } });
  fireEvent.change(field(/confirm new password/i), { target: { value: confirm } });
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

describe("Reset password (staff)", () => {
  it("sends the token and the new password exactly as typed, then points to sign in", async () => {
    render(<ResetPasswordPage />);
    fill(`Ne"w;Pass'123--`);
    submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/password has been changed/i));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/auth\/reset-password$/);
    expect(JSON.parse(init.body)).toEqual({ token: "abc123", new_password: `Ne"w;Pass'123--`, confirm_password: `Ne"w;Pass'123--` });
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("masks both fields", () => {
    render(<ResetPasswordPage />);
    expect(field(/^new password/i)).toHaveAttribute("type", "password");
    expect(field(/confirm new password/i)).toHaveAttribute("type", "password");
  });

  it("lists weak or mismatched passwords before calling the server", () => {
    render(<ResetPasswordPage />);
    fill("abc", "xyz");
    submit();
    expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/don't match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the link is unusable, and offers a new one, when there is no token", () => {
    search = "";
    render(<ResetPasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid|expired/i);
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByRole("button", { name: /set new password/i })).not.toBeInTheDocument();
  });

  it("shows the server's reason when the link has expired", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "This reset link is invalid or has expired. Request a new one.", code: "INVALID_OR_EXPIRED_LINK" }), { status: 400 }));
    render(<ResetPasswordPage />);
    fill("BrandNew123");
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/expired/i));
    expect(screen.getByRole("link", { name: /request a new link/i })).toBeInTheDocument();
  });
});
