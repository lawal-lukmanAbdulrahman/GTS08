import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();
const mockFrom = vi.fn();

vi.mock("@gts/database/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
      signOut: () => mockSignOut(),
    },
    from: (...args: any[]) => mockFrom(...args),
  }),
}));

vi.mock("../app/(storefront)/_components/catalogue-context", () => ({
  CATALOGUE_CACHE_KEY: "catalogue_cache",
}));

vi.mock("@/lib/notifications", () => ({
  clearCustomerNotifications: vi.fn(),
}));

import { AuthProvider, useAuth } from "../app/(storefront)/_components/auth-context";

function TestConsumer() {
  const { user, customer, isLoading } = useAuth();
  if (isLoading) return <div>loading...</div>;
  return (
    <div>
      <div data-testid="user-email">{user?.email || "none"}</div>
      <div data-testid="customer-email">{customer?.email || "none"}</div>
    </div>
  );
}

describe("Storefront Auth Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    if (typeof document !== "undefined" && document.cookie) {
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    }
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("does not read gts_user set by admin dashboard and remains signed out", async () => {
    // Admin dashboard stored credentials
    localStorage.setItem(
      "gts_user",
      JSON.stringify({ id: "admin-1", email: "admin@gts.ng", role: "admin" })
    );
    localStorage.setItem("gts_token", "admin-jwt-token");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText("loading...")).not.toBeInTheDocument();
    });

    // Storefront must NOT hydrate from gts_user
    expect(screen.getByTestId("user-email")).toHaveTextContent("none");
    expect(screen.getByTestId("customer-email")).toHaveTextContent("none");
  });

  it("hydrates from gts_customer_user when a valid customer is stored", async () => {
    localStorage.setItem(
      "gts_customer_user",
      JSON.stringify({ id: "cust-1", email: "customer@gmail.com", role: "customer" })
    );

    // Mock DB queries for customer
    mockFrom.mockImplementation((_table: string) => ({
      select: () => ({
        or: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: { id: "c1", user_id: "cust-1", full_name: "John Doe", email: "customer@gmail.com" },
              error: null,
            }),
          }),
        }),
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-email")).toHaveTextContent("customer@gmail.com");
    });
    await waitFor(() => {
      expect(screen.getByTestId("customer-email")).toHaveTextContent("customer@gmail.com");
    });
  });

  it("purges gts_customer_user if a staff account was erroneously stored", async () => {
    localStorage.setItem(
      "gts_customer_user",
      JSON.stringify({ id: "staff-1", email: "staff@gts.ng", role: "cashier" })
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText("loading...")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("user-email")).toHaveTextContent("none");
    expect(screen.getByTestId("customer-email")).toHaveTextContent("none");
    expect(localStorage.getItem("gts_customer_user")).toBeNull();
  });

  it("rejects staff user from active session and signs out browser client", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "admin-1", email: "admin@gts.ng" },
          access_token: "admin-tok",
        },
      },
      error: null,
    });

    // Mock database responses: no customer row, user is role 'admin'
    mockFrom.mockImplementation((_table: string) => ({
      select: () => ({
        or: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "admin-1", email: "admin@gts.ng", role: "admin" },
            error: null,
          }),
        }),
      }),
    }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    expect(screen.getByTestId("customer-email")).toHaveTextContent("none");
    expect(screen.getByTestId("user-email")).toHaveTextContent("none");
    expect(localStorage.getItem("gts_customer_user")).toBeNull();
  });
});
