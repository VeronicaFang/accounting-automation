import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/202606050001_allow_expense_adjustments.sql";

test("expense migration allows signed discount refund and offset adjustments", () => {
  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /alter table public\.expenses/i);
  assert.match(sql, /drop constraint if exists expenses_amount_check/i);
  assert.doesNotMatch(sql, /add constraint .*amount.*>=\s*0/i);
});
