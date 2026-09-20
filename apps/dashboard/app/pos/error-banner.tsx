"use client";

/** A dismissible error strip. Stale errors must never outlive the thing they were about. */
export default function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 px-6 py-3 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 min-w-[32px] min-h-[32px] text-lg leading-none text-red-500">
        &times;
      </button>
    </div>
  );
}
