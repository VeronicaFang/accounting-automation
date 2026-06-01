import assert from "node:assert/strict";
import { mapBillEstimateRows, mapCashFlowRows } from "./supabase-mappers.ts";

const cashFlow = mapCashFlowRows([
  {
    cash_flow_month: "2026-05",
    opening_balance: "120000",
    income_total: "95000",
    cash_expense_total: "71070",
    credit_card_payment_total: "11993",
    net_cash_flow: "-6750",
    ending_balance: "113250"
  }
]);

assert.deepEqual(cashFlow[0], {
  month: "2026-05",
  income: 95000,
  cashExpense: 71070,
  estimatedCardPayment: 11993,
  netFlow: -6750,
  openingBalance: 120000,
  endingBalance: 113250
});

const bills = mapBillEstimateRows(
  [
    {
      id: "estimate-1",
      credit_card_id: "card-1",
      bill_month: "2026-05",
      estimated_payment_date: "2026-05-23",
      estimated_bill_amount: "11993",
      detail_count: 18,
      credit_cards: { name: "聯邦" }
    }
  ],
  [
    {
      credit_card_id: "card-1",
      statement_month: "2026-05",
      payment_due_date: "2026-05-23",
      actual_amount: "30680",
      statement_status: "entered"
    }
  ]
);

assert.equal(bills[0].creditCardName, "聯邦");
assert.equal(bills[0].estimatedAmount, 11993);
assert.equal(bills[0].statementAmount, 30680);
assert.equal(bills[0].status, "statement_received");

console.log("supabase mappers: 6 assertions passed");
