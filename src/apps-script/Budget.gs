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

function getBudgetLookup(input) {
  if (!input || !input.budget_item) throw new Error("請選擇預算項目。");
  const monthKey = input.budget_month || toMonthKey_(new Date());
  const previewAmount = Number(input.preview_amount || 0);
  const budgetRows = readObjects_("BudgetItems");
  const sourceRow = budgetRows.find((row) => row.budget_item === input.budget_item);
  const item = getBudgetItems().find((row) => row.budget_item === input.budget_item);
  if (!item || !sourceRow) throw new Error(`找不到預算項目：${input.budget_item}`);
  const expenses = readObjects_("ExpenseRecords").filter((expense) => expense.expense_status !== "cancelled");
  const annualUsed = expenses
    .filter((expense) => expense.budget_item === input.budget_item)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const monthlyUsed = expenses
    .filter((expense) => expense.budget_item === input.budget_item)
    .filter((expense) => expense.budget_month === monthKey)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const monthlyBudget = Number(sourceRow[getMonthBudgetField_(monthKey)] || 0);
  const annualUsageRatio = item.annual_budget > 0 ? annualUsed / item.annual_budget : 0;
  const afterAnnualUsageRatio = item.annual_budget > 0 ? (annualUsed + previewAmount) / item.annual_budget : 0;
  const monthlyUsageRatio = monthlyBudget > 0 ? monthlyUsed / monthlyBudget : 0;
  const afterMonthlyUsageRatio = monthlyBudget > 0 ? (monthlyUsed + previewAmount) / monthlyBudget : 0;
  return {
    budget_item: item.budget_item,
    category: item.category,
    annual_budget: item.annual_budget,
    annual_used: annualUsed,
    annual_remaining: item.annual_budget - annualUsed,
    annual_usage_ratio: annualUsageRatio,
    annual_status: getBudgetStatus_(annualUsageRatio),
    monthly_budget: monthlyBudget,
    monthly_used: monthlyUsed,
    monthly_remaining: monthlyBudget - monthlyUsed,
    monthly_usage_ratio: monthlyUsageRatio,
    monthly_status: getBudgetStatus_(monthlyUsageRatio),
    after_annual_remaining: item.annual_budget - annualUsed - previewAmount,
    after_monthly_remaining: monthlyBudget - monthlyUsed - previewAmount,
    after_annual_usage_ratio: afterAnnualUsageRatio,
    after_annual_status: getBudgetStatus_(afterAnnualUsageRatio),
    after_monthly_usage_ratio: afterMonthlyUsageRatio,
    after_monthly_status: getBudgetStatus_(afterMonthlyUsageRatio),
  };
}

function getMonthBudgetField_(monthKey) {
  return `month_${String(monthKey || "").slice(5, 7)}`;
}
