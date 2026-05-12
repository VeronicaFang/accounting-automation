import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyIncomeSchedule } from "../src/core/income.mjs";

test("monthly salary schedule creates one income row on day 5 for each month", () => {
  assert.deepEqual(buildMonthlyIncomeSchedule({
    start_month: "2026-05",
    end_month: "2026-07",
    income_item: "薪資",
    income_amount: 65000,
    income_day: 5,
  }), [
    { income_date: "2026-05-05", income_month: "2026-05", income_item: "薪資", income_amount: 65000, income_status: "estimated", source: "salary_schedule", notes: "" },
    { income_date: "2026-06-05", income_month: "2026-06", income_item: "薪資", income_amount: 65000, income_status: "estimated", source: "salary_schedule", notes: "" },
    { income_date: "2026-07-05", income_month: "2026-07", income_item: "薪資", income_amount: 65000, income_status: "estimated", source: "salary_schedule", notes: "" },
  ]);
});

