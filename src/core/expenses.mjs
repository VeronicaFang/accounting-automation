export function resolveExpenseSourceFields(input = {}) {
  return {
    source_type: input.source_type || "manual_no_invoice",
    source_record_id: input.source_record_id || "",
    merchant_tax_id: input.merchant_tax_id || "",
  };
}
export function getRecentExpenses(expenseRows, limit = 10) {
  return expenseRows
    .filter((expense) => expense.expense_status !== "cancelled")
    .slice()
    .sort((a, b) => compareExpenseDateDesc(a, b))
    .slice(0, Number(limit || 10))
    .map((expense) => ({
      expense_id: expense.expense_id,
      consumption_date: expense.consumption_date,
      merchant_name: expense.merchant_name,
      item_description: expense.item_description,
      budget_item: expense.budget_item,
      amount: Number(expense.amount || 0),
      payment_label: getPaymentLabel(expense),
      expense_status: expense.expense_status,
    }));
}

export function getCreditCardLabel(value) {
  const labels = {
    YuShan: "玉山",
    Union: "聯邦",
    Cathay: "國泰",
    Fubon: "富邦",
    CTBC: "中信",
    玉山: "玉山",
    聯邦: "聯邦",
    國泰: "國泰",
    富邦: "富邦",
    中信: "中信",
  };
  return labels[value] || value || "";
}

function compareExpenseDateDesc(a, b) {
  const dateCompare = String(b.consumption_date || "").localeCompare(String(a.consumption_date || ""));
  if (dateCompare !== 0) return dateCompare;
  return String(b.expense_id || "").localeCompare(String(a.expense_id || ""));
}

function getPaymentLabel(expense) {
  if (expense.payment_tool_type === "credit_card") return `信用卡 ${getCreditCardLabel(expense.credit_card_name)}`.trim();
  return "現金";
}