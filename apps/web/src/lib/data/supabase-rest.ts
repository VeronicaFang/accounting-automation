type SupabaseRestConfig = {
  restUrl: string;
  publishableKey: string;
};

type SupabaseEnv = {
  NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type SupabaseRestDiagnostics = {
  useSupabase: string | null;
  hasSupabaseUrl: boolean;
  hasPublishableKey: boolean;
  isConfigured: boolean;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getDefaultSupabaseEnv(): SupabaseEnv {
  return {
    NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE: process.env.NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  };
}

export function getSupabaseRestConfig(env: SupabaseEnv = getDefaultSupabaseEnv()): SupabaseRestConfig | null {
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

export function isSupabaseRestConfigured(env: SupabaseEnv = getDefaultSupabaseEnv()): boolean {
  return getSupabaseRestConfig(env) !== null;
}

export function getSupabaseRestDiagnostics(env: SupabaseEnv = getDefaultSupabaseEnv()): SupabaseRestDiagnostics {
  return {
    useSupabase: env.NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE ?? null,
    hasSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    hasPublishableKey: Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    isConfigured: getSupabaseRestConfig(env) !== null
  };
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
  env: SupabaseEnv = getDefaultSupabaseEnv(),
  accessToken?: string
): Promise<T[]> {
  const config = getSupabaseRestConfig(env);

  if (!config) {
    const diagnostics = getSupabaseRestDiagnostics(env);
    throw new Error(`Supabase REST is not configured: ${JSON.stringify(diagnostics)}`);
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
    const responseText = await response.text();
    throw new Error(`Supabase REST read failed for ${tableName}: ${response.status} ${responseText}`);
  }

  return (await response.json()) as T[];
}
