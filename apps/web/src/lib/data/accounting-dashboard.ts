import {
  billEstimates,
  budgetStatuses,
  cashFlowMonths,
  currentMonth,
  reviewTasks
} from "@/lib/mock-data";
import { getSupabaseDashboardData, isSupabaseDashboardConfigured } from "./supabase-repository";
import type { BillEstimate, BudgetStatus, CashFlowMonth, ReviewTask } from "@/lib/types";

export type AccountingDashboardData = {
  currentMonth: string;
  cashFlowMonths: CashFlowMonth[];
  billEstimates: BillEstimate[];
  budgetStatuses: BudgetStatus[];
  reviewTasks: ReviewTask[];
  dataSource: "mock" | "supabase";
};

export function getMockDashboardData(): AccountingDashboardData {
  return {
    currentMonth,
    cashFlowMonths,
    billEstimates,
    budgetStatuses,
    reviewTasks,
    dataSource: "mock"
  };
}

export async function getAccountingDashboardData(): Promise<AccountingDashboardData> {
  const mockData = getMockDashboardData();

  if (!isSupabaseDashboardConfigured()) {
    return mockData;
  }

  try {
    const supabaseData = await getSupabaseDashboardData(mockData);
    return {
      ...mockData,
      ...supabaseData,
      dataSource: "supabase"
    };
  } catch {
    return mockData;
  }
}
