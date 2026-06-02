import assert from "node:assert/strict";
import { getSupabaseAuthConfig, hasSupabaseHashSession, parseSupabaseHashSession } from "./supabase-auth.ts";

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

assert.equal(hasSupabaseHashSession("#access_token=a&refresh_token=r&type=signup"), true);

assert.equal(hasSupabaseHashSession("#access_token=a&type=signup"), false);

console.log("supabase auth helpers: 6 assertions passed");
