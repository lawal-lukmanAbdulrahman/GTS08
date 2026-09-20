import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SkipLink from "../app/_components/skip-link";

describe("SkipLink", () => {
  it("is the first thing a keyboard user can reach and jumps to the page content", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("stays out of sight until focused", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    expect(link.className).toMatch(/sr-only/);
    expect(link.className).toMatch(/focus:not-sr-only/);
  });
});
