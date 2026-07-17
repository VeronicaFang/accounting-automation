"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  filterCashFlowMonthsByYear,
  getCashFlowAvailableYears,
  monthKeyFromDateValue,
  summarizeCashFlowMonths,
  summarizeSpendingCapacity,
  type SpendingCapacitySummary
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

const DEFAULT_CLOSED_BUDGET_ITEM_NAMES = [
  "05. 所得稅",
  "14. 動動生日派對",
  "30. 高雄小旅行",
  "31. 過年住宿+車票",
  "29. 寵物"
];

function SpendingCapacityPanel({
  capacity,
  safetyReserveInput,
  onSafetyReserveChange
}: {
  capacity: SpendingCapacitySummary;
  safetyReserveInput: string;
  onSafetyReserveChange: (value: string) => void;
}) {
  const isShort = capacity.shortfall > 0;
  const progress =
    capacity.plannedRemaining > 0
      ? Math.min(100, Math.max(0, (capacity.spendableCashFlow / capacity.plannedRemaining) * 100))
      : 100;

  return (
    <section className={`surface section-block spending-capacity-panel ${isShort ? "spending-capacity-danger" : "spending-capacity-ok"}`}>
      <div className="section-heading spending-capacity-heading">
        <div>
          <h2>年度支出承受度</h2>
          <span>比對尚未用完預算與年度現金流，已排除事件結束不再動支的項目。</span>
        </div>
        <label className="safety-reserve-control">
          安全現金水位
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={safetyReserveInput}
            onChange={(event) => onSafetyReserveChange(event.target.value)}
          />
        </label>
      </div>

      <div className="spending-capacity-grid">
        <div>
          <span>預算預期還會花</span>
          <strong>{formatCurrency(capacity.plannedRemaining)}</strong>
          <small>{capacity.plannedItems.length} 個仍可能動支項目</small>
        </div>
        <div>
          <span>現金流可承受</span>
          <strong>{formatCurrency(capacity.spendableCashFlow)}</strong>
          <small>年度淨流量 {formatCurrency(capacity.cashFlowCapacity)} - 安全水位 {formatCurrency(capacity.safetyReserve)}</small>
        </div>
        <div className={isShort ? "capacity-shortfall" : "capacity-surplus"}>
          <span>{isShort ? "需調整缺口" : "可用緩衝"}</span>
          <strong>{formatCurrency(isShort ? capacity.shortfall : capacity.surplus)}</strong>
          <small>{isShort ? "需要刪減、延後或補收入" : "目前現金流可承受預期支出"}</small>
        </div>
      </div>

      <div className="capacity-meter" aria-label="現金流可承受比例">
        <div className="capacity-meter-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="capacity-meter-labels">
        <span>可承受 {formatCurrency(capacity.spendableCashFlow)}</span>
        <span>預期支出 {formatCurrency(capacity.plannedRemaining)}</span>
      </div>

      <div className="capacity-lists">
        <div>
          <div className="capacity-list-title">
            <strong>仍會動支</strong>
            <span>{formatCurrency(capacity.plannedRemaining)}</span>
          </div>
          {capacity.plannedItems.slice(0, 8).map((item) => (
            <Link className="capacity-item" href={`/expenses?budget=${encodeURIComponent(item.itemName)}`} key={item.id}>
              <span>{item.itemName}</span>
              <strong>{formatCurrency(item.remainingAmount)}</strong>
            </Link>
          ))}
        </div>
        <div>
          <div className="capacity-list-title">
            <strong>已結束不再動支</strong>
            <span>{formatCurrency(capacity.closedRemaining)}</span>
          </div>
          {capacity.closedItems.map((item) => (
            <Link className="capacity-item capacity-item-muted" href={`/expenses?budget=${encodeURIComponent(item.itemName)}`} key={item.id}>
              <span>{item.itemName}</span>
              <strong>{formatCurrency(item.remainingAmount)}</strong>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
export function CashFlowClient({ initialData }: CashFlowClientProps) {
  const [data, setData] = useState<AccountingDashboardData>(initialData);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [safetyReserveInput, setSafetyReserveInput] = useState("0");
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
  const safetyReserve = Math.max(0, Number(safetyReserveInput.replace(/,/g, "")) || 0);
  const spendingCapacity = useMemo(
    () => summarizeSpendingCapacity(data.budgetStatuses, summary.netFlow, DEFAULT_CLOSED_BUDGET_ITEM_NAMES, safetyReserve),
    [data.budgetStatuses, safetyReserve, summary.netFlow]
  );
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

      <SpendingCapacityPanel
        capacity={spendingCapacity}
        safetyReserveInput={safetyReserveInput}
        onSafetyReserveChange={setSafetyReserveInput}
      />

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
