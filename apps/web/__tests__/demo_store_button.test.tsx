import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DemoStoreButton from "../app/(storefront)/_components/demo-store-button";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
const reply = (enabled: boolean, post?: Response) =>
  fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => (init?.method === "POST" ? post! : new Response(JSON.stringify({ data: { enabled } }), { status: 200 })));

describe("DemoStoreButton", () => {
  it("opens the demo store and reloads so every page shows demo data", async () => {
    reply(true, new Response(JSON.stringify({ data: { session: { access_token: "a" } } }), { status: 200 }));
    const reload = vi.fn();
    render(<DemoStoreButton reload={reload} />);
    fireEvent.click(await screen.findByRole("button", { name: /explore the demo store/i }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/demo-login", expect.objectContaining({ method: "POST" }));
  });

  it("shows nothing when the demo is switched off", async () => {
    reply(false);
    const { container } = render(<DemoStoreButton reload={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("says why the demo couldn't open", async () => {
    reply(true, new Response(JSON.stringify({ error: "The demo account hasn't been set up yet." }), { status: 503 }));
    const reload = vi.fn();
    render(<DemoStoreButton reload={reload} />);
    fireEvent.click(await screen.findByRole("button", { name: /explore the demo store/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/hasn't been set up/);
    expect(reload).not.toHaveBeenCalled();
  });
});
