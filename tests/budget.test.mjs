import test from "node:test";
import assert from "node:assert/strict";
import { getBudgetImpact, getBudgetItems, getBudgetSummary } from "../src/core/budget.mjs";

const budgetRows = [
  { year: 2026, category: "個人", budget_item: "23. 餐費", annual_budget: 120000, is_valid_expense_item: true },
  { year: 2026, category: "家庭", budget_item: "10. 日常用品", annual_budget: 10000, is_valid_expense_item: "TRUE" },
  { year: 2026, category: "", budget_item: "預算總額", annual_budget: 130000, is_valid_expense_item: false },
];

const expenseRows = [
  { budget_item: "23. 餐費", amount: 70000, expense_status: "normal" },
  { budget_item: "23. 餐費", amount: 20000, expense_status: "cancelled" },
  { budget_item: "10. 日常用品", amount: 10000, expense_status: "normal" },
];

test("budget items include boolean TRUE and text TRUE but exclude summary rows", () => {
  assert.deepEqual(getBudgetItems(budgetRows).map((item) => item.budget_item), ["23. 餐費", "10. 日常用品"]);
});

test("budget summary ignores cancelled expenses and sorts over budget first", () => {
  const summary = getBudgetSummary(budgetRows, expenseRows);
  assert.equal(summary[0].budget_item, "10. 日常用品");
  assert.equal(summary[0].status, "over_budget");
  assert.equal(summary[1].budget_item, "23. 餐費");
  assert.equal(summary[1].used, 70000);
  assert.equal(summary[1].status, "normal");
});

test("budget impact shows remaining amount after a new expense", () => {
  const impact = getBudgetImpact(budgetRows, expenseRows, "2026-05-13", "23. 餐費", 50000);
  assert.equal(impact.budget_month, "2026-05");
  assert.equal(impact.before_remaining, 50000);
  assert.equal(impact.after_remaining, 0);
  assert.equal(impact.after_status, "over_budget");
});
