import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const migrationPath = "supabase/migrations/202606010002_auth_household_rls.sql";

const householdScopedTables = [
  "household_members",
  "budget_groups",
  "budget_items",
  "payment_methods",
  "credit_cards",
  "expenses",
  "payment_schedules",
  "income_schedules",
  "expense_schedules",
  "credit_card_statements",
  "credit_card_bill_estimates",
  "cash_flow_months",
  "merchant_payment_rules",
  "merchant_item_rules",
  "invoice_import_batches",
  "invoice_drafts",
  "manual_import_batches",
  "budget_mapping_drafts",
  "migration_runs",
  "migration_issues"
];

function migrationSql() {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);
  return readFileSync(migrationPath, "utf8");
}

test("RLS migration creates private auth helper functions", () => {
  const sql = migrationSql();

  assert.match(sql, /create schema if not exists app_private/i);
  assert.match(sql, /create or replace function app_private\.is_household_member/i);
  assert.match(sql, /create or replace function app_private\.is_household_owner/i);
  assert.match(sql, /security definer/i);
  assert.doesNotMatch(sql, /create or replace function public\.[a-z_]+.*security definer/is);
});

test("RLS migration provisions a household for each new auth user", () => {
  const sql = migrationSql();

  assert.match(sql, /create or replace function app_private\.handle_new_user_accounting_household/i);
  assert.match(sql, /after insert on auth\.users/i);
  assert.match(sql, /insert into public\.households/i);
  assert.match(sql, /insert into public\.household_members/i);
  assert.match(sql, /insert into public\.household_members[\s\S]+values\s+\([^;]+,\s*'owner'/i);
});

test("RLS migration grants authenticated access without anon table grants", () => {
  const sql = migrationSql();

  assert.match(sql, /grant select, insert, update, delete on all tables in schema public to authenticated/i);
  assert.doesNotMatch(sql, /grant select, insert, update, delete on all tables in schema public to anon/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("RLS migration creates household policies for all household-owned tables", () => {
  const sql = migrationSql();

  assert.match(sql, /create policy household_select on public\.households/i);
  assert.match(sql, /create policy household_owner_update on public\.households/i);

  householdScopedTables.forEach((tableName) => {
    assert.match(sql, new RegExp(`create policy ${tableName}_member_select on public\\.${tableName}`, "i"));
    assert.match(sql, new RegExp(`create policy ${tableName}_member_insert on public\\.${tableName}`, "i"));
    assert.match(sql, new RegExp(`create policy ${tableName}_member_update on public\\.${tableName}`, "i"));
    assert.match(sql, new RegExp(`create policy ${tableName}_member_delete on public\\.${tableName}`, "i"));
  });
});
