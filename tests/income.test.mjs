import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyIncomeSchedule, getIncomeSchedule, applyIncomeStatusUpdate } from "../src/core/income.mjs";

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

test("income schedule exposes upcoming income rows sorted by date", () => {
  const rows = [
    { income_id: "I2", income_date: "2026-06-05", income_month: "2026-06", income_item: "薪資", income_amount: 65000, income_status: "estimated", source: "salary_schedule" },
    { income_id: "I1", income_date: "2026-05-05", income_month: "2026-05", income_item: "薪資", income_amount: 65000, income_status: "received", source: "salary_schedule" },
    { income_id: "I3", income_date: "2026-06-10", income_month: "2026-06", income_item: "獎金", income_amount: 10000, income_status: "estimated", source: "manual" },
  ];

  assert.deepEqual(getIncomeSchedule(rows, 2), [
    { income_id: "I1", income_date: "2026-05-05", income_month: "2026-05", income_item: "薪資", income_amount: 65000, income_status: "received", source: "salary_schedule", notes: "" },
    { income_id: "I2", income_date: "2026-06-05", income_month: "2026-06", income_item: "薪資", income_amount: 65000, income_status: "estimated", source: "salary_schedule", notes: "" },
  ]);
});

test("income status update can mark salary received or correct amount", () => {
  const rows = [
    { income_id: "I1", income_amount: 65000, income_status: "estimated", notes: "" },
    { income_id: "I2", income_amount: 10000, income_status: "estimated", notes: "" },
  ];

  assert.deepEqual(applyIncomeStatusUpdate(rows, {
    income_id: "I1",
    income_status: "corrected",
    income_amount: 64820,
    notes: "實際入帳 64820",
  }), [
    { income_id: "I1", income_amount: 64820, income_status: "corrected", notes: "實際入帳 64820" },
    { income_id: "I2", income_amount: 10000, income_status: "estimated", notes: "" },
  ]);
});
