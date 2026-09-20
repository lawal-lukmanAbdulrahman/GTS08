/** Shown instead of the profile when someone signs in with the one-time password an admin gave them. */
export default function MustChangeNotice({ name }: { name: string }) {
  return (
    <div role="alert" className="rounded-[10px] border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-1">
      <p className="text-base font-bold text-amber-900 dark:text-amber-200">
        {name ? `Welcome, ${name}. ` : "Welcome. "}Please set a new password to continue.
      </p>
      <p className="text-sm text-amber-800 dark:text-amber-300">
        You signed in with a one-time password from an admin. Choose one only you know; you&apos;ll go straight to your work afterwards.
      </p>
    </div>
  );
}
