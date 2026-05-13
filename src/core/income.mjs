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

export function getIncomeSchedule(rows, limit = 12) {
  return rows
    .filter((row) => row.income_date || row.income_month || row.income_item)
    .map((row) => ({
      income_id: row.income_id,
      income_date: normalizeDateText(row.income_date),
      income_month: row.income_month || normalizeMonthFromDate(row.income_date),
      income_item: row.income_item || "",
      income_amount: Number(row.income_amount || 0),
      income_status: row.income_status || "estimated",
      source: row.source || "",
      notes: row.notes || "",
    }))
    .sort((a, b) => {
      const dateCompare = String(a.income_date || "").localeCompare(String(b.income_date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.income_id || "").localeCompare(String(b.income_id || ""));
    })
    .slice(0, Number(limit || 12));
}

export function applyIncomeStatusUpdate(rows, input) {
  const allowedStatuses = new Set(["estimated", "received", "corrected"]);
  if (!input?.income_id) throw new Error("income_id is required");
  if (!allowedStatuses.has(input.income_status)) throw new Error(`Invalid income status: ${input.income_status}`);
  return rows.map((row) => {
    if (String(row.income_id) !== String(input.income_id)) return row;
    const updated = {
      ...row,
      income_status: input.income_status,
      notes: input.notes ?? row.notes ?? "",
    };
    if (input.income_amount !== undefined) updated.income_amount = Number(input.income_amount);
    return updated;
  });
}

function parseMonth(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) throw new Error("month must use YYYY-MM format");
  return new Date(`${text}-01T00:00:00`);
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeDateText(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

function normalizeMonthFromDate(value) {
  const dateText = normalizeDateText(value);
  return /^\d{4}-\d{2}/.test(dateText) ? dateText.slice(0, 7) : "";
}
