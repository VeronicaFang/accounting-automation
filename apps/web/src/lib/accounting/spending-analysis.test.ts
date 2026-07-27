import assert from "node:assert/strict";

import { summarizeSpendingTrends } from "./spending-analysis.ts";
import type { BudgetStatus, ExpenseRecord } from "@/lib/types";

const budgets: BudgetStatus[] = [
  {
    id: "food",
    groupName: "個人",
    itemName: "24. 餐費",
    annualBudget: 120000,
    usedAmount: 70000,
    remainingAmount: 50000,
    usageRatio: 70000 / 120000,
    severity: "normal"
  },
  {
    id: "fun",
    groupName: "個人",
    itemName: "26. 奢侈娛樂",
    annualBudget: 10000,
    usedAmount: 25676,
    remainingAmount: -15676,
    usageRatio: 2.5676,
    severity: "over_budget"
  }
];

const expenses: ExpenseRecord[] = [
  {
    id: "food-jan",
    consumptionDate: "2026-01-10",
    budgetMonth: "2026-01",
    merchantName: "A",
    itemDescription: "lunch",
    budgetItemId: "food",
    budgetItemName: "24. 餐費",
    amount: 1000,
    paymentToolType: "cash",
    status: "active"
  },
  {
    id: "food-feb",
    consumptionDate: "2026-02-10",
    budgetMonth: "2026-02",
    merchantName: "B",
    itemDescription: "dinner",
    budgetItemId: "food",
    budgetItemName: "24. 餐費",
    amount: 2000,
    paymentToolType: "credit_card",
    status: "active"
  },
  {
    id: "fun-feb",
    consumptionDate: "2026-02-12",
    budgetMonth: "2026-02",
    merchantName: "C",
    itemDescription: "toy",
    budgetItemId: "fun",
    budgetItemName: "26. 奢侈娛樂",
    amount: 3000,
    paymentToolType: "credit_card",
    status: "active"
  },
  {
    id: "old",
    consumptionDate: "2025-12-30",
    budgetMonth: "2025-12",
    merchantName: "D",
    itemDescription: "old",
    budgetItemId: "food",
    budgetItemName: "24. 餐費",
    amount: 9999,
    paymentToolType: "cash",
    status: "active"
  },
  {
    id: "deleted",
    consumptionDate: "2026-01-30",
    budgetMonth: "2026-01",
    merchantName: "E",
    itemDescription: "deleted",
    budgetItemId: "food",
    budgetItemName: "24. 餐費",
    amount: 9999,
    paymentToolType: "cash",
    status: "deleted"
  }
];

const monthly = summarizeSpendingTrends(expenses, budgets, {
  year: "2026",
  periodMode: "month",
  budgetGroup: "",
  budgetItemId: "",
  paymentTool: "all"
});

assert.equal(monthly.periods.length, 12);
assert.equal(monthly.items.find((item) => item.budgetItemId === "food")?.periodAmounts[0].amount, 1000);
assert.equal(monthly.items.find((item) => item.budgetItemId === "food")?.periodAmounts[1].amount, 2000);
assert.equal(monthly.summary.selectedTotal, 6000);
assert.equal(monthly.summary.overBudgetCount, 1);
assert.equal(monthly.summary.overrunTotal, 15676);
assert.equal(monthly.summary.annualRemainingBudget, 34324);

const quarterly = summarizeSpendingTrends(expenses, budgets, {
  year: "2026",
  periodMode: "quarter",
  budgetGroup: "",
  budgetItemId: "food",
  paymentTool: "credit_card"
});

assert.equal(quarterly.periods.length, 4);
assert.equal(quarterly.items.length, 1);
assert.equal(quarterly.items[0].periodAmounts[0].amount, 2000);
assert.equal(quarterly.items[0].annualUsed, 2000);
assert.equal(quarterly.summary.annualRemainingBudget, 118000);

console.log("spending analysis: 12 assertions passed");
