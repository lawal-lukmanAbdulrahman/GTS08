"use client";

import { useState } from "react";

export interface AdminDetails {
  full_name: string | null;
  avatar_cloudinary_id: string | null;
}

export type DetailsSaveResult = { ok: true; saved: AdminDetails } | { ok: false; message: string; fieldErrors?: Record<string, string> };
export type UploadResult = { ok: true; publicId: string } | { ok: false; message: string };

interface Props {
  initial: AdminDetails;
  onSave: (patch: Partial<AdminDetails>) => Promise<DetailsSaveResult>;
  onUpload: (file: File) => Promise<UploadResult>;
}

/** The photo's address from its Cloudinary id (or the address itself). */
export function avatarUrl(id: string | null): string | null {
  if (!id) return null;
  if (/^https?:\/\//.test(id)) return id;
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_160/${id}` : null;
}

/** An admin's own name and profile photo. Email and role are fixed. */
export default function AdminDetailsForm({ initial, onSave, onUpload }: Props) {
  const [details, setDetails] = useState(initial);
  const [name, setName] = useState(initial.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const save = async (patch: Partial<AdminDetails>) => {
    setBusy(true);
    setError(null);
    setFieldError(null);
    setSavedNote(false);
    const r = await onSave(patch);
    setBusy(false);
    if (r.ok) {
      setDetails(r.saved);
      setName(r.saved.full_name ?? "");
      setSavedNote(true);
    } else {
      setError(r.fieldErrors ? null : r.message);
      setFieldError(r.fieldErrors?.full_name ?? r.fieldErrors?.avatar_cloudinary_id ?? null);
      if (r.fieldErrors && !r.fieldErrors.full_name && !r.fieldErrors.avatar_cloudinary_id) setError(r.message);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const up = await onUpload(file);
    setBusy(false);
    if (!up.ok) {
      setError(up.message);
      return;
    }
    await save({ avatar_cloudinary_id: up.publicId });
  };

  const photo = avatarUrl(details.avatar_cloudinary_id);
  const initialLetter = (details.full_name || "?").trim().charAt(0).toUpperCase();
  const dirty = name.trim() !== (details.full_name ?? "").trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {photo ? (
          <img src={photo} alt="Your profile photo" className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-[#333]" />
        ) : (
          <span className="w-16 h-16 rounded-full bg-[#010101] text-white flex items-center justify-center text-xl font-bold">{initialLetter}</span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424] cursor-pointer">
            Change photo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          </label>
          {details.avatar_cloudinary_id && (
            <button type="button" disabled={busy} onClick={() => void save({ avatar_cloudinary_id: null })} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] text-red-600 bg-red-50 dark:bg-red-950/30 disabled:opacity-40">
              Remove photo
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && dirty) void save({ full_name: name.trim() });
        }}
        className="space-y-2 max-w-sm"
      >
        <label htmlFor="admin-name" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Your name
        </label>
        <input
          id="admin-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSavedNote(false);
          }}
          className={`w-full px-3 py-2 text-sm rounded-[6px] border bg-white dark:bg-[#1C1C1C] ${fieldError ? "border-red-500" : "border-gray-200 dark:border-[#383838]"}`}
        />
        {fieldError && <p className="text-xs text-red-600 dark:text-red-400">{fieldError}</p>}
        <button type="submit" disabled={busy || !name.trim() || !dirty} className="px-4 py-2 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40">
          {busy ? "Saving..." : "Save"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {savedNote && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          Your details are saved.
        </p>
      )}
    </div>
  );
}
