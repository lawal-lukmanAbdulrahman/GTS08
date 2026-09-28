import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("../sidebar-context", () => ({ AdminTopStrip: () => null }));
const api = { listCategories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn(), reorderCategories: vi.fn() };
vi.mock("../../lib/categories-api", () => ({
  listCategories: () => api.listCategories(),
  createCategory: (v: unknown) => api.createCategory(v),
  updateCategory: (id: string, p: unknown) => api.updateCategory(id, p),
  deleteCategory: (id: string) => api.deleteCategory(id),
  reorderCategories: (o: unknown) => api.reorderCategories(o),
}));

import CategoriesPage from "./page";

const cat = (o: Record<string, unknown>) => ({ description: null, parent_id: null, sort_order: 0, is_active: true, banner_cloudinary_id: null, ...o });
const SHIRTS = cat({ id: "c1", name: "Shirts", slug: "shirts", sort_order: 0 });
const OXFORD = cat({ id: "c2", name: "Oxford", slug: "oxford", parent_id: "c1" });
const SHOES = cat({ id: "c3", name: "Shoes", slug: "shoes", sort_order: 1 });

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  api.listCategories.mockResolvedValue({ ok: true, data: [SHIRTS, OXFORD, SHOES] });
  api.createCategory.mockResolvedValue({ ok: true, data: {} });
  api.updateCategory.mockResolvedValue({ ok: true, data: {} });
  api.deleteCategory.mockResolvedValue({ ok: true, data: {} });
  api.reorderCategories.mockResolvedValue({ ok: true, data: {} });
});

const row = (name: string) => screen.getByTestId(`category-${name}`);

describe("Categories (admin)", () => {
  it("says there are none yet and how to start, on a new live shop", async () => {
    api.listCategories.mockResolvedValue({ ok: true, data: [] });
    render(<CategoriesPage />);
    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
  });

  it("lists categories with their sub-categories under them", async () => {
    render(<CategoriesPage />);
    expect(await screen.findByTestId("category-Shirts")).toBeInTheDocument();
    expect(row("Oxford")).toHaveTextContent(/under shirts/i);
  });

  it("creates a category, optionally under a parent, and reloads the list", async () => {
    render(<CategoriesPage />);
    await screen.findByTestId("category-Shirts");
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Polo" } });
    fireEvent.change(screen.getByLabelText(/parent/i), { target: { value: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith({ name: "Polo", parent_id: "c1", description: "" }));
    expect(api.listCategories).toHaveBeenCalledTimes(2);
  });

  it("shows the reason a new category was refused", async () => {
    api.createCategory.mockResolvedValue({ ok: false, message: "That name is already taken." });
    render(<CategoriesPage />);
    await screen.findByTestId("category-Shirts");
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Shirts" } });
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already taken/);
  });

  it("renames a category", async () => {
    render(<CategoriesPage />);
    await screen.findByTestId("category-Shirts");
    fireEvent.click(within(row("Shirts")).getByRole("button", { name: /edit/i }));
    fireEvent.change(within(row("Shirts")).getByLabelText(/category name/i), { target: { value: "Dress Shirts" } });
    fireEvent.click(within(row("Shirts")).getByRole("button", { name: /save/i }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith("c1", { name: "Dress Shirts", description: null }));
  });

  it("hides and shows a category on the storefront", async () => {
    render(<CategoriesPage />);
    await screen.findByTestId("category-Shirts");
    fireEvent.click(within(row("Shirts")).getByRole("button", { name: /hide/i }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith("c1", { is_active: false }));
  });

  it("moves a category up the list", async () => {
    render(<CategoriesPage />);
    await screen.findByTestId("category-Shoes");
    fireEvent.click(within(row("Shoes")).getByRole("button", { name: /move up/i }));
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalledWith([{ id: "c3", sort_order: 0 }, { id: "c1", sort_order: 1 }]));
  });

  it("asks before deleting, and says why when a category still has products", async () => {
    api.deleteCategory.mockResolvedValue({ ok: false, message: "This category still has products. Move or remove them first." });
    render(<CategoriesPage />);
    await screen.findByTestId("category-Shoes");
    fireEvent.click(within(row("Shoes")).getByRole("button", { name: /^delete/i }));
    expect(api.deleteCategory).not.toHaveBeenCalled();
    fireEvent.click(within(row("Shoes")).getByRole("button", { name: /yes, delete/i }));
    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith("c3"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/still has products/);
  });
});
