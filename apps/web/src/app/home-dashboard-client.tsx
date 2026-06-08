"use client";

import { useEffect, useMemo, useState } from "react";

import { BillEstimateTable } from "@/components/bill-estimate-table";
import { BudgetStatusList } from "@/components/budget-status-list";
import { CashFlowTable } from "@/components/cash-flow-table";
import { PageHeader } from "@/components/page-header";
import { StatStrip } from "@/components/stat-strip";
import { TaskWorkbench } from "@/components/task-workbench";
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

  const { billEstimates, budgetStatuses, cashFlowMonths, currentMonth, reviewTasks } = dashboardData;
  const currentCashFlow = cashFlowMonths[0] ?? {
    month: currentMonth,
    income: 0,
    cashExpense: 0,
    estimatedCardPayment: 0,
    netFlow: 0
  };

  return (
    <>
      <PageHeader
        eyebrow="首頁"
        title={`${currentMonth} 本月狀態與待辦`}
        description="登入 Supabase 後，這裡只顯示目前帳號可讀取的 household 資料。"
      />
      <div className={`data-source-pill data-source-${status}`}>{statusText(status, dashboardData, sessionUser, households)}</div>
      {sessionUser ? <p className="muted">Supabase user id: {sessionUser.userId}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <StatStrip
        stats={[
          { label: "收入", value: currentCashFlow.income, tone: "good" },
          { label: "現金支出", value: currentCashFlow.cashExpense, tone: "neutral" },
          {
            label: "信用卡付款",
            value: currentCashFlow.actualCardPayment ?? currentCashFlow.estimatedCardPayment,
            tone: "warning"
          },
          {
            label: "月淨流量",
            value: currentCashFlow.netFlow,
            tone: currentCashFlow.netFlow < 0 ? "danger" : "good"
          }
        ]}
      />
      <div className="grid-two">
        <div>
          <BillEstimateTable bills={billEstimates} />
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
