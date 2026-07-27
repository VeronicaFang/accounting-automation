"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { monthKeyFromDateValue } from "@/lib/accounting/dashboard-filters";
import {
  summarizeSpendingTrends,
  type PaymentToolScope,
  type PeriodMode,
  type SpendingTrendItem
} from "@/lib/accounting/spending-analysis";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { getSupabaseBudgetStatuses, getSupabaseExpenses } from "@/lib/data/supabase-repository";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetStatus, ExpenseRecord } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

function getStateText(state: LoadState, expenseCount: number): string {
  if (state === "ready") return `已連線 Supabase，讀取 ${expenseCount} 筆消費明細`;
  if (state === "loading") return "正在讀取 Supabase 消費與預算資料";
  if (state === "expired") return "Session 已過期，請重新登入 Supabase";
  if (state === "error") return "Supabase 讀取失敗";
  return "請先登入 Supabase";
}

function getStatusLabel(item: SpendingTrendItem): string {
  if (item.status === "over") return "已超標";
  if (item.status === "near_limit") return "接近超標";
  if (item.status === "attention") return "需注意";
  return "正常";
}

function getStatusClass(item: SpendingTrendItem): string {
  return `trend-status-${item.status.replace("_", "-")}`;
}

function getPeriodLink(item: SpendingTrendItem, periodKey: string, mode: PeriodMode): string {
  const budget = encodeURIComponent(item.budgetItemName);
  if (mode === "month") {
    return `/expenses?month=${encodeURIComponent(periodKey)}&budget=${budget}`;
  }

  return `/expenses?month=all&budget=${budget}`;
}

function buildRecommendation(items: SpendingTrendItem[], annualRemainingBudget: number): string[] {
  const overItems = items.filter((item) => item.overrunAmount > 0);
  const nearItems = items.filter((item) => item.status === "near_limit");
  const projectedRisk = items
    .filter((item) => item.projectedAnnualAmount > item.annualBudget && item.overrunAmount === 0)
    .sort((a, b) => (b.projectedAnnualAmount - b.annualBudget) - (a.projectedAnnualAmount - a.annualBudget));
  const messages: string[] = [];

  if (overItems.length > 0) {
    const total = overItems.reduce((sum, item) => sum + item.overrunAmount, 0);
    messages.push(`目前有 ${overItems.length} 個預算項目已超標，合計超標 ${formatCurrency(total)}。優先檢查這些項目的明細，確認是否有重複入帳或需要正式追加預算。`);
  } else {
    messages.push("目前沒有已超標的預算項目，年度預算仍在可控範圍內。");
  }

  if (nearItems.length > 0) {
    messages.push(`${nearItems[0].budgetItemName} 已接近年度上限，建議先降低未來月份的同類消費，避免後面只能靠追加預算處理。`);
  }

  if (projectedRisk.length > 0) {
    const item = projectedRisk[0];
    messages.push(`${item.budgetItemName} 依目前月均花費推估全年約 ${formatCurrency(item.projectedAnnualAmount)}，可能超過年度預算 ${formatCurrency(item.projectedAnnualAmount - item.annualBudget)}。`);
  }

  messages.push(`年度剩餘預算仍有 ${formatCurrency(annualRemainingBudget)} 代表未超標項目剩餘扣除已超標金額後的可用空間；挪移前仍應確認是否會影響必要支出或現金流安全。`);
  return messages;
}

export function SpendingAnalysisClient() {
  const currentYear = monthKeyFromDateValue().slice(0, 4);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [budgetGroup, setBudgetGroup] = useState("");
  const [budgetItemId, setBudgetItemId] = useState("");
  const [paymentTool, setPaymentTool] = useState<PaymentToolScope>("all");

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

    Promise.all([
      getSupabaseExpenses(session.accessToken),
      getSupabaseBudgetStatuses(session.accessToken, selectedYear)
    ])
      .then(([expenseRows, budgetRows]) => {
        if (!isCurrent) return;
        setExpenses(expenseRows);
        setBudgets(budgetRows);
        setState("ready");
      })
      .catch((caughtError) => {
        if (!isCurrent) return;
        setExpenses([]);
        setBudgets([]);
        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setState("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    expenses.forEach((expense) => years.add(expense.budgetMonth.slice(0, 4)));
    return [...years].sort().reverse();
  }, [currentYear, expenses]);

  const budgetGroups = useMemo(
    () => [...new Set(budgets.map((budget) => budget.groupName).filter(Boolean))].sort(),
    [budgets]
  );

  const visibleBudgetOptions = useMemo(
    () => budgets
      .filter((budget) => !budgetGroup || budget.groupName === budgetGroup)
      .sort((a, b) => a.itemName.localeCompare(b.itemName)),
    [budgetGroup, budgets]
  );

  useEffect(() => {
    if (budgetItemId && !visibleBudgetOptions.some((budget) => budget.id === budgetItemId)) {
      setBudgetItemId("");
    }
  }, [budgetItemId, visibleBudgetOptions]);

  const analysis = useMemo(
    () => summarizeSpendingTrends(expenses, budgets, {
      year: selectedYear,
      periodMode,
      budgetGroup,
      budgetItemId,
      paymentTool
    }),
    [budgetGroup, budgetItemId, budgets, expenses, paymentTool, periodMode, selectedYear]
  );

  const maxBarAmount = useMemo(
    () => Math.max(1, ...analysis.items.flatMap((item) => item.periodAmounts.map((period) => period.amount))),
    [analysis.items]
  );
  const recommendations = useMemo(
    () => buildRecommendation(analysis.items, analysis.summary.annualRemainingBudget),
    [analysis.items, analysis.summary.annualRemainingBudget]
  );

  return (
    <>
      <PageHeader
        eyebrow="消費分析"
        title="消費趨勢分析"
        description="依消費發生月份或季度檢視每個預算項目的實際花費，判斷超標風險與可挪移預算。"
      />

      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, expenses.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}

      <section className="surface section-block spending-analysis-filter">
        <div className="filter-row spending-analysis-filter-row">
          <label>
            年度
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            顯示方式
            <select value={periodMode} onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}>
              <option value="month">月</option>
              <option value="quarter">季</option>
            </select>
          </label>
          <label>
            預算分類
            <select value={budgetGroup} onChange={(event) => setBudgetGroup(event.target.value)}>
              <option value="">全部分類</option>
              {budgetGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label>
            預算項目
            <select value={budgetItemId} onChange={(event) => setBudgetItemId(event.target.value)}>
              <option value="">全部預算項目</option>
              {visibleBudgetOptions.map((budget) => <option key={budget.id} value={budget.id}>{budget.itemName}</option>)}
            </select>
          </label>
          <label>
            支付工具
            <select value={paymentTool} onChange={(event) => setPaymentTool(event.target.value as PaymentToolScope)}>
              <option value="all">全部</option>
              <option value="cash">現金</option>
              <option value="credit_card">信用卡</option>
            </select>
          </label>
        </div>
      </section>

      <section className="spending-analysis-summary">
        <div className="budget-summary-card budget-summary-neutral">
          <span>本期總消費</span>
          <strong>{formatCurrency(analysis.summary.selectedTotal)}</strong>
          <small>{periodMode === "month" ? "依月份加總" : "依季度加總"}</small>
        </div>
        <div className="budget-summary-card budget-summary-danger">
          <span>已超標項目</span>
          <strong>{analysis.summary.overBudgetCount} 項</strong>
          <small>合計超標 {formatCurrency(analysis.summary.overrunTotal)}</small>
        </div>
        <div className="budget-summary-card budget-summary-good">
          <span>年度剩餘預算</span>
          <strong>{formatCurrency(analysis.summary.annualRemainingBudget)}</strong>
          <small>未超標項目剩餘 - 已超標累計</small>
        </div>
        <div className="budget-summary-card budget-summary-warning">
          <span>年度預算使用率</span>
          <strong>{analysis.summary.annualBudget > 0 ? formatPercent(analysis.summary.annualUsed / analysis.summary.annualBudget) : "0.0%"}</strong>
          <small>{formatCurrency(analysis.summary.annualUsed)} / {formatCurrency(analysis.summary.annualBudget)}</small>
        </div>
      </section>

      <section className="surface section-block spending-advisor-panel">
        <div className="section-heading">
          <h2>家庭財務管理建議</h2>
          <span>{recommendations.length} 則</span>
        </div>
        <div className="advisor-list">
          {recommendations.map((message) => <p key={message}>{message}</p>)}
        </div>
      </section>

      <section className="surface section-block">
        <div className="section-heading">
          <h2>預算項目趨勢</h2>
          <span>{analysis.items.length} 項</span>
        </div>
        <div className="trend-card-list">
          {analysis.items.map((item) => {
            const statusClass = getStatusClass(item);
            return (
              <article className={`trend-card ${statusClass}`} key={item.budgetItemId}>
                <div className="trend-card-header">
                  <div>
                    <span className="budget-table-group">{item.groupName}</span>
                    <Link className="table-link trend-card-title" href={`/expenses?month=all&budget=${encodeURIComponent(item.budgetItemName)}`}>
                      {item.budgetItemName}
                    </Link>
                  </div>
                  <span className={`trend-status-pill ${statusClass}`}>{getStatusLabel(item)}</span>
                </div>
                <div className="trend-card-metrics">
                  <span>年度預算 <strong>{formatCurrency(item.annualBudget)}</strong></span>
                  <span>已用 <strong>{formatCurrency(item.annualUsed)}</strong></span>
                  <span>{item.annualRemaining >= 0 ? "剩餘" : "超標"} <strong>{formatCurrency(Math.abs(item.annualRemaining))}</strong></span>
                  <span>月均 <strong>{formatCurrency(item.averageAmount)}</strong></span>
                  <span>推估全年 <strong>{formatCurrency(item.projectedAnnualAmount)}</strong></span>
                </div>
                <div className="trend-bars" style={{ "--trend-columns": analysis.periods.length } as React.CSSProperties}>
                  {item.periodAmounts.map((period) => {
                    const height = Math.max(period.amount > 0 ? 8 : 0, Math.round((period.amount / maxBarAmount) * 100));
                    return (
                      <Link
                        aria-label={`${item.budgetItemName} ${period.label} ${formatCurrency(period.amount)}`}
                        className="trend-bar-link"
                        href={getPeriodLink(item, period.key, periodMode)}
                        key={period.key}
                      >
                        <span className="trend-bar-value">{period.amount > 0 ? formatCurrency(period.amount) : ""}</span>
                        <span className="trend-bar-track">
                          <span className="trend-bar-fill" style={{ height: `${height}%` }} />
                        </span>
                        <span className="trend-bar-label">{period.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </article>
            );
          })}
          {state === "ready" && analysis.items.length === 0 ? (
            <p className="muted">目前篩選條件下沒有可呈現的消費趨勢。</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
