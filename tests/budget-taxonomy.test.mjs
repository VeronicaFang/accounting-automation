import test from "node:test";
import assert from "node:assert/strict";
import { buildBudgetMappingDrafts, parseLegacyBudgetItem } from "../src/core/budget-taxonomy.mjs";

test("legacy budget item parsing splits coded item names", () => {
  assert.deepEqual(parseLegacyBudgetItem(" 24. 餐費 "), {
    legacy_code: 24,
    legacy_name: "24. 餐費",
    item_name: "餐費",
  });
});

test("legacy budget item parsing keeps uncoded names", () => {
  assert.deepEqual(parseLegacyBudgetItem(" 預算總額 "), {
    legacy_code: null,
    legacy_name: "預算總額",
    item_name: "預算總額",
  });
});

test("budget mapping drafts include only valid expense items", () => {
  const drafts = buildBudgetMappingDrafts([
    { budget_item: "01. 老公家用", is_valid_expense_item: true },
    { budget_item: "預算總額", is_valid_expense_item: false },
    { budget_item: "99. 備註", is_valid_expense_item: "FALSE" },
  ]);

  assert.deepEqual(drafts.map((draft) => draft.legacy_budget_item), ["01. 老公家用"]);
});

test("budget mapping drafts suggest first-pass groups for known items", () => {
  const rows = [
    { budget_item: "01. 老公家用", is_valid_expense_item: true },
    { budget_item: "13. 動動用品與衣物", is_valid_expense_item: "TRUE" },
    { budget_item: "24. 餐費", is_valid_expense_item: "true" },
  ];

  assert.deepEqual(buildBudgetMappingDrafts(rows), [
    {
      legacy_budget_item: "01. 老公家用",
      legacy_code: 1,
      suggested_group_name: "家人",
      suggested_item_name: "老公家用",
      review_status: "needs_review",
      confidence: 90,
    },
    {
      legacy_budget_item: "13. 動動用品與衣物",
      legacy_code: 13,
      suggested_group_name: "小孩",
      suggested_item_name: "動動用品與衣物",
      review_status: "needs_review",
      confidence: 90,
    },
    {
      legacy_budget_item: "24. 餐費",
      legacy_code: 24,
      suggested_group_name: "家庭生活",
      suggested_item_name: "餐費",
      review_status: "needs_review",
      confidence: 80,
    },
  ]);
});

test("budget mapping drafts send unknown valid items to review bucket", () => {
  assert.deepEqual(buildBudgetMappingDrafts([
    { budget_item: "88. 其他未分類", is_valid_expense_item: true },
  ]), [
    {
      legacy_budget_item: "88. 其他未分類",
      legacy_code: 88,
      suggested_group_name: "待整理",
      suggested_item_name: "其他未分類",
      review_status: "needs_review",
      confidence: 50,
    },
  ]);
});

test("budget mapping drafts do not mutate input rows", () => {
  const rows = [{ budget_item: "24. 餐費", is_valid_expense_item: true }];
  const before = structuredClone(rows);

  buildBudgetMappingDrafts(rows);

  assert.deepEqual(rows, before);
});
