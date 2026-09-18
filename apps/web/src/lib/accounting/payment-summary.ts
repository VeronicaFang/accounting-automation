export type PaymentSummaryDeltaInput = {
  householdId: string;
  cashFlowMonth: string;
  incomeDelta?: number;
  cashExpenseDelta?: number;
  creditCardPaymentDelta?: number;
  creditCardId?: string | null;
  billAmountDelta?: number;
  billDetailDelta?: number;
  estimatedPaymentDate?: string | null;
};

export function buildPaymentSummaryDeltaParams(input: PaymentSummaryDeltaInput): Record<string, unknown> {
  return {
    p_household_id: input.householdId,
    p_cash_flow_month: input.cashFlowMonth,
    p_income_delta: input.incomeDelta ?? 0,
    p_cash_expense_delta: input.cashExpenseDelta ?? 0,
    p_credit_card_payment_delta: input.creditCardPaymentDelta ?? 0,
    p_credit_card_id: input.creditCardId ?? null,
    p_bill_amount_delta: input.billAmountDelta ?? 0,
    p_bill_detail_delta: input.billDetailDelta ?? 0,
    p_estimated_payment_date: input.estimatedPaymentDate ?? null
  };
}
