import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseRestConfig, createSupabaseRestHeaders } from "@/lib/data/supabase-rest";

type SupabaseRequestConfig = {
  restUrl: string;
  publishableKey: string;
};

type CreditCardRow = {
  id: string;
  name: string;
  legacy_id: string | null;
  cutoff_day: number;
  payment_day: number;
  is_active: boolean;
};

function requireConfig(accessToken: string): SupabaseRequestConfig {
  const config = getSupabaseRestConfig();

  if (!config) {
    throw new Error("Supabase REST 尚未設定。");
  }

  return config;
}

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token || null;
}

async function supabaseGet<T>(
  config: SupabaseRequestConfig,
  table: string,
  query: Record<string, string>,
  accessToken: string
): Promise<T[]> {
  const url = new URL(`${config.restUrl}/${table}`);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: createSupabaseRestHeaders(config, accessToken)
  });

  if (!response.ok) {
    throw new Error(`讀取 ${table} 失敗：${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T[];
}

async function supabasePost(
  config: SupabaseRequestConfig,
  table: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<Record<string, unknown>> {
  const url = new URL(`${config.restUrl}/${table}`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...createSupabaseRestHeaders(config, accessToken),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`寫入 ${table} 失敗：${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return Array.isArray(result) ? (result[0] as Record<string, unknown>) : (result as Record<string, unknown>);
}

async function supabasePatch(
  config: SupabaseRequestConfig,
  table: string,
  where: Record<string, string>,
  body: Record<string, unknown>,
  accessToken: string
): Promise<void> {
  const url = new URL(`${config.restUrl}/${table}`);

  for (const [key, value] of Object.entries(where)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...createSupabaseRestHeaders(config, accessToken),
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`更新 ${table} 失敗：${response.status} ${await response.text()}`);
  }
}

async function getHouseholdId(config: SupabaseRequestConfig, accessToken: string): Promise<string> {
  const rows = await supabaseGet<{ id: string }>(config, "households", { select: "id", order: "created_at.asc", limit: "1" }, accessToken);
  const id = rows[0]?.id;

  if (!id) {
    throw new Error("找不到 household，請確認帳號設定。");
  }

  return id;
}

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: "缺少 Supabase session，請先登入。" }, { status: 401 });
  }

  try {
    const config = requireConfig(accessToken);
    const cards = await supabaseGet<CreditCardRow>(
      config,
      "credit_cards",
      { select: "id,name,legacy_id,cutoff_day,payment_day,is_active", order: "name.asc" },
      accessToken
    );
    return NextResponse.json(cards);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "讀取失敗。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: "缺少 Supabase session，請先登入。" }, { status: 401 });
  }

  try {
    const config = requireConfig(accessToken);
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action || "");

    if (action === "create") {
      const name = String(payload.name || "").trim();
      const cutoffDay = Math.max(1, Math.min(31, Math.trunc(Number(payload.cutoffDay || 0))));
      const paymentDay = Math.max(1, Math.min(31, Math.trunc(Number(payload.paymentDay || 0))));

      if (!name) {
        throw new Error("請輸入信用卡名稱。");
      }

      if (!cutoffDay || !paymentDay) {
        throw new Error("結帳日與繳款日必須是 1–31 的整數。");
      }

      const householdId = await getHouseholdId(config, accessToken);

      const result = await supabasePost(
        config,
        "credit_cards",
        {
          household_id: householdId,
          name,
          cutoff_day: cutoffDay,
          payment_day: paymentDay,
          is_active: true
        },
        accessToken
      );

      return NextResponse.json(result);
    }

    if (action === "update") {
      const id = String(payload.id || "").trim();
      const name = String(payload.name || "").trim();
      const cutoffDay = Math.max(1, Math.min(31, Math.trunc(Number(payload.cutoffDay || 0))));
      const paymentDay = Math.max(1, Math.min(31, Math.trunc(Number(payload.paymentDay || 0))));
      const isActive = payload.isActive !== false;

      if (!id) {
        throw new Error("缺少信用卡 ID。");
      }

      if (!name) {
        throw new Error("請輸入信用卡名稱。");
      }

      if (!cutoffDay || !paymentDay) {
        throw new Error("結帳日與繳款日必須是 1–31 的整數。");
      }

      await supabasePatch(
        config,
        "credit_cards",
        { id: `eq.${id}` },
        { name, cutoff_day: cutoffDay, payment_day: paymentDay, is_active: isActive, updated_at: new Date().toISOString() },
        accessToken
      );

      return NextResponse.json({ updatedCards: 1 });
    }

    return NextResponse.json({ error: `不支援的動作：${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "操作失敗。" }, { status: 500 });
  }
}
