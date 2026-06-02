type SupabaseRestConfig = {
  restUrl: string;
  publishableKey: string;
};

type SupabaseEnv = {
  NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getSupabaseRestConfig(env: SupabaseEnv = process.env as SupabaseEnv): SupabaseRestConfig | null {
  if (env.NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE !== "true") {
    return null;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  return {
    restUrl: `${trimTrailingSlash(supabaseUrl)}/rest/v1`,
    publishableKey
  };
}

export function isSupabaseRestConfigured(env: SupabaseEnv = process.env as SupabaseEnv): boolean {
  return getSupabaseRestConfig(env) !== null;
}

export function createSupabaseRestHeaders(
  config: Pick<SupabaseRestConfig, "publishableKey">,
  accessToken?: string
): Record<string, string> {
  return {
    apikey: config.publishableKey,
    Authorization: `Bearer ${accessToken ?? config.publishableKey}`,
    Accept: "application/json"
  };
}

export async function fetchSupabaseRows<T>(
  tableName: string,
  query: Record<string, string>,
  env: SupabaseEnv = process.env as SupabaseEnv,
  accessToken?: string
): Promise<T[]> {
  const config = getSupabaseRestConfig(env);

  if (!config) {
    return [];
  }

  const url = new URL(`${config.restUrl}/${tableName}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    cache: "no-store",
    headers: createSupabaseRestHeaders(config, accessToken)
  });

  if (!response.ok) {
    throw new Error(`Supabase REST read failed for ${tableName}: ${response.status}`);
  }

  return (await response.json()) as T[];
}
