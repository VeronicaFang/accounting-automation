export function buildMonthlyIncomeSchedule(input) {
  const start = parseMonth(input.start_month);
  const end = parseMonth(input.end_month || input.start_month);
  if (end < start) throw new Error("end_month must be after start_month");
  const day = Number(input.income_day || 5);
  const rows = [];

  for (let date = new Date(start.getFullYear(), start.getMonth(), 1); date <= end; date = new Date(date.getFullYear(), date.getMonth() + 1, 1)) {
    const incomeMonth = formatMonth(date);
    rows.push({
      income_date: `${incomeMonth}-${String(day).padStart(2, "0")}`,
      income_month: incomeMonth,
      income_item: input.income_item || "薪資",
      income_amount: Number(input.income_amount || 0),
      income_status: input.income_status || "estimated",
      source: input.source || "salary_schedule",
      notes: input.notes || "",
    });
  }

  return rows;
}

function parseMonth(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) throw new Error("month must use YYYY-MM format");
  return new Date(`${text}-01T00:00:00`);
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
