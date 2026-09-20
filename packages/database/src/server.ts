import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.gen";

export async function createServerClient() {
  let cookieStore: any = null;
  try {
    // @ts-ignore
    const { cookies } = await import("next/headers");
    cookieStore = await cookies();
  } catch {
    // Environment where next/headers is not available
  }

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy",
    {
      cookies: {
        getAll() {
          return cookieStore?.getAll() || [];
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore?.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

/**
 * Service role client for server-only admin operations.
 * NEVER import this in client components or expose the key.
 */
export function createServiceClient() {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy"
  );
}
