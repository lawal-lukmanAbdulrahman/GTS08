export interface StaffFilterable {
  full_name: string | null;
  email: string | null;
  role: string;
  is_blocked: boolean;
}

export interface StaffFilters {
  query: string;
  role: string; // "all" or a role
  status: "all" | "active" | "blocked";
}

/** Narrows the staff list by name or email, role and whether they're blocked. */
export function filterStaff<T extends StaffFilterable>(staff: T[], f: StaffFilters): T[] {
  const q = f.query.trim().toLowerCase();
  return staff.filter((s) => {
    if (f.role !== "all" && s.role !== f.role) return false;
    if (f.status === "blocked" && !s.is_blocked) return false;
    if (f.status === "active" && s.is_blocked) return false;
    if (!q) return true;
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  });
}

export function paginate<T>(items: T[], page: number, size: number): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}
