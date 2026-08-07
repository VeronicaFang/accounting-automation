import type { BillEstimate, BudgetStatus, CashFlowMonth, ExpenseRecord } from "@/lib/types";

export type ExpenseSourceType = "invoice" | "manual";

export type ExpenseFilters = {
  month?: string;
  months?: string[];
  creditCardName?: string;
  paymentToolType?: ExpenseRecord["paymentToolType"];
  budgetItemName?: string;
  query?: string;
  merchantTag?: string;
  sourceType?: ExpenseSourceType;
  /** Bill month filter (YYYY-MM). When set, overrides month/months and filters by computed card billing month. */
  billMonth?: string;
  /** Card cutoff day (1–31). Required for billMonth to work correctly. */
  creditCardCutoffDay?: number;
};

export type AnnualDashboardMonth = {
  month: string;
  estimatedSpend: number;
  cardPayment: number;
  income: number;
  netFlow: number;
};

export type CashFlowSummary = {
  income: number;
  cashExpense: number;
  cardPayment: number;
  netFlow: number;
  endingBalance?: number;
};

export type OverBudgetSummary = {
  items: BudgetStatus[];
  totalOverrun: number;
};
export type SpendingCapacityItem = BudgetStatus & {
  planningStatus: "planned" | "closed";
};

export type SpendingCapacitySummary = {
  plannedItems: SpendingCapacityItem[];
  closedItems: SpendingCapacityItem[];
  plannedRemaining: number;
  closedRemaining: number;
  cashFlowCapacity: number;
  safetyReserve: number;
  spendableCashFlow: number;
  shortfall: number;
  surplus: number;
};

export type AnnualFinancialSummary = {
  annualIncome: number;
  annualSpend: number;
  annualNetRemaining: number;
  annualBudget: number;
  realizedBudget: number;
  unrecordedCreditCardSpend: number;
  unrealizedBudget: number;
  budgetUsageRatio: number;
  consumptionWaterRatio: number | null;
  isConsumptionWaterWarning: boolean;
  movableItems: BudgetStatus[];
  movableTotal: number;
  overBudget: OverBudgetSummary;
};

export function getBudgetOverrunAmount(item: BudgetStatus): number {
  return Math.max(0, -item.remainingAmount, item.usedAmount - item.annualBudget);
}

export function summarizeOverBudgetItems(items: BudgetStatus[]): OverBudgetSummary {
  const overBudgetItems = items
    .filter((item) => getBudgetOverrunAmount(item) > 0)
    .sort((a, b) => getBudgetOverrunAmount(b) - getBudgetOverrunAmount(a));

  return {
    items: overBudgetItems,
    totalOverrun: overBudgetItems.reduce((total, item) => total + getBudgetOverrunAmount(item), 0)
  };
}

export function summarizeSpendingCapacity(
  items: BudgetStatus[],
  cashFlowCapacity: number,
  closedItemNames: string[] = [],
  safetyReserve = 0
): SpendingCapacitySummary {
  const closedNames = new Set(closedItemNames.map((name) => normalize(name)));
  const remainingItems = items
    .filter((item) => item.remainingAmount > 0)
    .map<SpendingCapacityItem>((item) => ({
      ...item,
      planningStatus: closedNames.has(normalize(item.itemName)) ? "closed" : "planned"
    }))
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
  const plannedItems = remainingItems.filter((item) => item.planningStatus === "planned");
  const closedItems = remainingItems.filter((item) => item.planningStatus === "closed");
  const plannedRemaining = plannedItems.reduce((total, item) => total + item.remainingAmount, 0);
  const closedRemaining = closedItems.reduce((total, item) => total + item.remainingAmount, 0);
  const spendableCashFlow = cashFlowCapacity - safetyReserve;
  const shortfall = Math.max(0, plannedRemaining - spendableCashFlow);

  return {
    plannedItems,
    closedItems,
    plannedRemaining,
    closedRemaining,
    cashFlowCapacity,
    safetyReserve,
    spendableCashFlow,
    shortfall,
    surplus: Math.max(0, spendableCashFlow - plannedRemaining)
  };
}
export function summarizeAnnualFinancialOverview(
  rows: AnnualDashboardMonth[],
  items: BudgetStatus[]
): AnnualFinancialSummary {
  const annualIncome = rows.reduce((total, row) => total + row.income, 0);
  const annualSpend = rows.reduce((total, row) => total + row.estimatedSpend, 0);
  const annualNetRemaining = annualIncome - annualSpend;
  const annualBudget = items.reduce((total, item) => total + item.annualBudget, 0);
  const realizedBudget = items.reduce((total, item) => total + item.usedAmount, 0);
  const unrecordedCreditCardSpend = annualSpend - realizedBudget;
  const unrealizedBudget = annualBudget - realizedBudget;
  const budgetUsageRatio = annualBudget > 0 ? 1 - unrealizedBudget / annualBudget : 0;
  const consumptionWaterRatio = annualNetRemaining > 0 && unrealizedBudget > 0 ? unrealizedBudget / annualNetRemaining : null;
  const movableItems = items
    .filter((item) => getBudgetOverrunAmount(item) === 0 && item.remainingAmount > 0)
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
  const movableTotal = movableItems.reduce((total, item) => total + item.remainingAmount, 0);
  const overBudget = summarizeOverBudgetItems(items);

  return {
    annualIncome,
    annualSpend,
    annualNetRemaining,
    annualBudget,
    realizedBudget,
    unrecordedCreditCardSpend,
    unrealizedBudget,
    budgetUsageRatio,
    consumptionWaterRatio,
    isConsumptionWaterWarning: consumptionWaterRatio === null || consumptionWaterRatio > 0.9,
    movableItems,
    movableTotal,
    overBudget
  };
}
export function monthKeyFromDateValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return monthKeyFromDateValue(date);
}

export function getDefaultExpenseMonths(currentMonth: string): string[] {
  return [currentMonth, addMonths(currentMonth, -1)];
}

export function filterFutureBills(bills: BillEstimate[], currentMonth: string): BillEstimate[] {
  return bills.filter((bill) => bill.month >= currentMonth);
}

export function filterHistoricalBills(bills: BillEstimate[], currentMonth: string): BillEstimate[] {
  return bills.filter((bill) => bill.month < currentMonth);
}
export function filterStatementBills(bills: BillEstimate[]): BillEstimate[] {
  return bills
    .filter((bill) => bill.statementAmount !== undefined)
    .sort((a, b) => b.month.localeCompare(a.month) || a.creditCardName.localeCompare(b.creditCardName));
}

export function filterEstimatedBills(bills: BillEstimate[]): BillEstimate[] {
  return bills
    .filter((bill) => bill.statementAmount === undefined)
    .sort((a, b) => a.month.localeCompare(b.month) || a.creditCardName.localeCompare(b.creditCardName));
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function getExpenseSourceType(expense: ExpenseRecord): ExpenseSourceType {
  return normalize(expense.invoiceNumber) ? "invoice" : "manual";
}

export function expenseMatchesFilters(expense: ExpenseRecord, filters: ExpenseFilters): boolean {
  if (filters.billMonth && expense.isInstallment) {
    return false;
  }

  if (filters.billMonth) {
    // Bill month mode: compute which billing cycle this expense belongs to.
    if (filters.creditCardCutoffDay !== undefined && expense.paymentToolType === "credit_card") {
      const consumptionDay = Number(expense.consumptionDate.slice(8, 10));
      const consumptionMonth = expense.consumptionDate.slice(0, 7);
      const computedBillMonth =
        consumptionDay <= filters.creditCardCutoffDay ? consumptionMonth : addMonths(consumptionMonth, 1);

      if (computedBillMonth !== filters.billMonth) {
        return false;
      }
    } else {
      // No cutoff info available: fall back to budgetMonth comparison.
      if (expense.budgetMonth !== filters.billMonth) {
        return false;
      }
    }
  } else {
    const months = filters.month ? [filters.month] : filters.months;

    if (months && months.length > 0 && !months.includes(expense.budgetMonth)) {
      return false;
    }
  }

  if (filters.sourceType && getExpenseSourceType(expense) !== filters.sourceType) {
    return false;
  }

  if (filters.paymentToolType && expense.paymentToolType !== filters.paymentToolType) {
    return false;
  }

  if (filters.creditCardName && normalize(expense.creditCardName) !== normalize(filters.creditCardName)) {
    return false;
  }

  if (filters.budgetItemName && normalize(expense.budgetItemName) !== normalize(filters.budgetItemName)) {
    return false;
  }

  const merchantTag = normalize(filters.merchantTag);
  if (merchantTag && !normalize(expense.merchantName).includes(merchantTag)) {
    return false;
  }

  const query = normalize(filters.query);
  if (query) {
    const haystack = [expense.merchantName, expense.itemDescription, expense.budgetItemName, expense.creditCardName]
      .map(normalize)
      .join(" ");

    if (!haystack.includes(query)) {
      return false;
    }
  }

  return true;
}

export function filterExpenses(expenses: ExpenseRecord[], filters: ExpenseFilters): ExpenseRecord[] {
  return expenses.filter((expense) => expenseMatchesFilters(expense, filters));
}

export function buildInstallmentScheduleQuery(cashFlowMonth: string, creditCardId: string): Record<string, string> {
  return {
    select: "id,expense_id,payment_sequence,payment_amount,cash_flow_month,credit_card_id,expenses(merchant_name,item_description,installment_count)",
    cash_flow_month: `eq.${cashFlowMonth}`,
    credit_card_id: `eq.${creditCardId}`,
    order: "payment_sequence.asc"
  };
}
export function getCashFlowAvailableYears(months: CashFlowMonth[]): string[] {
  return Array.from(new Set(months.map((month) => month.month.slice(0, 4)).filter(Boolean))).sort((a, b) =>
    b.localeCompare(a)
  );
}

export function filterCashFlowMonthsByYear(months: CashFlowMonth[], year: string): CashFlowMonth[] {
  return months
    .filter((month) => month.month.startsWith(`${year}-`))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function summarizeCashFlowMonths(months: CashFlowMonth[]): CashFlowSummary {
  const summary = months.reduce<CashFlowSummary>(
    (current, month) => ({
      income: current.income + month.income,
      cashExpense: current.cashExpense + month.cashExpense,
      cardPayment: current.cardPayment + (month.actualCardPayment ?? month.estimatedCardPayment),
      netFlow: current.netFlow + month.netFlow,
      endingBalance: current.endingBalance
    }),
    { income: 0, cashExpense: 0, cardPayment: 0, netFlow: 0 }
  );

  const latestWithBalance = [...months]
    .sort((a, b) => b.month.localeCompare(a.month))
    .find((month) => month.endingBalance !== undefined);

  if (latestWithBalance) {
    summary.endingBalance = latestWithBalance.endingBalance;
  }

  return summary;
}
export function buildAnnualDashboardMonths(
  year: number,
  cashFlowMonths: CashFlowMonth[],
  billEstimates: BillEstimate[]
): AnnualDashboardMonth[] {
  const cashFlowByMonth = new Map(cashFlowMonths.map((month) => [month.month, month]));
  const billSpendByMonth = new Map<string, number>();

  for (const bill of billEstimates) {
    billSpendByMonth.set(bill.month, (billSpendByMonth.get(bill.month) ?? 0) + (bill.statementAmount ?? bill.estimatedAmount));
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const cashFlow = cashFlowByMonth.get(month);
    const income = cashFlow?.income ?? 0;
    const cardPayment = billSpendByMonth.get(month) ?? 0;
    const estimatedSpend = (cashFlow?.cashExpense ?? 0) + cardPayment;

    return {
      month,
      estimatedSpend,
      cardPayment,
      income,
      netFlow: income - estimatedSpend
    };
  });
}
