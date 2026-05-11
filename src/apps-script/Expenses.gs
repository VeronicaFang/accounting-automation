function createManualExpense(input) {
  validateManualExpense_(input);
  const expenseId = makeId_("E");
  const consumptionDate = toDateText_(input.consumption_date);
  const budgetMonth = toMonthKey_(consumptionDate);
  const installmentCount = input.is_installment === "yes" ? Number(input.installment_count) : 1;
  const amount = Number(input.amount);

  const expense = {
    expense_id: expenseId,
    source_type: "manual_no_invoice",
    source_record_id: "",
    consumption_date: consumptionDate,
    budget_month: budgetMonth,
    merchant_tax_id: "",
    merchant_name: input.channel,
    item_description: input.purchase_item,
    budget_item: input.budget_item,
    suggested_budget_item: input.suggested_budget_item || input.budget_item,
    classification_status: "needs_review",
    classification_basis: "manual",
    amount,
    payment_tool_type: input.payment_tool_type,
    credit_card_name: input.payment_tool_type === "credit_card" ? input.credit_card_name : "",
    is_installment: input.is_installment,
    installment_count: installmentCount,
    expense_status: "normal",
    notes: input.notes || "",
  };
  appendObject_("ExpenseRecords", expense);

  const schedules = createPaymentSchedulesForExpense_(expense);
  schedules.forEach((schedule) => appendObject_("PaymentSchedule", schedule));

  return {
    expense,
    payment_schedules: schedules,
    budget_impact: getBudgetImpact(consumptionDate, input.budget_item, amount),
  };
}

function validateManualExpense_(input) {
  if (!input.consumption_date) throw new Error("請填寫消費日。");
  if (!input.purchase_item) throw new Error("請填寫購買品項。");
  if (!input.channel) throw new Error("請填寫消費通路。");
  if (!input.budget_item) throw new Error("請選擇預算項目。");
  if (!input.payment_tool_type) throw new Error("請選擇支付工具類型。");
  if (input.payment_tool_type === "credit_card" && !input.credit_card_name) {
    throw new Error("信用卡付款請選擇信用卡名稱。");
  }
  if (Number(input.amount) <= 0) throw new Error("消費金額必須大於 0。");
}

function createPaymentSchedulesForExpense_(expense) {
  const firstPaymentDate = getPaymentDate_(expense.consumption_date, expense.payment_tool_type, expense.credit_card_name);
  const payments = splitInstallments_(expense.amount, Number(expense.installment_count || 1));
  return payments.map((paymentAmount, index) => {
    const paymentDate = index === 0 ? firstPaymentDate : addMonths_(firstPaymentDate, index);
    return {
      payment_id: makeId_("P") + String(index + 1).padStart(2, "0"),
      expense_id: expense.expense_id,
      payment_sequence: index + 1,
      payment_date: paymentDate,
      cash_flow_month: toMonthKey_(paymentDate),
      payment_amount: paymentAmount,
      payment_tool_type: expense.payment_tool_type,
      credit_card_name: expense.credit_card_name,
      payment_status: "estimated",
      notes: "",
    };
  });
}
function getRecentExpenses(limit) {
  return readObjects_("ExpenseRecords")
    .filter((expense) => expense.expense_status !== "cancelled")
    .sort((a, b) => {
      const dateCompare = String(b.consumption_date || "").localeCompare(String(a.consumption_date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.expense_id || "").localeCompare(String(a.expense_id || ""));
    })
    .slice(0, Number(limit || 10))
    .map((expense) => ({
      expense_id: expense.expense_id,
      consumption_date: expense.consumption_date,
      merchant_name: expense.merchant_name,
      item_description: expense.item_description,
      budget_item: expense.budget_item,
      amount: Number(expense.amount || 0),
      payment_label: getPaymentLabel_(expense),
      expense_status: expense.expense_status,
    }));
}

function getPaymentLabel_(expense) {
  if (expense.payment_tool_type === "credit_card") return `信用卡 ${getCreditCardLabel_(expense.credit_card_name)}`.trim();
  return "現金";
}



function getCreditCardLabel_(value) {
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