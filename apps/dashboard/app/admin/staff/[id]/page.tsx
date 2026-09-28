"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatWAT } from "@gts/utils";
import { AdminTopStrip } from "../../sidebar-context";
import SalesPanel from "../../../components/staff/sales-panel";
import ActivityList from "../../../components/staff/activity-list";
import { apiCall } from "../../../lib/staff-api";
import { useLive } from "../../../lib/use-live";
import type { ActivityEntryView, PermissionsView, SalesRangeId, SalesRecordView } from "../../../lib/staff-types";
import PermissionEditor from "./permission-editor";
import RemoveStaff from "./remove-staff";
import { getSessionUser } from "../../../lib/session";

interface StaffRecord {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: string;
    is_blocked: boolean;
    is_super_admin?: boolean;
    created_at: string;
    permissions: PermissionsView;
  };
  sales: SalesRecordView;
  activity: ActivityEntryView[];
}

/** An admin's view of one staff member: who they are, what they may do, what they've sold and what they've done. */
export default function StaffRecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // Only the super admin may block other admins or remove anyone; never themself, never the super admin.
  const [viewer, setViewer] = useState<{ id: string; isSuper: boolean } | null>(null);
  useEffect(() => {
    const me = getSessionUser();
    setViewer(me ? { id: me.id, isSuper: me.is_super_admin === true } : null);
  }, []);
  const [range, setRange] = useState<SalesRangeId>("today");
  // Kept live: a sale, a void or a sign-in shows up here within seconds, without a reload.
  const live = useLive<StaffRecord>(`/users/${id}?range=${range}`, { intervalMs: 10_000 });
  const record = live.data;
  const error = live.error;
  const loading = record === null && error === null;
  const load = (_which?: SalesRangeId) => live.refresh();

  async function patch(body: Record<string, unknown>) {
    const result = await apiCall(`/users/${id}`, { method: "PATCH", json: body });
    if (!result.ok) return { ok: false as const, message: result.message };
    live.refresh();
    return { ok: true as const };
  }

  const profile = record?.profile;
  const superControls = !!viewer?.isSuper && !!profile && !profile.is_super_admin && profile.id !== viewer.id;
  const name = profile?.full_name || profile?.email || "Staff member";

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip breadcrumbs={[{ label: "Staff", href: "/admin/staff" }, { label: name }]} />

      <div className="border-b border-gray-200 dark:border-[#262626] pb-4">
        <Link href="/admin/staff" className="text-xs text-gray-500 underline">
          ← All staff
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">{name}</h1>
        {profile && (
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">
            {profile.email} · {profile.role} · {profile.phone ?? "no phone"} · joined {formatWAT(profile.created_at)}
          </p>
        )}
      </div>

      {error && !record && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button type="button" onClick={() => load()} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
            Try again
          </button>
        </div>
      )}

      {loading && !record && <p className="text-sm text-gray-500">Loading...</p>}

      {record && profile && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Access</h2>
            <PermissionEditor
              name={name}
              permissions={profile.permissions}
              isAdminAccount={profile.role === "admin"}
              isBlocked={profile.is_blocked}
              onSavePermissions={(changes) => patch({ permissions: changes })}
              onSetBlocked={(blocked) => patch({ is_blocked: blocked })}
              canBlockAdmin={superControls}
            />
            {superControls && (
              <div className="border-t border-gray-200 dark:border-[#262626] pt-4">
                <RemoveStaff
                  name={name}
                  onRemove={async () => {
                    const r = await apiCall(`/users/${id}`, { method: "DELETE" });
                    return r.ok ? { ok: true as const } : { ok: false as const, message: r.message };
                  }}
                  onRemoved={() => router.push("/admin/staff")}
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Sales</h2>
            <SalesPanel range={range} onRangeChange={setRange} record={record.sales} loading={loading} error={error} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Recent activity</h2>
            <ActivityList entries={record.activity} />
          </section>
        </>
      )}
    </div>
  );
}
