function createManualExpense(input) {
  validateManualExpense_(input);
  const expenseId = input.expense_id || makeId_("E");
  const consumptionDate = toDateText_(input.consumption_date);
  const budgetMonth = toMonthKey_(consumptionDate);
  const installmentCount = input.is_installment === "yes" ? Number(input.installment_count) : 1;
  const amount = Number(input.amount);

  const expense = {
    expense_id: expenseId,
    source_type: input.source_type || "manual_no_invoice",
    source_record_id: input.source_record_id || "",
    consumption_date: consumptionDate,
    budget_month: budgetMonth,
    merchant_tax_id: input.merchant_tax_id || "",
    merchant_name: input.channel,
    item_description: input.purchase_item,
    budget_item: input.budget_item,
    suggested_budget_item: input.suggested_budget_item || input.budget_item,
    classification_status: "needs_review",
    classification_basis: input.classification_basis || "manual",
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

  const merchantPaymentRule = input.save_to_merchant_payment_rules === true || input.save_to_merchant_payment_rules === "yes"
    ? saveMerchantPaymentRuleFromRecord_(expense)
    : null;

  return {
    expense,
    payment_schedules: schedules,
    budget_impact: getBudgetImpact(consumptionDate, input.budget_item, amount),
    merchant_payment_rule: merchantPaymentRule,
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
  if (!isExpenseAmountAllowed_(input)) throw new Error("消費金額必須大於 0。");
}


function isExpenseAmountAllowed_(input) {
  const amount = Number(input.amount);
  if (!isFinite(amount)) return false;
  if (input.source_type === "finance_ministry_invoice" || input.source_type === "manual_batch_import") return true;
  return amount > 0;
}
function createPaymentSchedulesForExpense_(expense) {
  const firstPaymentDate = getPaymentDate_(expense.consumption_date, expense.payment_tool_type, expense.credit_card_name);
  const payments = splitInstallments_(expense.amount, Number(expense.installment_count || 1));
  return payments.map((paymentAmount, index) => {
    const paymentDate = index === 0 ? firstPaymentDate : addMonths_(firstPaymentDate, index);
    return {
      payment_id: `${expense.expense_id}_P${String(index + 1).padStart(2, "0")}`,
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
function importManualExpensesFromText(text, options) {
  const rows = parseManualExpenseText_(text);
  if (rows.length === 0) throw new Error("請先貼上或上傳手動消費清單。");
  const saveToRules = options && (options.save_to_merchant_payment_rules === true || options.save_to_merchant_payment_rules === "yes");
  const results = [];
  const errors = [];
  rows.forEach((row, index) => {
    try {
      results.push(createManualExpense(Object.assign({}, row, {
        source_type: "manual_batch_import",
        classification_basis: "manual_batch_import",
        is_installment: "no",
        installment_count: 1,
        save_to_merchant_payment_rules: saveToRules ? "yes" : "no",
      })));
    } catch (error) {
      errors.push({ row_number: index + 2, item: row.purchase_item || "", message: error.message });
    }
  });
  return { imported_count: results.length, error_count: errors.length, errors };
}

function createMonthlyExpenseSchedule(input) {
  validateMonthlyExpenseSchedule_(input);
  const scheduleId = makeId_("MES");
  const rows = buildMonthlyExpenseScheduleRows_(input, scheduleId);
  const results = rows.map((row) => createManualExpense(Object.assign({}, row, {
    source_type: "monthly_scheduled_expense",
    source_record_id: scheduleId,
    classification_basis: "monthly_expense_schedule",
    is_installment: "no",
    installment_count: 1,
    save_to_merchant_payment_rules: input.save_to_merchant_payment_rules === true || input.save_to_merchant_payment_rules === "yes" ? "yes" : "no",
  })));
  return {
    schedule_id: scheduleId,
    created_count: results.length,
    first_consumption_date: rows.length ? rows[0].consumption_date : "",
    last_consumption_date: rows.length ? rows[rows.length - 1].consumption_date : "",
    expense_ids: results.map((result) => result.expense.expense_id),
  };
}

function debugFindPaymentSchedulesMissingExpenses() {
  const expenseIds = {};
  readObjects_("ExpenseRecords").forEach((expense) => {
    if (expense.expense_id) expenseIds[String(expense.expense_id)] = true;
  });
  return readObjects_("PaymentSchedule")
    .filter((payment) => payment.expense_id)
    .filter((payment) => !expenseIds[String(payment.expense_id)])
    .map((payment) => ({
      payment_id: payment.payment_id,
      expense_id: payment.expense_id,
      payment_date: payment.payment_date,
      cash_flow_month: payment.cash_flow_month,
      payment_amount: Number(payment.payment_amount || 0),
      payment_tool_type: payment.payment_tool_type,
      credit_card_name: payment.credit_card_name,
      payment_status: payment.payment_status,
    }));
}

function validateMonthlyExpenseSchedule_(input) {
  if (!input || !String(input.start_month || "").match(/^\d{4}-\d{2}$/)) throw new Error("請選擇開始月份。");
  const repeatCount = Number(input.repeat_count);
  if (!isFinite(repeatCount) || repeatCount < 1 || Math.floor(repeatCount) !== repeatCount) throw new Error("請填寫正確的重複次數。");
  const expenseDay = Number(input.expense_day);
  if (!isFinite(expenseDay) || expenseDay < 1 || expenseDay > 31 || Math.floor(expenseDay) !== expenseDay) throw new Error("每月幾號需介於 1 到 31。");
  if (!input.purchase_item) throw new Error("請填寫固定支出項目。");
  if (!input.channel) throw new Error("請填寫消費通路。");
  if (!input.budget_item) throw new Error("請選擇預算項目。");
  if (!input.payment_tool_type) throw new Error("請選擇支付工具類型。");
  if (input.payment_tool_type === "credit_card" && !input.credit_card_name) throw new Error("信用卡付款請選擇信用卡名稱。");
  if (!isExpenseAmountAllowed_(input)) throw new Error("消費金額必須大於 0。");
}

function buildMonthlyExpenseScheduleRows_(input, scheduleId) {
  const startMonth = String(input.start_month || "").trim();
  const repeatCount = Number(input.repeat_count || 0);
  const expenseDay = Number(input.expense_day || 0);
  const parts = startMonth.split("-");
  const startYear = Number(parts[0]);
  const startMonthNumber = Number(parts[1]);
  const rows = [];
  for (let index = 0; index < repeatCount; index += 1) {
    const consumptionDate = buildMonthlyExpenseDate_(startYear, startMonthNumber, index, expenseDay);
    rows.push({
      expense_id: `${scheduleId.replace(/^MES/, "E")}_${String(index + 1).padStart(3, "0")}`,
      consumption_date: consumptionDate,
      purchase_item: input.purchase_item,
      amount: Number(input.amount || 0),
      channel: input.channel,
      budget_item: input.budget_item,
      payment_tool_type: input.payment_tool_type || "cash",
      credit_card_name: input.payment_tool_type === "credit_card" ? (input.credit_card_name || "") : "",
      notes: input.notes || "",
    });
  }
  return rows;
}

function buildMonthlyExpenseDate_(startYear, startMonthNumber, monthOffset, expenseDay) {
  const target = new Date(startYear, startMonthNumber - 1 + monthOffset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(expenseDay, lastDay);
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseManualExpenseText_(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitManualDelimitedLine_(lines[0], delimiter).map((cell) => cell.trim());
  const hasHeaders = isManualExpenseHeaderRow_(firstCells);
  const headers = hasHeaders ? firstCells : getDefaultManualExpenseHeaders_(firstCells.length);
  const dataLines = hasHeaders ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const cells = splitManualDelimitedLine_(line, delimiter);
    const raw = {};
    headers.forEach((header, index) => raw[header] = index === headers.length - 1 ? cells.slice(index).join(delimiter) : (cells[index] || ""));
    return normalizeManualExpenseRow_(raw);
  }).filter((row) => row.consumption_date || row.purchase_item || Number(row.amount) !== 0);
}

function isManualExpenseHeaderRow_(cells) {
  const knownHeaders = ["消費日", "消費日期", "日期", "consumption_date", "購買品項", "消費金額", "amount"];
  return cells.some((cell) => knownHeaders.indexOf(cell) >= 0);
}

function getDefaultManualExpenseHeaders_(length) {
  const headers = ["消費日", "購買品項", "消費金額", "消費通路", "預算項目", "支付方式", "信用卡", "備註"];
  return headers.slice(0, Math.max(length, 1));
}

function normalizeManualExpenseRow_(row) {
  const paymentText = pickManualField_(row, ["支付方式", "payment_method", "payment_tool_type"]);
  const paymentToolType = paymentText === "credit_card" || paymentText.indexOf("信用卡") >= 0 ? "credit_card" : "cash";
  return {
    consumption_date: normalizeManualExpenseDate_(pickManualField_(row, ["消費日", "消費日期", "日期", "consumption_date"])),
    purchase_item: pickManualField_(row, ["購買品項", "品項", "商品名稱", "purchase_item", "item_description"]),
    amount: parseManualExpenseAmount_(pickManualField_(row, ["消費金額", "金額", "amount"])),
    channel: pickManualField_(row, ["消費通路", "通路", "店家", "channel", "merchant_name"]),
    budget_item: pickManualField_(row, ["預算項目", "Budget Item", "budget_item"]),
    payment_tool_type: paymentToolType,
    credit_card_name: paymentToolType === "credit_card" ? normalizeManualCreditCardName_(pickManualField_(row, ["信用卡", "信用卡名稱", "credit_card_name"])) : "",
    notes: pickManualField_(row, ["備註", "notes"]),
  };
}

function splitManualDelimitedLine_(line, delimiter) {
  if (delimiter === "\t") return line.split("\t");
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function pickManualField_(row, names) {
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (Object.prototype.hasOwnProperty.call(row, name)) return String(row[name] || "").trim();
  }
  return "";
}

function normalizeManualExpenseDate_(value) {
  const text = String(value || "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const monthOnly = text.match(/^(\d{4})[\/\-.年](\d{1,2})月?$/);
  if (monthOnly) return `${monthOnly[1]}-${monthOnly[2].padStart(2, "0")}-01`;
  const match = text.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (!match) return text.slice(0, 10);
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseManualExpenseAmount_(value) {
  const number = Number(String(value || "").replace(/[$,，\s]/g, ""));
  return isNaN(number) ? 0 : number;
}

function normalizeManualCreditCardName_(value) {
  const text = String(value || "").trim();
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
  return labels[text] || text;
}

function debugImportManualExpenseSample() {
  const sample = "消費日,購買品項,消費金額,消費通路,預算項目,支付方式,信用卡,備註\n2026/05/12,洗面乳,299,蝦皮,10. 日常用品,信用卡,聯邦,測試";
  const result = importManualExpensesFromText(sample, { save_to_merchant_payment_rules: "no" });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
