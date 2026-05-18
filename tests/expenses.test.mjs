import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyExpenseScheduleRows, getRecentExpenses, isExpenseAmountAllowed, parseManualExpenseText, resolveExpenseSourceFields } from "../src/core/expenses.mjs";

const expenses = [
  { expense_id: "E1", consumption_date: "2026-05-01", merchant_name: "超商", item_description: "早餐", budget_item: "23. 餐費", amount: 100, payment_tool_type: "cash", credit_card_name: "", expense_status: "normal" },
  { expense_id: "E2", consumption_date: "2026-05-03", merchant_name: "量販店", item_description: "清潔用品", budget_item: "10. 日常用品", amount: 500, payment_tool_type: "credit_card", credit_card_name: "YuShan", expense_status: "normal" },
  { expense_id: "E3", consumption_date: "2026-05-04", merchant_name: "取消店家", item_description: "退貨", budget_item: "23. 餐費", amount: 200, payment_tool_type: "cash", credit_card_name: "", expense_status: "cancelled" },
];

test("recent expenses exclude cancelled rows and show newest rows first", () => {
  assert.deepEqual(getRecentExpenses(expenses, 2), [
    { expense_id: "E2", consumption_date: "2026-05-03", merchant_name: "量販店", item_description: "清潔用品", budget_item: "10. 日常用品", amount: 500, payment_label: "信用卡 玉山", expense_status: "normal" },
    { expense_id: "E1", consumption_date: "2026-05-01", merchant_name: "超商", item_description: "早餐", budget_item: "23. 餐費", amount: 100, payment_label: "現金", expense_status: "normal" },
  ]);
});

test("recent expenses show credit card names in Traditional Chinese", () => {
  assert.equal(getRecentExpenses(expenses, 1)[0].payment_label, "信用卡 玉山");
});
test("invoice import source fields are preserved for expense records", () => {
  assert.deepEqual(resolveExpenseSourceFields({
    source_type: "finance_ministry_invoice",
    source_record_id: "AB12345678",
    merchant_tax_id: "12345678",
  }), {
    source_type: "finance_ministry_invoice",
    source_record_id: "AB12345678",
    merchant_tax_id: "12345678",
  });
});

test("manual expense defaults to no-invoice source fields", () => {
  assert.deepEqual(resolveExpenseSourceFields({}), {
    source_type: "manual_no_invoice",
    source_record_id: "",
    merchant_tax_id: "",
  });
});
test("invoice import allows zero and negative amount lines", () => {
  assert.equal(isExpenseAmountAllowed({ source_type: "finance_ministry_invoice", amount: 0 }), true);
  assert.equal(isExpenseAmountAllowed({ source_type: "finance_ministry_invoice", amount: -3 }), true);
});

test("manual no-invoice expenses must be positive", () => {
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_no_invoice", amount: 0 }), false);
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_no_invoice", amount: -3 }), false);
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_no_invoice", amount: 1 }), true);
});
test("parse manual expense text supports shopping cart rows", () => {
  const text = `消費日,購買品項,消費金額,消費通路,預算項目,支付方式,信用卡,備註
2026/05/12,洗面乳,299,蝦皮,10. 日常用品,信用卡,聯邦,母親節
2026/05/12,折扣,-30,蝦皮,10. 日常用品,信用卡,聯邦,折抵`;

  assert.deepEqual(parseManualExpenseText(text), [
    { consumption_date: "2026-05-12", purchase_item: "洗面乳", amount: 299, channel: "蝦皮", budget_item: "10. 日常用品", payment_tool_type: "credit_card", credit_card_name: "聯邦", notes: "母親節" },
    { consumption_date: "2026-05-12", purchase_item: "折扣", amount: -30, channel: "蝦皮", budget_item: "10. 日常用品", payment_tool_type: "credit_card", credit_card_name: "聯邦", notes: "折抵" },
  ]);
});

test("parse manual expense text normalizes month-only dates to first day", () => {
  const text = `消費日\t購買品項\t消費金額\t消費通路\t預算項目\t支付方式\t信用卡
2026/01\t麗克特料理機\t1951\t淘寶\t26. 奢侈娛樂\t信用卡\t中信`;

  assert.deepEqual(parseManualExpenseText(text), [
    { consumption_date: "2026-01-01", purchase_item: "麗克特料理機", amount: 1951, channel: "淘寶", budget_item: "26. 奢侈娛樂", payment_tool_type: "credit_card", credit_card_name: "中信", notes: "" },
  ]);
});

test("parse manual expense text supports rows without headers using default order", () => {
  const text = `2026/01\t麗克特料理機\t1951\t淘寶\t26. 奢侈娛樂\t信用卡\t中信
2026/01\t冬天薄褲\t250\t淘寶\t13. 動動用品與衣物\t信用卡\t中信`;

  assert.deepEqual(parseManualExpenseText(text), [
    { consumption_date: "2026-01-01", purchase_item: "麗克特料理機", amount: 1951, channel: "淘寶", budget_item: "26. 奢侈娛樂", payment_tool_type: "credit_card", credit_card_name: "中信", notes: "" },
    { consumption_date: "2026-01-01", purchase_item: "冬天薄褲", amount: 250, channel: "淘寶", budget_item: "13. 動動用品與衣物", payment_tool_type: "credit_card", credit_card_name: "中信", notes: "" },
  ]);
});

test("manual batch import allows zero and negative amount lines", () => {
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_batch_import", amount: 0 }), true);
  assert.equal(isExpenseAmountAllowed({ source_type: "manual_batch_import", amount: -30 }), true);
});

test("monthly expense schedule creates repeated monthly expense inputs", () => {
  assert.deepEqual(buildMonthlyExpenseScheduleRows({
    start_month: "2026-05",
    expense_day: 5,
    repeat_count: 3,
    purchase_item: "每月家用",
    amount: 10000,
    channel: "家庭轉帳",
    budget_item: "01. 老公家用",
    payment_tool_type: "cash",
    notes: "固定支出",
  }), [
    { consumption_date: "2026-05-05", purchase_item: "每月家用", amount: 10000, channel: "家庭轉帳", budget_item: "01. 老公家用", payment_tool_type: "cash", credit_card_name: "", notes: "固定支出" },
    { consumption_date: "2026-06-05", purchase_item: "每月家用", amount: 10000, channel: "家庭轉帳", budget_item: "01. 老公家用", payment_tool_type: "cash", credit_card_name: "", notes: "固定支出" },
    { consumption_date: "2026-07-05", purchase_item: "每月家用", amount: 10000, channel: "家庭轉帳", budget_item: "01. 老公家用", payment_tool_type: "cash", credit_card_name: "", notes: "固定支出" },
  ]);
});

test("monthly expense schedule clamps large days to the last day of each month", () => {
  assert.deepEqual(buildMonthlyExpenseScheduleRows({
    start_month: "2026-01",
    expense_day: 31,
    repeat_count: 3,
    purchase_item: "月底訂閱",
    amount: 299,
    channel: "App Store",
    budget_item: "26. 奢侈娛樂",
    payment_tool_type: "credit_card",
    credit_card_name: "中信",
  }).map((row) => row.consumption_date), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
  ]);
});
