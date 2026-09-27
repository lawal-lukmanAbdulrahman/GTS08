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
  it("marks the demo account's screens as demo data", async () => {
    localStorage.setItem("gts_token", "tok");
    loadDataMode.mockResolvedValue({ ok: true, mode: "test" });
    render(<DataModeBanner />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/demo data/i));
  });

  it("says nothing in live mode", async () => {
    localStorage.setItem("gts_token", "tok");
    loadDataMode.mockResolvedValue({ ok: true, mode: "live" });
    render(<DataModeBanner />);
    await waitFor(() => expect(loadDataMode).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says nothing if the mode can't be read", async () => {
    localStorage.setItem("gts_token", "tok");
    loadDataMode.mockResolvedValue({ ok: false, message: "x" });
    render(<DataModeBanner />);
    await waitFor(() => expect(loadDataMode).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
