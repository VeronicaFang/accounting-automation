import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const migrationPath = "supabase/migrations/202606020001_allow_payment_schedule_adjustments.sql";

test("payment schedule migration allows signed refund offset and correction adjustments", () => {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);

  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /alter table public\.payment_schedules/i);
  assert.match(sql, /drop constraint if exists payment_schedules_payment_amount_check/i);
  assert.doesNotMatch(sql, /add constraint .*payment_amount.*>=\s*0/i);
});
