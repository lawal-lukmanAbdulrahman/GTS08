import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../_lib/http";

/**
 * GET /api/v1/search/suggestions?q=&limit=8
 *
 * Returns:
 *   - If `q` is empty: trending searches (most popular queries with results > 0 in last 14d)
 *   - If `q` is provided: autocomplete suggestions from past successful queries
 *
 * This powers the "Trending Searches" chips and live autocomplete in the dropdown.
 * Data comes from real user search history (self-improving / collective intelligence).
 */

// In-memory cache for trending queries (refreshed every 5 minutes)
let trendingCache: { data: string[]; at: number } | null = null;
const TRENDING_TTL = 5 * 60_000; // 5 min

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
    const limit = Math.min(parseInt(searchParams.get("limit") || "8", 10), 20);

    const supabase = createServiceClient();

    // ── No query: return trending searches ──────────────────────────────────
    if (!q) {
      if (trendingCache && Date.now() - trendingCache.at < TRENDING_TTL) {
        return NextResponse.json({ data: trendingCache.data.slice(0, limit) }, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
        });
      }

      // Aggregate top queries from the last 14 days that had results
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("search_queries")
        .select("query, results_count")
        .gt("results_count", 0)
        .gte("created_at", fourteenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(2000);

      // Count and rank queries
      const counts = new Map<string, number>();
      for (const row of rows || []) {
        const normalized = row.query.toLowerCase().trim();
        if (normalized.length < 2) continue;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }

      const trending = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([term]) => term);

      trendingCache = { data: trending, at: Date.now() };

      return NextResponse.json({ data: trending.slice(0, limit) }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    }

    // ── With query: autocomplete from past successful searches ───────────────
    // Find queries that start with or closely match the user's input
    const { data: rows } = await supabase
      .from("search_queries")
      .select("query, results_count")
      .gt("results_count", 0)
      .ilike("query", `${q}%`)
      .order("created_at", { ascending: false })
      .limit(500);

    // Deduplicate and rank by frequency
    const counts = new Map<string, number>();
    for (const row of rows || []) {
      const normalized = row.query.toLowerCase().trim();
      if (normalized.length < 2 || normalized === q) continue;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    let suggestions = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);

    // If prefix matching found few results, try fuzzy matching too
    if (suggestions.length < 3) {
      const { data: fuzzyRows } = await supabase
        .from("search_queries")
        .select("query, results_count")
        .gt("results_count", 0)
        .order("created_at", { ascending: false })
        .limit(1000);

      const fuzzyCounts = new Map<string, number>();
      const existingSet = new Set(suggestions);
      for (const row of fuzzyRows || []) {
        const normalized = row.query.toLowerCase().trim();
        if (normalized.length < 2 || normalized === q || existingSet.has(normalized)) continue;
        // Simple containment check + edit distance approximation
        if (normalized.includes(q) || q.includes(normalized) || editDistanceClose(q, normalized)) {
          fuzzyCounts.set(normalized, (fuzzyCounts.get(normalized) || 0) + 1);
        }
      }

      const fuzzy = Array.from(fuzzyCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit - suggestions.length)
        .map(([term]) => term);

      suggestions = [...suggestions, ...fuzzy];
    }

    return NextResponse.json({ data: suggestions }, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (err) {
    return serverError(err);
  }
}

/** Quick check: are two strings within edit distance 2? */
function editDistanceClose(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 2) return true;

  let dist = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) dist++;
    if (dist > 2) return false;
  }
  dist += Math.abs(a.length - b.length);
  return dist <= 2;
}
