"use client";

import { useEffect, useMemo, useState } from "react";

import { BillEstimateTable } from "@/components/bill-estimate-table";
import { BudgetStatusList } from "@/components/budget-status-list";
import { CashFlowTable } from "@/components/cash-flow-table";
import { PageHeader } from "@/components/page-header";
import { StatStrip } from "@/components/stat-strip";
import { TaskWorkbench } from "@/components/task-workbench";
import {
  buildAnnualDashboardMonths,
  filterFutureBills,
  monthKeyFromDateValue
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
  const identity = user?.email ? `帳號 ${user.email}` : "未取得帳號 email";

  if (status === "loading") {
    return `正在讀取 Supabase，${identity}`;
  }

  if (status === "connected") {
    const householdLabel = households.length > 0 ? households.map((household) => household.name).join("、") : "無可讀 household";
    return `已連線 Supabase，${identity}，household：${householdLabel}，帳單 ${data.billEstimates.length} 筆、預算 ${data.budgetStatuses.length} 筆、現金流 ${data.cashFlowMonths.length} 個月份`;
  }

  if (status === "expired") {
    return `Session 已過期，${identity}，請重新登入 Supabase`;
  }

  if (status === "error") {
    return `Supabase 讀取失敗，${identity}`;
  }

  return "請先登入 Supabase，登入前不顯示正式資料";
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
        <span>全年預期</span>
      </div>
      <div className="table-scroll">
        <table className="data-table annual-dashboard-table">
          <thead>
            <tr>
              <th>項目</th>
              {rows.map((row) => (
                <th key={row.month}>{row.month.replace("-", "")}</th>
              ))}
              <th>全年</th>
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
export function HomeDashboardClient({ initialData }: { initialData: AccountingDashboardData }) {
  const emptyDashboard = useMemo(() => getEmptyDashboard(initialData), [initialData]);
  const [dashboardData, setDashboardData] = useState<AccountingDashboardData>(emptyDashboard);
  const [status, setStatus] = useState<DashboardStatus>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SupabaseSessionUser | null>(null);
  const [households, setHouseholds] = useState<SupabaseHouseholdRow[]>([]);

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
  const futureBillEstimates = filterFutureBills(billEstimates, displayMonth);
  const annualRows = buildAnnualDashboardMonths(Number(displayMonth.slice(0, 4)), cashFlowMonths, billEstimates);

  return (
    <>
      <PageHeader
        eyebrow="首頁"
        title={`${displayMonth} 本月狀態與待辦`}
        description="登入 Supabase 後，這裡只顯示目前帳號可讀取的 household 資料。"
      />
      <div className={`data-source-pill data-source-${status}`}>{statusText(status, dashboardData, sessionUser, households)}</div>
      {sessionUser ? <p className="muted">Supabase user id: {sessionUser.userId}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <StatStrip
        stats={[
          { label: "本月收入", value: currentCashFlow.income, tone: "teal" },
          { label: "現金支出", value: currentCashFlow.cashExpense, tone: "sky" },
          {
            label: "信用卡付款",
            value: currentCashFlow.actualCardPayment ?? currentCashFlow.estimatedCardPayment,
            tone: "orange"
          },
          {
            label: "月淨流量",
            value: currentCashFlow.netFlow,
            tone: currentCashFlow.netFlow < 0 ? "rose" : "violet"
          }
        ]}
      />
      <AnnualDashboardTable rows={annualRows} />
      <div className="grid-two">
        <div>
          <BillEstimateTable bills={futureBillEstimates} title="每月帳單預估（本月以後）" />
          <CashFlowTable months={cashFlowMonths} />
        </div>
        <div>
          <TaskWorkbench tasks={reviewTasks} />
          <BudgetStatusList items={budgetStatuses} />
        </div>
      </div>
    </>
  );
}
