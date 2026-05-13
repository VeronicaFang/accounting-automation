export function parseManualExpenseText(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitDelimitedLine(lines[0], delimiter).map((cell) => cell.trim());
  const hasHeaders = isManualExpenseHeaderRow(firstCells);
  const headers = hasHeaders ? firstCells : getDefaultManualExpenseHeaders(firstCells.length);
  const dataLines = hasHeaders ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => row[header] = index === headers.length - 1 ? cells.slice(index).join(delimiter) : (cells[index] || ""));
    return normalizeManualExpenseRow(row);
  }).filter((row) => row.consumption_date || row.purchase_item || row.amount !== 0);
}

function isManualExpenseHeaderRow(cells) {
  return cells.some((cell) => ["消費日", "消費日期", "日期", "consumption_date", "購買品項", "消費金額", "amount"].includes(cell));
}

function getDefaultManualExpenseHeaders(length) {
  const headers = ["消費日", "購買品項", "消費金額", "消費通路", "預算項目", "支付方式", "信用卡", "備註"];
  return headers.slice(0, Math.max(length, 1));
}

function splitDelimitedLine(line, delimiter) {
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
function normalizeManualExpenseRow(row) {
  const paymentText = pickManualField(row, ["支付方式", "payment_method", "payment_tool_type"]);
  const paymentToolType = paymentText === "credit_card" || paymentText.includes("信用卡") ? "credit_card" : "cash";
  return {
    consumption_date: normalizeManualDate(pickManualField(row, ["消費日", "消費日期", "日期", "consumption_date"])),
    purchase_item: pickManualField(row, ["購買品項", "品項", "商品名稱", "purchase_item", "item_description"]),
    amount: parseManualAmount(pickManualField(row, ["消費金額", "金額", "amount"])),
    channel: pickManualField(row, ["消費通路", "通路", "店家", "channel", "merchant_name"]),
    budget_item: pickManualField(row, ["預算項目", "Budget Item", "budget_item"]),
    payment_tool_type: paymentToolType,
    credit_card_name: paymentToolType === "credit_card" ? normalizeManualCardName(pickManualField(row, ["信用卡", "信用卡名稱", "credit_card_name"])) : "",
    notes: pickManualField(row, ["備註", "notes"]),
  };
}

function pickManualField(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return String(row[name] || "").trim();
  }
  return "";
}

function normalizeManualDate(value) {
  const text = String(value || "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const monthOnly = text.match(/^(\d{4})[\/\-.年](\d{1,2})月?$/);
  if (monthOnly) return `${monthOnly[1]}-${monthOnly[2].padStart(2, "0")}-01`;
  const match = text.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (!match) return text.slice(0, 10);
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseManualAmount(value) {
  const number = Number(String(value || "").replace(/[$,，\s]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function normalizeManualCardName(value) {
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
export function isExpenseAmountAllowed(input = {}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) return false;
  if (input.source_type === "finance_ministry_invoice" || input.source_type === "manual_batch_import") return true;
  return amount > 0;
}
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
