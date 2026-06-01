import type { AccountingDashboardData } from "./accounting-dashboard";
import { fetchSupabaseRows, isSupabaseRestConfigured } from "./supabase-rest";
import {
  mapBillEstimateRows,
  mapCashFlowRows,
  type SupabaseBillEstimateRow,
  type SupabaseCashFlowMonthRow,
  type SupabaseCreditCardStatementRow
} from "./supabase-mappers";

export function isSupabaseDashboardConfigured(): boolean {
  return isSupabaseRestConfigured();
}

export async function getSupabaseDashboardData(
  fallback: AccountingDashboardData
): Promise<Partial<AccountingDashboardData>> {
  const [cashFlowRows, billEstimateRows, statementRows] = await Promise.all([
    fetchSupabaseRows<SupabaseCashFlowMonthRow>("cash_flow_months", {
      select:
        "cash_flow_month,opening_balance,income_total,cash_expense_total,credit_card_payment_total,net_cash_flow,ending_balance",
      order: "cash_flow_month.asc"
    }),
    fetchSupabaseRows<SupabaseBillEstimateRow>("credit_card_bill_estimates", {
      select:
        "id,credit_card_id,bill_month,estimated_payment_date,estimated_bill_amount,detail_count,credit_cards(name)",
      order: "bill_month.asc"
    }),
    fetchSupabaseRows<SupabaseCreditCardStatementRow>("credit_card_statements", {
      select: "credit_card_id,statement_month,payment_due_date,actual_amount,statement_status",
      order: "statement_month.asc"
    })
  ]);

  const cashFlowMonths = mapCashFlowRows(cashFlowRows);
  const billEstimates = mapBillEstimateRows(billEstimateRows, statementRows);

  return {
    currentMonth: cashFlowMonths[0]?.month ?? fallback.currentMonth,
    cashFlowMonths: cashFlowMonths.length > 0 ? cashFlowMonths : fallback.cashFlowMonths,
    billEstimates: billEstimates.length > 0 ? billEstimates : fallback.billEstimates,
    budgetStatuses: fallback.budgetStatuses,
    reviewTasks: fallback.reviewTasks
  };
}
