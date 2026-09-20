import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MustChangeNotice from "./must-change-notice";

describe("MustChangeNotice", () => {
  it("explains why, in plain words, as an alert", () => {
    render(<MustChangeNotice name="Ada" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/set a new password/i);
    expect(screen.getByText(/one-time password/i)).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
  });

  it("works without a name", () => {
    render(<MustChangeNotice name="" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
