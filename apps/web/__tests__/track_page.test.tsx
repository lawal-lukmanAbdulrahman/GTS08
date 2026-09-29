import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseAuth = vi.fn();
vi.mock("../app/(storefront)/_components/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("../app/(storefront)/_components/landing/footer", () => ({
  Footer: () => null,
}));

vi.mock("../app/(storefront)/_lib/store-info", () => ({
  useStoreInfo: () => ({ store_name: "GTS", store_address: "12 Allen Ave" }),
}));

import TrackOrderPage from "../app/(storefront)/track/page";

describe("TrackOrderPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com" },
      customer: { email: "customer@example.com", full_name: "Customer Name" },
      isLoading: false,
    });
  });

  it("prefills the email field with the logged-in customer email", async () => {
    render(<TrackOrderPage />);
    const emailInput = screen.getByPlaceholderText("email@example.com") as HTMLInputElement;
    expect(emailInput.value).toBe("customer@example.com");
    expect(screen.getByText(/Logged In/i)).toBeInTheDocument();
  });

  it("updates the email field when auth finishes loading after initial render", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      customer: null,
      isLoading: true,
    });

    const { rerender } = render(<TrackOrderPage />);
    const emailInput = screen.getByPlaceholderText("email@example.com") as HTMLInputElement;
    expect(emailInput.value).toBe("");

    // Auth completes and provides user
    mockUseAuth.mockReturnValue({
      user: { email: "okohmicah00@gmail.com" },
      customer: null,
      isLoading: false,
    });

    rerender(<TrackOrderPage />);

    await waitFor(() => {
      expect(emailInput.value).toBe("okohmicah00@gmail.com");
    });
    expect(screen.getByText(/Logged In/i)).toBeInTheDocument();
  });
});
