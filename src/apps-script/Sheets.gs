function getDatabase_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function setupDatabase() {
  const spreadsheet = getDatabase_();
  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = getOrCreateSheet_(spreadsheet, sheetName);
    ensureHeaders_(sheet, HEADERS[sheetName]);
  });
  seedCreditCardRules_();
  seedMerchantPaymentRules_();
  return { ok: true, message: "Database sheets are ready." };
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const range = sheet.getRange(1, 1, 1, lastColumn);
  const current = range.getValues()[0];
  const hasHeaders = current.some((value) => String(value || "").trim() !== "");
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const existingHeaders = current.map((value) => String(value || "").trim()).filter(Boolean);
  const missingHeaders = headers.filter((header) => !existingHeaders.includes(header));
  if (missingHeaders.length > 0) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    sheet.setFrozenRows(1);
  }
}
function seedCreditCardRules_() {
  const sheet = getDatabase_().getSheetByName("CreditCardRules");
  if (sheet.getLastRow() > 1) return;
  appendObject_("CreditCardRules", {
    credit_card_name: "YuShan",
    card_group: "yushan",
    cutoff_day: 12,
    payment_day: 23,
    is_default_for_other_cards: false,
    notes: "YuShan purchases from day 1 to 12 pay on the 23rd of the same month.",
  });
  ["Union", "Cathay", "Fubon", "CTBC"].forEach((name) => {
    appendObject_("CreditCardRules", {
      credit_card_name: name,
      card_group: "other",
      cutoff_day: 5,
      payment_day: 17,
      is_default_for_other_cards: true,
      notes: "Other card purchases from day 1 to 5 pay on the 17th of the same month.",
    });
  });
}


function seedMerchantPaymentRules_() {
  const existing = readObjects_("MerchantPaymentRules");
  const existingKeys = new Set(existing.map((rule) => `${rule.merchant_tax_id || ""}|${rule.merchant_name_contains || ""}`));
  INITIAL_MERCHANT_PAYMENT_RULES.forEach((rule, index) => {
    const key = `${rule.merchant_tax_id || ""}|${rule.merchant_name_contains || ""}`;
    if (existingKeys.has(key)) return;
    appendObject_("MerchantPaymentRules", {
      rule_id: `MPR_INIT_${String(index + 1).padStart(3, "0")}`,
      merchant_tax_id: rule.merchant_tax_id,
      merchant_name_contains: rule.merchant_name_contains,
      payment_tool_type: rule.payment_tool_type,
      credit_card_name: rule.credit_card_name,
      default_budget_item: rule.default_budget_item || "",
      is_active: true,
      notes: rule.notes,
    });
  });
}
function appendObject_(sheetName, record) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "");
  sheet.appendRow(row);
}

function readObjects_(sheetName) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((value) => value !== "")).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
}

function makeId_(prefix) {
  return `${prefix}${Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmssSSS")}`;
}

function debugGetBudgetRows() {
  return readObjects_("BudgetItems");
}

function debugGetDatabaseName() {
  return getDatabase_().getName();
}
function updateObjectById_(sheetName, idColumn, idValue, updates) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) throw new Error(`找不到工作表或資料：${sheetName}`);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf(idColumn);
  if (idIndex < 0) throw new Error(`找不到欄位：${idColumn}`);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const rowIndex = values.findIndex((row) => String(row[idIndex]) === String(idValue));
  if (rowIndex < 0) throw new Error(`找不到資料：${idValue}`);
  const rowNumber = rowIndex + 2;
  Object.keys(updates).forEach((key) => {
    const columnIndex = headers.indexOf(key);
    if (columnIndex >= 0) sheet.getRange(rowNumber, columnIndex + 1).setValue(updates[key]);
  });
}
