"use client";

import { useEffect, useState } from "react";

import { BudgetStatusList } from "@/components/budget-status-list";
import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { getSupabaseBudgetStatuses } from "@/lib/data/supabase-repository";
import type { BudgetStatus } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `已連線 Supabase，顯示 ${count} 個預算項目`;
  }

  if (state === "loading") {
    return "正在讀取 Supabase";
  }

  if (state === "expired") {
    return "Session 已過期，請重新登入";
  }

  if (state === "error") {
    return "Supabase 讀取失敗";
  }

  return "請先登入 Supabase";
}

export function BudgetClient() {
  const [items, setItems] = useState<BudgetStatus[]>([]);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session) {
      setState("signed-out");
      return;
    }

    if (!isStoredSupabaseSessionValid(window.localStorage)) {
      setState("expired");
      return;
    }

    let isCurrent = true;
    setState("loading");
    setError(null);

    getSupabaseBudgetStatuses(session.accessToken)
      .then((rows) => {
        if (!isCurrent) {
          return;
        }

        setItems(rows);
        setState("ready");
      })
      .catch((caughtError) => {
        if (!isCurrent) {
          return;
        }

        setItems([]);
        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setState("error");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="預算"
        title="預算總覽"
        description="顯示目前登入帳號可讀取的年度預算項目與已用金額。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, items.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <BudgetStatusList items={items} />
    </>
  );
}
