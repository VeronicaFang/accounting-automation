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

export function getSupabaseAuthConfig(env: AuthEnv = process.env as AuthEnv): SupabaseAuthConfig | null {
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
  tokenType: string | null;
};

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
    tokenType: params.get("token_type")
  };
}
