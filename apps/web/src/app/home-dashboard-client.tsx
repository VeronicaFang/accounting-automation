"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BillEstimateTable } from "@/components/bill-estimate-table";
import { BudgetStatusList } from "@/components/budget-status-list";
import { CashFlowTable } from "@/components/cash-flow-table";
import { PageHeader } from "@/components/page-header";
import { RecentExpensesFeed } from "@/components/recent-expenses-feed";
import { StatStrip } from "@/components/stat-strip";
import { TaskWorkbench } from "@/components/task-workbench";
import {
  buildAnnualDashboardMonths,
  filterFutureBills,
  getBudgetOverrunAmount,
  monthKeyFromDateValue,
  summarizeOverBudgetItems
} from "@/lib/accounting/dashboard-filters";
import { formatCurrency } from "@/lib/format";
import {
  isStoredSupabaseSessionValid,
  readStoredSupabaseSession,
  readStoredSupabaseUser,
  type SupabaseSessionUser
} from "@/lib/auth/supabase-auth";
import type { AccountingDashboardData } from "@/lib/data/accounting-dashboard";
import {
  getSupabaseDashboardData,
  getSupabaseHouseholds,
  type SupabaseHouseholdRow
} from "@/lib/data/supabase-repository";
import type { BudgetStatus } from "@/lib/types";

type DashboardStatus = "signed-out" | "expired" | "loading" | "connected" | "error";

function getEmptyDashboard(initialData: AccountingDashboardData): AccountingDashboardData {
  return {
    ...initialData,
    cashFlowMonths: [],
    billEstimates: [],
    budgetStatuses: [],
    reviewTasks: [],
    dataSource: "supabase"
  };
}

function statusText(
  status: DashboardStatus,
  data: AccountingDashboardData,
  user: SupabaseSessionUser | null,
  households: SupabaseHouseholdRow[]
): string {
  const identity = user?.email ? `帳號 ${user.email}` : "未讀取 email";

  if (status === "loading") {
    return `正在讀取 Supabase，${identity}`;
  }

  if (status === "connected") {
    const householdLabel = households.length > 0 ? households.map((household) => household.name).join("、") : "尚未讀取 household";
    return `已連線 Supabase，${identity}，household：${householdLabel}，帳單 ${data.billEstimates.length} 筆、預算 ${data.budgetStatuses.length} 筆、現金流 ${data.cashFlowMonths.length} 個月份`;
  }

  if (status === "expired") {
    return `Session 已失效，${identity}，請重新登入 Supabase`;
  }

  if (status === "error") {
    return `Supabase 讀取失敗，${identity}`;
  }

  return "請先登入 Supabase，首頁只會顯示空白狀態";
}

function AnnualDashboardTable({ rows }: { rows: ReturnType<typeof buildAnnualDashboardMonths> }) {
  const totals = rows.reduce(
    (current, row) => ({
      estimatedSpend: current.estimatedSpend + row.estimatedSpend,
      income: current.income + row.income,
      netFlow: current.netFlow + row.netFlow
    }),
    { estimatedSpend: 0, income: 0, netFlow: 0 }
  );

  return (
    <section className="surface section-block annual-dashboard">
      <div className="section-heading">
        <h2>年度儀表板</h2>
        <span>預期花費、收入與現金流</span>
      </div>
      <div className="table-scroll">
        <table className="data-table annual-dashboard-table">
          <thead>
            <tr>
              <th>項目</th>
              {rows.map((row) => (
                <th key={row.month}>{row.month.replace("-", "")}</th>
              ))}
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>預期花費</th>
              {rows.map((row) => (
                <td key={row.month}>{formatCurrency(row.estimatedSpend)}</td>
              ))}
              <td>{formatCurrency(totals.estimatedSpend)}</td>
            </tr>
            <tr>
              <th>薪資收入</th>
              {rows.map((row) => (
                <td key={row.month}>{formatCurrency(row.income)}</td>
              ))}
              <td>{formatCurrency(totals.income)}</td>
            </tr>
            <tr>
              <th>現金流</th>
              {rows.map((row) => (
                <td key={row.month} className={row.netFlow < 0 ? "text-danger" : "text-good"}>
                  {formatCurrency(row.netFlow)}
                </td>
              ))}
              <td className={totals.netFlow < 0 ? "text-danger" : "text-good"}>{formatCurrency(totals.netFlow)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnnualFinancialOverview({ rows, items }: { rows: ReturnType<typeof buildAnnualDashboardMonths>; items: BudgetStatus[] }) {
  const annualTotals = rows.reduce(
    (current, row) => ({
      estimatedSpend: current.estimatedSpend + row.estimatedSpend,
      income: current.income + row.income,
      netFlow: current.netFlow + row.netFlow
    }),
    { estimatedSpend: 0, income: 0, netFlow: 0 }
  );
  const overBudget = summarizeOverBudgetItems(items);
  const topOverBudgetItems = overBudget.items.slice(0, 6);
  const totalBudget = items.reduce((total, item) => total + item.annualBudget, 0);
  const totalUsed = items.reduce((total, item) => total + item.usedAmount, 0);
  const nonOverBudgetRemaining = items
    .filter((item) => getBudgetOverrunAmount(item) === 0 && item.remainingAmount > 0)
    .reduce((total, item) => total + item.remainingAmount, 0);
  const remainingAfterCoveringOverrun = nonOverBudgetRemaining - overBudget.totalOverrun;
  const incomeBudgetRoom = annualTotals.income - totalBudget;
  const additionalBudgetCap = Math.max(0, Math.min(incomeBudgetRoom, annualTotals.netFlow));
  const capReason = incomeBudgetRoom <= 0
    ? "年度預算已達或超過年度收入"
    : annualTotals.netFlow <= 0
      ? "年度淨流量已無追加空間"
      : "以收入上限與年度淨流量取較保守值";

  return (
    <section className="surface section-block annual-control-panel">
      <div className="section-heading annual-control-heading">
        <div>
          <h2>年度控管</h2>
          <span>現金流是最後防線；預算管理用來判斷超標、挪移與追加上限。</span>
        </div>
        <Link className="secondary-action" href="/cash-flow">查看月度現金流</Link>
      </div>

      <div className="annual-control-grid">
        <div className="annual-control-card annual-control-income">
          <span>年度收入上限</span>
          <strong>{formatCurrency(annualTotals.income)}</strong>
          <small>今年花費上限不可超過年度收入總額。</small>
        </div>
        <div className="annual-control-card annual-control-spend">
          <span>已排程支出</span>
          <strong>{formatCurrency(annualTotals.estimatedSpend)}</strong>
          <small>現金支出 + 信用卡實際/預估帳單，已在現金流扣除。</small>
        </div>
        <div className={`annual-control-card ${annualTotals.netFlow < 0 ? "annual-control-danger" : "annual-control-good"}`}>
          <span>年度淨流量</span>
          <strong>{formatCurrency(annualTotals.netFlow)}</strong>
          <small>最後防線：若為負數，應先降支出或補收入。</small>
        </div>
        <div className={`annual-control-card ${additionalBudgetCap <= 0 ? "annual-control-danger" : "annual-control-good"}`}>
          <span>可追加預算上限</span>
          <strong>{formatCurrency(additionalBudgetCap)}</strong>
          <small>{capReason}</small>
        </div>
      </div>

      <div className="annual-decision-grid">
        <div className="annual-decision-card annual-decision-danger">
          <span>已超標項目</span>
          <strong>{overBudget.items.length} 項 / {formatCurrency(overBudget.totalOverrun)}</strong>
          {topOverBudgetItems.length > 0 ? (
            <ul className="annual-decision-list">
              {topOverBudgetItems.map((item) => (
                <li key={item.id}>
                  <Link href={`/expenses?month=all&budget=${encodeURIComponent(item.itemName)}`}>{item.itemName}</Link>
                  <strong>{formatCurrency(getBudgetOverrunAmount(item))}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <small>目前沒有超標項目。</small>
          )}
        </div>
        <div className="annual-decision-card">
          <span>可挪移剩餘預算</span>
          <strong>{formatCurrency(nonOverBudgetRemaining)}</strong>
          <small>只加總未超標且仍有剩餘的預算項目。</small>
        </div>
        <div className={`annual-decision-card ${remainingAfterCoveringOverrun < 0 ? "annual-decision-danger" : "annual-decision-good"}`}>
          <span>挪移後結果</span>
          <strong>{remainingAfterCoveringOverrun >= 0 ? `仍剩 ${formatCurrency(remainingAfterCoveringOverrun)}` : `仍缺 ${formatCurrency(Math.abs(remainingAfterCoveringOverrun))}`}</strong>
          <small>若仍缺，才評估追加預算；追加後仍不可超過年度收入與淨流量防線。</small>
        </div>
        <div className="annual-decision-card">
          <span>年度預算使用</span>
          <strong>{formatCurrency(totalUsed)} / {formatCurrency(totalBudget)}</strong>
          <small>所有 active 消費明細加總後的年度預算使用狀態。</small>
        </div>
      </div>
    </section>
  );
}
export function HomeDashboardClient({ initialData }: { initialData: AccountingDashboardData }) {
  const emptyDashboard = useMemo(() => getEmptyDashboard(initialData), [initialData]);
  const [dashboardData, setDashboardData] = useState<AccountingDashboardData>(emptyDashboard);
  const [status, setStatus] = useState<DashboardStatus>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SupabaseSessionUser | null>(null);
  const [households, setHouseholds] = useState<SupabaseHouseholdRow[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);
    const user = readStoredSupabaseUser(window.localStorage);
    setSessionUser(user);

    if (!session) {
      setDashboardData(emptyDashboard);
      setHouseholds([]);
      setStatus("signed-out");
      return;
    }

    if (!isStoredSupabaseSessionValid(window.localStorage)) {
      setDashboardData(emptyDashboard);
      setHouseholds([]);
      setStatus("expired");
      return;
    }

    let isCurrent = true;
    setStatus("loading");
    setError(null);
    setAccessToken(session.accessToken);

    Promise.all([
      getSupabaseDashboardData(initialData, session.accessToken),
      getSupabaseHouseholds(session.accessToken)
    ])
      .then(([supabaseData, householdRows]) => {
        if (!isCurrent) {
          return;
        }

        setDashboardData({
          ...emptyDashboard,
          ...supabaseData,
          dataSource: "supabase"
        });
        setHouseholds(householdRows);
        setStatus("connected");
      })
      .catch((caughtError) => {
        if (!isCurrent) {
          return;
        }

        setDashboardData(emptyDashboard);
        setHouseholds([]);
        setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
        setStatus("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [emptyDashboard, initialData]);

  const { billEstimates, budgetStatuses, cashFlowMonths, reviewTasks } = dashboardData;
  const displayMonth = monthKeyFromDateValue();
  const currentCashFlow = cashFlowMonths.find((month) => month.month === displayMonth) ?? {
    month: displayMonth,
    income: 0,
    cashExpense: 0,
    estimatedCardPayment: 0,
    netFlow: 0
  };
  const previousCashFlows = cashFlowMonths.filter((month) => month.month < displayMonth).sort((a, b) => b.month.localeCompare(a.month));
  const prevCashFlow = previousCashFlows[0];
  const futureBillEstimates = filterFutureBills(billEstimates, displayMonth);
  const annualRows = buildAnnualDashboardMonths(Number(displayMonth.slice(0, 4)), cashFlowMonths, billEstimates);

  const incomeDiff = prevCashFlow ? currentCashFlow.income - prevCashFlow.income : null;
  const incomeSubtitle = incomeDiff === null
    ? undefined
    : Math.abs(incomeDiff) < 500
      ? "與前月接近"
      : `較前月${incomeDiff > 0 ? "增加" : "減少"} ${formatCurrency(Math.abs(incomeDiff))}`;

  const cashDiff = prevCashFlow ? currentCashFlow.cashExpense - prevCashFlow.cashExpense : null;
  const cashSubtitle = cashDiff === null
    ? undefined
    : cashDiff > 0
      ? `較前月增加 ${formatCurrency(cashDiff)}`
      : `較前月減少 ${formatCurrency(Math.abs(cashDiff))}`;

  const thisMonthCards = [...new Set(futureBillEstimates.filter((bill) => bill.month === displayMonth).map((bill) => bill.creditCardName))];
  const cardSubtitle = thisMonthCards.length > 0 ? thisMonthCards.join(" + ") : undefined;
  const netSubtitle = currentCashFlow.netFlow >= 0 ? "現金流健康" : "本月超支";

  return (
    <>
      <PageHeader
        eyebrow="首頁"
        title="年度財務總覽"
        description={`${displayMonth} 更新。先檢視全年收入、防線、預算超標與可挪移空間，再回頭處理本月現金流與待辦。`}
      />
      <div className={`data-source-pill data-source-${status}`}>{statusText(status, dashboardData, sessionUser, households)}</div>
      {sessionUser ? <p className="muted">Supabase user id: {sessionUser.userId}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <AnnualFinancialOverview rows={annualRows} items={budgetStatuses} />

      <StatStrip
        stats={[
          { label: "本月收入", value: currentCashFlow.income, tone: "teal", subtitle: incomeSubtitle },
          { label: "現金支出", value: currentCashFlow.cashExpense, tone: "sky", subtitle: cashSubtitle },
          {
            label: "信用卡付款",
            value: currentCashFlow.actualCardPayment ?? currentCashFlow.estimatedCardPayment,
            tone: "orange",
            subtitle: cardSubtitle
          },
          {
            label: "月淨流量",
            value: currentCashFlow.netFlow,
            tone: currentCashFlow.netFlow < 0 ? "rose" : "violet",
            subtitle: netSubtitle
          }
        ]}
      />

      <div className="grid-two">
        <RecentExpensesFeed accessToken={accessToken} />
        <div>
          <TaskWorkbench tasks={reviewTasks} />
          <BudgetStatusList items={budgetStatuses} />
        </div>
      </div>
      <AnnualDashboardTable rows={annualRows} />
      <div className="grid-two">
        <BillEstimateTable bills={futureBillEstimates} title="本月以後帳單預估" />
        <CashFlowTable months={cashFlowMonths} />
      </div>
    </>
  );
}
