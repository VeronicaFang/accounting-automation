import assert from "node:assert/strict";
import {
  createSupabaseRestHeaders,
  fetchSupabaseRows,
  getSupabaseRestConfig,
  isSupabaseRestConfigured
} from "./supabase-rest.ts";

assert.equal(isSupabaseRestConfigured({}), false);
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

globalThis.fetch = originalFetch;

console.log("supabase rest config: 6 assertions passed");
