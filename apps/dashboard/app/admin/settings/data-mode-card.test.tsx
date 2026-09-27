import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const loadDataMode = vi.fn();
vi.mock("../../lib/data-mode-api", () => ({ loadDataMode: () => loadDataMode() }));

import DataModeCard from "./data-mode-card";

beforeEach(() => loadDataMode.mockReset());

describe("DataModeCard", () => {
  it("tells a real admin they are looking at the live shop, and where the demo data went", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: "live" });
    render(<DataModeCard />);
    expect(await screen.findByText(/live shop/i)).toBeInTheDocument();
    expect(screen.getByText(/demo account/i)).toBeInTheDocument();
  });

  it("tells the demo account it is looking at demo data that can't reach the live shop", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: "test" });
    render(<DataModeCard />);
    expect(await screen.findByText(/this is the demo account/i)).toBeInTheDocument();
  });

  it("has no switch: what you see follows the account you signed in with", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: "live" });
    render(<DataModeCard />);
    await screen.findByText(/live shop/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a load failure", async () => {
    loadDataMode.mockResolvedValue({ ok: false, message: "Couldn't reach the server." });
    render(<DataModeCard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach/i);
  });
});
