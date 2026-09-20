"use client";

import { formatWAT } from "@gts/utils";
import { describeActivity } from "../../lib/activity-labels";
import type { ActivityEntryView } from "../../lib/staff-types";

interface Props {
  entries: ActivityEntryView[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

/** A staff member's audit trail as readable sentences, newest first. */
export default function ActivityList({ entries, loading, error, hasMore, onLoadMore }: Props) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }
  if (loading && entries.length === 0) return <p className="text-sm text-gray-500">Loading activity...</p>;
  if (entries.length === 0) return <p className="text-sm text-gray-500">No activity yet.</p>;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-gray-100 dark:divide-[#262626] rounded-[8px] border border-gray-200 dark:border-[#262626]">
        {entries.map((entry) => {
          const { title, detail } = describeActivity(entry);
          return (
            <li key={entry.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                {detail && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{detail}</p>}
              </div>
              <time dateTime={entry.created_at} className="text-[11px] text-gray-400 whitespace-nowrap">
                {formatWAT(entry.created_at)}
              </time>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424] disabled:opacity-50"
        >
          Load more
        </button>
      )}
    </div>
  );
}
