import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ErrorBanner from "./error-banner";

describe("ErrorBanner", () => {
  it("shows nothing without a message", () => {
    const { container } = render(<ErrorBanner message={null} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message as an alert and can be dismissed", () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="One or more items no longer have sufficient stock." onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/sufficient stock/i);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
