const FIELD_ALIASES = {
  source_record_id: ["發票號碼", "發票字軌號碼", "字軌號碼", "invoice_number", "source_record_id"],
  consumption_date: ["消費日", "交易日期", "發票日期", "發票開立日期", "日期", "consumption_date"],
  merchant_name: ["賣方名稱", "營業人名稱", "店家名稱", "商店名稱", "merchant_name"],
  merchant_tax_id: ["賣方統一編號", "營業人統編", "店家統編", "統一編號", "merchant_tax_id"],
  item_description: ["消費明細_品名", "品名", "品項", "商品名稱", "發票明細", "購買品項", "item_description"],
  amount: ["消費明細_金額", "金額", "總金額", "發票金額", "銷售額合計", "消費金額", "amount"],
};

export function parseInvoiceText(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = index === headers.length - 1 ? cells.slice(index).join(delimiter) : (cells[index] ?? "");
    });
    return normalizeInvoiceRow(row);
  }).filter((row) => row.consumption_date || row.merchant_name || row.amount > 0);
}

export function buildInvoiceDrafts(invoiceRows, paymentRules = [], itemRules = []) {
  const keyCounts = new Map();
  return invoiceRows.map((row) => {
    const paymentRule = findPaymentRule(row, paymentRules);
    const itemRule = findItemRule(row, itemRules);
    return {
      ...row,
      source_line_key: buildSourceLineKey(row, keyCounts),
      suggested_payment_tool_type: row.annotated_payment_tool_type || paymentRule?.payment_tool_type || "cash",
      suggested_credit_card_name: row.annotated_credit_card_name || paymentRule?.credit_card_name || "",
      suggested_budget_item: row.annotated_budget_item || paymentRule?.default_budget_item || itemRule?.budget_item || "",
      classification_status: "needs_review",
      import_status: "pending",
    };
  });
}



export function filterNewInvoiceDrafts(drafts, existingRows = []) {
  const existing = buildExistingInvoiceDuplicateIndex(existingRows);
  return drafts.filter((draft) => {
    const fullKey = String(draft.source_line_key || "");
    const baseKey = buildInvoiceLineBaseKey(draft);
    return !existing.fullKeys.has(fullKey) && !existing.baseKeys.has(baseKey);
  });
}

function buildExistingInvoiceDuplicateIndex(rows) {
  const fullKeys = new Set();
  const baseKeys = new Set();
  rows.forEach((row) => {
    const fullKey = String(row.source_line_key || "").trim();
    if (fullKey) fullKeys.add(fullKey);
    const baseKey = buildInvoiceLineBaseKey(row);
    if (baseKey) baseKeys.add(baseKey);
  });
  return { fullKeys, baseKeys };
}

function buildInvoiceLineBaseKey(row) {
  const values = [
    row.source_record_id,
    row.merchant_tax_id,
    normalizeKeyDate(row.consumption_date),
    row.item_description || row.purchase_item,
    row.amount,
  ].map((value) => String(value ?? "").trim());
  return values.some(Boolean) ? values.join("|") : "";
}

function buildSourceLineKey(row, keyCounts) {
  const base = [
    row.source_record_id,
    row.merchant_tax_id,
    normalizeKeyDate(row.consumption_date),
    row.item_description,
    row.amount,
  ].map((value) => String(value ?? "").trim()).join("|");
  const nextCount = (keyCounts.get(base) || 0) + 1;
  keyCounts.set(base, nextCount);
  return `${base}|${nextCount}`;
}
export function buildSelectedInvoiceDeletions(drafts, selectionsByImportId) {
  return drafts
    .filter((draft) => draft.import_status === "pending")
    .filter((draft) => selectionsByImportId[draft.import_id])
    .map((draft) => ({ import_id: draft.import_id }));
}
export function buildSelectedInvoiceConfirmations(drafts, editsByImportId) {
  return drafts
    .filter((draft) => draft.import_status === "pending")
    .map((draft) => ({ draft, edit: editsByImportId[draft.import_id] }))
    .filter(({ edit }) => edit?.selected)
    .map(({ draft, edit }) => ({
      import_id: draft.import_id,
      budget_item: edit.budget_item || draft.suggested_budget_item,
      payment_tool_type: edit.payment_tool_type || draft.suggested_payment_tool_type || "cash",
      credit_card_name: (edit.payment_tool_type || draft.suggested_payment_tool_type) === "credit_card" ? (edit.credit_card_name || draft.suggested_credit_card_name || "") : "",
      save_to_merchant_payment_rules: edit.save_to_merchant_payment_rules === true,
    }));
}
function normalizeInvoiceRow(row) {
  return {
    source_record_id: pickField(row, FIELD_ALIASES.source_record_id),
    consumption_date: normalizeDate(pickField(row, FIELD_ALIASES.consumption_date)),
    merchant_name: pickField(row, FIELD_ALIASES.merchant_name),
    merchant_tax_id: pickField(row, FIELD_ALIASES.merchant_tax_id),
    item_description: pickField(row, FIELD_ALIASES.item_description),
    amount: parseAmount(pickField(row, FIELD_ALIASES.amount)),
    annotated_budget_item: pickField(row, ["項目", "budget_item"]),
    ...parseAnnotatedPayment(pickField(row, ["支付方式", "payment_method"])), 
    annotated_notes: pickField(row, ["分期備註", "備註", "notes"]),
  };
}

function pickField(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return String(row[name] || "").trim();
  }
  return "";
}

function normalizeKeyDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return normalizeDate(value);
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const match = text.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (!match) return text.slice(0, 10);
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseAmount(value) {
  const text = String(value || "").replace(/[$,，\s]/g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function detectDelimiter(headerLine) {
  if (headerLine.includes("\t")) return "\t";
  return ",";
}

function splitLine(line, delimiter) {
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

function findPaymentRule(row, rules) {
  return rules.filter(isActiveRule).find((rule) => matchesRule(row, rule));
}

function findItemRule(row, rules) {
  return rules.filter(isActiveRule).find((rule) => matchesRule(row, rule) && matchesKeyword(row, rule));
}

function isActiveRule(rule) {
  const value = String(rule.is_active ?? "true").toLowerCase();
  return value === "true" || value === "yes" || value === "1";
}

function matchesRule(row, rule) {
  const taxId = String(rule.merchant_tax_id || "").trim();
  const nameContains = String(rule.merchant_name_contains || "").trim();
  if (taxId && taxId === String(row.merchant_tax_id || "").trim()) return true;
  if (nameContains && String(row.merchant_name || "").includes(nameContains)) return true;
  return !taxId && !nameContains;
}

function matchesKeyword(row, rule) {
  const keyword = String(rule.item_keyword_contains || "").trim();
  if (!keyword) return true;
  return String(row.item_description || "").includes(keyword);
}
function parseAnnotatedPayment(value) {
  const text = String(value || "").trim();
  if (!text) return { annotated_payment_tool_type: "", annotated_credit_card_name: "" };
  if (text.includes("現金")) return { annotated_payment_tool_type: "cash", annotated_credit_card_name: "" };
  const cardLabels = ["玉山", "聯邦", "國泰", "富邦", "中信"];
  const cardName = cardLabels.find((label) => text.includes(label)) || "";
  if (text.includes("信用卡") || cardName) return { annotated_payment_tool_type: "credit_card", annotated_credit_card_name: cardName };
  return { annotated_payment_tool_type: "", annotated_credit_card_name: "" };
}
