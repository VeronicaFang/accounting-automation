import test from "node:test";
import assert from "node:assert/strict";
import { parseInvoiceText, buildInvoiceDrafts, buildSelectedInvoiceConfirmations, filterNewInvoiceDrafts } from "../src/core/invoice-import.mjs";

const pastedText = `消費日\t賣方名稱\t賣方統一編號\t品名\t金額\t發票號碼
2026/05/02\t統一超商\t12345678\t飯糰\t59\tAB12345678
2026/05/03\t全聯福利中心\t87654321\t洗衣精\t199\tCD12345678`;

const paymentRules = [
  { merchant_name_contains: "統一超商", payment_tool_type: "credit_card", credit_card_name: "玉山", is_active: "true" },
];

const itemRules = [
  { merchant_name_contains: "統一超商", item_keyword_contains: "飯糰", budget_item: "23. 餐費", is_active: "true" },
  { merchant_name_contains: "全聯", item_keyword_contains: "洗衣精", budget_item: "10. 日常用品", is_active: "true" },
];

test("parse invoice text maps finance ministry-like columns", () => {
  assert.deepEqual(parseInvoiceText(pastedText), [
    { source_record_id: "AB12345678", consumption_date: "2026-05-02", merchant_name: "統一超商", merchant_tax_id: "12345678", item_description: "飯糰", amount: 59, annotated_budget_item: "", annotated_payment_tool_type: "", annotated_credit_card_name: "", annotated_notes: "" },
    { source_record_id: "CD12345678", consumption_date: "2026-05-03", merchant_name: "全聯福利中心", merchant_tax_id: "87654321", item_description: "洗衣精", amount: 199, annotated_budget_item: "", annotated_payment_tool_type: "", annotated_credit_card_name: "", annotated_notes: "" },
  ]);
});

test("invoice drafts apply payment and budget item rules but still need review", () => {
  const drafts = buildInvoiceDrafts(parseInvoiceText(pastedText), paymentRules, itemRules);

  assert.deepEqual(drafts.map((draft) => ({
    merchant_name: draft.merchant_name,
    suggested_payment_tool_type: draft.suggested_payment_tool_type,
    suggested_credit_card_name: draft.suggested_credit_card_name,
    suggested_budget_item: draft.suggested_budget_item,
    classification_status: draft.classification_status,
    import_status: draft.import_status,
  })), [
    { merchant_name: "統一超商", suggested_payment_tool_type: "credit_card", suggested_credit_card_name: "玉山", suggested_budget_item: "23. 餐費", classification_status: "needs_review", import_status: "pending" },
    { merchant_name: "全聯福利中心", suggested_payment_tool_type: "cash", suggested_credit_card_name: "", suggested_budget_item: "10. 日常用品", classification_status: "needs_review", import_status: "pending" },
  ]);
});
test("parse actual finance ministry export columns and reuse manual annotations", () => {
  const text = `載具自訂名稱\t發票日期\t發票月份\t發票號碼\t發票金額\t發票狀態\t折讓\t賣方統一編號\t賣方名稱\t賣方地址\t買方統編\t消費明細_數量\t消費明細_單價\t消費明細_金額\t消費明細_品名\t項目\t支付方式\t分期備註
手機條碼\t20260105\t202601\tWA75815730\t38\t開立已確認\t否\t28992277\t三商家購股份有限公司永和智光分公司\t新北市永和區智光街113號1樓\t\t1\t38\t38\t真好家黑豆鼓45g\t23. 餐費\t聯邦信用卡\t`;

  const [row] = parseInvoiceText(text);
  assert.deepEqual(row, {
    source_record_id: "WA75815730",
    consumption_date: "2026-01-05",
    merchant_name: "三商家購股份有限公司永和智光分公司",
    merchant_tax_id: "28992277",
    item_description: "真好家黑豆鼓45g",
    amount: 38,
    annotated_budget_item: "23. 餐費",
    annotated_payment_tool_type: "credit_card",
    annotated_credit_card_name: "聯邦",
    annotated_notes: "",
  });

  const [draft] = buildInvoiceDrafts([row], [], []);
  assert.equal(draft.suggested_budget_item, "23. 餐費");
  assert.equal(draft.suggested_payment_tool_type, "credit_card");
  assert.equal(draft.suggested_credit_card_name, "聯邦");
});
test("parse finance ministry rows with unquoted commas in final item column", () => {
  const text = `載具自訂名稱,發票日期,發票號碼,發票金額,發票狀態,折讓,賣方統一編號,賣方名稱,賣方地址,買方統編,消費明細_數量,消費明細_單價,消費明細_金額,消費明細_品名
手機條碼,20260503,BR19314850,125,開立已確認,否,60599890,鑫光威登股份有限公司景平分公司,新北市永和區中正路１５８號１樓,,1,125,125,好吃雞肉飯-加蔥辣,醬多`;

  const [row] = parseInvoiceText(text);
  assert.equal(row.item_description, "好吃雞肉飯-加蔥辣,醬多");
  assert.equal(row.amount, 125);
});
test("batch confirmation payload only includes selected pending drafts", () => {
  const drafts = [
    { import_id: "I1", suggested_budget_item: "23. 餐費", suggested_payment_tool_type: "cash", suggested_credit_card_name: "", import_status: "pending" },
    { import_id: "I2", suggested_budget_item: "10. 日常用品", suggested_payment_tool_type: "credit_card", suggested_credit_card_name: "玉山", import_status: "pending" },
    { import_id: "I3", suggested_budget_item: "11. 勤動才藝課", suggested_payment_tool_type: "cash", suggested_credit_card_name: "", import_status: "confirmed" },
  ];
  const edits = {
    I1: { selected: true, budget_item: "23. 餐費", payment_tool_type: "cash", credit_card_name: "" },
    I2: { selected: false, budget_item: "10. 日常用品", payment_tool_type: "credit_card", credit_card_name: "玉山" },
    I3: { selected: true, budget_item: "11. 勤動才藝課", payment_tool_type: "cash", credit_card_name: "" },
  };

  assert.deepEqual(buildSelectedInvoiceConfirmations(drafts, edits), [
    { import_id: "I1", budget_item: "23. 餐費", payment_tool_type: "cash", credit_card_name: "" },
  ]);
});
test("invoice drafts include stable duplicate keys with occurrence numbers", () => {
  const text = `消費日\t賣方名稱\t賣方統一編號\t品名\t金額\t發票號碼
2026/05/02\t同店家\t12345678\t同品項\t59\tAB12345678
2026/05/02\t同店家\t12345678\t同品項\t59\tAB12345678`;
  const drafts = buildInvoiceDrafts(parseInvoiceText(text), [], []);

  assert.equal(drafts[0].source_line_key, "AB12345678|12345678|2026-05-02|同品項|59|1");
  assert.equal(drafts[1].source_line_key, "AB12345678|12345678|2026-05-02|同品項|59|2");
});

test("duplicate invoice drafts already imported are skipped", () => {
  const drafts = buildInvoiceDrafts(parseInvoiceText(pastedText), [], []);
  const existing = [{ source_line_key: drafts[0].source_line_key }];

  assert.deepEqual(filterNewInvoiceDrafts(drafts, existing).map((draft) => draft.source_record_id), ["CD12345678"]);
});
