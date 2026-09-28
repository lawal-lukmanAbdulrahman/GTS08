import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from "./categories-api";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("gts_token", "tok");
});
const reply = (status: number, body: unknown) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
const call = () => fetchMock.mock.calls[0]!;

describe("categories api", () => {
  it("lists every category, hidden ones included, with the staff token", async () => {
    reply(200, { data: [{ id: "c1", name: "Shirts" }] });
    expect(await listCategories()).toEqual({ ok: true, data: [{ id: "c1", name: "Shirts" }] });
    expect(String(call()[0])).toBe("/api/v1/categories?all=true");
    expect(new Headers(call()[1].headers).get("Authorization")).toBe("Bearer tok");
  });

  it("creates, updates, deletes and reorders through the category routes", async () => {
    reply(201, { data: { id: "c1" } });
    await createCategory({ name: "Shirts", parent_id: null, description: "" });
    expect(call()[1].method).toBe("POST");
    expect(JSON.parse(call()[1].body)).toEqual({ name: "Shirts", parent_id: null, description: null });

    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await updateCategory("c1", { is_active: false });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/v1/categories/c1");
    expect(fetchMock.mock.calls[0]![1].method).toBe("PATCH");

    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await deleteCategory("c1");
    expect(fetchMock.mock.calls[0]![1].method).toBe("DELETE");

    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await reorderCategories([{ id: "c1", sort_order: 0 }]);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/v1/categories/reorder");
    expect(fetchMock.mock.calls[0]![1].method).toBe("PUT");
  });

  it("passes on the server's message and field errors", async () => {
    reply(409, { error: "This category still has products. Move or remove them first.", code: "CATEGORY_IN_USE" });
    expect(await deleteCategory("c1")).toEqual({ ok: false, message: "This category still has products. Move or remove them first.", fieldErrors: undefined });
    reply(400, { error: "Please fix the highlighted fields.", details: { name: "Name is required." } });
    expect(await createCategory({ name: "", parent_id: null, description: "" })).toMatchObject({ ok: false, fieldErrors: { name: "Name is required." } });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await listCategories()).ok).toBe(false);
  });
});
