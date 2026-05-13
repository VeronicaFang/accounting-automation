export function toMonthKey(dateText) {
  const date = parseLocalDate(dateText);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function addMonths(dateText, monthOffset) {
  const date = parseLocalDate(dateText);
  const result = new Date(date.getFullYear(), date.getMonth() + monthOffset, date.getDate());
  return formatDate(result);
}

export function getPaymentDate(consumptionDateText, paymentToolType, creditCardName) {
  if (paymentToolType === "cash") {
    return consumptionDateText;
  }

  const date = parseLocalDate(consumptionDateText);
  const day = date.getDate();
  const isYuShan = creditCardName === "YuShan" || creditCardName === "玉山";
  const cutoffDay = isYuShan ? 12 : 5;
  const paymentDay = isYuShan ? 23 : 17;
  const paymentMonthOffset = day <= cutoffDay ? 0 : 1;
  const paymentDate = new Date(date.getFullYear(), date.getMonth() + paymentMonthOffset, paymentDay);
  return formatDate(paymentDate);
}

export function splitInstallments(totalAmount, installmentCount) {
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw new Error("installmentCount must be a positive integer");
  }

  const base = Math.floor(totalAmount / installmentCount);
  const payments = Array.from({ length: installmentCount }, () => base);
  payments[installmentCount - 1] = totalAmount - base * (installmentCount - 1);
  return payments;
}

export function getBudgetStatus(usageRatio) {
  if (usageRatio >= 1) return "over_budget";
  if (usageRatio >= 0.9) return "warning";
  if (usageRatio >= 0.7) return "reminder";
  return "normal";
}

export function buildMerchantPaymentRuleFromRecord(record) {
  const merchantTaxId = String(record.merchant_tax_id || "").trim();
  const merchantName = String(record.merchant_name || record.channel || "").trim();
  const paymentToolType = record.payment_tool_type || "cash";
  const creditCardName = paymentToolType === "credit_card" ? (record.credit_card_name || "") : "";
  const budgetItem = record.budget_item || record.suggested_budget_item || "";
  return {
    merchant_tax_id: merchantTaxId,
    merchant_name_contains: merchantTaxId ? "" : merchantName,
    merchant_display_name: merchantName,
    payment_tool_type: paymentToolType,
    credit_card_name: creditCardName,
    default_budget_item: budgetItem,
    is_active: true,
    notes: `manual save from ${record.source_type || "expense"}`,
  };
}

function parseLocalDate(dateText) {
  return new Date(`${String(dateText).slice(0, 10)}T00:00:00`);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
