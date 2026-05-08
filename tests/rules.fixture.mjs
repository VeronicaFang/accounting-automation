export function toMonthKey(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function addMonths(dateText, monthOffset) {
  const date = new Date(`${dateText}T00:00:00`);
  const result = new Date(date.getFullYear(), date.getMonth() + monthOffset, date.getDate());
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, "0");
  const day = String(result.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPaymentDate(consumptionDateText, paymentToolType, creditCardName) {
  if (paymentToolType === "cash") {
    return consumptionDateText;
  }

  const date = new Date(`${consumptionDateText}T00:00:00`);
  const day = date.getDate();
  const isYuShan = creditCardName === "YuShan";
  const cutoffDay = isYuShan ? 12 : 5;
  const paymentDay = isYuShan ? 23 : 17;
  const paymentMonthOffset = day <= cutoffDay ? 0 : 1;
  const base = new Date(date.getFullYear(), date.getMonth() + paymentMonthOffset, paymentDay);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${String(paymentDay).padStart(2, "0")}`;
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
