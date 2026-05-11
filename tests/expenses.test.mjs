import test from "node:test";
import assert from "node:assert/strict";
import { getRecentExpenses } from "../src/core/expenses.mjs";

const expenses = [
  { expense_id: "E1", consumption_date: "2026-05-01", merchant_name: "超商", item_description: "早餐", budget_item: "23. 餐費", amount: 100, payment_tool_type: "cash", credit_card_name: "", expense_status: "normal" },
  { expense_id: "E2", consumption_date: "2026-05-03", merchant_name: "量販店", item_description: "清潔用品", budget_item: "10. 日常用品", amount: 500, payment_tool_type: "credit_card", credit_card_name: "YuShan", expense_status: "normal" },
  { expense_id: "E3", consumption_date: "2026-05-04", merchant_name: "取消店家", item_description: "退貨", budget_item: "23. 餐費", amount: 200, payment_tool_type: "cash", credit_card_name: "", expense_status: "cancelled" },
];

test("recent expenses exclude cancelled rows and show newest rows first", () => {
  assert.deepEqual(getRecentExpenses(expenses, 2), [
    { expense_id: "E2", consumption_date: "2026-05-03", merchant_name: "量販店", item_description: "清潔用品", budget_item: "10. 日常用品", amount: 500, payment_label: "信用卡 YuShan", expense_status: "normal" },
    { expense_id: "E1", consumption_date: "2026-05-01", merchant_name: "超商", item_description: "早餐", budget_item: "23. 餐費", amount: 100, payment_label: "現金", expense_status: "normal" },
  ]);
});
