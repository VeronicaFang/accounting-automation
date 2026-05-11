import test from "node:test";
import assert from "node:assert/strict";
import { getCashFlowOverview, getUpcomingCreditCardPayments } from "../src/core/cash-flow.mjs";

const incomes = [
  { income_month: "2026-05", income_amount: 65000 },
  { income_month: "2026-06", income_amount: 70000 },
];

const payments = [
  { cash_flow_month: "2026-05", payment_amount: 10000, payment_status: "estimated", payment_tool_type: "credit_card", credit_card_name: "YuShan" },
  { cash_flow_month: "2026-05", payment_amount: 2000, payment_status: "offset", payment_tool_type: "credit_card", credit_card_name: "YuShan" },
  { cash_flow_month: "2026-06", payment_amount: 3000, payment_status: "paid", payment_tool_type: "credit_card", credit_card_name: "Union" },
  { cash_flow_month: "2026-06", payment_amount: 1500, payment_status: "estimated", payment_tool_type: "cash", credit_card_name: "" },
];

test("cash flow overview subtracts active payment rows from income", () => {
  assert.deepEqual(getCashFlowOverview(incomes, payments), [
    { month: "2026-05", income_total: 65000, payment_total: 10000, net_cash_flow: 55000 },
    { month: "2026-06", income_total: 70000, payment_total: 4500, net_cash_flow: 65500 },
  ]);
});

test("upcoming credit card payments exclude paid offset and cash rows", () => {
  assert.deepEqual(getUpcomingCreditCardPayments(payments, ["2026-05", "2026-06"]), [
    { month: "2026-05", credit_card_name: "YuShan", credit_card_label: "玉山", amount: 10000 },
  ]);
});
test("cash flow overview normalizes date-like month values before grouping", () => {
  const result = getCashFlowOverview(
    [
      { income_month: "2026-06", income_amount: 65000 },
      { income_month: "2026-05-31T16:00:00.000Z", income_amount: 5000 },
    ],
    [
      { cash_flow_month: "2026-06", payment_amount: 3000, payment_status: "estimated" },
      { cash_flow_month: "2026-05-31T16:00:00.000Z", payment_amount: 2000, payment_status: "estimated" },
    ],
  );

  assert.deepEqual(result, [
    { month: "2026-06", income_total: 70000, payment_total: 5000, net_cash_flow: 65000 },
  ]);
});

test("upcoming credit card payments normalize date-like month values before grouping", () => {
  const result = getUpcomingCreditCardPayments([
    { cash_flow_month: "2026-05-31T16:00:00.000Z", payment_amount: 1000, payment_status: "estimated", payment_tool_type: "credit_card", credit_card_name: "YuShan" },
    { cash_flow_month: "2026-06", payment_amount: 2000, payment_status: "estimated", payment_tool_type: "credit_card", credit_card_name: "YuShan" },
  ], ["2026-06"]);

  assert.deepEqual(result, [
    { month: "2026-06", credit_card_name: "YuShan", credit_card_label: "玉山", amount: 3000 },
  ]);
});

