import test from "node:test";
import assert from "node:assert/strict";
import { compareCardBill, getCashFlowCardPaymentAmount } from "../src/core/card-statements.mjs";

test("cash flow uses actual card statement when present", () => {
  assert.equal(getCashFlowCardPaymentAmount({
    estimated_amount: 11993,
    actual_amount: 30500,
  }), 30500);
});

test("cash flow falls back to estimated amount when actual statement is missing", () => {
  assert.equal(getCashFlowCardPaymentAmount({
    estimated_amount: 11993,
    actual_amount: null,
  }), 11993);
});

test("compareCardBill reports amount and percentage variance", () => {
  assert.deepEqual(compareCardBill({
    bill_month: "2026-05",
    credit_card_name: "聯邦",
    estimated_amount: 11993,
    actual_amount: 30500,
  }), {
    bill_month: "2026-05",
    credit_card_name: "聯邦",
    estimated_amount: 11993,
    actual_amount: 30500,
    cash_flow_amount: 30500,
    difference_amount: 18507,
    difference_ratio: 18507 / 11993,
    status: "variance_warning",
  });
});

test("compareCardBill marks missing actual statements as estimated only", () => {
  assert.deepEqual(compareCardBill({
    bill_month: "2026-06",
    credit_card_name: "玉山",
    estimated_amount: 14432,
    actual_amount: null,
  }), {
    bill_month: "2026-06",
    credit_card_name: "玉山",
    estimated_amount: 14432,
    actual_amount: null,
    cash_flow_amount: 14432,
    difference_amount: null,
    difference_ratio: null,
    status: "estimated_only",
  });
});
