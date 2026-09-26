import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const loadDataMode = vi.fn();
const switchDataMode = vi.fn();
vi.mock("../../lib/data-mode-api", () => ({ loadDataMode: () => loadDataMode(), switchDataMode: (m: string) => switchDataMode(m) }));

import DataModeCard from "./data-mode-card";

beforeEach(() => {
  loadDataMode.mockReset().mockResolvedValue({ ok: true, mode: "live", ready: true });
  switchDataMode.mockReset().mockResolvedValue({ ok: true, mode: "test" });
});

describe("DataModeCard", () => {
  it("says which data the shop is showing and what the other side is", async () => {
    render(<DataModeCard canSwitch onSwitched={vi.fn()} />);
    expect(await screen.findByText("live data")).toBeInTheDocument();
    expect(screen.getByText(/nothing is ever deleted/i)).toBeInTheDocument();
  });

  it("needs a second click before switching, and reloads the view afterwards", async () => {
    const onSwitched = vi.fn();
    render(<DataModeCard canSwitch onSwitched={onSwitched} />);
    fireEvent.click(await screen.findByRole("button", { name: /switch to test data/i }));
    expect(switchDataMode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /yes, switch/i }));
    await waitFor(() => expect(switchDataMode).toHaveBeenCalledWith("test"));
    await waitFor(() => expect(onSwitched).toHaveBeenCalled());
  });

  it("lets them back out of the confirmation", async () => {
    render(<DataModeCard canSwitch onSwitched={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /switch to test data/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /switch to test data/i })).toBeInTheDocument();
    expect(switchDataMode).not.toHaveBeenCalled();
  });

  it("offers no switch to an admin who isn't the super admin", async () => {
    render(<DataModeCard canSwitch={false} onSwitched={vi.fn()} />);
    expect(await screen.findByText("live data")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only the super admin/i)).toBeInTheDocument();
  });

  it("shows why a switch failed", async () => {
    switchDataMode.mockResolvedValue({ ok: false, message: "Only the super admin can do this." });
    const onSwitched = vi.fn();
    render(<DataModeCard canSwitch onSwitched={onSwitched} />);
    fireEvent.click(await screen.findByRole("button", { name: /switch to test data/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, switch/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/super admin/i);
    expect(onSwitched).not.toHaveBeenCalled();
  });

  it("explains that the database needs the migration first", async () => {
    loadDataMode.mockResolvedValue({ ok: true, mode: null, ready: false });
    render(<DataModeCard canSwitch onSwitched={vi.fn()} />);
    expect(await screen.findByText(/migration 00017/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to/i })).not.toBeInTheDocument();
  });

  it("shows a load failure", async () => {
    loadDataMode.mockResolvedValue({ ok: false, message: "Couldn't reach the server." });
    render(<DataModeCard canSwitch onSwitched={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach/i);
  });
});
