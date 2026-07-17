import assert from "node:assert/strict";

import * as dashboardFilters from "./dashboard-filters.ts";

import {
  addMonths,
  buildAnnualDashboardMonths,
  expenseMatchesFilters,
  filterCashFlowMonthsByYear,
  filterFutureBills,
  filterHistoricalBills,
  getCashFlowAvailableYears,
  getDefaultExpenseMonths,
  monthKeyFromDateValue,
  summarizeCashFlowMonths,
  summarizeOverBudgetItems,
  summarizeSpendingCapacity
} from "./dashboard-filters.ts";

assert.equal(monthKeyFromDateValue(new Date("2026-06-23T12:00:00+08:00")), "2026-06");
assert.equal(addMonths("2026-01", -1), "2025-12");
assert.deepEqual(getDefaultExpenseMonths("2026-06"), ["2026-06", "2026-05"]);

const bills = [
  { id: "jan", month: "2026-01", creditCardId: "card-1", creditCardName: "CTBC", estimatedAmount: 100, paymentDate: "2026-01-17", cutoffLabel: "", status: "estimated" as const, scheduleCount: 1 },
  { id: "jun", month: "2026-06", creditCardId: "card-2", creditCardName: "Union", estimatedAmount: 300, paymentDate: "2026-06-17", cutoffLabel: "", status: "estimated" as const, scheduleCount: 2 },
  { id: "jul", month: "2026-07", creditCardId: "card-3", creditCardName: "Cathay", estimatedAmount: 500, paymentDate: "2026-07-17", cutoffLabel: "", status: "estimated" as const, scheduleCount: 3 }
];

assert.deepEqual(filterFutureBills(bills, "2026-06").map((bill) => bill.id), ["jun", "jul"]);
assert.deepEqual(filterHistoricalBills(bills, "2026-06").map((bill) => bill.id), ["jan"]);

const expense = {
  id: "expense-1",
  consumptionDate: "2026-06-12",
  budgetMonth: "2026-06",
  merchantName: "Shopee Taiwan",
  itemDescription: "USB cable",
  budgetItemId: "budget-1",
  budgetItemName: "10. Daily",
  amount: 120,
  paymentToolType: "credit_card" as const,
  creditCardName: "Union",
  status: "active"
};

assert.equal(expenseMatchesFilters(expense, { month: "2026-06", creditCardName: "Union", query: "usb" }), true);
assert.equal(expenseMatchesFilters(expense, { merchantTag: "shopee" }), true);
assert.equal(expenseMatchesFilters(expense, { month: "2026-05" }), false);
assert.equal(expenseMatchesFilters(expense, { paymentToolType: "credit_card" }), true);
assert.equal(expenseMatchesFilters(expense, { paymentToolType: "cash" }), false);
assert.equal(expenseMatchesFilters(expense, { budgetItemName: "10. Daily" }), true);
assert.equal(expenseMatchesFilters(expense, { budgetItemName: "24. Food" }), false);

const invoiceExpense = {
  ...expense,
  id: "expense-invoice",
  invoiceNumber: "AB12345678"
};
const manualExpense = {
  ...expense,
  id: "expense-manual"
};
const blankInvoiceExpense = {
  ...expense,
  id: "expense-blank-invoice",
  invoiceNumber: "   "
};

assert.equal(expenseMatchesFilters(invoiceExpense, { sourceType: "invoice" }), true);
assert.equal(expenseMatchesFilters(invoiceExpense, { sourceType: "manual" }), false);
assert.equal(expenseMatchesFilters(manualExpense, { sourceType: "manual" }), true);
assert.equal(expenseMatchesFilters(manualExpense, { sourceType: "invoice" }), false);
assert.equal(expenseMatchesFilters(blankInvoiceExpense, { sourceType: "manual" }), true);
assert.equal(expenseMatchesFilters(blankInvoiceExpense, { sourceType: "invoice" }), false);
assert.equal(expenseMatchesFilters(invoiceExpense, { month: "2026-05", sourceType: "invoice" }), false);
assert.equal(expenseMatchesFilters(invoiceExpense, { query: "not found", sourceType: "invoice" }), false);

const oldInvoiceExpense = {
  ...invoiceExpense,
  id: "expense-old-invoice",
  consumptionDate: "2024-12-31",
  budgetMonth: "2024-12",
  merchantName: "Legacy Bookstore",
  itemDescription: "Archived receipt"
};

assert.equal(
  expenseMatchesFilters(oldInvoiceExpense, { query: "archived", sourceType: "invoice" }),
  true,
  "omitting month and months must leave all months available"
);
assert.equal(
  expenseMatchesFilters(oldInvoiceExpense, { query: "archived", sourceType: "manual" }),
  false,
  "source filters must remain mutually exclusive across years"
);

assert.equal(dashboardFilters.getExpenseSourceType(invoiceExpense), "invoice");
assert.equal(dashboardFilters.getExpenseSourceType(blankInvoiceExpense), "manual");
const installmentExpense = {
  ...expense,
  id: "expense-installment",
  amount: 13510,
  isInstallment: true
};

assert.equal(
  expenseMatchesFilters(installmentExpense, {
    billMonth: "2026-06",
    creditCardCutoffDay: 25,
    creditCardName: "Union"
  }),
  false,
  "帳單鑽取應由 payment_schedules 顯示分期本期金額，不應顯示原始消費總額"
);

assert.equal(
  typeof (dashboardFilters as Record<string, unknown>).buildInstallmentScheduleQuery,
  "function",
  "分期帳單查詢需要可測試的查詢條件產生器"
);

const installmentQuery = dashboardFilters.buildInstallmentScheduleQuery("2026-06", "card-fubon");
assert.equal(installmentQuery.cash_flow_month, "eq.2026-06");
assert.equal(installmentQuery.credit_card_id, "eq.card-fubon");
assert.equal(installmentQuery.payment_sequence, undefined, "帳單鑽取必須包含第 1 期");

const annual = buildAnnualDashboardMonths(
  2026,
  [{ month: "2026-06", income: 1000, cashExpense: 100, estimatedCardPayment: 0, netFlow: 900 }],
  bills
);

assert.equal(annual[5].month, "2026-06");
assert.equal(annual[5].estimatedSpend, 400);
assert.equal(annual[5].income, 1000);
assert.equal(annual[5].netFlow, 600);


const cashFlowMonths = [
  { month: "2025-12", income: 500, cashExpense: 100, estimatedCardPayment: 50, netFlow: 350, endingBalance: 350 },
  { month: "2026-01", income: 1000, cashExpense: 200, estimatedCardPayment: 150, netFlow: 650, endingBalance: 1000 },
  { month: "2026-02", income: 900, cashExpense: 300, estimatedCardPayment: 120, actualCardPayment: 100, netFlow: 500, endingBalance: 1500 }
];

assert.deepEqual(getCashFlowAvailableYears(cashFlowMonths), ["2026", "2025"]);
assert.deepEqual(filterCashFlowMonthsByYear(cashFlowMonths, "2026").map((month) => month.month), ["2026-01", "2026-02"]);
assert.deepEqual(summarizeCashFlowMonths(filterCashFlowMonthsByYear(cashFlowMonths, "2026")), {
  income: 1900,
  cashExpense: 500,
  cardPayment: 250,
  netFlow: 1150,
  endingBalance: 1500
});

const overBudgetSummary = summarizeOverBudgetItems([
  { id: "ok", groupName: "living", itemName: "daily goods", annualBudget: 1000, usedAmount: 900, remainingAmount: 100, usageRatio: 0.9, severity: "normal" },
  { id: "over-a", groupName: "entertainment", itemName: "subscription", annualBudget: 1000, usedAmount: 1300, remainingAmount: -300, usageRatio: 1.3, severity: "over_budget" },
  { id: "over-b", groupName: "transport", itemName: "taxi", annualBudget: 500, usedAmount: 900, remainingAmount: -400, usageRatio: 1.8, severity: "over_budget" }
]);

assert.deepEqual(overBudgetSummary.items.map((item) => item.id), ["over-b", "over-a"]);
assert.equal(overBudgetSummary.totalOverrun, 700);

const spendingCapacity = summarizeSpendingCapacity(
  [
    { id: "food", groupName: "living", itemName: "24. Food", annualBudget: 1000, usedAmount: 600, remainingAmount: 400, usageRatio: 0.6, severity: "normal" },
    { id: "tax", groupName: "tax", itemName: "05. Tax", annualBudget: 500, usedAmount: 100, remainingAmount: 400, usageRatio: 0.2, severity: "normal" },
    { id: "over", groupName: "over", itemName: "99. Over", annualBudget: 100, usedAmount: 120, remainingAmount: -20, usageRatio: 1.2, severity: "over_budget" }
  ],
  300,
  ["05. Tax"],
  50
);

assert.deepEqual(spendingCapacity.plannedItems.map((item) => item.id), ["food"]);
assert.deepEqual(spendingCapacity.closedItems.map((item) => item.id), ["tax"]);
assert.equal(spendingCapacity.plannedRemaining, 400);
assert.equal(spendingCapacity.closedRemaining, 400);
assert.equal(spendingCapacity.spendableCashFlow, 250);
assert.equal(spendingCapacity.shortfall, 150);
assert.equal(spendingCapacity.surplus, 0);
console.log("dashboard filters: 45 assertions passed");
