import assert from "node:assert/strict";
import { getSupabaseAuthConfig, parseSupabaseHashSession } from "./supabase-auth.ts";

assert.equal(getSupabaseAuthConfig({}), null);

assert.deepEqual(
  getSupabaseAuthConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000/"
  }),
  {
    authUrl: "https://example.supabase.co/auth/v1",
    publishableKey: "publishable",
    emailRedirectTo: "http://127.0.0.1:3000/auth/callback"
  }
);

assert.deepEqual(parseSupabaseHashSession("#access_token=a&refresh_token=r&expires_in=3600&token_type=bearer"), {
  accessToken: "a",
  refreshToken: "r",
  expiresIn: "3600",
  tokenType: "bearer"
});

assert.equal(parseSupabaseHashSession("#error=access_denied"), null);

console.log("supabase auth helpers: 4 assertions passed");
