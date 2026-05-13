function toDateText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Taipei", "yyyy-MM-dd");
  }
  const text = String(value || "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const monthOnly = text.match(/^(\d{4})[\/\-.年](\d{1,2})月?$/);
  if (monthOnly) return `${monthOnly[1]}-${monthOnly[2].padStart(2, "0")}-01`;
  const dateMatch = text.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (dateMatch) return `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  return text.slice(0, 10);
}

function toMonthKey_(dateValue) {
  const date = new Date(`${toDateText_(dateValue)}T00:00:00`);
  if (isNaN(date.getTime())) throw new Error(`日期格式不正確：${dateValue}`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths_(dateText, monthOffset) {
  const date = new Date(`${dateText}T00:00:00`);
  const result = new Date(date.getFullYear(), date.getMonth() + monthOffset, date.getDate());
  return Utilities.formatDate(result, "Asia/Taipei", "yyyy-MM-dd");
}

function getPaymentDate_(consumptionDate, paymentToolType, creditCardName) {
  const consumptionDateText = toDateText_(consumptionDate);
  if (paymentToolType === "cash") return consumptionDateText;

  const date = new Date(`${consumptionDateText}T00:00:00`);
  const isYuShan = creditCardName === "YuShan" || creditCardName === "玉山";
  const cutoffDay = isYuShan ? 12 : 5;
  const paymentDay = isYuShan ? 23 : 17;
  const monthOffset = date.getDate() <= cutoffDay ? 0 : 1;
  const paymentDate = new Date(date.getFullYear(), date.getMonth() + monthOffset, paymentDay);
  return Utilities.formatDate(paymentDate, "Asia/Taipei", "yyyy-MM-dd");
}

function splitInstallments_(totalAmount, installmentCount) {
  const count = Number(installmentCount || 1);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("分期期數必須是大於 0 的整數。");
  }
  const amount = Number(totalAmount);
  const base = Math.floor(amount / count);
  const payments = Array.from({ length: count }, () => base);
  payments[count - 1] = amount - base * (count - 1);
  return payments;
}

function getBudgetStatus_(usageRatio) {
  if (usageRatio >= 1) return "over_budget";
  if (usageRatio >= 0.9) return "warning";
  if (usageRatio >= 0.7) return "reminder";
  return "normal";
}


function saveMerchantPaymentRuleFromRecord_(record) {
  const merchantTaxId = String(record.merchant_tax_id || "").trim();
  const merchantName = String(record.merchant_name || record.channel || "").trim();
  if (!merchantTaxId && !merchantName) throw new Error("缺少店家資訊，無法寫入店家支付規則。");

  const paymentToolType = record.payment_tool_type || "cash";
  const creditCardName = paymentToolType === "credit_card" ? (record.credit_card_name || "") : "";
  const budgetItem = record.budget_item || record.suggested_budget_item || "";
  const rules = readObjects_("MerchantPaymentRules");
  const existing = rules.find((rule) => {
    const sameTaxId = merchantTaxId && String(rule.merchant_tax_id || "").trim() === merchantTaxId;
    const sameName = !merchantTaxId && merchantName && String(rule.merchant_name_contains || "").trim() === merchantName;
    return sameTaxId || sameName;
  });

  const updates = {
    merchant_tax_id: merchantTaxId,
    merchant_name_contains: merchantTaxId ? "" : merchantName,
    payment_tool_type: paymentToolType,
    credit_card_name: creditCardName,
    default_budget_item: budgetItem,
    is_active: true,
    notes: `manual save from ${record.source_type || "expense"}`,
  };

  if (existing && existing.rule_id) {
    updateObjectById_("MerchantPaymentRules", "rule_id", existing.rule_id, updates);
    return Object.assign({ rule_id: existing.rule_id, action: "updated" }, updates);
  }

  const rule = Object.assign({ rule_id: makeId_("MPR") }, updates);
  appendObject_("MerchantPaymentRules", rule);
  return Object.assign({ action: "created" }, rule);
}
