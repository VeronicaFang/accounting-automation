import { AppShell } from "@/components/app-shell";
import { BillEstimateTable } from "@/components/bill-estimate-table";
import { BudgetStatusList } from "@/components/budget-status-list";
import { CashFlowTable } from "@/components/cash-flow-table";
import { PageHeader } from "@/components/page-header";
import { StatStrip } from "@/components/stat-strip";
import { TaskWorkbench } from "@/components/task-workbench";
import { billEstimates, budgetStatuses, cashFlowMonths, currentMonth, reviewTasks } from "@/lib/mock-data";

export default function HomePage() {
  const currentCashFlow = cashFlowMonths[0];

  return (
    <AppShell>
      <PageHeader
        eyebrow="本月工作台"
        title={`${currentMonth} 現金與帳單狀態`}
        description="首頁只放每天要看的資訊：現金流、帳單、待確認、預算風險。"
        action={
          <select aria-label="查詢月份" defaultValue={currentMonth}>
            <option>{currentMonth}</option>
          </select>
        }
      />
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
    </AppShell>
  );
}
