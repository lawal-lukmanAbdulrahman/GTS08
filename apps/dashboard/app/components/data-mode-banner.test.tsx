import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const loadDataMode = vi.fn();
vi.mock("../lib/data-mode-api", () => ({ loadDataMode: () => loadDataMode() }));

import DataModeBanner from "./data-mode-banner";

beforeEach(() => {
  loadDataMode.mockReset();
  localStorage.clear();
});

describe("DataModeBanner", () => {
  it("warns staff that they are looking at test data", async () => {
    localStorage.setItem("gts_token", "tok");
    loadDataMode.mockResolvedValue({ ok: true, mode: "test", ready: true });
    render(<DataModeBanner />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/test data/i));
  });

  it("says nothing in live mode", async () => {
    localStorage.setItem("gts_token", "tok");
    loadDataMode.mockResolvedValue({ ok: true, mode: "live", ready: true });
    render(<DataModeBanner />);
    await waitFor(() => expect(loadDataMode).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says nothing before the migration, or if the mode can't be read", async () => {
    localStorage.setItem("gts_token", "tok");
    loadDataMode.mockResolvedValue({ ok: true, mode: null, ready: false });
    const { unmount } = render(<DataModeBanner />);
    await waitFor(() => expect(loadDataMode).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();
    loadDataMode.mockResolvedValue({ ok: false, message: "x" });
    render(<DataModeBanner />);
    await waitFor(() => expect(loadDataMode).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not ask when nobody is signed in (the sign-in page)", () => {
    render(<DataModeBanner />);
    expect(loadDataMode).not.toHaveBeenCalled();
  });
});
