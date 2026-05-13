import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  getBudgetStatus,
  getPaymentDate,
  buildMerchantPaymentRuleFromRecord,
  splitInstallments,
  toMonthKey,
} from "../src/core/rules.mjs";

test("month key comes from consumption date", () => {
  assert.equal(toMonthKey("2026-02-10"), "2026-02");
});

test("cash payment date is the consumption date", () => {
  assert.equal(getPaymentDate("2026-05-08", "cash", ""), "2026-05-08");
});

test("other credit cards pay on current month 17th before or on day 5", () => {
  assert.equal(getPaymentDate("2026-05-05", "credit_card", "Union"), "2026-05-17");
});

test("other credit cards pay on next month 17th after day 5", () => {
  assert.equal(getPaymentDate("2026-05-06", "credit_card", "Cathay"), "2026-06-17");
});

test("YuShan pays on current month 23rd before or on day 12", () => {
  assert.equal(getPaymentDate("2026-05-12", "credit_card", "YuShan"), "2026-05-23");
});

test("YuShan pays on next month 23rd after day 12", () => {
  assert.equal(getPaymentDate("2026-05-13", "credit_card", "YuShan"), "2026-06-23");
});

test("installment split puts rounding remainder in last payment", () => {
  assert.deepEqual(splitInstallments(10000, 3), [3333, 3333, 3334]);
});

test("month addition preserves payment day", () => {
  assert.equal(addMonths("2026-05-17", 2), "2026-07-17");
});

test("budget status thresholds match requirements", () => {
  assert.equal(getBudgetStatus(0.69), "normal");
  assert.equal(getBudgetStatus(0.7), "reminder");
  assert.equal(getBudgetStatus(0.9), "warning");
  assert.equal(getBudgetStatus(1), "over_budget");
});
test("Chinese YuShan card name uses YuShan payment rule", () => {
  assert.equal(getPaymentDate("2026-05-12", "credit_card", "玉山"), "2026-05-23");
});

test("merchant payment rule stores display name without changing tax id matching", () => {
  assert.deepEqual(buildMerchantPaymentRuleFromRecord({
    source_type: "invoice_import",
    merchant_tax_id: "42159369",
    merchant_name: "測試商店股份有限公司台北分公司",
    payment_tool_type: "credit_card",
    credit_card_name: "玉山",
    budget_item: "24. 餐費",
  }), {
    merchant_tax_id: "42159369",
    merchant_name_contains: "",
    merchant_display_name: "測試商店股份有限公司台北分公司",
    payment_tool_type: "credit_card",
    credit_card_name: "玉山",
    default_budget_item: "24. 餐費",
    is_active: true,
    notes: "manual save from invoice_import",
  });
});
