"use client";

import { useEffect, useState } from "react";

import { BudgetStatusList } from "@/components/budget-status-list";
import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { createSupabaseRestHeaders, getSupabaseRestConfig } from "@/lib/data/supabase-rest";
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
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function loadData(accessToken: string, isCurrent = () => true) {
    setState("loading");
    setError(null);

    return getSupabaseBudgetStatuses(accessToken)
      .then((rows) => {
        if (!isCurrent()) return;
        setItems(rows);
        setBudgetEdits(Object.fromEntries(rows.map((r) => [r.id, String(r.annualBudget)])));
        setState("ready");
      })
      .catch((caughtError) => {
        if (!isCurrent()) return;
        setItems([]);
        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setState("error");
      });
  }

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
    loadData(session.accessToken, () => isCurrent);

    return () => {
      isCurrent = false;
    };
  }, []);

  async function saveBudget(item: BudgetStatus) {
    const session = readStoredSupabaseSession(window.localStorage);
    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setSaveMessage("Session 已過期，請重新登入。");
      return;
    }

    const raw = budgetEdits[item.id] ?? "";
    const newAmount = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      setSaveMessage("請輸入有效的預算金額（≥ 0）。");
      return;
    }

    const config = getSupabaseRestConfig();
    if (!config) {
      setSaveMessage("Supabase 未設定。");
      return;
    }

    setSavingId(item.id);
    setSaveMessage(null);

    try {
      const url = new URL(`${config.restUrl}/budget_items`);
      url.searchParams.set("id", `eq.${item.id}`);

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          ...createSupabaseRestHeaders(config, session.accessToken),
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ annual_budget: newAmount })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`更新失敗：${response.status} ${text}`);
      }

      setEditingId(null);
      setSaveMessage(`已更新「${item.itemName}」的年度預算。`);
      await loadData(session.accessToken);
    } catch (caughtError) {
      setSaveMessage(caughtError instanceof Error ? caughtError.message : "儲存失敗。");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="預算"
        title="預算總覽"
        description="顯示目前登入帳號可讀取的年度預算項目與已用金額。點擊項目名稱可篩選消費明細；點擊鉛筆可編輯年度預算金額。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, items.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}
      {saveMessage ? <p className="entry-message entry-message-success">{saveMessage}</p> : null}
      <BudgetStatusList
        items={items}
        budgetEdits={budgetEdits}
        editingId={editingId}
        savingId={savingId}
        onEditStart={(id) => { setEditingId(id); setSaveMessage(null); }}
        onEditCancel={() => setEditingId(null)}
        onEditChange={(id, value) => setBudgetEdits((prev) => ({ ...prev, [id]: value }))}
        onEditSave={(item) => saveBudget(item)}
      />
    </>
  );
}
