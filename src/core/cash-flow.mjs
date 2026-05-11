export function getCashFlowOverview(incomeRows, paymentRows) {
  const activePayments = paymentRows.filter((payment) => payment.payment_status !== "offset");
  const monthKeys = Array.from(new Set([
    ...incomeRows.map((income) => income.income_month),
    ...activePayments.map((payment) => payment.cash_flow_month),
  ])).filter(Boolean).sort();

  return monthKeys.map((month) => {
    const incomeTotal = incomeRows
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
  const payments = paymentRows
    .filter((payment) => payment.payment_tool_type === "credit_card")
    .filter((payment) => payment.payment_status !== "paid" && payment.payment_status !== "offset")
    .filter((payment) => monthKeys.includes(payment.cash_flow_month));

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
