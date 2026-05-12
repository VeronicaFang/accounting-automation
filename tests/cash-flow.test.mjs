import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPaymentStatusUpdate,
  getCashFlowOverview,
  getMonthlyCreditCardBillEstimates,
  getPaymentSchedule,
  getUpcomingCreditCardPayments,
} from "../src/core/cash-flow.mjs";

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

test("cash flow overview separates income cash expenses credit card payments and net flow", () => {
  assert.deepEqual(getCashFlowOverview(incomes, payments), [
    { month: "2026-05", income_total: 65000, cash_expense_total: 0, credit_card_payment_total: 10000, net_cash_flow: 55000 },
    { month: "2026-06", income_total: 70000, cash_expense_total: 1500, credit_card_payment_total: 3000, net_cash_flow: 65500 },
  ]);
});

test("upcoming credit card payments exclude paid offset and cash rows", () => {
  assert.deepEqual(getUpcomingCreditCardPayments(payments, ["2026-05", "2026-06"]), [
    { month: "2026-05", credit_card_name: "YuShan", credit_card_label: "玉山", amount: 10000 },
  ]);
});

test("monthly credit card bill estimates group payment schedules by payment month and card", () => {
  const result = getMonthlyCreditCardBillEstimates([
    { cash_flow_month: "2026-05", payment_date: "2026-05-17", payment_amount: 1000, payment_status: "estimated", payment_tool_type: "credit_card", credit_card_name: "Union" },
    { cash_flow_month: "2026-05", payment_date: "2026-05-17", payment_amount: 2000, payment_status: "reconciled", payment_tool_type: "credit_card", credit_card_name: "Union" },
    { cash_flow_month: "2026-05", payment_date: "2026-05-17", payment_amount: 500, payment_status: "offset", payment_tool_type: "credit_card", credit_card_name: "Union" },
    { cash_flow_month: "2026-06", payment_date: "2026-06-23", payment_amount: 3000, payment_status: "estimated", payment_tool_type: "credit_card", credit_card_name: "YuShan" },
    { cash_flow_month: "2026-06", payment_date: "2026-06-01", payment_amount: 400, payment_status: "estimated", payment_tool_type: "cash", credit_card_name: "" },
  ], ["2026-05", "2026-06"]);

  assert.deepEqual(result, [
    {
      bill_month: "2026-05",
      credit_card_name: "Union",
      credit_card_label: "聯邦",
      billing_period_start: "2026-04-06",
      billing_period_end: "2026-05-05",
      estimated_payment_date: "2026-05-17",
      estimated_bill_amount: 3000,
      detail_count: 2,
      status_counts: { estimated: 1, reconciled: 1, paid: 0, corrected: 0, offset: 0 },
    },
    {
      bill_month: "2026-06",
      credit_card_name: "YuShan",
      credit_card_label: "玉山",
      billing_period_start: "2026-05-13",
      billing_period_end: "2026-06-12",
      estimated_payment_date: "2026-06-23",
      estimated_bill_amount: 3000,
      detail_count: 1,
      status_counts: { estimated: 1, reconciled: 0, paid: 0, corrected: 0, offset: 0 },
    },
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
    { month: "2026-06", income_total: 70000, cash_expense_total: 5000, credit_card_payment_total: 0, net_cash_flow: 65000 },
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

test("payment schedule exposes payment date amount card status and source expense", () => {
  const result = getPaymentSchedule([
    {
      payment_id: "P1",
      expense_id: "E1",
      payment_sequence: 1,
      payment_date: "2026-05-23",
      cash_flow_month: "2026-05",
      payment_amount: 1200,
      payment_tool_type: "credit_card",
      credit_card_name: "YuShan",
      payment_status: "estimated",
    },
  ], [
    {
      expense_id: "E1",
      consumption_date: "2026-05-02",
      merchant_name: "博客來",
      item_description: "技術書",
      amount: 1200,
    },
  ], ["2026-05"]);

  assert.deepEqual(result, [
    {
      payment_id: "P1",
      payment_month: "2026-05",
      payment_date: "2026-05-23",
      payment_amount: 1200,
      payment_tool_type: "credit_card",
      credit_card_name: "YuShan",
      credit_card_label: "玉山",
      payment_status: "estimated",
      source_expense: "2026-05-02 博客來 技術書",
      source_amount: 1200,
    },
  ]);
});

test("payment status update only changes allowed status and notes for matching payment", () => {
  const result = applyPaymentStatusUpdate([
    { payment_id: "P1", payment_status: "estimated", notes: "" },
    { payment_id: "P2", payment_status: "estimated", notes: "" },
  ], { payment_id: "P1", payment_status: "paid", notes: "已對帳" });

  assert.deepEqual(result, [
    { payment_id: "P1", payment_status: "paid", notes: "已對帳" },
    { payment_id: "P2", payment_status: "estimated", notes: "" },
  ]);
});

test("payment status update can correct reconciled payment amount", () => {
  const result = applyPaymentStatusUpdate([
    { payment_id: "P1", payment_amount: 333, payment_status: "estimated", notes: "" },
  ], { payment_id: "P1", payment_amount: 334, payment_status: "corrected", notes: "帳單尾差" });

  assert.deepEqual(result, [
    { payment_id: "P1", payment_amount: 334, payment_status: "corrected", notes: "帳單尾差" },
  ]);
});

