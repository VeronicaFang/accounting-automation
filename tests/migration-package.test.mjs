import test from "node:test";
import assert from "node:assert/strict";
import { buildSupabaseImportPackage, validateSupabaseImportPackage } from "../src/core/google-sheet-migration-package.mjs";

const workbookRows = {
  BudgetItems: [
    {
      category: "家庭",
      budget_item: "38. 家電",
      annual_budget: 20000,
      month_01: 5000,
      month_04: 5000,
      month_07: 5000,
      month_10: 5000,
      is_valid_expense_item: true
    },
    { category: "個人", budget_item: "18. 交通工具", annual_budget: 12000, is_valid_expense_item: true }
  ],
  CreditCardRules: [{ credit_card_name: "Union", card_group: "other", cutoff_day: 5, payment_day: 17 }],
  ExpenseRecords: [
    {
      expense_id: "E1",
      consumption_date: "2026-05-02",
      budget_month: "2026-05-01",
      item_description: "fan",
      budget_item: "38. 家電",
      amount: 5000,
      payment_tool_type: "credit_card",
      credit_card_name: "聯邦",
      is_installment: "no",
      installment_count: 1,
      expense_status: "normal"
    }
  ],
  PaymentSchedule: [
    {
      payment_id: "P1",
      expense_id: "E1",
      payment_sequence: 1,
      payment_date: "2026-05-17",
      cash_flow_month: "2026-05-01",
      payment_amount: -500,
      payment_tool_type: "credit_card",
      credit_card_name: "聯邦",
      payment_status: "corrected"
    },
    {
      payment_id: "P_orphan",
      expense_id: "E404",
      payment_sequence: 1,
      payment_date: "1970-01-01",
      cash_flow_month: "1970-01-01",
      payment_amount: 100,
      payment_tool_type: "credit_card",
      credit_card_name: "聯邦",
      payment_status: "estimated"
    }
  ],
  IncomeSchedule: [
    {
      income_id: "I1",
      income_date: "2026-05-05",
      income_month: "2026-05-01",
      income_item: "薪資",
      income_amount: 90000,
      income_status: "received",
      source: "salary_schedule"
    }
  ],
  MerchantPaymentRules: [],
  MerchantItemRules: [],
  ImportedInvoiceDrafts: [],
  ClassificationHistory: [],
  PaymentChoiceHistory: []
};

test("builds a cleaned Supabase import package from mapped Google Sheet rows", () => {
  const pkg = buildSupabaseImportPackage(workbookRows);

  assert.deepEqual(pkg.summary, {
    budgetGroups: 2,
    budgetItems: 2,
    creditCards: 1,
    paymentMethods: 2,
    expenses: 1,
    paymentSchedules: 1,
    skippedPaymentSchedules: 1,
    incomeSchedules: 1
  });

  assert.equal(pkg.budgetItems[0].legacy_name, "38. 家電");
  assert.equal(pkg.budgetItems[0].month_01, 5000);
  assert.equal(pkg.expenses[0].budget_item_legacy_name, "38. 家電");
  assert.equal(pkg.expenses[0].credit_card_legacy_name, "Union");
  assert.equal(pkg.paymentSchedules[0].payment_amount, -500);
  assert.equal(pkg.paymentSchedules[0].migration_action, "preserve_as_payment_adjustment");
  assert.equal(pkg.skippedPaymentSchedules[0].migration_action, "delete_before_import");
  assert.deepEqual(validateSupabaseImportPackage(pkg), []);
});
