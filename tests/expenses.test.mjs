import test from "node:test";
import assert from "node:assert/strict";
import { getRecentExpenses, isExpenseAmountAllowed, parseManualExpenseText, resolveExpenseSourceFields } from "../src/core/expenses.mjs";

const expenses = [
  { expense_id: "E1", consumption_date: "2026-05-01", merchant_name: "超商", item_description: "早餐", budget_item: "23. 餐費", amount: 100, payment_tool_type: "cash", credit_card_name: "", expense_status: "normal" },
  { expense_id: "E2", consumption_date: "2026-05-03", merchant_name: "量販店", item_description: "清潔用品", budget_item: "10. 日常用品", amount: 500, payment_tool_type: "credit_card", credit_card_name: "YuShan", expense_status: "normal" },
  { expense_id: "E3", consumption_date: "2026-05-04", merchant_name: "取消店家", item_description: "退貨", budget_item: "23. 餐費", amount: 200, payment_tool_type: "cash", credit_card_name: "", expense_status: "cancelled" },
];

test("recent expenses exclude cancelled rows and show newest rows first", () => {
  assert.deepEqual(getRecentExpenses(expenses, 2), [
    { expense_id: "E2", consumption_date: "2026-05-03", merchant_name: "量販店", item_description: "清潔用品", budget_item: "10. 日常用品", amount: 500, payment_label: "信用卡 玉山", expense_status: "normal" },
    { expense_id: "E1", consumption_date: "2026-05-01", merchant_name: "超商", item_description: "早餐", budget_item: "23. 餐費", amount: 100, payment_label: "現金", expense_status: "normal" },
  ]);
});

test("recent expenses show credit card names in Traditional Chinese", () => {
  assert.equal(getRecentExpenses(expenses, 1)[0].payment_label, "信用卡 玉山");
});
test("invoice import source fields are preserved for expense records", () => {
  assert.deepEqual(resolveExpenseSourceFields({
    source_type: "finance_ministry_invoice",
    source_record_id: "AB12345678",
    merchant_tax_id: "12345678",
  }), {
    source_type: "finance_ministry_invoice",
    source_record_id: "AB12345678",
    merchant_tax_id: "12345678",
  });
});

test("manual expense defaults to no-invoice source fields", () => {
  assert.deepEqual(resolveExpenseSourceFields({}), {
    source_type: "manual_no_invoice",
    source_record_id: "",
    merchant_tax_id: "",
  });
});
test("invoice import allows zero and negative amount lines", () => {
  assert.equal(isExpenseAmountAllowed({ source_type: "finance_ministry_invoice", amount: 0 }), true);
  assert.equal(isExpenseAmountAllowed({ source_type: "finance_ministry_invoice", amount: -3 }), true);
});

test("manual no-invoice expenses must be positive", () => {
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_no_invoice", amount: 0 }), false);
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_no_invoice", amount: -3 }), false);
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_no_invoice", amount: 1 }), true);
});
test("parse manual expense text supports shopping cart rows", () => {
  const text = `消費日,購買品項,消費金額,消費通路,預算項目,支付方式,信用卡,備註
2026/05/12,洗面乳,299,蝦皮,10. 日常用品,信用卡,聯邦,母親節
2026/05/12,折扣,-30,蝦皮,10. 日常用品,信用卡,聯邦,折抵`;

  assert.deepEqual(parseManualExpenseText(text), [
    { consumption_date: "2026-05-12", purchase_item: "洗面乳", amount: 299, channel: "蝦皮", budget_item: "10. 日常用品", payment_tool_type: "credit_card", credit_card_name: "聯邦", notes: "母親節" },
    { consumption_date: "2026-05-12", purchase_item: "折扣", amount: -30, channel: "蝦皮", budget_item: "10. 日常用品", payment_tool_type: "credit_card", credit_card_name: "聯邦", notes: "折抵" },
  ]);
});

test("manual batch import allows zero and negative amount lines", () => {
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_batch_import", amount: 0 }), true);
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_batch_import", amount: -30 }), true);
});
