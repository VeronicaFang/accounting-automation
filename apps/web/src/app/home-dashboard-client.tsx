"use client";

import { useEffect, useState } from "react";
import { BillEstimateTable } from "@/components/bill-estimate-table";
import { BudgetStatusList } from "@/components/budget-status-list";
import { CashFlowTable } from "@/components/cash-flow-table";
import { PageHeader } from "@/components/page-header";
import { StatStrip } from "@/components/stat-strip";
import { TaskWorkbench } from "@/components/task-workbench";
import type { AccountingDashboardData } from "@/lib/data/accounting-dashboard";
import { getSupabaseDashboardData } from "@/lib/data/supabase-repository";
import { readStoredSupabaseSession } from "@/lib/auth/supabase-auth";

type DashboardStatus = "signed-out" | "loading" | "connected" | "error";

function getStatusText(status: DashboardStatus): string {
  if (status === "loading") {
    return "正在讀取 Supabase household 資料";
  }

  if (status === "connected") {
    return "已使用登入 session 讀取 Supabase 資料";
  }

  if (status === "error") {
    return "Supabase 資料讀取失敗，暫時顯示本機示範資料";
  }

  return "尚未登入，顯示本機示範資料";
}

export function HomeDashboardClient({ initialData }: { initialData: AccountingDashboardData }) {
  const [dashboardData, setDashboardData] = useState<AccountingDashboardData>(initialData);
  const [status, setStatus] = useState<DashboardStatus>("signed-out");

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session) {
      setStatus("signed-out");
      return;
    }

    let isCurrent = true;
    setStatus("loading");

    getSupabaseDashboardData(initialData, session.accessToken)
      .then((supabaseData) => {
        if (!isCurrent) {
          return;
        }

        setDashboardData({
          ...initialData,
          ...supabaseData,
          dataSource: "supabase"
        });
        setStatus("connected");
      })
      .catch(() => {
        if (isCurrent) {
          setStatus("error");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [initialData]);

  const { billEstimates, budgetStatuses, cashFlowMonths, currentMonth, reviewTasks } = dashboardData;
  const currentCashFlow = cashFlowMonths[0];

  return (
    <>
      <PageHeader
        eyebrow="家庭記帳"
        title={`${currentMonth} 現金流總覽`}
        description="收入、現金支出、信用卡帳單與待確認事項會依登入狀態讀取資料。"
        action={
          <select aria-label="檢視月份" defaultValue={currentMonth}>
            <option>{currentMonth}</option>
          </select>
        }
      />
      <div className={`data-source-pill data-source-${status}`}>{getStatusText(status)}</div>
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
