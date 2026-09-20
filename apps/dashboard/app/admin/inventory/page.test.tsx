import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));

import InventoryPage from "./page";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Admin inventory page never shows invented stock", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("says why when the server refuses, instead of listing sample products", async () => {
    fetchMock.mockResolvedValue(json({ error: "Not allowed", code: "FORBIDDEN" }, 403));
    render(<InventoryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have access/i);
    expect(screen.queryByText("Cool back pack")).not.toBeInTheDocument();
    expect(screen.queryByText(/DeLonghi/)).not.toBeInTheDocument();
  });

  it("says the stock couldn't be loaded when the server fails or is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<InventoryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.queryByText("Cool back pack")).not.toBeInTheDocument();
  });

  it("shows an honestly empty list when there is no stock yet", async () => {
    fetchMock.mockResolvedValue(json({ data: [] }));
    render(<InventoryPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByText("Cool back pack")).not.toBeInTheDocument();
  });
});
