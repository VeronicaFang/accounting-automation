import assert from "node:assert/strict";

import {
  clearStoredSupabaseSession,
  getSessionExpiryDate,
  getSupabaseAuthConfig,
  hasSupabaseHashSession,
  isStoredSupabaseSessionValid,
  parseSupabaseAccessTokenUser,
  parseSupabaseHashSession,
  readStoredSupabaseSession,
  readStoredSupabaseUser,
  supabaseSessionStorageKey
} from "./supabase-auth.ts";

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

assert.deepEqual(
  parseSupabaseHashSession("#access_token=a&refresh_token=r&expires_in=3600&expires_at=1780384229&token_type=bearer"),
  {
    accessToken: "a",
    refreshToken: "r",
    expiresIn: "3600",
    expiresAt: "1780384229",
    tokenType: "bearer"
  }
);

assert.equal(parseSupabaseHashSession("#error=access_denied"), null);
assert.equal(hasSupabaseHashSession("#access_token=a&refresh_token=r&type=signup"), true);
assert.equal(hasSupabaseHashSession("#access_token=a&type=signup"), false);

const tokenPayload = Buffer.from(JSON.stringify({ sub: "user-1", email: "heartfish0309@gmail.com" })).toString("base64url");
const fakeJwt = `header.${tokenPayload}.signature`;

assert.deepEqual(parseSupabaseAccessTokenUser(fakeJwt), {
  userId: "user-1",
  email: "heartfish0309@gmail.com"
});

assert.deepEqual(
  readStoredSupabaseSession({
    getItem: (key) =>
      key === supabaseSessionStorageKey
        ? JSON.stringify({ accessToken: "a", refreshToken: "r", expiresIn: "3600", expiresAt: "1780384229", tokenType: "bearer" })
        : null
  }),
  { accessToken: "a", refreshToken: "r", expiresIn: "3600", expiresAt: "1780384229", tokenType: "bearer" }
);

assert.equal(
  readStoredSupabaseSession({
    getItem: () => "not json"
  }),
  null
);

assert.deepEqual(
  readStoredSupabaseUser({
    getItem: (key) =>
      key === supabaseSessionStorageKey
        ? JSON.stringify({ accessToken: fakeJwt, refreshToken: "r" })
        : null
  }),
  {
    userId: "user-1",
    email: "heartfish0309@gmail.com"
  }
);

assert.equal(
  getSessionExpiryDate({ expiresAt: "1780384229", expiresIn: null })?.toISOString(),
  "2026-06-02T07:10:29.000Z"
);

assert.equal(
  isStoredSupabaseSessionValid(
    {
      getItem: () => JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: "2000" })
    },
    new Date("2026-06-01T00:00:00Z")
  ),
  false
);

assert.equal(
  isStoredSupabaseSessionValid(
    {
      getItem: () => JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: "2000000000" })
    },
    new Date("2026-06-01T00:00:00Z")
  ),
  true
);

let removedKey = "";
clearStoredSupabaseSession({ removeItem: (key) => (removedKey = key) });
assert.equal(removedKey, supabaseSessionStorageKey);

console.log("supabase auth helpers: 14 assertions passed");
