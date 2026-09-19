"use client";

import { useCallback, useEffect, useState } from "react";
import ActivityList from "../components/staff/activity-list";
import SalesPanel from "../components/staff/sales-panel";
import StaffMenu from "../components/staff/staff-menu";
import IdleLockScreen from "../components/idle/idle-lock-screen";
import { useIdleLock } from "../components/idle/use-idle-lock";
import { apiCall } from "../lib/staff-api";
import { reauthenticate, getSessionUser, signOut } from "../lib/session";
import { useStaffSession } from "../lib/use-staff-session";
import type { ActivityEntryView, SalesRangeId, SalesRecordView } from "../lib/staff-types";
import MyFlags, { type MyFlag } from "./my-flags";
import PasswordForm, { type PasswordChangeInput, type PasswordChangeOutcome } from "./password-form";
import PermissionList from "./permission-list";
import PhoneForm, { type PhoneSaveResult } from "./phone-form";

const ACTIVITY_PAGE = 30;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const session = useStaffSession();
  const { profile } = session;

  const idle = useIdleLock({ enabled: !!profile });

  // Sales
  const [range, setRange] = useState<SalesRangeId>("today");
  const [sales, setSales] = useState<SalesRecordView | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setSalesLoading(true);
    setSalesError(null);
    apiCall<SalesRecordView>(`/staff/me/sales?range=${range}`).then((r) => {
      if (cancelled) return;
      if (r.ok) setSales(r.data);
      else setSalesError(r.message);
      setSalesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, range]);

  // Activity (newest first, paged backwards)
  const [activity, setActivity] = useState<ActivityEntryView[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityMore, setActivityMore] = useState(false);

  const loadActivity = useCallback(async (before?: string) => {
    setActivityLoading(true);
    const qs = new URLSearchParams({ limit: String(ACTIVITY_PAGE) });
    if (before) qs.set("before", before);
    const r = await apiCall<ActivityEntryView[]>(`/staff/me/activity?${qs}`);
    if (r.ok) {
      setActivity((prev) => (before ? [...prev, ...r.data] : r.data));
      setActivityMore(r.data.length === ACTIVITY_PAGE);
      setActivityError(null);
    } else {
      setActivityError(r.message);
    }
    setActivityLoading(false);
  }, []);

  useEffect(() => {
    if (profile) void loadActivity();
  }, [profile, loadActivity]);

  // Flags raised by this person (only relevant to POS staff)
  const [flags, setFlags] = useState<MyFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.permissions.can_process_pos) return;
    setFlagsLoading(true);
    apiCall<MyFlag[]>("/pos/flags").then((r) => {
      if (r.ok) setFlags(r.data);
      else setFlagsError(r.message);
      setFlagsLoading(false);
    });
  }, [profile]);

  async function savePhone(phone: string): Promise<PhoneSaveResult> {
    const r = await apiCall<{ phone: string | null }>("/staff/me", { method: "PATCH", json: { phone } });
    return r.ok ? { ok: true, phone: r.data.phone } : { ok: false, message: r.message, fieldErrors: r.details };
  }

  async function changePassword(input: PasswordChangeInput): Promise<PasswordChangeOutcome> {
    const r = await apiCall("/staff/me/password", { method: "POST", json: input });
    return r.ok ? { ok: true } : { ok: false, message: r.message, fieldErrors: r.details };
  }

  if (session.loading) {
    return <p className="p-8 text-sm text-gray-500">Loading your profile...</p>;
  }
  if (!profile) {
    return (
      <div className="p-8 space-y-3" role="alert">
        <p className="text-sm text-red-600 dark:text-red-400">{session.error ?? "Couldn't load your profile."}</p>
        <button type="button" onClick={session.reload} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#1C1C1C] font-sans">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-gray-900 dark:text-white">My profile</h1>
          {session.canUsePos && (
            <a href="/pos" className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white">
              ← Back to POS
            </a>
          )}
        </div>
        <StaffMenu
          name={profile.full_name ?? ""}
          role={profile.role}
          isAdmin={session.isAdmin}
          canUsePos={session.canUsePos}
          current="profile"
          onSignOut={session.signOut}
        />
      </header>

      <main className="mx-auto max-w-4xl p-4 lg:p-6 space-y-10">
        <Section title="Your details">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">{profile.full_name || "—"}</dd>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">{profile.email}</dd>
            <dt className="text-gray-500">Role</dt>
            <dd className="font-semibold text-gray-900 dark:text-white capitalize">{profile.role.replace("_", " ")}</dd>
          </dl>
          <PhoneForm initialPhone={profile.phone} onSave={savePhone} />
        </Section>

        <Section title="What you can do" hint="Set by an admin. If something's missing, ask them.">
          <PermissionList permissions={profile.permissions} isAdmin={profile.is_admin} />
        </Section>

        <Section title="My sales" hint="Sales you took payment for, in Lagos time.">
          <SalesPanel range={range} onRangeChange={setRange} record={sales} loading={salesLoading} error={salesError} />
        </Section>

        {profile.permissions.can_process_pos && (
          <Section title="My product flags" hint="Problems you've reported on products, and what the admin said.">
            <MyFlags flags={flags} loading={flagsLoading} error={flagsError} />
          </Section>
        )}

        <Section title="My activity" hint="Everything you've done in the system. Only you and admins can see this.">
          <ActivityList
            entries={activity}
            loading={activityLoading}
            error={activityError}
            hasMore={activityMore}
            onLoadMore={() => activity.length && void loadActivity(activity[activity.length - 1]!.created_at)}
          />
        </Section>

        <Section title="Change password">
          <PasswordForm onSubmit={changePassword} />
        </Section>
      </main>

      <IdleLockScreen
        state={idle.state}
        name={profile.full_name ?? ""}
        onStay={idle.stayActive}
        onUnlock={async (password) => {
          const result = await reauthenticate(getSessionUser()?.email ?? profile.email ?? "", password);
          if (result.ok) idle.unlock();
          return result;
        }}
        onSignOut={() => void signOut({ reason: "idle" })}
      />
    </div>
  );
}
