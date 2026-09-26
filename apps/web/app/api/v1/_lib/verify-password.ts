import { createClient } from "@supabase/supabase-js";

/**
 * Checks a password without side effects on anything else. This must not be done
 * on the service client: a supabase-js client that signs a user in sends every
 * later request as that user rather than with its service key, so row-level
 * security starts applying to it (audit-log writes, for one, were being refused).
 * A throwaway client with no stored session keeps the check on its own.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false;
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data?.user) return false;
    await client.auth.signOut().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
