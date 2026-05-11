function importInvoiceDraftsFromText(text) {
  const rows = parseInvoiceText_(text);
  const drafts = buildInvoiceDrafts_(rows);
  const existingKeys = new Set(readObjects_("ImportedInvoiceDrafts").map((row) => row.source_line_key).filter(Boolean).map(String));
  const newDrafts = drafts.filter((draft) => !existingKeys.has(String(draft.source_line_key || "")));
  newDrafts.forEach((draft) => appendObject_("ImportedInvoiceDrafts", draft));
  return { imported_count: newDrafts.length, skipped_count: drafts.length - newDrafts.length, drafts: newDrafts };
}

function getPendingInvoiceDrafts(limit) {
  return readObjects_("ImportedInvoiceDrafts")
    .filter((draft) => draft.import_status === "pending")
    .sort((a, b) => String(b.consumption_date || "").localeCompare(String(a.consumption_date || "")))
    .slice(0, Number(limit || 50));
}

function confirmInvoiceDraft(input) {
  const draft = readObjects_("ImportedInvoiceDrafts").find((row) => String(row.import_id) === String(input.import_id));
  if (!draft) throw new Error("找不到待確認發票資料。");
  if (draft.import_status !== "pending") throw new Error("這筆發票資料已處理過。");

  const paymentToolType = input.payment_tool_type || draft.suggested_payment_tool_type || "cash";
  const creditCardName = paymentToolType === "credit_card" ? (input.credit_card_name || draft.suggested_credit_card_name) : "";
  const result = createManualExpense({
    consumption_date: draft.consumption_date,
    purchase_item: draft.item_description,
    amount: draft.amount,
    channel: draft.merchant_name,
    budget_item: input.budget_item || draft.suggested_budget_item,
    payment_tool_type: paymentToolType,
    credit_card_name: creditCardName,
    is_installment: "no",
    installment_count: 1,
    suggested_budget_item: draft.suggested_budget_item,
    notes: input.notes || `由發票匯入：${draft.source_record_id || ""}`,
  });

  updateObjectById_("ImportedInvoiceDrafts", "import_id", draft.import_id, {
    import_status: "confirmed",
    expense_id: result.expense.expense_id,
    suggested_budget_item: input.budget_item || draft.suggested_budget_item,
    suggested_payment_tool_type: paymentToolType,
    suggested_credit_card_name: creditCardName,
  });
  appendClassificationHistory_(draft, input.budget_item || draft.suggested_budget_item);
  appendPaymentChoiceHistory_(draft, paymentToolType, creditCardName);
  if (input.save_to_merchant_payment_rules === true || input.save_to_merchant_payment_rules === "yes") {
    result.merchant_payment_rule = saveMerchantPaymentRuleFromRecord_({
      source_type: "invoice_import",
      merchant_tax_id: draft.merchant_tax_id,
      merchant_name: draft.merchant_name,
      payment_tool_type: paymentToolType,
      credit_card_name: creditCardName,
      budget_item: input.budget_item || draft.suggested_budget_item,
    });
  }
  return result;
}


function confirmInvoiceDraftsBatch(inputs) {
  const rows = Array.isArray(inputs) ? inputs : [];
  if (rows.length === 0) throw new Error("請先勾選要確認入帳的發票。");
  const results = [];
  const errors = [];
  rows.forEach((input) => {
    try {
      results.push(confirmInvoiceDraft(input));
    } catch (error) {
      errors.push({ import_id: input.import_id, message: error.message });
    }
  });
  return {
    confirmed_count: results.length,
    error_count: errors.length,
    errors,
  };
}
function parseInvoiceText_(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine_(lines[0], delimiter).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine_(line, delimiter);
    const raw = {};
    headers.forEach((header, index) => raw[header] = index === headers.length - 1 ? cells.slice(index).join(delimiter) : (cells[index] || ""));
    return normalizeInvoiceRow_(raw);
  }).filter((row) => row.consumption_date || row.merchant_name || Number(row.amount) > 0);
}

function deleteInvoiceDraft(input) {
  const importId = input && input.import_id;
  if (!importId) throw new Error("請先選擇要刪除的待確認發票。");
  const draft = readObjects_("ImportedInvoiceDrafts").find((row) => String(row.import_id) === String(importId));
  if (!draft) throw new Error("找不到待確認發票資料。");
  if (draft.import_status !== "pending") throw new Error("這筆發票資料已處理過，不能刪除。");
  updateObjectById_("ImportedInvoiceDrafts", "import_id", draft.import_id, {
    import_status: "deleted",
    notes: input.notes || "不是本人支付，已從待確認清單刪除",
  });
  return { deleted_count: 1, import_id: draft.import_id };
}

function deleteInvoiceDraftsBatch(inputs) {
  const rows = Array.isArray(inputs) ? inputs : [];
  if (rows.length === 0) throw new Error("請先勾選要刪除的待確認發票。");
  const results = [];
  const errors = [];
  rows.forEach((input) => {
    try {
      results.push(deleteInvoiceDraft(input));
    } catch (error) {
      errors.push({ import_id: input.import_id, message: error.message });
    }
  });
  return {
    deleted_count: results.length,
    error_count: errors.length,
    errors,
  };
}
function buildInvoiceDrafts_(rows) {
  const keyCounts = {};
  const paymentRules = readObjects_("MerchantPaymentRules");
  const itemRules = readObjects_("MerchantItemRules");
  return rows.map((row, index) => {
    const paymentRule = findPaymentRule_(row, paymentRules);
    const itemRule = findItemRule_(row, itemRules);
    return Object.assign({}, row, {
      import_id: makeId_("IMP") + String(index + 1).padStart(2, "0"),
      source_type: "finance_ministry_invoice",
      suggested_payment_tool_type: row.annotated_payment_tool_type || (paymentRule ? paymentRule.payment_tool_type : "cash"),
      suggested_credit_card_name: row.annotated_credit_card_name || (paymentRule ? paymentRule.credit_card_name : ""),
      suggested_budget_item: row.annotated_budget_item || (paymentRule ? paymentRule.default_budget_item : "") || (itemRule ? itemRule.budget_item : ""),
      classification_status: "needs_review",
      import_status: "pending",
      expense_id: "",
      notes: "",
    });
  });
}


function buildSourceLineKey_(row, keyCounts) {
  const base = [
    row.source_record_id,
    row.merchant_tax_id,
    row.consumption_date,
    row.item_description,
    row.amount,
  ].map((value) => String(value == null ? "" : value).trim()).join("|");
  const nextCount = (keyCounts[base] || 0) + 1;
  keyCounts[base] = nextCount;
  return `${base}|${nextCount}`;
}
function normalizeInvoiceRow_(row) {
  return {
    source_record_id: pickInvoiceField_(row, ["發票號碼", "發票字軌號碼", "字軌號碼", "invoice_number", "source_record_id"]),
    consumption_date: normalizeInvoiceDate_(pickInvoiceField_(row, ["消費日", "交易日期", "發票日期", "發票開立日期", "日期", "consumption_date"])),
    merchant_name: pickInvoiceField_(row, ["賣方名稱", "營業人名稱", "店家名稱", "商店名稱", "merchant_name"]),
    merchant_tax_id: pickInvoiceField_(row, ["賣方統一編號", "營業人統編", "店家統編", "統一編號", "merchant_tax_id"]),
    item_description: pickInvoiceField_(row, ["消費明細_品名", "品名", "品項", "商品名稱", "發票明細", "購買品項", "item_description"]),
    amount: parseInvoiceAmount_(pickInvoiceField_(row, ["消費明細_金額", "金額", "總金額", "發票金額", "銷售額合計", "消費金額", "amount"])),
    annotated_budget_item: pickInvoiceField_(row, ["項目", "budget_item"]),
    annotated_payment_tool_type: parseAnnotatedPayment_(pickInvoiceField_(row, ["支付方式", "payment_method"])).payment_tool_type,
    annotated_credit_card_name: parseAnnotatedPayment_(pickInvoiceField_(row, ["支付方式", "payment_method"])).credit_card_name,
    annotated_notes: pickInvoiceField_(row, ["分期備註", "備註", "notes"]),
  };
}

function pickInvoiceField_(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return String(row[name] || "").trim();
  }
  return "";
}

function normalizeInvoiceDate_(value) {
  const text = String(value || "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const match = text.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (!match) return text.slice(0, 10);
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseInvoiceAmount_(value) {
  const number = Number(String(value || "").replace(/[$,，\s]/g, ""));
  return isNaN(number) ? 0 : number;
}

function splitDelimitedLine_(line, delimiter) {
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

function findPaymentRule_(row, rules) {
  return rules.filter(isActiveRule_).find((rule) => matchesMerchantRule_(row, rule));
}

function findItemRule_(row, rules) {
  return rules.filter(isActiveRule_).find((rule) => matchesMerchantRule_(row, rule) && matchesItemKeyword_(row, rule));
}

function isActiveRule_(rule) {
  const value = String(rule.is_active || "true").toLowerCase();
  return value === "true" || value === "yes" || value === "1";
}

function matchesMerchantRule_(row, rule) {
  const taxId = String(rule.merchant_tax_id || "").trim();
  const nameContains = String(rule.merchant_name_contains || "").trim();
  if (taxId && taxId === String(row.merchant_tax_id || "").trim()) return true;
  if (nameContains && String(row.merchant_name || "").includes(nameContains)) return true;
  return !taxId && !nameContains;
}

function matchesItemKeyword_(row, rule) {
  const keyword = String(rule.item_keyword_contains || "").trim();
  return !keyword || String(row.item_description || "").includes(keyword);
}

function appendClassificationHistory_(draft, budgetItem) {
  appendObject_("ClassificationHistory", {
    history_id: makeId_("CH"),
    merchant_tax_id: draft.merchant_tax_id,
    merchant_name: draft.merchant_name,
    item_description: draft.item_description,
    budget_item: budgetItem,
    confirmed_at: Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss"),
    notes: "invoice_import_confirmed",
  });
}

function appendPaymentChoiceHistory_(draft, paymentToolType, creditCardName) {
  appendObject_("PaymentChoiceHistory", {
    history_id: makeId_("PH"),
    merchant_tax_id: draft.merchant_tax_id,
    merchant_name: draft.merchant_name,
    payment_tool_type: paymentToolType,
    credit_card_name: creditCardName,
    confirmed_at: Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss"),
    notes: "invoice_import_confirmed",
  });
}

function debugImportInvoiceSample() {
  const sample = "消費日\t賣方名稱\t賣方統一編號\t品名\t金額\t發票號碼\n2026/05/02\t統一超商\t12345678\t飯糰\t59\tAB12345678";
  const result = importInvoiceDraftsFromText(sample);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function parseAnnotatedPayment_(value) {
  const text = String(value || "").trim();
  if (!text) return { payment_tool_type: "", credit_card_name: "" };
  if (text.includes("現金")) return { payment_tool_type: "cash", credit_card_name: "" };
  const cardLabels = ["玉山", "聯邦", "國泰", "富邦", "中信"];
  const cardName = cardLabels.find((label) => text.includes(label)) || "";
  if (text.includes("信用卡") || cardName) return { payment_tool_type: "credit_card", credit_card_name: cardName };
  return { payment_tool_type: "", credit_card_name: "" };
}
