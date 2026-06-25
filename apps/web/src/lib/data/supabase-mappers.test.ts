import assert from "node:assert/strict";

import { mapBillEstimateRows, mapBudgetStatuses, mapCashFlowRows, mapExpenseRows, mapReviewCounts } from "./supabase-mappers.ts";

const cashFlow = mapCashFlowRows([
  {
    cash_flow_month: "2026-05",
    opening_balance: "120000",
    income_total: "95000",
    cash_expense_total: "71070",
    credit_card_payment_total: "11993",
    net_cash_flow: "-6750",
    ending_balance: "113250"
  }
]);

assert.deepEqual(cashFlow[0], {
  month: "2026-05",
  income: 95000,
  cashExpense: 71070,
  estimatedCardPayment: 11993,
  netFlow: -6750,
  openingBalance: 120000,
  endingBalance: 113250
});

const bills = mapBillEstimateRows(
  [
    {
      id: "estimate-1",
      credit_card_id: "card-1",
      bill_month: "2026-05",
      estimated_payment_date: "2026-05-23",
      estimated_bill_amount: "11993",
      detail_count: 18
    }
  ],
  [
    {
      credit_card_id: "card-1",
      statement_month: "2026-05",
      payment_due_date: "2026-05-23",
      actual_amount: "30680",
      statement_status: "entered"
    }
  ],
  [{ id: "card-1", name: "Union" }]
);

assert.equal(bills[0].creditCardName, "Union");
assert.equal(bills[0].estimatedAmount, 11993);
assert.equal(bills[0].statementAmount, 30680);
assert.equal(bills[0].status, "statement_received");

const expenses = mapExpenseRows([
  {
    id: "expense-1",
    budget_item_id: "budget-item-1",
    credit_card_id: "card-2",
    consumption_date: "2026-05-10",
    budget_month: "2026-05",
    merchant_name: "測試商戶",
    item_description: "折扣",
    legacy_budget_item: "24. 餐費",
    amount: "-50",
    payment_tool_type: "credit_card",
    is_installment: true,
    installment_count: 6,
    invoice_number: "AW99003017",
    original_amount: "-50",
    line_type: "discount",
    payment_parent_expense_id: "expense-parent",
    source_line_key: "AW99003017|line|1",
    status: "active"
  }
], [{ id: "budget-item-1", legacy_name: "24. 餐費", name: "餐費" }], [{ id: "card-2", name: "Cathay" }]);

assert.equal(expenses[0].amount, -50);
assert.equal(expenses[0].budgetItemName, "24. 餐費");
assert.equal(expenses[0].creditCardId, "card-2");
assert.equal(expenses[0].creditCardName, "Cathay");
assert.equal(expenses[0].isInstallment, true);
assert.equal(expenses[0].installmentCount, 6);
assert.equal(expenses[0].invoiceNumber, "AW99003017");
assert.equal(expenses[0].originalAmount, -50);
assert.equal(expenses[0].lineType, "discount");
assert.equal(expenses[0].paymentParentExpenseId, "expense-parent");
assert.deepEqual(mapReviewCounts(0, 0), []);
assert.equal(mapReviewCounts(2, 1).length, 2);

const budgetStatuses = mapBudgetStatuses(
  [{ id: "budget-item-1", budget_group_id: "group-1", legacy_name: "24. 餐費", name: "餐費", annual_budget: "1000" }],
  [{ id: "group-1", name: "個人" }],
  [{ budget_item_id: "budget-item-1", amount: "900", status: "active" }]
);

assert.equal(budgetStatuses[0].groupName, "個人");
assert.equal(budgetStatuses[0].itemName, "24. 餐費");
assert.equal(budgetStatuses[0].severity, "warning");

console.log("supabase mappers: 21 assertions passed");
