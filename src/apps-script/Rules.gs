function toDateText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Taipei", "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function toMonthKey_(dateValue) {
  const date = new Date(`${toDateText_(dateValue)}T00:00:00`);
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
  const isYuShan = creditCardName === "YuShan";
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

