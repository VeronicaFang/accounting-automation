import type { BudgetStatus, ExpenseRecord } from "@/lib/types";

export type PeriodMode = "month" | "quarter";
export type PaymentToolScope = "all" | "cash" | "credit_card";

export type SpendingAnalysisFilters = {
  year: string;
  periodMode: PeriodMode;
  budgetGroup: string;
  budgetItemId: string;
  paymentTool: PaymentToolScope;
};

export type PeriodAmount = {
  key: string;
  label: string;
  amount: number;
};

export type SpendingTrendItem = {
  budgetItemId: string;
  budgetItemName: string;
  groupName: string;
  annualBudget: number;
  annualUsed: number;
  annualRemaining: number;
  usageRatio: number;
  periodAmounts: PeriodAmount[];
  selectedTotal: number;
  averageAmount: number;
  projectedAnnualAmount: number;
  overrunAmount: number;
  status: "normal" | "attention" | "near_limit" | "over";
};

export type SpendingAnalysisSummary = {
  selectedTotal: number;
  annualUsed: number;
  annualBudget: number;
  overBudgetCount: number;
  overrunTotal: number;
  annualRemainingBudget: number;
  highestGrowthItem: SpendingTrendItem | null;
};

export type SpendingAnalysisResult = {
  periods: PeriodAmount[];
  items: SpendingTrendItem[];
  summary: SpendingAnalysisSummary;
};

export function buildYearMonths(year: string): PeriodAmount[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { key: month, label: `${index + 1}月`, amount: 0 };
  });
}

export function buildYearQuarters(year: string): PeriodAmount[] {
  return [1, 2, 3, 4].map((quarter) => ({
    key: `${year}-Q${quarter}`,
    label: `Q${quarter}`,
    amount: 0
  }));
}

export function getExpensePeriodKey(expense: ExpenseRecord, mode: PeriodMode): string {
  if (mode === "month") {
    return expense.budgetMonth;
  }

  const month = Number(expense.budgetMonth.slice(5, 7));
  const quarter = Math.max(1, Math.ceil(month / 3));
  return `${expense.budgetMonth.slice(0, 4)}-Q${quarter}`;
}

export function getTrendStatus(usageRatio: number): SpendingTrendItem["status"] {
  if (usageRatio > 1) return "over";
  if (usageRatio >= 0.9) return "near_limit";
  if (usageRatio >= 0.75) return "attention";
  return "normal";
}

export function summarizeSpendingTrends(
  expenses: ExpenseRecord[],
  budgets: BudgetStatus[],
  filters: SpendingAnalysisFilters
): SpendingAnalysisResult {
  const periods = filters.periodMode === "month" ? buildYearMonths(filters.year) : buildYearQuarters(filters.year);
  const periodKeys = new Set(periods.map((period) => period.key));
  const budgetById = new Map(budgets.map((budget) => [budget.id, budget]));
  const amountByBudgetAndPeriod = new Map<string, Map<string, number>>();

  expenses
    .filter((expense) => expense.status === "active")
    .filter((expense) => expense.budgetMonth.startsWith(`${filters.year}-`))
    .filter((expense) => filters.paymentTool === "all" || expense.paymentToolType === filters.paymentTool)
    .filter((expense) => !filters.budgetItemId || expense.budgetItemId === filters.budgetItemId)
    .forEach((expense) => {
      const periodKey = getExpensePeriodKey(expense, filters.periodMode);
      if (!periodKeys.has(periodKey)) return;

      const current = amountByBudgetAndPeriod.get(expense.budgetItemId) ?? new Map<string, number>();
      current.set(periodKey, (current.get(periodKey) ?? 0) + expense.amount);
      amountByBudgetAndPeriod.set(expense.budgetItemId, current);
    });

  const items = budgets
    .filter((budget) => !filters.budgetGroup || budget.groupName === filters.budgetGroup)
    .filter((budget) => !filters.budgetItemId || budget.id === filters.budgetItemId)
    .map((budget) => {
      const amountByPeriod = amountByBudgetAndPeriod.get(budget.id) ?? new Map<string, number>();
      const periodAmounts = periods.map((period) => ({
        ...period,
        amount: amountByPeriod.get(period.key) ?? 0
      }));
      const selectedTotal = periodAmounts.reduce((sum, period) => sum + period.amount, 0);
      const activePeriods = periodAmounts.filter((period) => period.amount > 0).length || 1;
      const averageAmount = selectedTotal / activePeriods;
      const projectedAnnualAmount = filters.periodMode === "month"
        ? averageAmount * 12
        : averageAmount * 4;
      const annualUsed = filters.paymentTool === "all" ? budget.usedAmount : selectedTotal;
      const annualRemaining = budget.annualBudget - annualUsed;
      const usageRatio = budget.annualBudget > 0 ? annualUsed / budget.annualBudget : 0;

      return {
        budgetItemId: budget.id,
        budgetItemName: budget.itemName,
        groupName: budget.groupName,
        annualBudget: budget.annualBudget,
        annualUsed,
        annualRemaining,
        usageRatio,
        periodAmounts,
        selectedTotal,
        averageAmount,
        projectedAnnualAmount,
        overrunAmount: Math.max(annualUsed - budget.annualBudget, 0),
        status: getTrendStatus(usageRatio)
      };
    })
    .filter((item) => item.selectedTotal > 0 || item.annualBudget > 0)
    .sort((a, b) => {
      const statusWeight = { over: 4, near_limit: 3, attention: 2, normal: 1 };
      const statusDiff = statusWeight[b.status] - statusWeight[a.status];
      if (statusDiff !== 0) return statusDiff;
      return b.selectedTotal - a.selectedTotal;
    });

  const overBudgetItems = items.filter((item) => item.overrunAmount > 0);
  const overrunTotal = overBudgetItems.reduce((sum, item) => sum + item.overrunAmount, 0);
  const nonOverBudgetRemaining = items
    .filter((item) => item.overrunAmount === 0 && item.annualRemaining > 0)
    .reduce((sum, item) => sum + item.annualRemaining, 0);
  const annualRemainingBudget = nonOverBudgetRemaining - overrunTotal;
  const highestGrowthItem = [...items]
    .filter((item) => item.periodAmounts.some((period) => period.amount > 0))
    .sort((a, b) => b.projectedAnnualAmount - b.annualBudget - (a.projectedAnnualAmount - a.annualBudget))[0] ?? null;

  return {
    periods,
    items,
    summary: {
      selectedTotal: items.reduce((sum, item) => sum + item.selectedTotal, 0),
      annualUsed: items.reduce((sum, item) => sum + item.annualUsed, 0),
      annualBudget: items.reduce((sum, item) => sum + item.annualBudget, 0),
      overBudgetCount: overBudgetItems.length,
      overrunTotal,
      annualRemainingBudget,
      highestGrowthItem
    }
  };
}
