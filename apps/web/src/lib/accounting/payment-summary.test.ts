import assert from "node:assert/strict";

import { buildPaymentSummaryDeltaParams } from "./payment-summary.ts";

assert.deepEqual(
  buildPaymentSummaryDeltaParams({
    householdId: "household-1",
    cashFlowMonth: "2026-09",
    incomeDelta: 0,
    cashExpenseDelta: 0,
    creditCardPaymentDelta: 436,
    creditCardId: "card-ctbc",
    billAmountDelta: 436,
    billDetailDelta: 1,
    estimatedPaymentDate: "2026-09-20"
  }),
  {
    p_household_id: "household-1",
    p_cash_flow_month: "2026-09",
    p_income_delta: 0,
    p_cash_expense_delta: 0,
    p_credit_card_payment_delta: 436,
    p_credit_card_id: "card-ctbc",
    p_bill_amount_delta: 436,
    p_bill_detail_delta: 1,
    p_estimated_payment_date: "2026-09-20"
  },
  "付款摘要 RPC 的參數名稱必須與資料庫函式一致"
);

assert.deepEqual(
  buildPaymentSummaryDeltaParams({
    householdId: "household-1",
    cashFlowMonth: "2026-09",
    incomeDelta: 1000
  }),
  {
    p_household_id: "household-1",
    p_cash_flow_month: "2026-09",
    p_income_delta: 1000,
    p_cash_expense_delta: 0,
    p_credit_card_payment_delta: 0,
    p_credit_card_id: null,
    p_bill_amount_delta: 0,
    p_bill_detail_delta: 0,
    p_estimated_payment_date: null
  },
  "收入異動不應建立信用卡帳單摘要"
);
