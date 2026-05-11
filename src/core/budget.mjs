import { getBudgetStatus, toMonthKey } from "./rules.mjs";

export function getBudgetItems(rows) {
  return rows
    .filter((row) => isValidExpenseItem(row.is_valid_expense_item))
    .map((row) => ({
      budget_item: row.budget_item,
      category: row.category,
      annual_budget: Number(row.annual_budget || 0),
    }));
}

export function getBudgetSummary(budgetRows, expenseRows) {
  const budgetItems = getBudgetItems(budgetRows);
  const activeExpenses = expenseRows.filter((expense) => expense.expense_status !== "cancelled");

  return budgetItems.map((item) => {
    const used = activeExpenses
      .filter((expense) => expense.budget_item === item.budget_item)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const remaining = item.annual_budget - used;
    const usageRatio = item.annual_budget > 0 ? used / item.annual_budget : 0;
    return {
      budget_item: item.budget_item,
      category: item.category,
      annual_budget: item.annual_budget,
      used,
      remaining,
      usage_ratio: usageRatio,
      status: getBudgetStatus(usageRatio),
    };
  }).sort((a, b) => {
    const order = { over_budget: 0, warning: 1, reminder: 2, normal: 3 };
    return order[a.status] - order[b.status] || b.usage_ratio - a.usage_ratio;
  });
}

export function getBudgetImpact(budgetRows, expenseRows, consumptionDate, budgetItem, amount) {
  const summary = getBudgetSummary(budgetRows, expenseRows).find((row) => row.budget_item === budgetItem);
  if (!summary) {
    throw new Error(`Budget item not found: ${budgetItem}`);
  }
  const amountNumber = Number(amount || 0);
  const afterUsed = summary.used + amountNumber;
  const afterRemaining = summary.annual_budget - afterUsed;
  const afterRatio = summary.annual_budget > 0 ? afterUsed / summary.annual_budget : 0;
  return {
    budget_month: toMonthKey(consumptionDate),
    budget_item: budgetItem,
    before_remaining: summary.remaining,
    after_remaining: afterRemaining,
    after_usage_ratio: afterRatio,
    after_status: getBudgetStatus(afterRatio),
  };
}

function isValidExpenseItem(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}
