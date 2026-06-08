import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreditCardAliasMap,
  normalizeLegacyCreditCardName,
  normalizeLegacyMonth,
  runGoogleSheetMigrationPreflight
} from "../src/core/google-sheet-migration-preflight.mjs";

test("normalizes legacy month values from date strings and rejects invalid placeholders", () => {
  assert.equal(normalizeLegacyMonth("2026-05-01"), "2026-05");
  assert.equal(normalizeLegacyMonth("2026/5"), "2026-05");
  assert.equal(normalizeLegacyMonth(new Date("2026-05-23T00:00:00")), "2026-05");
  assert.equal(normalizeLegacyMonth("NaN-NaN"), null);
});

test("maps legacy Chinese credit card names to current CreditCardRules names", () => {
  const aliasMap = buildCreditCardAliasMap([
    { credit_card_name: "YuShan" },
    { credit_card_name: "Union" },
    { credit_card_name: "Cathay" },
    { credit_card_name: "CTBC" },
    { credit_card_name: "Fubon" }
  ]);

  assert.equal(normalizeLegacyCreditCardName("玉山", aliasMap), "YuShan");
  assert.equal(normalizeLegacyCreditCardName("聯邦", aliasMap), "Union");
  assert.equal(normalizeLegacyCreditCardName("中信", aliasMap), "CTBC");
});

test("preflight flags rows that cannot be safely inserted into Supabase", () => {
  const report = runGoogleSheetMigrationPreflight({
    BudgetItems: [{ budget_item: "24. 餐費" }],
    CreditCardRules: [{ credit_card_name: "Union" }],
    ExpenseRecords: [
      { expense_id: "E1", budget_item: "24. 餐費", suggested_budget_item: "24. 餐費" },
      { expense_id: "E2", budget_item: "missing", suggested_budget_item: "24. 餐費" }
    ],
    PaymentSchedule: [
      {
        payment_id: "P1",
        expense_id: "E1",
        payment_date: "1970-01-01",
        cash_flow_month: "1970-01-01",
        payment_amount: 100,
        payment_tool_type: "credit_card",
        credit_card_name: "聯邦"
      },
      {
        payment_id: "P2",
        expense_id: "E404",
        payment_date: "2026-05-17",
        cash_flow_month: "NaN-NaN",
        payment_amount: -50,
        payment_tool_type: "credit_card",
        credit_card_name: "聯邦"
      }
    ],
    IncomeSchedule: [],
    ImportedInvoiceDrafts: [],
    MerchantPaymentRules: [],
    MerchantItemRules: [],
    ClassificationHistory: [],
    PaymentChoiceHistory: []
  });

  assert.equal(report.issueCounts.invalidBudgetItems, 1);
  assert.equal(report.issueCounts.invalidPaymentMonths, 1);
  assert.equal(report.issueCounts.legacyEpochPaymentMonths, 1);
  assert.equal(report.issueCounts.orphanPaymentSchedules, 1);
  assert.equal(report.issueCounts.negativePaymentAmounts, 1);
  assert.equal(report.issueCounts.unmappedCreditCards, 0);
});
