function getBudgetItems() {
  return readObjects_("BudgetItems")
    .filter((item) => item.is_valid_expense_item === true || String(item.is_valid_expense_item).toLowerCase() === "true")
    .map((item) => ({
      budget_item: item.budget_item,
      category: item.category,
      annual_budget: Number(item.annual_budget || 0),
    }));
}

function getBudgetSummary() {
  const budgetItems = getBudgetItems();
  const expenses = readObjects_("ExpenseRecords").filter((expense) => expense.expense_status !== "cancelled");
  return budgetItems.map((item) => {
    const used = expenses
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
      status: getBudgetStatus_(usageRatio),
    };
  }).sort((a, b) => {
    const order = { over_budget: 0, warning: 1, reminder: 2, normal: 3 };
    return order[a.status] - order[b.status] || b.usage_ratio - a.usage_ratio;
  });
}

function getBudgetImpact(consumptionDate, budgetItem, amount) {
  const summary = getBudgetSummary().find((row) => row.budget_item === budgetItem);
  if (!summary) {
    throw new Error(`找不到預算項目：${budgetItem}`);
  }
  const amountNumber = Number(amount || 0);
  const afterUsed = summary.used + amountNumber;
  const afterRemaining = summary.annual_budget - afterUsed;
  const afterRatio = summary.annual_budget > 0 ? afterUsed / summary.annual_budget : 0;
  return {
    budget_month: toMonthKey_(consumptionDate),
    budget_item: budgetItem,
    before_remaining: summary.remaining,
    after_remaining: afterRemaining,
    after_usage_ratio: afterRatio,
    after_status: getBudgetStatus_(afterRatio),
  };
}

