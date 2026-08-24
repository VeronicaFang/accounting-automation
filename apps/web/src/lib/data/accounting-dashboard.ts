import {
  billEstimates,
  budgetStatuses,
  cashFlowMonths,
  currentMonth,
  reviewTasks
} from "@/lib/mock-data";
import { isSupabaseDashboardConfigured } from "./supabase-repository";
import type { BillEstimate, BudgetStatus, CashFlowMonth, ExpenseRecord, ReviewTask } from "@/lib/types";

export type AccountingDashboardData = {
  currentMonth: string;
  cashFlowMonths: CashFlowMonth[];
  billEstimates: BillEstimate[];
  budgetStatuses: BudgetStatus[];
  expenses: ExpenseRecord[];
  reviewTasks: ReviewTask[];
  dataSource: "mock" | "supabase";
};

export function getMockDashboardData(): AccountingDashboardData {
  return {
    currentMonth,
    cashFlowMonths,
    billEstimates,
    budgetStatuses,
    expenses: [],
    reviewTasks,
    dataSource: "mock"
  };
}

export async function getAccountingDashboardData(): Promise<AccountingDashboardData> {
  const mockData = getMockDashboardData();

  if (!isSupabaseDashboardConfigured()) {
    return mockData;
  }

  return mockData;
}
