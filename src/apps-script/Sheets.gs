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
  return { ok: true, message: "Database sheets are ready." };
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureHeaders_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0];
  const hasHeaders = current.some((value) => String(value || "").trim() !== "");
  if (!hasHeaders) {
    range.setValues([headers]);
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
