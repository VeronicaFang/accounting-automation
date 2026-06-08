type AuthEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_APP_URL?: string;
};

export type SupabaseAuthConfig = {
  authUrl: string;
  publishableKey: string;
  emailRedirectTo: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getDefaultAuthEnv(): AuthEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  };
}

export function getSupabaseAuthConfig(env: AuthEnv = getDefaultAuthEnv()): SupabaseAuthConfig | null {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  const appUrl = trimTrailingSlash(env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000");

  return {
    authUrl: `${trimTrailingSlash(supabaseUrl)}/auth/v1`,
    publishableKey,
    emailRedirectTo: `${appUrl}/auth/callback`
  };
}

export async function requestMagicLink(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = getSupabaseAuthConfig();

  if (!config) {
    return { ok: false, message: "Supabase 登入設定尚未完成。" };
  }

  const response = await fetch(`${config.authUrl}/otp`, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      create_user: true,
      options: {
        email_redirect_to: config.emailRedirectTo
      }
    })
  });

  if (!response.ok) {
    return { ok: false, message: `Magic link 發送失敗：${response.status}` };
  }

  return { ok: true };
}

export type ParsedHashSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string | null;
  expiresAt: string | null;
  tokenType: string | null;
};

export type SupabaseSessionUser = {
  userId: string;
  email: string | null;
};

export const supabaseSessionStorageKey = "accounting.supabase.session";

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  return atob(padded);
}

export function parseSupabaseAccessTokenUser(accessToken: string): SupabaseSessionUser | null {
  const [, payload] = accessToken.split(".");

  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { sub?: unknown; email?: unknown };

    if (typeof parsed.sub !== "string") {
      return null;
    }

    return {
      userId: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : null
    };
  } catch {
    return null;
  }
}

export function parseSupabaseHashSession(hash: string): ParsedHashSession | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: params.get("expires_in"),
    expiresAt: params.get("expires_at"),
    tokenType: params.get("token_type")
  };
}

export function hasSupabaseHashSession(hash: string): boolean {
  return parseSupabaseHashSession(hash) !== null;
}

export function readStoredSupabaseSession(storage: Pick<Storage, "getItem">): ParsedHashSession | null {
  const rawValue = storage.getItem(supabaseSessionStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ParsedHashSession>;

    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresIn: parsed.expiresIn ?? null,
      expiresAt: parsed.expiresAt ?? null,
      tokenType: parsed.tokenType ?? null
    };
  } catch {
    return null;
  }
}

export function getSessionExpiryDate(session: Pick<ParsedHashSession, "expiresAt" | "expiresIn">, now = new Date()): Date | null {
  if (session.expiresAt) {
    const expiresAtSeconds = Number(session.expiresAt);

    if (Number.isFinite(expiresAtSeconds)) {
      return new Date(expiresAtSeconds * 1000);
    }
  }

  if (session.expiresIn) {
    const expiresInSeconds = Number(session.expiresIn);

    if (Number.isFinite(expiresInSeconds)) {
      return new Date(now.getTime() + expiresInSeconds * 1000);
    }
  }

  return null;
}

export function isStoredSupabaseSessionValid(
  storage: Pick<Storage, "getItem">,
  now = new Date()
): boolean {
  const session = readStoredSupabaseSession(storage);

  if (!session) {
    return false;
  }

  const expiryDate = getSessionExpiryDate(session, now);

  if (!expiryDate) {
    return true;
  }

  return expiryDate.getTime() > now.getTime();
}

export function clearStoredSupabaseSession(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(supabaseSessionStorageKey);
}

export function readStoredSupabaseUser(storage: Pick<Storage, "getItem">): SupabaseSessionUser | null {
  const session = readStoredSupabaseSession(storage);

  if (!session) {
    return null;
  }

  return parseSupabaseAccessTokenUser(session.accessToken);
}
