"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { apiCall } from "../../lib/staff-api";
import { OperatingHoursPicker } from "./operating-hours-picker";


export interface PickupStation {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  phone?: string | null;
  operating_hours?: string | null;
  notes?: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

const INITIAL_FORM = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "Ikeja",
  state: "Lagos",
  phone: "",
  operating_hours: "Mon - Sat: 9:00 AM - 6:00 PM",
  notes: "",
  is_active: true,
  is_default: false,
};

export default function AdminPickupStationsPage() {
  const [stations, setStations] = useState<PickupStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiCall<PickupStation[]>("/pickup-stations?all=true");
    if (res.ok) {
      setStations(res.data || []);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      ...INITIAL_FORM,
      is_default: stations.length === 0,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (station: PickupStation) => {
    setEditingId(station.id);
    setFormData({
      name: station.name,
      address_line1: station.address_line1,
      address_line2: station.address_line2 || "",
      city: station.city,
      state: station.state,
      phone: station.phone || "",
      operating_hours: station.operating_hours || "Mon - Sat: 9:00 AM - 6:00 PM",
      notes: station.notes || "",
      is_active: station.is_active,
      is_default: station.is_default,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address_line1.trim() || !formData.city.trim()) {
      setFormError("Name, Address Line 1, and City are required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      name: formData.name.trim(),
      address_line1: formData.address_line1.trim(),
      address_line2: formData.address_line2.trim() || null,
      city: formData.city.trim(),
      state: formData.state.trim() || "Lagos",
      phone: formData.phone.trim() || null,
      operating_hours: formData.operating_hours.trim() || null,
      notes: formData.notes.trim() || null,
      is_active: formData.is_active,
      is_default: formData.is_default,
    };

    const res = editingId
      ? await apiCall(`/pickup-stations/${editingId}`, { method: "PATCH", json: payload })
      : await apiCall("/pickup-stations", { method: "POST", json: payload });

    if (res.ok) {
      setModalOpen(false);
      await loadStations();
    } else {
      setFormError(res.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (station: PickupStation) => {
    const res = await apiCall(`/pickup-stations/${station.id}`, {
      method: "PATCH",
      json: { is_active: !station.is_active },
    });
    if (res.ok) {
      await loadStations();
    }
  };

  const handleSetDefault = async (station: PickupStation) => {
    if (station.is_default) return;
    const res = await apiCall(`/pickup-stations/${station.id}`, {
      method: "PATCH",
      json: { is_default: true, is_active: true },
    });
    if (res.ok) {
      await loadStations();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await apiCall(`/pickup-stations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeletingId(null);
      await loadStations();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="px-4 pt-3.5 pb-8 sm:px-6 lg:px-8 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip
        breadcrumbs={[
          { label: "Fulfilment", href: "/admin/orders" },
          { label: "Pickup Stations" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#262626] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Pickup Stations
          </h1>
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">
            Manage physical collection points and stores for customer pickup and in-person payment.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#010101] text-white hover:bg-black/85 text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Pickup Station
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadStations} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
          <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Loading pickup stations...</p>
        </div>
      ) : stations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-[#262626] p-12 text-center space-y-3 bg-gray-50/50 dark:bg-[#141414]">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#242424] flex items-center justify-center mx-auto text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">No pickup stations yet</h3>
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] max-w-sm mx-auto">
            Create your first pickup station so customers can choose where to pick up their orders at checkout.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-[#010101] text-white hover:bg-black/85 text-xs font-bold cursor-pointer"
          >
            Create Station
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stations.map((st) => (
            <div
              key={st.id}
              className={`rounded-2xl border p-5 space-y-4 transition-all bg-white dark:bg-[#1A1A1A] ${
                st.is_default
                  ? "border-[#EDCF5D] ring-2 ring-[#EDCF5D]/20 shadow-xs"
                  : "border-gray-200 dark:border-[#262626] hover:border-gray-300"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                      {st.name}
                    </h3>
                    {st.is_default && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EDCF5D]/30 text-amber-900 dark:text-amber-200">
                        Default Hub
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-block mt-1 text-[11px] font-mono font-semibold ${
                      st.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                    }`}
                  >
                    ● {st.is_active ? "Active for Checkout" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(st)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#242424] transition-colors"
                    title="Edit station"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(st.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Delete station"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Address Details */}
              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{st.address_line1}</p>
                    {st.address_line2 && <p className="text-gray-500">{st.address_line2}</p>}
                    <p className="text-gray-500">{st.city}, {st.state}</p>
                  </div>
                </div>

                {st.operating_hours && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-500">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{st.operating_hours}</span>
                  </div>
                )}

                {st.phone && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-gray-500">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    <span>{st.phone}</span>
                  </div>
                )}

                {st.notes && (
                  <p className="text-[11px] text-gray-400 italic pt-1 border-t border-gray-100 dark:border-[#262626]">
                    {st.notes}
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[#262626] text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleActive(st)}
                  className={`font-semibold cursor-pointer ${
                    st.is_active
                      ? "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                      : "text-emerald-600 hover:text-emerald-700"
                  }`}
                >
                  {st.is_active ? "Deactivate" : "Activate"}
                </button>

                {!st.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(st)}
                    className="font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Make Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-xl max-w-lg sm:max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#262626] pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Pickup Station" : "Add Pickup Station"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Station Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. GTS Flagship Hub - Ikeja"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Street Address (Line 1) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12 Allen Avenue"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Address Line 2 / Landmark / Floor (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suite 4, Ground Floor, Opposite Zenith Bank"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700 dark:text-gray-300">
                    City *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ikeja"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700 dark:text-gray-300">
                    State *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lagos"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0814 000 0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <OperatingHoursPicker
                value={formData.operating_hours}
                onChange={(val) => setFormData({ ...formData, operating_hours: val })}
              />

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Pickup Instructions / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer should present their order code at the pickup counter."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-[#262626]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded accent-black"
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Active for customer checkout
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded accent-black"
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Set as default / primary hub
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#242424] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#010101] text-white hover:bg-black/85 font-bold cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingId ? "Save Changes" : "Create Station"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-[#262626] p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Delete pickup station?</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              If any previous orders were placed for this station, it will be deactivated instead of permanently erased to preserve order history.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
