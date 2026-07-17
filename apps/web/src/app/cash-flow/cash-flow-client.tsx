"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  filterCashFlowMonthsByYear,
  getCashFlowAvailableYears,
  monthKeyFromDateValue,
  summarizeCashFlowMonths
} from "@/lib/accounting/dashboard-filters";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import type { AccountingDashboardData } from "@/lib/data/accounting-dashboard";
import { getSupabaseDashboardData } from "@/lib/data/supabase-repository";
import { formatCurrency } from "@/lib/format";
import type { CashFlowMonth } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

type CashFlowClientProps = {
  initialData: AccountingDashboardData;
};

function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `Supabase 已連線，已讀取 ${count} 個現金流月份`;
  }

  if (state === "loading") {
    return "正在讀取 Supabase 現金流資料";
  }

  if (state === "expired") {
    return "Session 已失效，請重新登入 Supabase";
  }

  if (state === "error") {
    return "Supabase 讀取失敗";
  }

  return "請先登入 Supabase";
}

function getCashFlowHealth(month: CashFlowMonth): { label: string; className: string } {
  if (month.netFlow < 0) {
    return { label: "流出", className: "cash-flow-health-danger" };
  }

  if (month.netFlow === 0) {
    return { label: "持平", className: "cash-flow-health-neutral" };
  }

  return { label: "流入", className: "cash-flow-health-good" };
}

function StatCard({ label, value, subtitle, tone }: { label: string; value: number | undefined; subtitle: string; tone: string }) {
  return (
    <div className={`stat-cell tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value === undefined ? "尚未計算" : formatCurrency(value)}</strong>
      <span className="stat-subtitle">{subtitle}</span>
    </div>
  );
}

function MonthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="cash-flow-link" href={href}>
      {children}
    </Link>
  );
}

export function CashFlowClient({ initialData }: CashFlowClientProps) {
  const [data, setData] = useState<AccountingDashboardData>(initialData);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const currentYear = monthKeyFromDateValue().slice(0, 4);
  const [selectedYear, setSelectedYear] = useState(currentYear);

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

    getSupabaseDashboardData(initialData, session.accessToken)
      .then((dashboardData) => {
        if (!isCurrent) {
          return;
        }

        setData({ ...initialData, ...dashboardData, dataSource: "supabase" });
        setState("ready");
      })
      .catch((caughtError) => {
        if (!isCurrent) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setState("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [initialData]);

  const availableYears = useMemo(() => getCashFlowAvailableYears(data.cashFlowMonths), [data.cashFlowMonths]);
  const effectiveYear = availableYears.includes(selectedYear) ? selectedYear : availableYears[0] ?? currentYear;
  const visibleMonths = useMemo(
    () => filterCashFlowMonthsByYear(data.cashFlowMonths, effectiveYear),
    [data.cashFlowMonths, effectiveYear]
  );
  const summary = useMemo(() => summarizeCashFlowMonths(visibleMonths), [visibleMonths]);
  const bestMonth = visibleMonths.reduce<CashFlowMonth | null>(
    (best, month) => (!best || month.netFlow > best.netFlow ? month : best),
    null
  );
  const worstMonth = visibleMonths.reduce<CashFlowMonth | null>(
    (worst, month) => (!worst || month.netFlow < worst.netFlow ? month : worst),
    null
  );

  return (
    <>
      <PageHeader
        eyebrow="現金流"
        title="月度現金流"
        description="用付款月份檢視收入、現金支出、信用卡付款與月底餘額，信用卡付款優先採用真實帳單。"
        action={
          availableYears.length > 0 ? (
            <label className="inline-filter-label">
              年度
              <select value={effectiveYear} onChange={(event) => setSelectedYear(event.target.value)}>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, data.cashFlowMonths.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="stat-strip cash-flow-stat-strip">
        <StatCard label="年度收入" value={summary.income} subtitle={`${effectiveYear} 已入帳與預估收入`} tone="teal" />
        <StatCard label="現金支出" value={summary.cashExpense} subtitle="直接由現金支付的支出" tone="sky" />
        <StatCard label="信用卡付款" value={summary.cardPayment} subtitle="真實帳單優先，否則用預估" tone="orange" />
        <StatCard
          label="年度淨流量"
          value={summary.netFlow}
          subtitle={summary.endingBalance === undefined ? "月底餘額尚未完整計算" : `最近月底餘額 ${formatCurrency(summary.endingBalance)}`}
          tone={summary.netFlow < 0 ? "rose" : "violet"}
        />
      </div>

      <section className="surface section-block cash-flow-overview">
        <div className="section-heading">
          <h2>{effectiveYear} 現金流概況</h2>
          <span>{visibleMonths.length} 個月份</span>
        </div>
        <div className="cash-flow-insights">
          <div>
            <span className="muted">流入最高月份</span>
            <strong>{bestMonth ? `${bestMonth.month} / ${formatCurrency(bestMonth.netFlow)}` : "尚無資料"}</strong>
          </div>
          <div>
            <span className="muted">流出最高月份</span>
            <strong className={worstMonth && worstMonth.netFlow < 0 ? "text-danger" : undefined}>
              {worstMonth ? `${worstMonth.month} / ${formatCurrency(worstMonth.netFlow)}` : "尚無資料"}
            </strong>
          </div>
          <div>
            <span className="muted">可追查入口</span>
            <strong>點月表金額可查看收入、消費或帳單</strong>
          </div>
        </div>
      </section>

      <section className="surface section-block">
        <div className="section-heading">
          <h2>現金流明細</h2>
          <span>收入、現金支出、信用卡付款、月淨流量</span>
        </div>
        <div className="table-scroll">
          <table className="data-table cash-flow-detail-table">
            <thead>
              <tr>
                <th>月份</th>
                <th>收入</th>
                <th>現金支出</th>
                <th>信用卡付款</th>
                <th>月淨流量</th>
                <th>月底餘額</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {visibleMonths.length === 0 ? (
                <tr>
                  <td colSpan={7}>目前沒有 {effectiveYear} 的現金流資料。</td>
                </tr>
              ) : (
                visibleMonths.map((month) => {
                  const cardPayment = month.actualCardPayment ?? month.estimatedCardPayment;
                  const health = getCashFlowHealth(month);

                  return (
                    <tr key={month.month}>
                      <td>{month.month}</td>
                      <td>
                        <MonthLink href={`/income-entry?year=${month.month.slice(0, 4)}`}>{formatCurrency(month.income)}</MonthLink>
                      </td>
                      <td>
                        <MonthLink href={`/expenses?month=${month.month}`}>{formatCurrency(month.cashExpense)}</MonthLink>
                      </td>
                      <td>
                        <MonthLink href={`/bills?month=${month.month}`}>{formatCurrency(cardPayment)}</MonthLink>
                      </td>
                      <td className={month.netFlow < 0 ? "text-danger" : "text-good"}>{formatCurrency(month.netFlow)}</td>
                      <td>{month.endingBalance === undefined ? "尚未計算" : formatCurrency(month.endingBalance)}</td>
                      <td>
                        <span className={`cash-flow-health ${health.className}`}>{health.label}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
