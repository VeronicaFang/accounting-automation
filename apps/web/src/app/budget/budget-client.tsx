"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  getBudgetOverrunAmount,
  monthKeyFromDateValue,
  summarizeOverBudgetItems
} from "@/lib/accounting/dashboard-filters";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { createSupabaseRestHeaders, getSupabaseRestConfig } from "@/lib/data/supabase-rest";
import { getSupabaseBudgetStatuses } from "@/lib/data/supabase-repository";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";
type BudgetViewFilter = "risk" | "over" | "warning" | "normal" | "all";

const filterLabels: Record<BudgetViewFilter, string> = {
  risk: "需注意",
  over: "已超標",
  warning: "接近超標",
  normal: "正常",
  all: "全部"
};

function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `已連線 Supabase，讀取 ${count} 個預算項目`;
  }

  if (state === "loading") {
    return "正在讀取 Supabase 預算資料";
  }

  if (state === "expired") {
    return "Session 已失效，請重新登入 Supabase";
  }

  if (state === "error") {
    return "Supabase 讀取失敗";
  }

  return "請先登入 Supabase";
}

function getBudgetStatusLabel(item: BudgetStatus): string {
  const overrun = getBudgetOverrunAmount(item);

  if (overrun > 0) {
    return "已超標";
  }

  if (item.usageRatio >= 0.85 || item.severity === "warning") {
    return "接近超標";
  }

  if (item.severity === "reminder") {
    return "需留意";
  }

  return "正常";
}

function getBudgetStatusClass(item: BudgetStatus): string {
  const overrun = getBudgetOverrunAmount(item);

  if (overrun > 0) {
    return "budget-risk-over";
  }

  if (item.usageRatio >= 0.85 || item.severity === "warning") {
    return "budget-risk-warning";
  }

  if (item.severity === "reminder") {
    return "budget-risk-reminder";
  }

  return "budget-risk-normal";
}

function filterBudgetItems(items: BudgetStatus[], filter: BudgetViewFilter): BudgetStatus[] {
  const sortedItems = [...items].sort((a, b) => {
    const overrunDiff = getBudgetOverrunAmount(b) - getBudgetOverrunAmount(a);
    if (overrunDiff !== 0) return overrunDiff;

    const ratioDiff = b.usageRatio - a.usageRatio;
    if (ratioDiff !== 0) return ratioDiff;

    return a.itemName.localeCompare(b.itemName);
  });

  if (filter === "all") {
    return sortedItems;
  }

  if (filter === "over") {
    return sortedItems.filter((item) => getBudgetOverrunAmount(item) > 0);
  }

  if (filter === "warning") {
    return sortedItems.filter((item) => getBudgetOverrunAmount(item) === 0 && (item.usageRatio >= 0.85 || item.severity === "warning"));
  }

  if (filter === "normal") {
    return sortedItems.filter((item) => getBudgetOverrunAmount(item) === 0 && item.usageRatio < 0.85 && item.severity !== "warning");
  }

  return sortedItems.filter((item) => getBudgetOverrunAmount(item) > 0 || item.usageRatio >= 0.85 || item.severity === "warning");
}

function BudgetSummary({ items }: { items: BudgetStatus[] }) {
  const overBudget = summarizeOverBudgetItems(items);
  const warningCount = items.filter((item) => getBudgetOverrunAmount(item) === 0 && (item.usageRatio >= 0.85 || item.severity === "warning")).length;
  const totalBudget = items.reduce((total, item) => total + item.annualBudget, 0);
  const totalUsed = items.reduce((total, item) => total + item.usedAmount, 0);
  const remaining = totalBudget - totalUsed;
  const nonOverBudgetRemaining = items
    .filter((item) => getBudgetOverrunAmount(item) === 0 && item.remainingAmount > 0)
    .reduce((total, item) => total + item.remainingAmount, 0);

  return (
    <section className="budget-overview-summary">
      <div className="budget-summary-card budget-summary-danger">
        <span>已超標</span>
        <strong>{overBudget.items.length} 項</strong>
        <small>合計超標 {formatCurrency(overBudget.totalOverrun)}</small>
      </div>
      <div className="budget-summary-card budget-summary-warning">
        <span>接近超標</span>
        <strong>{warningCount} 項</strong>
        <small>使用率達 85% 以上</small>
      </div>
      <div className="budget-summary-card budget-summary-neutral">
        <span>年度預算</span>
        <strong>{formatCurrency(totalBudget)}</strong>
        <small>已用 {formatCurrency(totalUsed)}</small>
      </div>
      <div className={`budget-summary-card ${remaining < 0 ? "budget-summary-danger" : "budget-summary-good"}`}>
        <span>年度剩餘</span>
        <strong>{formatCurrency(remaining)}</strong>
        <small>{remaining < 0 ? "總額已超出年度預算" : "全部項目加總後剩餘"}</small>
      </div>
      <div className="budget-summary-card budget-summary-wide budget-summary-danger">
        <span>超標項目與總額</span>
        <strong>{formatCurrency(overBudget.totalOverrun)}</strong>
        {overBudget.items.length > 0 ? (
          <ul className="budget-summary-list">
            {overBudget.items.map((item) => (
              <li key={item.id}>
                <Link href={`/expenses?month=all&budget=${encodeURIComponent(item.itemName)}`}>{item.itemName}</Link>
                <strong>{formatCurrency(getBudgetOverrunAmount(item))}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <small>目前沒有超標項目</small>
        )}
      </div>
      <div className="budget-summary-card budget-summary-wide budget-summary-good">
        <span>未超標項目剩餘預算</span>
        <strong>{formatCurrency(nonOverBudgetRemaining)}</strong>
        <small>只加總尚未超標且仍有剩餘的預算項目，不扣抵已超標項目。</small>
      </div>
    </section>
  );
}

export function BudgetClient() {
  const [items, setItems] = useState<BudgetStatus[]>([]);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<BudgetViewFilter>("risk");
  const currentYear = monthKeyFromDateValue().slice(0, 4);

  const counts = useMemo(() => ({
    risk: filterBudgetItems(items, "risk").length,
    over: filterBudgetItems(items, "over").length,
    warning: filterBudgetItems(items, "warning").length,
    normal: filterBudgetItems(items, "normal").length,
    all: items.length
  }), [items]);
  const visibleItems = useMemo(() => filterBudgetItems(items, activeFilter), [activeFilter, items]);

  function loadData(accessToken: string, isCurrent = () => true) {
    setState("loading");
    setError(null);

    return getSupabaseBudgetStatuses(accessToken, currentYear)
      .then((rows) => {
        if (!isCurrent()) return;
        setItems(rows);
        setBudgetEdits(Object.fromEntries(rows.map((row) => [row.id, String(row.annualBudget)])));
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
      setSaveMessage("Session 已失效，請重新登入。");
      return;
    }

    const raw = budgetEdits[item.id] ?? "";
    const newAmount = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      setSaveMessage("請輸入有效的年度預算金額，必須大於或等於 0。");
      return;
    }

    const config = getSupabaseRestConfig();
    if (!config) {
      setSaveMessage("Supabase 尚未設定。");
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
      setSaveMessage(`已更新「${item.itemName}」年度預算。`);
      await loadData(session.accessToken);
    } catch (caughtError) {
      setSaveMessage(caughtError instanceof Error ? caughtError.message : "儲存失敗");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="預算"
        title="預算總覽"
        description={`${currentYear} 年度資料。優先檢視已超標與接近超標項目，確認每個預算項目的使用率、剩餘金額與相關消費。`}
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, items.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}
      {saveMessage ? <p className="entry-message entry-message-success">{saveMessage}</p> : null}

      <BudgetSummary items={items} />

      <section className="surface section-block budget-overview-panel">
        <div className="section-heading">
          <h2>預算項目</h2>
          <span>{visibleItems.length} / {items.length} 項</span>
        </div>
        <div className="budget-filter-bar" aria-label="預算狀態篩選">
          {(Object.keys(filterLabels) as BudgetViewFilter[]).map((filter) => (
            <button
              aria-pressed={activeFilter === filter}
              className={`budget-filter-button ${activeFilter === filter ? "budget-filter-active" : ""}`}
              key={filter}
              onClick={() => setActiveFilter(filter)}
              type="button"
            >
              {filterLabels[filter]}
              <span>{counts[filter]}</span>
            </button>
          ))}
        </div>

        <div className="table-scroll">
          <table className="data-table budget-overview-table">
            <thead>
              <tr>
                <th>狀態</th>
                <th>預算項目</th>
                <th>已用 / 年預算</th>
                <th>剩餘或超標</th>
                <th>使用率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const isEditing = editingId === item.id;
                const isSaving = savingId === item.id;
                const overrun = getBudgetOverrunAmount(item);
                const fillPct = Math.min(item.usageRatio * 100, 100);
                const statusClass = getBudgetStatusClass(item);

                return (
                  <tr className={statusClass} key={item.id}>
                    <td><span className={`budget-risk-pill ${statusClass}`}>{getBudgetStatusLabel(item)}</span></td>
                    <td>
                      <span className="budget-table-group">{item.groupName}</span>
                      <Link className="table-link budget-table-name" href={`/expenses?month=all&budget=${encodeURIComponent(item.itemName)}`}>
                        {item.itemName}
                      </Link>
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="budget-inline-edit">
                          <input
                            className="budget-amount-input"
                            type="number"
                            min="0"
                            value={budgetEdits[item.id] ?? ""}
                            onChange={(event) => setBudgetEdits((prev) => ({ ...prev, [item.id]: event.target.value }))}
                            disabled={isSaving}
                          />
                          <button className="secondary-action" type="button" disabled={isSaving} onClick={() => saveBudget(item)}>
                            {isSaving ? "儲存中" : "儲存"}
                          </button>
                          <button className="secondary-action" type="button" disabled={isSaving} onClick={() => setEditingId(null)}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <span>{formatCurrency(item.usedAmount)} / {formatCurrency(item.annualBudget)}</span>
                      )}
                    </td>
                    <td className={overrun > 0 ? "budget-overrun-cell" : "budget-remaining-cell"}>
                      {overrun > 0 ? `超標 ${formatCurrency(overrun)}` : `剩餘 ${formatCurrency(item.remainingAmount)}`}
                    </td>
                    <td>
                      <div className="budget-table-progress">
                        <span>{formatPercent(item.usageRatio)}</span>
                        <div className="budget-mini-track"><div style={{ width: `${fillPct}%` }} /></div>
                      </div>
                    </td>
                    <td>
                      <div className="budget-table-actions">
                        <Link className="secondary-action" href={`/expenses?month=all&budget=${encodeURIComponent(item.itemName)}`}>查看消費</Link>
                        <button className="secondary-action" type="button" onClick={() => { setEditingId(item.id); setSaveMessage(null); }}>
                          編輯預算
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 ? (
                <tr><td colSpan={6}>目前沒有符合此篩選的預算項目。</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
