import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const loadDataMode = vi.fn();
vi.mock("../../lib/data-mode-api", () => ({ loadDataMode: () => loadDataMode() }));
const demoAvailable = vi.fn();
const signInToDemo = vi.fn();
vi.mock("../../lib/demo-login", () => ({ demoLoginAvailable: () => demoAvailable(), signInToDemo: () => signInToDemo() }));
const signOut = vi.fn();
vi.mock("../../lib/session", () => ({ signOut: (...a: unknown[]) => signOut(...a) }));

import DataModeCard from "./data-mode-card";

beforeEach(() => {
  loadDataMode.mockReset();
  demoAvailable.mockReset().mockResolvedValue(true);
  signInToDemo.mockReset().mockResolvedValue({ ok: true, home: "/admin" });
  signOut.mockReset();
});

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

  it("switches a real admin into the demo in one click", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: "live" });
    const navigate = vi.fn();
    render(<DataModeCard navigate={navigate} />);
    fireEvent.click(await screen.findByRole("button", { name: /open the demo/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin"));
  });

  it("offers no demo switch when the demo is turned off", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: "live" });
    demoAvailable.mockResolvedValue(false);
    render(<DataModeCard />);
    await screen.findByText(/live shop/i);
    await waitFor(() => expect(demoAvailable).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /open the demo/i })).not.toBeInTheDocument();
  });

  it("lets the demo account leave, back to the sign-in page", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: "test" });
    render(<DataModeCard />);
    fireEvent.click(await screen.findByRole("button", { name: /leave the demo/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("shows a load failure", async () => {
    loadDataMode.mockResolvedValue({ ok: false, message: "Couldn't reach the server." });
    render(<DataModeCard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach/i);
  });
});
