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

function createMonthlySalarySchedule(input) {
  if (!input.start_month) throw new Error("請填寫開始月份。");
  if (!input.end_month) throw new Error("請填寫結束月份。");
  if (Number(input.income_amount) <= 0) throw new Error("薪資金額必須大於 0。");
  const rows = buildMonthlyIncomeSchedule_(input);
  const created = rows.map((row) => {
    const record = Object.assign({}, row, { income_id: makeId_("I") });
    appendObject_("IncomeSchedule", record);
    return record;
  });
  return { created_count: created.length, incomes: created };
}

function getIncomeSchedule(limit) {
  return readObjects_("IncomeSchedule")
    .filter((income) => income.income_date || income.income_month || income.income_item)
    .map((income) => Object.assign({}, income, {
      income_date: toDateText_(income.income_date),
      income_month: income.income_month || toMonthKey_(income.income_date),
      income_amount: Number(income.income_amount || 0),
      income_status: income.income_status || "estimated",
      source: income.source || "",
      notes: income.notes || "",
    }))
    .sort((a, b) => {
      const dateCompare = String(a.income_date || "").localeCompare(String(b.income_date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.income_id || "").localeCompare(String(b.income_id || ""));
    })
    .slice(0, Number(limit || 12));
}

function updateIncomeStatus(input) {
  if (!input || !input.income_id) throw new Error("找不到要更新的收入資料。");
  const allowedStatuses = ["estimated", "received", "corrected"];
  if (allowedStatuses.indexOf(input.income_status) < 0) throw new Error("收入狀態不正確。");
  const updates = {
    income_status: input.income_status,
    notes: input.notes || "",
  };
  if (input.income_amount !== undefined && input.income_amount !== "") {
    if (Number(input.income_amount) <= 0) throw new Error("收入金額必須大於 0。");
    updates.income_amount = Number(input.income_amount);
  }
  updateObjectById_("IncomeSchedule", "income_id", input.income_id, updates);
  return readObjects_("IncomeSchedule").find((income) => String(income.income_id) === String(input.income_id));
}

function buildMonthlyIncomeSchedule_(input) {
  const start = parseIncomeMonth_(input.start_month);
  const end = parseIncomeMonth_(input.end_month);
  if (end < start) throw new Error("結束月份不可早於開始月份。");
  const day = Number(input.income_day || 5);
  const rows = [];
  for (let date = new Date(start.getFullYear(), start.getMonth(), 1); date <= end; date = new Date(date.getFullYear(), date.getMonth() + 1, 1)) {
    const incomeMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    rows.push({
      income_date: `${incomeMonth}-${String(day).padStart(2, "0")}`,
      income_month: incomeMonth,
      income_item: input.income_item || "薪資",
      income_amount: Number(input.income_amount || 0),
      income_status: input.income_status || "estimated",
      source: input.source || "salary_schedule",
      notes: input.notes || "",
    });
  }
  return rows;
}

function parseIncomeMonth_(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) throw new Error("月份格式需為 YYYY-MM。");
  return new Date(`${text}-01T00:00:00`);
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
    const cashExpenseTotal = payments
      .filter((payment) => payment.cash_flow_month === month)
      .filter((payment) => payment.payment_tool_type !== "credit_card")
      .reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0);
    const creditCardPaymentTotal = payments
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

function getPaymentSchedule(monthLimit) {
  const allowedMonths = getUpcomingMonthKeys_(monthLimit || 6);
  const expensesById = {};
  readObjects_("ExpenseRecords").forEach((expense) => {
    expensesById[expense.expense_id] = expense;
  });
  return readObjects_("PaymentSchedule")
    .map((payment) => Object.assign({}, payment, { cash_flow_month: normalizeMonthKey_(payment.cash_flow_month || payment.payment_date) }))
    .filter((payment) => allowedMonths.includes(payment.cash_flow_month))
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
        credit_card_label: getCreditCardLabel_(payment.credit_card_name),
        payment_status: payment.payment_status,
        source_expense: formatPaymentSourceExpense_(expense),
        source_amount: Number(expense.amount || 0),
        notes: payment.notes || "",
      };
    });
}

function getMonthlyCreditCardBillEstimates(monthLimit) {
  const allowedMonths = getUpcomingMonthKeys_(monthLimit || 6);
  const payments = readObjects_("PaymentSchedule")
    .filter((payment) => payment.payment_tool_type === "credit_card")
    .filter((payment) => payment.payment_status !== "offset")
    .map((payment) => Object.assign({}, payment, { cash_flow_month: normalizeMonthKey_(payment.cash_flow_month || payment.payment_date) }))
    .filter((payment) => allowedMonths.includes(payment.cash_flow_month));

  const grouped = {};
  payments.forEach((payment) => {
    const key = `${payment.cash_flow_month}|${payment.credit_card_name}`;
    if (!grouped[key]) {
      const billingPeriod = getBillingPeriod_(payment.cash_flow_month, payment.credit_card_name);
      grouped[key] = {
        bill_month: payment.cash_flow_month,
        credit_card_name: payment.credit_card_name,
        credit_card_label: getCreditCardLabel_(payment.credit_card_name),
        billing_period_start: billingPeriod.start,
        billing_period_end: billingPeriod.end,
        estimated_payment_date: getEstimatedPaymentDate_(payment.cash_flow_month, payment.credit_card_name, payment.payment_date),
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

  return Object.values(grouped).sort((a, b) => a.bill_month.localeCompare(b.bill_month) || String(a.credit_card_name || "").localeCompare(String(b.credit_card_name || "")));
}

function updatePaymentStatus(input) {
  if (!input || !input.payment_id) throw new Error("找不到付款排程 ID。");
  const allowedStatuses = ENUMS.paymentStatuses;
  if (allowedStatuses.indexOf(input.payment_status) < 0) throw new Error(`不支援的付款狀態：${input.payment_status}`);
  const updates = {
    payment_status: input.payment_status,
    notes: input.notes || "",
  };
  if (input.payment_amount !== undefined && input.payment_amount !== "") {
    const amount = Number(input.payment_amount);
    if (!isFinite(amount) || amount < 0) throw new Error("付款金額必須為 0 或正數。");
    updates.payment_amount = amount;
  }
  updateObjectById_("PaymentSchedule", "payment_id", input.payment_id, updates);
  return { ok: true, payment_id: input.payment_id, payment_status: input.payment_status };
}

function getUpcomingCreditCardPayments(monthLimit) {
  const allowedMonths = getUpcomingMonthKeys_(monthLimit || 3);
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

function getUpcomingMonthKeys_(monthLimit) {
  const limit = Number(monthLimit || 3);
  const today = new Date();
  return Array.from({ length: limit }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
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

function formatPaymentSourceExpense_(expense) {
  return [
    expense.consumption_date,
    expense.merchant_name,
    expense.item_description,
  ].filter(Boolean).join(" ");
}

function getBillingPeriod_(monthKey, creditCardName) {
  const parts = String(monthKey || "").split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const isYuShan = creditCardName === "YuShan" || creditCardName === "玉山";
  const cutoffDay = isYuShan ? 12 : 5;
  const startDay = cutoffDay + 1;
  return {
    start: formatLocalDate_(new Date(year, month - 2, startDay)),
    end: formatLocalDate_(new Date(year, month - 1, cutoffDay)),
  };
}

function getEstimatedPaymentDate_(monthKey, creditCardName, fallbackDate) {
  const parts = String(monthKey || "").split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const isYuShan = creditCardName === "YuShan" || creditCardName === "玉山";
  const paymentDay = isYuShan ? 23 : 17;
  return fallbackDate || formatLocalDate_(new Date(year, month - 1, paymentDay));
}

function formatLocalDate_(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
