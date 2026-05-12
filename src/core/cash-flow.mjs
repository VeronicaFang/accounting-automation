import { getCreditCardLabel } from "./expenses.mjs";

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
    const cashExpenseTotal = activePayments
      .filter((payment) => payment.cash_flow_month === month)
      .filter((payment) => payment.payment_tool_type !== "credit_card")
      .reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0);
    const creditCardPaymentTotal = activePayments
      .filter((payment) => payment.cash_flow_month === month)
      .filter((payment) => payment.payment_tool_type === "credit_card")
      .reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0);
    return {
      month,
      income_total: incomeTotal,
      cash_expense_total: cashExpenseTotal,
      credit_card_payment_total: creditCardPaymentTotal,
      net_cash_flow: incomeTotal - cashExpenseTotal - creditCardPaymentTotal,
    };
  });
}

export function getPaymentSchedule(paymentRows, expenseRows = [], monthKeys = []) {
  const allowedMonths = monthKeys.map(normalizeMonthKey).filter(Boolean);
  const expensesById = Object.fromEntries(expenseRows.map((expense) => [expense.expense_id, expense]));
  return paymentRows
    .map((payment) => ({
      ...payment,
      cash_flow_month: normalizeMonthKey(payment.cash_flow_month || payment.payment_date),
    }))
    .filter((payment) => !allowedMonths.length || allowedMonths.includes(payment.cash_flow_month))
    .sort((a, b) => {
      const dateCompare = String(a.payment_date || "").localeCompare(String(b.payment_date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.payment_id || "").localeCompare(String(b.payment_id || ""));
    })
    .map((payment) => {
      const expense = expensesById[payment.expense_id] || {};
      return {
        payment_id: payment.payment_id,
        payment_month: payment.cash_flow_month,
        payment_date: payment.payment_date,
        payment_amount: Number(payment.payment_amount || 0),
        payment_tool_type: payment.payment_tool_type,
        credit_card_name: payment.credit_card_name,
        credit_card_label: getCreditCardLabel(payment.credit_card_name),
        payment_status: payment.payment_status,
        source_expense: formatSourceExpense(expense),
        source_amount: Number(expense.amount || 0),
      };
    });
}

export function getMonthlyCreditCardBillEstimates(paymentRows, monthKeys = []) {
  const allowedMonths = monthKeys.map(normalizeMonthKey).filter(Boolean);
  const payments = paymentRows
    .filter((payment) => payment.payment_tool_type === "credit_card")
    .filter((payment) => payment.payment_status !== "offset")
    .map((payment) => ({
      ...payment,
      cash_flow_month: normalizeMonthKey(payment.cash_flow_month || payment.payment_date),
    }))
    .filter((payment) => payment.cash_flow_month)
    .filter((payment) => !allowedMonths.length || allowedMonths.includes(payment.cash_flow_month));

  const grouped = {};
  payments.forEach((payment) => {
    const key = `${payment.cash_flow_month}|${payment.credit_card_name}`;
    if (!grouped[key]) {
      const billingPeriod = getBillingPeriod(payment.cash_flow_month, payment.credit_card_name);
      grouped[key] = {
        bill_month: payment.cash_flow_month,
        credit_card_name: payment.credit_card_name,
        credit_card_label: getCreditCardLabel(payment.credit_card_name),
        billing_period_start: billingPeriod.start,
        billing_period_end: billingPeriod.end,
        estimated_payment_date: getEstimatedPaymentDate(payment.cash_flow_month, payment.credit_card_name, payment.payment_date),
        estimated_bill_amount: 0,
        detail_count: 0,
        status_counts: { estimated: 0, reconciled: 0, paid: 0, corrected: 0, offset: 0 },
      };
    }
    grouped[key].estimated_bill_amount += Number(payment.payment_amount || 0);
    grouped[key].detail_count += 1;
    if (Object.prototype.hasOwnProperty.call(grouped[key].status_counts, payment.payment_status)) {
      grouped[key].status_counts[payment.payment_status] += 1;
    }
  });

  return Object.values(grouped).sort((a, b) => a.bill_month.localeCompare(b.bill_month) || a.credit_card_name.localeCompare(b.credit_card_name));
}

export function applyPaymentStatusUpdate(paymentRows, input) {
  const allowedStatuses = new Set(["estimated", "reconciled", "paid", "corrected", "offset"]);
  if (!input || !input.payment_id) throw new Error("payment_id is required");
  if (!allowedStatuses.has(input.payment_status)) throw new Error(`Unsupported payment status: ${input.payment_status}`);
  return paymentRows.map((payment) => {
    if (String(payment.payment_id) !== String(input.payment_id)) return payment;
    const updated = {
      ...payment,
      payment_status: input.payment_status,
      notes: input.notes || "",
    };
    if (input.payment_amount !== undefined) updated.payment_amount = Number(input.payment_amount);
    return updated;
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
      credit_card_label: getCreditCardLabel(payment.credit_card_name),
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

function formatSourceExpense(expense) {
  return [
    expense.consumption_date,
    expense.merchant_name,
    expense.item_description,
  ].filter(Boolean).join(" ");
}

function getBillingPeriod(monthKey, creditCardName) {
  const [year, month] = monthKey.split("-").map(Number);
  const isYuShan = creditCardName === "YuShan" || creditCardName === "玉山";
  const cutoffDay = isYuShan ? 12 : 5;
  const startDay = cutoffDay + 1;
  return {
    start: formatLocalDate(new Date(year, month - 2, startDay)),
    end: formatLocalDate(new Date(year, month - 1, cutoffDay)),
  };
}

function getEstimatedPaymentDate(monthKey, creditCardName, fallbackDate) {
  const [year, month] = monthKey.split("-").map(Number);
  const isYuShan = creditCardName === "YuShan" || creditCardName === "玉山";
  const paymentDay = isYuShan ? 23 : 17;
  const expected = formatLocalDate(new Date(year, month - 1, paymentDay));
  return fallbackDate || expected;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
