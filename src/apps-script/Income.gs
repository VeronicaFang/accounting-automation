function createIncome(input) {
  if (!input.income_date) throw new Error("請填寫收入日期。");
  if (!input.income_item) throw new Error("請填寫收入項目。");
  if (Number(input.income_amount) <= 0) throw new Error("收入金額必須大於 0。");
  const incomeDate = toDateText_(input.income_date);
  const record = {
    income_id: makeId_("I"),
    income_date: incomeDate,
    income_month: toMonthKey_(incomeDate),
    income_item: input.income_item,
    income_amount: Number(input.income_amount),
    income_status: input.income_status || "estimated",
    source: input.source || "manual",
    notes: input.notes || "",
  };
  appendObject_("IncomeSchedule", record);
  return record;
}

function getCashFlowOverview() {
  const incomes = readObjects_("IncomeSchedule")
    .map((income) => Object.assign({}, income, { income_month: normalizeMonthKey_(income.income_month) }))
    .filter((income) => income.income_month);
  const payments = readObjects_("PaymentSchedule")
    .filter((payment) => payment.payment_status !== "offset")
    .map((payment) => Object.assign({}, payment, { cash_flow_month: normalizeMonthKey_(payment.cash_flow_month) }))
    .filter((payment) => payment.cash_flow_month);
  const monthKeys = Array.from(new Set([
    ...incomes.map((income) => income.income_month),
    ...payments.map((payment) => payment.cash_flow_month),
  ])).sort();

  return monthKeys.map((month) => {
    const incomeTotal = incomes
      .filter((income) => income.income_month === month)
      .reduce((sum, income) => sum + Number(income.income_amount || 0), 0);
    const paymentTotal = payments
      .filter((payment) => payment.cash_flow_month === month)
      .reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0);
    return {
      month,
      income_total: incomeTotal,
      payment_total: paymentTotal,
      net_cash_flow: incomeTotal - paymentTotal,
    };
  });
}

function getUpcomingCreditCardPayments(monthLimit) {
  const limit = Number(monthLimit || 3);
  const today = new Date();
  const allowedMonths = Array.from({ length: limit }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const payments = readObjects_("PaymentSchedule")
    .filter((payment) => payment.payment_tool_type === "credit_card")
    .filter((payment) => payment.payment_status !== "paid" && payment.payment_status !== "offset")
    .map((payment) => Object.assign({}, payment, { cash_flow_month: normalizeMonthKey_(payment.cash_flow_month) }))
    .filter((payment) => allowedMonths.includes(payment.cash_flow_month));

  const grouped = {};
  payments.forEach((payment) => {
    const key = `${payment.cash_flow_month}|${payment.credit_card_name}`;
    grouped[key] = grouped[key] || {
      month: payment.cash_flow_month,
      credit_card_name: payment.credit_card_name,
      amount: 0,
    };
    grouped[key].amount += Number(payment.payment_amount || 0);
  });
  return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month) || String(a.credit_card_name || "").localeCompare(String(b.credit_card_name || "")));
}

function normalizeMonthKey_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Taipei", "yyyy-MM");
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text);
    if (!isNaN(date.getTime())) return Utilities.formatDate(date, "Asia/Taipei", "yyyy-MM");
  }
  return text;
}
