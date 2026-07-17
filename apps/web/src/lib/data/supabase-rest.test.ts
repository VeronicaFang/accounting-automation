import assert from "node:assert/strict";
import {
  createSupabaseRestHeaders,
  fetchAllSupabaseRows,
  fetchSupabaseRows,
  getSupabaseRestConfig,
  getSupabaseRestDiagnostics,
  isSupabaseRestConfigured
} from "./supabase-rest.ts";

assert.equal(isSupabaseRestConfigured({}), false);
assert.deepEqual(getSupabaseRestDiagnostics({}), {
  useSupabase: null,
  hasSupabaseUrl: false,
  hasPublishableKey: false,
  isConfigured: false
});

assert.equal(
  isSupabaseRestConfigured({
    NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE: "false",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable"
  }),
  false
);

assert.deepEqual(
  getSupabaseRestConfig({
    NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable"
  }),
  {
    restUrl: "https://example.supabase.co/rest/v1",
    publishableKey: "publishable"
  }
);

await assert.rejects(
  () => fetchSupabaseRows("households", { select: "id" }, {}),
  /Supabase REST is not configured/
);

assert.deepEqual(createSupabaseRestHeaders({ publishableKey: "publishable" }), {
  apikey: "publishable",
  Authorization: "Bearer publishable",
  Accept: "application/json"
});

assert.deepEqual(createSupabaseRestHeaders({ publishableKey: "publishable" }, "user-jwt"), {
  apikey: "publishable",
  Authorization: "Bearer user-jwt",
  Accept: "application/json"
});

const originalFetch = globalThis.fetch;
let sentAuthorization = "";

globalThis.fetch = async (_input, init) => {
  sentAuthorization = String((init?.headers as Record<string, string>).Authorization);

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

await fetchSupabaseRows(
  "households",
  { select: "id" },
  {
    NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable"
  },
  "user-jwt"
);

assert.equal(sentAuthorization, "Bearer user-jwt");

const requestedRanges: string[] = [];
globalThis.fetch = async (_input, init) => {
  const range = String((init?.headers as Record<string, string>).Range ?? "");
  requestedRanges.push(range);
  const rows = range === "0-1" ? [{ id: "a" }, { id: "b" }] : [{ id: "c" }];

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const pagedRows = await fetchAllSupabaseRows(
  "expenses",
  { select: "id" },
  {
    NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable"
  },
  "user-jwt",
  2
);

assert.deepEqual(pagedRows, [{ id: "a" }, { id: "b" }, { id: "c" }]);
assert.deepEqual(requestedRanges, ["0-1", "2-3"]);

globalThis.fetch = originalFetch;

console.log("supabase rest config: 10 assertions passed");
