import assert from "node:assert/strict";
import { getSupabaseRestConfig, isSupabaseRestConfigured } from "./supabase-rest.ts";

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

console.log("supabase rest config: 3 assertions passed");
