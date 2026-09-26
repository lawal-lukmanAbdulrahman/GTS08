import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

let search = "token=abc123";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

import ResetPasswordPage from "../app/(storefront)/reset-password/page";

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

describe("Reset password (customer)", () => {
  it("sends the token and the password exactly as typed, then says the password changed", async () => {
    render(<ResetPasswordPage />);
    fill(`Ne"w;Pass'123--`);
    submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/password has been changed/i));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("/api/v1/auth/reset-password");
    expect(JSON.parse(init.body)).toEqual({ token: "abc123", new_password: `Ne"w;Pass'123--`, confirm_password: `Ne"w;Pass'123--` });
  });

  it("lists weak or mismatched passwords before calling the server", () => {
    render(<ResetPasswordPage />);
    fill("abc", "xyz");
    submit();
    expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/don't match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a new link when there is no token or it has expired", async () => {
    search = "";
    const { unmount } = render(<ResetPasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid|expired/i);
    unmount();

    search = "token=old";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "This reset link is invalid or has expired. Request a new one.", code: "INVALID_OR_EXPIRED_LINK" }), { status: 400 }));
    render(<ResetPasswordPage />);
    fill("BrandNew123");
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/expired/i));
  });
});
