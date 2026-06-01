import type { BillEstimate, CashFlowMonth } from "@/lib/types";

type NestedCreditCard = { name?: string | null } | { name?: string | null }[] | null;

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
  credit_cards?: NestedCreditCard;
};

export type SupabaseCreditCardStatementRow = {
  credit_card_id: string;
  statement_month: string;
  payment_due_date: string;
  actual_amount: string | number;
  statement_status: string;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(value);
}

function getCreditCardName(creditCards: NestedCreditCard, fallback: string): string {
  if (Array.isArray(creditCards)) {
    return creditCards[0]?.name ?? fallback;
  }

  return creditCards?.name ?? fallback;
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
  statements: SupabaseCreditCardStatementRow[]
): BillEstimate[] {
  const statementsByCardAndMonth = new Map<string, SupabaseCreditCardStatementRow>();

  statements.forEach((statement) => {
    statementsByCardAndMonth.set(`${statement.credit_card_id}:${statement.statement_month}`, statement);
  });

  return estimates.map((estimate) => {
    const statement = statementsByCardAndMonth.get(`${estimate.credit_card_id}:${estimate.bill_month}`);

    return {
      id: estimate.id,
      month: estimate.bill_month,
      creditCardName: getCreditCardName(estimate.credit_cards ?? null, "未命名信用卡"),
      estimatedAmount: toNumber(estimate.estimated_bill_amount),
      statementAmount: statement ? toNumber(statement.actual_amount) : undefined,
      paymentDate: statement?.payment_due_date ?? estimate.estimated_payment_date ?? "付款日未設定",
      cutoffLabel: `${estimate.bill_month} 帳單`,
      status: statement ? "statement_received" : "estimated",
      scheduleCount: estimate.detail_count ?? 0
    };
  });
}
