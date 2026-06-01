import assert from "node:assert/strict";
import { formatCurrency, formatMonth, formatPercent, formatVariance } from "./format.ts";

assert.equal(formatCurrency(67124), "67,124");
assert.equal(formatCurrency(-146870), "-146,870");

assert.equal(formatMonth("2026-05"), "2026-05");
assert.equal(formatMonth("NaN-NaN"), "月份未設定");

assert.equal(formatPercent(0.875), "87.5%");

assert.equal(formatVariance(1200), "+1,200");
assert.equal(formatVariance(-300), "-300");
assert.equal(formatVariance(0), "0");

console.log("format helpers: 8 assertions passed");
