import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams("") }));

import LoginPage from "./page";

const fetchMock = vi.fn();
beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const signIn = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText(/staff email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /login to terminal/i }));
};

describe("Staff sign-in", () => {
  it("sends the password exactly as typed: quotes, semicolons and dashes are part of it, not an attack", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "x", code: "UNAUTHORIZED" }), { status: 401 }));
    render(<LoginPage />);
    const tricky = `Pa"ss;w'ord--1 `;
    signIn("ada@gts.ng", tricky);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).password).toBe(tricky);
  });

  it("tells a suspended staff member their account is suspended, not that they are a customer", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "This staff account is suspended. Please contact administrator.", code: "FORBIDDEN", field: "email" }), { status: 403 }));
    render(<LoginPage />);
    signIn("ada@gts.ng", "Secret123!");
    await waitFor(() => expect(screen.getByText(/account is suspended/i)).toBeInTheDocument());
    expect(screen.queryByText(/customer accounts cannot/i)).not.toBeInTheDocument();
  });

  it("offers a way to reset a forgotten password", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/forgot-password");
  });
});
