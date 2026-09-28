import { API_BASE } from "./api-base";
import { authFetch } from "./session";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  banner_cloudinary_id: string | null;
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

async function send<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await authFetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: body?.error || "Something went wrong. Please try again.", fieldErrors: body?.details };
    return { ok: true, data: body?.data as T };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

/** Every category, hidden ones included (needs the manage-products grant). */
export const listCategories = () => send<AdminCategory[]>("/categories?all=true");

export const createCategory = (v: { name: string; parent_id: string | null; description: string }) =>
  send<AdminCategory>("/categories", { method: "POST", body: JSON.stringify({ name: v.name.trim(), parent_id: v.parent_id, description: v.description.trim() || null }) });

export const updateCategory = (id: string, patch: Partial<Pick<AdminCategory, "name" | "description" | "parent_id" | "is_active" | "banner_cloudinary_id">>) =>
  send<AdminCategory>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteCategory = (id: string) => send<unknown>(`/categories/${id}`, { method: "DELETE" });

export const reorderCategories = (order: Array<{ id: string; sort_order: number }>) =>
  send<unknown>("/categories/reorder", { method: "PUT", body: JSON.stringify(order) });
