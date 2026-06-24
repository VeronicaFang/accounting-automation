import type { BillEstimate, CashFlowMonth, ExpenseRecord } from "@/lib/types";

export type ExpenseFilters = {
  month?: string;
  months?: string[];
  creditCardName?: string;
  budgetItemName?: string;
  query?: string;
  merchantTag?: string;
  /** Bill month filter (YYYY-MM). When set, overrides month/months and filters by computed card billing month. */
  billMonth?: string;
  /** Card cutoff day (1–31). Required for billMonth to work correctly. */
  creditCardCutoffDay?: number;
};

export type AnnualDashboardMonth = {
  month: string;
  estimatedSpend: number;
  income: number;
  netFlow: number;
};

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

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
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
export function buildAnnualDashboardMonths(
  year: number,
  cashFlowMonths: CashFlowMonth[],
  billEstimates: BillEstimate[]
): AnnualDashboardMonth[] {
  const cashFlowByMonth = new Map(cashFlowMonths.map((month) => [month.month, month]));
  const billSpendByMonth = new Map<string, number>();

  for (const bill of billEstimates) {
    billSpendByMonth.set(bill.month, (billSpendByMonth.get(bill.month) ?? 0) + bill.estimatedAmount);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const cashFlow = cashFlowByMonth.get(month);
    const income = cashFlow?.income ?? 0;
    const estimatedSpend = (cashFlow?.cashExpense ?? 0) + (billSpendByMonth.get(month) ?? 0);

    return {
      month,
      estimatedSpend,
      income,
      netFlow: income - estimatedSpend
    };
  });
}