import assert from "node:assert/strict";

import {
  addMonths,
  buildAnnualDashboardMonths,
  expenseMatchesFilters,
  filterFutureBills,
  filterHistoricalBills,
  getDefaultExpenseMonths,
  monthKeyFromDateValue
} from "./dashboard-filters.ts";

assert.equal(monthKeyFromDateValue(new Date("2026-06-23T12:00:00+08:00")), "2026-06");
assert.equal(addMonths("2026-01", -1), "2025-12");
assert.deepEqual(getDefaultExpenseMonths("2026-06"), ["2026-06", "2026-05"]);

const bills = [
  { id: "jan", month: "2026-01", creditCardName: "CTBC", estimatedAmount: 100, paymentDate: "2026-01-17", cutoffLabel: "", status: "estimated" as const, scheduleCount: 1 },
  { id: "jun", month: "2026-06", creditCardName: "Union", estimatedAmount: 300, paymentDate: "2026-06-17", cutoffLabel: "", status: "estimated" as const, scheduleCount: 2 },
  { id: "jul", month: "2026-07", creditCardName: "Cathay", estimatedAmount: 500, paymentDate: "2026-07-17", cutoffLabel: "", status: "estimated" as const, scheduleCount: 3 }
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
assert.equal(expenseMatchesFilters(expense, { budgetItemName: "24. Food" }), false);

const annual = buildAnnualDashboardMonths(
  2026,
  [{ month: "2026-06", income: 1000, cashExpense: 100, estimatedCardPayment: 0, netFlow: 900 }],
  bills
);

assert.equal(annual[5].month, "2026-06");
assert.equal(annual[5].estimatedSpend, 400);
assert.equal(annual[5].income, 1000);
assert.equal(annual[5].netFlow, 600);

console.log("dashboard filters: 13 assertions passed");