export type Call = { method: string; args: unknown[] };
export type Result = { data: unknown; error: unknown; count?: number };

/**
 * A chainable stand-in for the Supabase service client. Every table returns
 * the configured result whichever way the query ends (await, single, maybeSingle),
 * and every builder call is recorded so a test can assert what was queried.
 */
export function makeDbStub() {
  const results: Record<string, Result | ((calls: Call[]) => Result)> = {};
  const calls: Record<string, Call[]> = {};
  const touched: string[] = [];

  const resultFor = (table: string, log: Call[]): Result => {
    const r = results[table];
    if (typeof r === "function") return r(log);
    return r ?? { data: null, error: null };
  };

  const client = {
    from(table: string) {
      touched.push(table);
      const log: Call[] = []; // this query only, for result functions
      const all: Call[] = (calls[table] ??= []); // every query on the table since reset, for assertions
      const stub: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") return (resolve: (v: Result) => void) => resolve(resultFor(table, log));
            return (...args: unknown[]) => {
              log.push({ method: prop, args });
              all.push({ method: prop, args });
              if (prop === "single" || prop === "maybeSingle") return Promise.resolve(resultFor(table, log));
              return stub;
            };
          },
        }
      );
      return stub;
    },
  };

  return {
    client,
    results,
    calls,
    touched,
    called: (table: string, method: string) => calls[table]?.find((c) => c.method === method),
    reset() {
      for (const k of Object.keys(results)) delete results[k];
      for (const k of Object.keys(calls)) delete calls[k];
      touched.length = 0;
    },
  };
}
