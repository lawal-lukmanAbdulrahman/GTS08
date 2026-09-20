import { describe, it, expect } from "vitest";
import { filterStaff, paginate } from "./staff-filter";

const S = (id: string, name: string, email: string, role: string, blocked = false) => ({ id, full_name: name, email, role, is_blocked: blocked });
const LIST = [S("1", "Ada Obi", "ada@gts.ng", "cashier"), S("2", "Bola Ade", "bola@gts.ng", "admin"), S("3", "Chidi Eze", "chidi@gts.ng", "cashier", true), S("4", "Ada Nwosu", "nwosu@gts.ng", "inventory_staff")];

describe("filterStaff", () => {
  it("returns everyone with no filters", () => expect(filterStaff(LIST, { query: "", role: "all", status: "all" })).toHaveLength(4));
  it("matches name or email, ignoring case and spaces", () => {
    expect(filterStaff(LIST, { query: "  ADA ", role: "all", status: "all" }).map((s) => s.id)).toEqual(["1", "4"]);
    expect(filterStaff(LIST, { query: "chidi@", role: "all", status: "all" }).map((s) => s.id)).toEqual(["3"]);
  });
  it("filters by role", () => expect(filterStaff(LIST, { query: "", role: "cashier", status: "all" }).map((s) => s.id)).toEqual(["1", "3"]));
  it("filters by status", () => {
    expect(filterStaff(LIST, { query: "", role: "all", status: "blocked" }).map((s) => s.id)).toEqual(["3"]);
    expect(filterStaff(LIST, { query: "", role: "all", status: "active" })).toHaveLength(3);
  });
  it("combines filters", () => expect(filterStaff(LIST, { query: "ada", role: "cashier", status: "active" }).map((s) => s.id)).toEqual(["1"]));
  it("copes with missing names and emails", () => {
    expect(filterStaff([{ id: "x", full_name: null, email: null, role: "cashier", is_blocked: false }], { query: "a", role: "all", status: "all" })).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  it("returns a page and the page count", () => {
    expect(paginate(items, 1, 10)).toMatchObject({ items: items.slice(0, 10), page: 1, pages: 3, total: 23 });
    expect(paginate(items, 3, 10).items).toEqual([20, 21, 22]);
  });
  it("clamps an out-of-range page", () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
  });
  it("handles an empty list", () => expect(paginate([], 1, 10)).toMatchObject({ items: [], page: 1, pages: 1, total: 0 }));
});
