"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory, type AdminCategory } from "../../lib/categories-api";

const INPUT = "w-full px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#1C1C1C]";
const SMALL_BUTTON = "px-2.5 py-1 text-[11px] font-semibold rounded-[6px] disabled:opacity-40";

const byOrder = (a: AdminCategory, b: AdminCategory) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/** Categories: what the storefront menu, category tiles and product filters show. */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");

  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listCategories();
    if (r.ok) {
      setCategories(r.data);
      setLoadError(null);
    } else setLoadError(r.message);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs a change, shows its error if refused, and reloads the list either way. */
  const run = async (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setActionError(null);
    const r = await action();
    if (!r.ok) setActionError(r.message ?? "Something went wrong.");
    await load();
    setBusy(false);
    return r.ok;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await run(() => createCategory({ name, parent_id: parentId || null, description }));
    if (ok) {
      setName("");
      setDescription("");
      setParentId("");
    }
  };

  const move = (cat: AdminCategory, direction: -1 | 1) => {
    const siblings = (categories ?? []).filter((c) => c.parent_id === cat.parent_id).sort(byOrder);
    const i = siblings.findIndex((c) => c.id === cat.id);
    const j = i + direction;
    if (j < 0 || j >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[i], reordered[j]] = [reordered[j]!, reordered[i]!];
    const changed = reordered.map((c, index) => ({ id: c.id, sort_order: index })).filter((c, index) => siblings[index]!.id !== c.id || siblings[index]!.sort_order !== index);
    void run(() => reorderCategories(changed));
  };

  const all = categories ?? [];
  const parents = all.filter((c) => !c.parent_id).sort(byOrder);
  const ordered = parents.flatMap((p) => [p, ...all.filter((c) => c.parent_id === p.id).sort(byOrder)]);
  // A sub-category whose parent was removed still needs to be reachable.
  const orphans = all.filter((c) => c.parent_id && !all.some((p) => p.id === c.parent_id));

  const renderRow = (cat: AdminCategory) => {
    const siblings = all.filter((c) => c.parent_id === cat.parent_id).sort(byOrder);
    const index = siblings.findIndex((c) => c.id === cat.id);
    const parent = cat.parent_id ? all.find((p) => p.id === cat.parent_id) : undefined;
    const isThisDeleting = deletingId === cat.id;
    const isAnyBusy = busy || deletingId !== null;

    return (
      <li
        key={cat.id}
        data-testid={`category-${cat.name}`}
        className={`py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-opacity duration-150 ${cat.parent_id ? "sm:pl-8" : ""} ${
          isThisDeleting ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {editing === cat.id ? (
          <div className="flex-1 space-y-2">
            <label className="sr-only" htmlFor={`edit-name-${cat.id}`}>
              Category name
            </label>
            <input id={`edit-name-${cat.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} className={INPUT} />
            <textarea aria-label="Description" rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className={INPUT} placeholder="Description (optional)" />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isAnyBusy || !editName.trim()}
                onClick={async () => {
                  if (await run(() => updateCategory(cat.id, { name: editName.trim(), description: editDescription.trim() || null }))) setEditing(null);
                }}
                className={`${SMALL_BUTTON} bg-[#010101] text-white`}
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(null)} className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {cat.parent_id && <span className="text-gray-400">↳</span>}
              {cat.name}
              {!cat.is_active && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 dark:bg-[#333] text-gray-600 dark:text-gray-300">Hidden</span>}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {parent ? `Under ${parent.name} · ` : ""}/{cat.slug}
              {cat.description ? ` · ${cat.description}` : ""}
            </p>
          </div>
        )}

        {editing !== cat.id && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-label="Move up"
              disabled={isAnyBusy || index <= 0}
              onClick={() => move(cat, -1)}
              className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={isAnyBusy || index >= siblings.length - 1}
              onClick={() => move(cat, 1)}
              className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}
            >
              ↓
            </button>
            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                setEditing(cat.id);
                setEditName(cat.name);
                setEditDescription(cat.description ?? "");
              }}
              className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => void run(() => updateCategory(cat.id, { is_active: !cat.is_active }))}
              className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}
            >
              {cat.is_active ? "Hide" : "Show"}
            </button>
            {confirmDelete === cat.id ? (
              <>
                <button
                  type="button"
                  aria-label="Yes, delete"
                  disabled={isAnyBusy}
                  onClick={async () => {
                    setDeletingId(cat.id);
                    try {
                      await run(() => deleteCategory(cat.id));
                    } finally {
                      setDeletingId(null);
                      setConfirmDelete(null);
                    }
                  }}
                  className={`${SMALL_BUTTON} bg-red-600 text-white inline-flex items-center gap-1.5`}
                >
                  {isThisDeleting ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-white shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    "Yes, delete"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isAnyBusy}
                  onClick={() => setConfirmDelete(null)}
                  className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isAnyBusy}
                onClick={() => setConfirmDelete(cat.id)}
                className={`${SMALL_BUTTON} text-red-600 bg-red-50 dark:bg-red-950/30 disabled:opacity-40`}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Categories" }]} />

      <div className="border-b border-gray-200 dark:border-[#262626] pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Categories</h1>
        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">
          What the storefront menu, category tiles and product filters show. Hidden categories stay here but aren&apos;t shown to shoppers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] items-start">
        <form onSubmit={add} className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Add a category</h2>
          <div className="space-y-1">
            <label htmlFor="new-name" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Name
            </label>
            <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="e.g. Shirts" />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-parent" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Parent (optional)
            </label>
            <select id="new-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className={INPUT}>
              <option value="">None: a top-level category</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="new-description" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Description (optional)
            </label>
            <textarea id="new-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
          </div>
          <button type="submit" disabled={busy || !name.trim()} className="px-4 py-2 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40">
            Add category
          </button>
        </form>

        <section className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] p-4 space-y-2 relative overflow-hidden">
          {deletingId && (
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold animate-pulse">
              <svg className="animate-spin h-3.5 w-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Deleting category... Please wait.</span>
            </div>
          )}
          {busy && !deletingId && (
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold animate-pulse">
              <svg className="animate-spin h-3.5 w-3.5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating categories...</span>
            </div>
          )}
          {actionError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
          {loadError && (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
              <button type="button" onClick={() => void load()} className={`${SMALL_BUTTON} bg-gray-100 dark:bg-[#242424]`}>
                Try again
              </button>
            </div>
          )}
          {!categories && !loadError && <p className="text-sm text-gray-500">Loading categories...</p>}
          {categories && categories.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No categories yet. Add your first one: it appears on the storefront as soon as it has products to show.
            </p>
          )}
          {categories && categories.length > 0 && <ul className="divide-y divide-gray-100 dark:divide-[#262626]">{[...ordered, ...orphans].map(renderRow)}</ul>}
        </section>
      </div>
    </div>
  );
}
