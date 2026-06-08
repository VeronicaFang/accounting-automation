import type { BillEstimate, CashFlowMonth, ExpenseRecord, ReviewTask } from "@/lib/types";
import type { BudgetStatus } from "@/lib/types";

export type SupabaseCashFlowMonthRow = {
  cash_flow_month: string;
  opening_balance: string | number | null;
  income_total: string | number;
  cash_expense_total: string | number;
  credit_card_payment_total: string | number;
  net_cash_flow: string | number;
  ending_balance: string | number | null;
};

export type SupabaseBillEstimateRow = {
  id: string;
  credit_card_id: string;
  bill_month: string;
  estimated_payment_date: string | null;
  estimated_bill_amount: string | number;
  detail_count: number | null;
};

export type SupabaseCreditCardStatementRow = {
  credit_card_id: string;
  statement_month: string;
  payment_due_date: string;
  actual_amount: string | number;
  statement_status: string;
};

export type SupabaseCreditCardLookupRow = {
  id: string;
  name: string;
};

export type SupabaseBudgetItemLookupRow = {
  id: string;
  budget_group_id?: string;
  legacy_name: string | null;
  name: string | null;
  annual_budget?: string | number;
};

export type SupabaseBudgetGroupLookupRow = {
  id: string;
  name: string;
};

export type SupabaseExpenseBudgetRow = {
  budget_item_id: string;
  amount: string | number;
  status: string;
};

export type SupabaseExpenseRow = {
  id: string;
  budget_item_id: string;
  credit_card_id: string | null;
  consumption_date: string;
  budget_month: string;
  merchant_name: string | null;
  item_description: string;
  legacy_budget_item: string | null;
  amount: string | number;
  payment_tool_type: "cash" | "credit_card";
  status: string;
};

export type SupabaseReviewCountRow = {
  count: number;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(value);
}

export function mapCashFlowRows(rows: SupabaseCashFlowMonthRow[]): CashFlowMonth[] {
  return rows.map((row) => ({
    month: row.cash_flow_month,
    income: toNumber(row.income_total),
    cashExpense: toNumber(row.cash_expense_total),
    estimatedCardPayment: toNumber(row.credit_card_payment_total),
    netFlow: toNumber(row.net_cash_flow),
    openingBalance: row.opening_balance === null ? undefined : toNumber(row.opening_balance),
    endingBalance: row.ending_balance === null ? undefined : toNumber(row.ending_balance)
  }));
}

export function mapBillEstimateRows(
  estimates: SupabaseBillEstimateRow[],
  statements: SupabaseCreditCardStatementRow[],
  creditCards: SupabaseCreditCardLookupRow[] = []
): BillEstimate[] {
  const statementsByCardAndMonth = new Map<string, SupabaseCreditCardStatementRow>();
  const creditCardNameById = new Map(creditCards.map((card) => [card.id, card.name]));

  statements.forEach((statement) => {
    statementsByCardAndMonth.set(`${statement.credit_card_id}:${statement.statement_month}`, statement);
  });

  return estimates.map((estimate) => {
    const statement = statementsByCardAndMonth.get(`${estimate.credit_card_id}:${estimate.bill_month}`);

    return {
      id: estimate.id,
      month: estimate.bill_month,
      creditCardName: creditCardNameById.get(estimate.credit_card_id) ?? "未知信用卡",
      estimatedAmount: toNumber(estimate.estimated_bill_amount),
      statementAmount: statement ? toNumber(statement.actual_amount) : undefined,
      paymentDate: statement?.payment_due_date ?? estimate.estimated_payment_date ?? "付款日未設定",
      cutoffLabel: `${estimate.bill_month} 帳單`,
      status: statement ? "statement_received" : "estimated",
      scheduleCount: estimate.detail_count ?? 0
    };
  });
}

export function mapExpenseRows(
  rows: SupabaseExpenseRow[],
  budgetItems: SupabaseBudgetItemLookupRow[] = [],
  creditCards: SupabaseCreditCardLookupRow[] = []
): ExpenseRecord[] {
  const budgetItemById = new Map(budgetItems.map((item) => [item.id, item]));
  const creditCardNameById = new Map(creditCards.map((card) => [card.id, card.name]));

  return rows.map((row) => {
    const budgetItem = budgetItemById.get(row.budget_item_id);

    return {
      id: row.id,
      consumptionDate: row.consumption_date,
      budgetMonth: row.budget_month,
      merchantName: row.merchant_name ?? "",
      itemDescription: row.item_description,
      budgetItemName: budgetItem?.legacy_name ?? budgetItem?.name ?? row.legacy_budget_item ?? "",
      amount: toNumber(row.amount),
      paymentToolType: row.payment_tool_type,
      creditCardName:
        row.payment_tool_type === "credit_card" && row.credit_card_id
          ? creditCardNameById.get(row.credit_card_id) ?? ""
          : undefined,
      status: row.status
    };
  });
}

export function mapReviewCounts(invoiceDraftCount: number, mappingDraftCount: number): ReviewTask[] {
  const tasks: ReviewTask[] = [];

  if (invoiceDraftCount > 0) {
    tasks.push({
      id: "invoice-drafts",
      type: "invoice_draft",
      title: `${invoiceDraftCount} 筆待確認發票`,
      description: "Supabase invoice_drafts 仍有待確認資料。",
      createdAt: new Date().toISOString().slice(0, 10)
    });
  }

  if (mappingDraftCount > 0) {
    tasks.push({
      id: "budget-mapping-drafts",
      type: "budget_mapping",
      title: `${mappingDraftCount} 筆預算 mapping 待確認`,
      description: "Supabase budget_mapping_drafts 仍有待確認資料。",
      createdAt: new Date().toISOString().slice(0, 10)
    });
  }

  return tasks;
}

function severityFromUsage(usageRatio: number): BudgetStatus["severity"] {
  if (usageRatio >= 1) {
    return "over_budget";
  }

  if (usageRatio >= 0.9) {
    return "warning";
  }

  if (usageRatio >= 0.7) {
    return "reminder";
  }

  return "normal";
}

export function mapBudgetStatuses(
  budgetItems: SupabaseBudgetItemLookupRow[],
  budgetGroups: SupabaseBudgetGroupLookupRow[],
  expenses: SupabaseExpenseBudgetRow[]
): BudgetStatus[] {
  const groupNameById = new Map(budgetGroups.map((group) => [group.id, group.name]));
  const usedByBudgetItemId = new Map<string, number>();

  expenses
    .filter((expense) => expense.status !== "cancelled")
    .forEach((expense) => {
      usedByBudgetItemId.set(
        expense.budget_item_id,
        (usedByBudgetItemId.get(expense.budget_item_id) ?? 0) + toNumber(expense.amount)
      );
    });

  return budgetItems
    .map((item) => {
      const annualBudget = toNumber(item.annual_budget);
      const usedAmount = usedByBudgetItemId.get(item.id) ?? 0;
      const remainingAmount = annualBudget - usedAmount;
      const usageRatio = annualBudget > 0 ? usedAmount / annualBudget : 0;

      return {
        groupName: item.budget_group_id ? groupNameById.get(item.budget_group_id) ?? "" : "",
        itemName: item.legacy_name ?? item.name ?? "",
        annualBudget,
        usedAmount,
        remainingAmount,
        usageRatio,
        severity: severityFromUsage(usageRatio)
      };
    })
    .sort((a, b) => {
      const severityRank = { over_budget: 0, warning: 1, reminder: 2, normal: 3 };
      return severityRank[a.severity] - severityRank[b.severity] || b.usageRatio - a.usageRatio;
    });
}
