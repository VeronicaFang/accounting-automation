import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConfirmedBudgetMappings,
  generateBudgetMappingDrafts,
  generateBudgetMappingReviewRows,
  generateCreditCardMappingDrafts,
  generateMigrationIssueDrafts,
  generateMigrationReviewDrafts
} from "../src/core/google-sheet-migration-drafts.mjs";
import { runGoogleSheetMigrationPreflight } from "../src/core/google-sheet-migration-preflight.mjs";

const workbookRows = {
  BudgetItems: [
    { category: "飲食", budget_item: "24. 餐費" },
    { category: "交通", budget_item: "18. 交通工具" }
  ],
  CreditCardRules: [
    { credit_card_name: "Union", card_group: "other", cutoff_day: 5, payment_day: 17 },
    { credit_card_name: "YuShan", card_group: "yushan", cutoff_day: 12, payment_day: 23 }
  ],
  ExpenseRecords: [
    { expense_id: "E1", budget_item: "24. 餐費", suggested_budget_item: "24. 餐費" },
    { expense_id: "E2", budget_item: "17. 交通工具", suggested_budget_item: "17. 交通工具" }
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
      credit_card_name: "玉山"
    }
  ],
  IncomeSchedule: [],
  ImportedInvoiceDrafts: [],
  MerchantPaymentRules: [],
  MerchantItemRules: [],
  ClassificationHistory: [],
  PaymentChoiceHistory: []
};

test("generates budget mapping drafts for legacy labels missing from BudgetItems", () => {
  const drafts = generateBudgetMappingDrafts(workbookRows);

  assert.deepEqual(drafts, [
    {
      legacy_budget_item: "17. 交通工具",
      suggested_group_name: "交通",
      suggested_item_name: "18. 交通工具",
      confidence: 90,
      review_status: "needs_review",
      source_system: "google_sheets",
      source_table: "migration_preflight",
      notes: "Suggested by matching legacy budget label."
    }
  ]);
});

test("generates budget mapping review rows with blank confirmed target columns", () => {
  const rows = generateBudgetMappingReviewRows(workbookRows);

  assert.deepEqual(rows, [
    {
      legacy_budget_item: "17. 交通工具",
      occurrence_count: 2,
      suggested_group_name: "交通",
      suggested_item_name: "18. 交通工具",
      confidence: 90,
      confirmed_budget_item: "",
      review_status: "needs_review",
      notes: "Suggested by matching legacy budget label."
    }
  ]);
});

test("applies confirmed budget mappings to every legacy budget reference", () => {
  const mappedRows = applyConfirmedBudgetMappings(workbookRows, [
    {
      legacy_budget_item: "17. 交通工具",
      confirmed_budget_item: "18. 交通工具"
    }
  ]);
  const preflight = runGoogleSheetMigrationPreflight(mappedRows);

  assert.equal(preflight.issueCounts.invalidBudgetItems, 0);
  assert.equal(mappedRows.ExpenseRecords[1].budget_item, "18. 交通工具");
  assert.equal(mappedRows.ExpenseRecords[1].suggested_budget_item, "18. 交通工具");
});

test("generates credit card mapping drafts from Chinese legacy names to Supabase card names", () => {
  const drafts = generateCreditCardMappingDrafts(workbookRows);

  assert.deepEqual(drafts, [
    {
      legacy_credit_card_name: "玉山",
      target_credit_card_name: "YuShan",
      confidence: 100,
      review_status: "confirmed_by_alias",
      source_system: "google_sheets"
    },
    {
      legacy_credit_card_name: "聯邦",
      target_credit_card_name: "Union",
      confidence: 100,
      review_status: "confirmed_by_alias",
      source_system: "google_sheets"
    }
  ]);
});

test("converts preflight issues into migration issue drafts", () => {
  const preflight = runGoogleSheetMigrationPreflight(workbookRows);
  const issues = generateMigrationIssueDrafts(preflight);

  assert.equal(issues.length, 6);
  assert.equal(issues[0].severity, "error");
  assert.equal(issues[0].source_system, "google_sheets");
  assert.equal(issues[0].source_table, "ExpenseRecords");
  assert.equal(issues[0].issue_type, "invalid_budget_item");

  const orphanIssue = issues.find((issue) => issue.issue_type === "orphan_payment_schedule");
  assert.equal(orphanIssue.payload.recommended_action, "delete_before_import");

  const negativeAmountIssue = issues.find((issue) => issue.issue_type === "negative_payment_amount");
  assert.equal(negativeAmountIssue.severity, "warning");
  assert.equal(negativeAmountIssue.payload.recommended_action, "preserve_as_payment_adjustment");

  const invalidMonthIssue = issues.find((issue) => issue.issue_type === "invalid_payment_month");
  assert.equal(invalidMonthIssue.payload.recommended_action, "review_payment_month_before_import");
});

test("generates a full review draft package", () => {
  const packageDraft = generateMigrationReviewDrafts(workbookRows);

  assert.equal(packageDraft.summary.budgetMappingDraftCount, 1);
  assert.equal(packageDraft.summary.creditCardMappingDraftCount, 2);
  assert.equal(packageDraft.summary.migrationIssueDraftCount, 6);
  assert.equal(packageDraft.summary.canImportDirectly, false);
});
