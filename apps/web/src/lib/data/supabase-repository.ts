import {
  mapInvoiceDraftReviewItems,
  type InvoiceMerchantItemRule,
  type InvoiceMerchantPaymentRule,
  type InvoiceDraftReviewItem,
  type InvoiceDraftReviewRow
} from "@/lib/accounting/invoice-review";
import { buildInstallmentScheduleQuery } from "@/lib/accounting/dashboard-filters";
import type { BudgetStatus, ExpenseRecord, ReviewTask } from "@/lib/types";

import type { AccountingDashboardData } from "./accounting-dashboard";
import {
  mapBillEstimateRows,
  mapBudgetStatuses,
  mapCashFlowRows,
  mapExpenseRows,
  mapReviewCounts,
  type SupabaseBillEstimateRow,
  type SupabaseBudgetGroupLookupRow,
  type SupabaseBudgetItemLookupRow,
  type SupabaseCashFlowMonthRow,
  type SupabaseCreditCardLookupRow,
  type SupabaseCreditCardStatementRow,
  type SupabaseExpenseBudgetRow,
  type SupabaseExpenseRow,
  type SupabaseReviewCountRow
} from "./supabase-mappers";
import { fetchSupabaseRows, isSupabaseRestConfigured } from "./supabase-rest";

export function isSupabaseDashboardConfigured(): boolean {
  return isSupabaseRestConfigured();
}

export type SupabaseHouseholdRow = {
  id: string;
  name: string;
};

export async function getSupabaseHouseholds(accessToken?: string): Promise<SupabaseHouseholdRow[]> {
  return fetchSupabaseRows<SupabaseHouseholdRow>(
    "households",
    {
      select: "id,name",
      order: "created_at.asc"
    },
    undefined,
    accessToken
  );
}

async function getSupabaseCreditCards(accessToken?: string): Promise<SupabaseCreditCardLookupRow[]> {
  return fetchSupabaseRows<SupabaseCreditCardLookupRow>(
    "credit_cards",
    {
      select: "id,name",
      order: "name.asc"
    },
    undefined,
    accessToken
  );
}

export async function getSupabaseBillEstimates(accessToken?: string) {
  const [billEstimateRows, statementRows, creditCardRows] = await Promise.all([
    fetchSupabaseRows<SupabaseBillEstimateRow>(
      "credit_card_bill_estimates",
      {
        select: "id,credit_card_id,bill_month,estimated_payment_date,estimated_bill_amount,detail_count",
        order: "bill_month.asc"
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseCreditCardStatementRow>(
      "credit_card_statements",
      {
        select: "credit_card_id,statement_month,payment_due_date,actual_amount,statement_status",
        order: "statement_month.asc"
      },
      undefined,
      accessToken
    ),
    getSupabaseCreditCards(accessToken)
  ]);

  return mapBillEstimateRows(billEstimateRows, statementRows, creditCardRows);
}

export async function getSupabaseDashboardData(
  fallback: AccountingDashboardData,
  accessToken?: string
): Promise<Partial<AccountingDashboardData>> {
  const [cashFlowRows, billEstimates, reviewTasks, budgetStatuses] = await Promise.all([
    fetchSupabaseRows<SupabaseCashFlowMonthRow>(
      "cash_flow_months",
      {
        select:
          "cash_flow_month,opening_balance,income_total,cash_expense_total,credit_card_payment_total,net_cash_flow,ending_balance",
        order: "cash_flow_month.asc"
      },
      undefined,
      accessToken
    ),
    getSupabaseBillEstimates(accessToken),
    getSupabaseReviewTasks(accessToken),
    getSupabaseBudgetStatuses(accessToken)
  ]);

  const cashFlowMonths = mapCashFlowRows(cashFlowRows);

  return {
    currentMonth: cashFlowMonths[0]?.month ?? fallback.currentMonth,
    cashFlowMonths,
    billEstimates,
    budgetStatuses,
    reviewTasks
  };
}

export async function getSupabaseReviewTasks(accessToken?: string): Promise<ReviewTask[]> {
  const [invoiceDraftRows, mappingDraftRows] = await Promise.all([
    fetchSupabaseRows<SupabaseReviewCountRow>(
      "invoice_drafts",
      {
        select: "id",
        review_status: "eq.needs_review"
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseReviewCountRow>(
      "budget_mapping_drafts",
      {
        select: "id",
        review_status: "neq.confirmed"
      },
      undefined,
      accessToken
    )
  ]);

  return mapReviewCounts(invoiceDraftRows.length, mappingDraftRows.length);
}

export async function getSupabaseInvoiceDrafts(accessToken?: string, limit = 100): Promise<InvoiceDraftReviewItem[]> {
  const [rows, budgetItems, creditCards, paymentRules, itemRules] = await Promise.all([
    fetchSupabaseRows<InvoiceDraftReviewRow>(
      "invoice_drafts",
      {
        select:
          "id,invoice_number,source_order,line_type,source_line_key,consumption_date,merchant_tax_id,merchant_name,item_description,amount,suggested_payment_tool_type,suggested_credit_card_id,suggested_budget_item_id,legacy_suggested_budget_item,review_status,notes",
        review_status: "eq.needs_review",
        order: "consumption_date.asc,id.asc",
        limit: String(limit)
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseBudgetItemLookupRow>(
      "budget_items",
      {
        select: "id,name,legacy_id,legacy_name",
        is_active: "eq.true",
        order: "legacy_code.asc"
      },
      undefined,
      accessToken
    ),
    getSupabaseCreditCards(accessToken),
    fetchSupabaseRows<InvoiceMerchantPaymentRule>(
      "merchant_payment_rules",
      {
        select: "merchant_tax_id,merchant_name_contains,payment_tool_type,credit_card_id,default_budget_item_id,is_active",
        is_active: "eq.true"
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<InvoiceMerchantItemRule>(
      "merchant_item_rules",
      {
        select: "merchant_tax_id,merchant_name_contains,item_keyword_contains,budget_item_id,is_active",
        is_active: "eq.true"
      },
      undefined,
      accessToken
    )
  ]);

  return mapInvoiceDraftReviewItems(rows, budgetItems, creditCards, { paymentRules, itemRules });
}

export async function getSupabaseExpensesByMonth(month: string, accessToken?: string): Promise<ExpenseRecord[]> {
  const [rows, budgetItems, creditCards] = await Promise.all([
    fetchSupabaseRows<SupabaseExpenseRow>(
      "expenses",
      {
        select:
          "id,budget_item_id,credit_card_id,consumption_date,budget_month,merchant_name,item_description,legacy_budget_item,amount,payment_tool_type,is_installment,invoice_number,original_amount,line_type,payment_parent_expense_id,source_line_key,status",
        status: "eq.active",
        budget_month: `eq.${month}`,
        order: "consumption_date.desc,id.desc",
        limit: "200"
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseBudgetItemLookupRow>("budget_items", { select: "id,legacy_name,name" }, undefined, accessToken),
    getSupabaseCreditCards(accessToken)
  ]);

  return mapExpenseRows(rows, budgetItems, creditCards);
}

export async function getSupabaseExpenses(accessToken?: string, limit = 200): Promise<ExpenseRecord[]> {
  const [rows, budgetItems, creditCards] = await Promise.all([
    fetchSupabaseRows<SupabaseExpenseRow>(
      "expenses",
      {
        select:
          "id,budget_item_id,credit_card_id,consumption_date,budget_month,merchant_name,item_description,legacy_budget_item,amount,payment_tool_type,is_installment,invoice_number,original_amount,line_type,payment_parent_expense_id,source_line_key,status",
        status: "eq.active",
        order: "consumption_date.desc,id.desc",
        limit: String(limit)
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseBudgetItemLookupRow>(
      "budget_items",
      {
        select: "id,legacy_name,name"
      },
      undefined,
      accessToken
    ),
    getSupabaseCreditCards(accessToken)
  ]);

  return mapExpenseRows(rows, budgetItems, creditCards);
}

export type InstallmentScheduleRecord = {
  scheduleId: string;
  expenseId: string;
  merchantName: string;
  itemDescription: string;
  paymentSequence: number;
  installmentCount: number;
  scheduleAmount: number;
  cashFlowMonth: string;
  creditCardId: string;
};

type RawInstallmentScheduleRow = {
  id: string;
  expense_id: string;
  payment_sequence: number;
  payment_amount: number;
  cash_flow_month: string;
  credit_card_id: string;
  expenses: {
    merchant_name: string | null;
    item_description: string | null;
    installment_count: number | null;
  } | null;
};

export async function getSupabaseInstallmentSchedulesByMonth(
  cashFlowMonth: string,
  creditCardId: string,
  accessToken?: string
): Promise<InstallmentScheduleRecord[]> {
  const rows = await fetchSupabaseRows<RawInstallmentScheduleRow>(
    "payment_schedules",
    buildInstallmentScheduleQuery(cashFlowMonth, creditCardId),
    undefined,
    accessToken
  );

  return rows.map((row) => ({
    scheduleId: row.id,
    expenseId: row.expense_id,
    merchantName: row.expenses?.merchant_name ?? "",
    itemDescription: row.expenses?.item_description ?? "",
    paymentSequence: row.payment_sequence,
    installmentCount: row.expenses?.installment_count ?? 0,
    scheduleAmount: row.payment_amount,
    cashFlowMonth: row.cash_flow_month,
    creditCardId: row.credit_card_id
  }));
}

export async function getSupabaseBudgetStatuses(accessToken?: string): Promise<BudgetStatus[]> {
  const [budgetItems, budgetGroups, expenseRows] = await Promise.all([
    fetchSupabaseRows<SupabaseBudgetItemLookupRow>(
      "budget_items",
      {
        select: "id,budget_group_id,legacy_name,name,annual_budget",
        order: "legacy_code.asc"
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseBudgetGroupLookupRow>(
      "budget_groups",
      {
        select: "id,name"
      },
      undefined,
      accessToken
    ),
    fetchSupabaseRows<SupabaseExpenseBudgetRow>(
      "expenses",
      {
        select: "budget_item_id,amount,status",
        limit: "2000"
      },
      undefined,
      accessToken
    )
  ]);

  return mapBudgetStatuses(budgetItems, budgetGroups, expenseRows);
}
