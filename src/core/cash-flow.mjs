export function getCashFlowOverview(incomeRows, paymentRows) {
  const normalizedIncomes = incomeRows
    .map((income) => ({ ...income, income_month: normalizeMonthKey(income.income_month) }))
    .filter((income) => income.income_month);
  const activePayments = paymentRows
    .filter((payment) => payment.payment_status !== "offset")
    .map((payment) => ({ ...payment, cash_flow_month: normalizeMonthKey(payment.cash_flow_month) }))
    .filter((payment) => payment.cash_flow_month);

  const monthKeys = Array.from(new Set([
    ...normalizedIncomes.map((income) => income.income_month),
    ...activePayments.map((payment) => payment.cash_flow_month),
  ])).sort();

  return monthKeys.map((month) => {
    const incomeTotal = normalizedIncomes
      .filter((income) => income.income_month === month)
      .reduce((sum, income) => sum + Number(income.income_amount || 0), 0);
    const paymentTotal = activePayments
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

export function getUpcomingCreditCardPayments(paymentRows, monthKeys) {
  const allowedMonths = monthKeys.map(normalizeMonthKey).filter(Boolean);
  const payments = paymentRows
    .filter((payment) => payment.payment_tool_type === "credit_card")
    .filter((payment) => payment.payment_status !== "paid" && payment.payment_status !== "offset")
    .map((payment) => ({ ...payment, cash_flow_month: normalizeMonthKey(payment.cash_flow_month) }))
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

  return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month) || a.credit_card_name.localeCompare(b.credit_card_name));
}

export function normalizeMonthKey(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatTaipeiMonth(value);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return formatTaipeiMonth(date);
  }
  return text;
}

function formatTaipeiMonth(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  return `${year}-${month}`;
}
