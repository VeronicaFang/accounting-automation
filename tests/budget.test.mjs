import test from "node:test";
import assert from "node:assert/strict";
import { getBudgetImpact, getBudgetItems, getBudgetLookup, getBudgetSummary } from "../src/core/budget.mjs";

const budgetRows = [
  { year: 2026, category: "個人", budget_item: "23. 餐費", annual_budget: 120000, month_05: 10000, is_valid_expense_item: true },
  { year: 2026, category: "家庭", budget_item: "10. 日常用品", annual_budget: 10000, is_valid_expense_item: "TRUE" },
  { year: 2026, category: "", budget_item: "預算總額", annual_budget: 130000, is_valid_expense_item: false },
];

const expenseRows = [
  { budget_item: "23. 餐費", budget_month: "2026-05", amount: 70000, expense_status: "normal" },
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

test("budget lookup returns annual and monthly remaining budget with optional after-spend preview", () => {
  const lookup = getBudgetLookup(budgetRows, expenseRows, "23. 餐費", "2026-05", 3000);

  assert.deepEqual(lookup, {
    budget_item: "23. 餐費",
    category: "個人",
    annual_budget: 120000,
    annual_used: 70000,
    annual_remaining: 50000,
    annual_usage_ratio: 70000 / 120000,
    annual_status: "normal",
    monthly_budget: 10000,
    monthly_used: 70000,
    monthly_remaining: -60000,
    monthly_usage_ratio: 7,
    monthly_status: "over_budget",
    after_annual_remaining: 47000,
    after_monthly_remaining: -63000,
    after_annual_usage_ratio: 73000 / 120000,
    after_annual_status: "normal",
    after_monthly_usage_ratio: 7.3,
    after_monthly_status: "over_budget",
  });
});

test("budget lookup defaults to the current month when no month is provided", () => {
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const monthField = `month_${currentMonth.slice(5, 7)}`;
  const rows = [
    { year: 2026, category: "個人", budget_item: "預設月份測試", annual_budget: 120000, [monthField]: 8000, is_valid_expense_item: true },
  ];
  const expenses = [
    { budget_item: "預設月份測試", budget_month: currentMonth, amount: 3000, expense_status: "normal" },
  ];

  const lookup = getBudgetLookup(rows, expenses, "預設月份測試", undefined, 500);

  assert.equal(lookup.monthly_budget, 8000);
  assert.equal(lookup.monthly_used, 3000);
  assert.equal(lookup.after_monthly_remaining, 4500);
});
