# Supabase Schema Migration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Supabase schema and migration foundation for the accounting app while keeping the current Google Sheet MVP untouched.

**Architecture:** Add a Supabase migration folder with product-oriented tables, source traceability columns, conservative review gates, Budget Taxonomy v2, real credit card statements, and migration diagnostics. Add local Node tests that validate the SQL contract and add small pure-core helpers for mapping drafts and actual-vs-estimated card bill behavior.

**Tech Stack:** Supabase Postgres SQL, Node.js built-in test runner, existing `src/core/*.mjs` pure functions, Markdown docs.

---

## Scope Boundaries

This plan only creates the Supabase schema and migration foundation. It must not change the current Apps Script UI, must not deploy Apps Script, and must not push GitHub.

The current Google Sheet source of truth remains active until a later dual-track import plan is implemented.

## File Structure

Create or modify these files:

- Create `supabase/migrations/202606010001_initial_accounting_schema.sql`
  - Owns the first Supabase schema.
  - Defines enums, account/household tables, budget taxonomy tables, expense/income/payment tables, bill tables, import/migration tables, indexes, and RLS enablement.
- Create `src/core/budget-taxonomy.mjs`
  - Owns legacy budget item parsing and mapping draft generation.
  - Has no Supabase dependency.
- Create `src/core/card-statements.mjs`
  - Owns pure estimated-vs-actual statement comparison and cash-flow amount selection.
  - Has no Supabase dependency.
- Create `tests/supabase-schema.test.mjs`
  - Verifies the SQL migration contains required tables, traceability fields, foreign keys, indexes, and RLS enablement.
- Create `tests/budget-taxonomy.test.mjs`
  - Verifies legacy item parsing and mapping draft behavior.
- Create `tests/card-statements.test.mjs`
  - Verifies actual statement override behavior and bill variance calculation.
- Modify `docs/data-model.md`
  - Add a UTF-8 section at the top or bottom that links the old Google Sheet model to the new Supabase schema without rewriting the existing document.
- Modify `docs/product-development-guide.md`
  - Add a short UTF-8 section noting that Supabase/Vercel is a planned dual-track migration, not the current deployed system.

## Task 1: Add Initial Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/202606010001_initial_accounting_schema.sql`
- Test later: `tests/supabase-schema.test.mjs`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/202606010001_initial_accounting_schema.sql` with this content:

```sql
create extension if not exists "pgcrypto";

create type public.household_role as enum ('owner', 'member', 'viewer');
create type public.payment_tool_type as enum ('cash', 'credit_card');
create type public.record_status as enum ('active', 'cancelled');
create type public.review_status as enum ('draft', 'needs_review', 'confirmed', 'deleted');
create type public.payment_status as enum ('estimated', 'reconciled', 'paid', 'corrected', 'offset');
create type public.income_status as enum ('estimated', 'received', 'corrected');
create type public.statement_status as enum ('missing', 'entered', 'reconciled', 'ignored');
create type public.migration_status as enum ('started', 'completed', 'failed');
create type public.migration_issue_severity as enum ('info', 'warning', 'error');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null default 'owner',
  display_name text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.budget_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  annual_budget numeric(14, 2),
  monthly_budget numeric(14, 2),
  is_group_budget_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_group_id uuid not null references public.budget_groups(id),
  name text not null,
  display_order integer not null default 0,
  annual_budget numeric(14, 2) not null default 0,
  month_01 numeric(14, 2) not null default 0,
  month_02 numeric(14, 2) not null default 0,
  month_03 numeric(14, 2) not null default 0,
  month_04 numeric(14, 2) not null default 0,
  month_05 numeric(14, 2) not null default 0,
  month_06 numeric(14, 2) not null default 0,
  month_07 numeric(14, 2) not null default 0,
  month_08 numeric(14, 2) not null default 0,
  month_09 numeric(14, 2) not null default 0,
  month_10 numeric(14, 2) not null default 0,
  month_11 numeric(14, 2) not null default 0,
  month_12 numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  legacy_code integer,
  legacy_name text,
  source_system text,
  source_table text,
  source_row_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, budget_group_id, name)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tool_type public.payment_tool_type not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, tool_type, name)
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  card_group text,
  cutoff_day integer not null check (cutoff_day between 1 and 31),
  payment_day integer not null check (payment_day between 1 and 31),
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  consumption_date date not null,
  budget_month char(7) not null check (budget_month ~ '^[0-9]{4}-[0-9]{2}$'),
  merchant_tax_id text,
  merchant_name text,
  item_description text not null,
  budget_item_id uuid not null references public.budget_items(id),
  legacy_budget_item text,
  amount numeric(14, 2) not null check (amount >= 0),
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid references public.credit_cards(id),
  is_installment boolean not null default false,
  installment_count integer not null default 1 check (installment_count >= 1),
  status public.record_status not null default 'active',
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete set null,
  payment_sequence integer not null default 1,
  payment_date date not null,
  cash_flow_month char(7) not null check (cash_flow_month ~ '^[0-9]{4}-[0-9]{2}$'),
  payment_amount numeric(14, 2) not null check (payment_amount >= 0),
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid references public.credit_cards(id),
  payment_status public.payment_status not null default 'estimated',
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.income_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  income_date date not null,
  income_month char(7) not null check (income_month ~ '^[0-9]{4}-[0-9]{2}$'),
  income_item text not null,
  income_amount numeric(14, 2) not null check (income_amount >= 0),
  income_status public.income_status not null default 'estimated',
  source text,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  schedule_name text not null,
  day_of_month integer not null check (day_of_month between 1 and 31),
  start_month char(7) not null check (start_month ~ '^[0-9]{4}-[0-9]{2}$'),
  repeat_count integer not null check (repeat_count >= 1),
  amount numeric(14, 2) not null check (amount >= 0),
  merchant_name text,
  item_description text not null,
  budget_item_id uuid not null references public.budget_items(id),
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid references public.credit_cards(id),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  credit_card_id uuid not null references public.credit_cards(id),
  statement_month char(7) not null check (statement_month ~ '^[0-9]{4}-[0-9]{2}$'),
  payment_due_date date not null,
  actual_amount numeric(14, 2) not null check (actual_amount >= 0),
  statement_status public.statement_status not null default 'entered',
  source text,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, credit_card_id, statement_month)
);

create table public.credit_card_bill_estimates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id),
  bill_month char(7) not null check (bill_month ~ '^[0-9]{4}-[0-9]{2}$'),
  billing_period_start date,
  billing_period_end date,
  estimated_payment_date date,
  estimated_bill_amount numeric(14, 2) not null default 0,
  detail_count integer not null default 0,
  generated_at timestamptz not null default now(),
  unique (household_id, credit_card_id, bill_month)
);

create table public.cash_flow_months (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  cash_flow_month char(7) not null check (cash_flow_month ~ '^[0-9]{4}-[0-9]{2}$'),
  opening_balance numeric(14, 2),
  income_total numeric(14, 2) not null default 0,
  cash_expense_total numeric(14, 2) not null default 0,
  credit_card_payment_total numeric(14, 2) not null default 0,
  net_cash_flow numeric(14, 2) not null default 0,
  ending_balance numeric(14, 2),
  generated_at timestamptz not null default now(),
  unique (household_id, cash_flow_month)
);

create table public.merchant_payment_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_tax_id text,
  merchant_name_contains text,
  merchant_display_name text,
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid references public.credit_cards(id),
  default_budget_item_id uuid references public.budget_items(id),
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merchant_tax_id is not null or merchant_name_contains is not null)
);

create table public.merchant_item_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_tax_id text,
  merchant_name_contains text,
  item_keyword_contains text not null,
  budget_item_id uuid not null references public.budget_items(id),
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merchant_tax_id is not null or merchant_name_contains is not null)
);

create table public.invoice_import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_system text not null default 'finance_ministry_invoice',
  file_name text,
  imported_by uuid references auth.users(id),
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  batch_id uuid references public.invoice_import_batches(id) on delete set null,
  source_line_key text not null,
  consumption_date date not null,
  merchant_tax_id text,
  merchant_name text,
  item_description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  suggested_payment_tool_type public.payment_tool_type,
  suggested_credit_card_id uuid references public.credit_cards(id),
  suggested_budget_item_id uuid references public.budget_items(id),
  legacy_suggested_budget_item text,
  review_status public.review_status not null default 'needs_review',
  confirmed_expense_id uuid references public.expenses(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, source_line_key)
);

create table public.manual_import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  imported_by uuid references auth.users(id),
  row_count integer not null default 0,
  review_status public.review_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.budget_mapping_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_budget_item text not null,
  suggested_group_name text not null,
  suggested_item_name text not null,
  confirmed_budget_group_id uuid references public.budget_groups(id),
  confirmed_budget_item_id uuid references public.budget_items(id),
  review_status public.review_status not null default 'needs_review',
  confidence numeric(5, 2) not null default 0,
  source_system text,
  source_table text,
  source_row_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, legacy_budget_item)
);

create table public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_system text not null default 'google_sheets',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.migration_status not null default 'started',
  summary jsonb not null default '{}'::jsonb
);

create table public.migration_issues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  migration_run_id uuid references public.migration_runs(id) on delete cascade,
  severity public.migration_issue_severity not null default 'warning',
  issue_type text not null,
  source_table text,
  source_row_id text,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_budget_items_household_group on public.budget_items(household_id, budget_group_id);
create index idx_expenses_household_budget_month on public.expenses(household_id, budget_month);
create index idx_expenses_household_budget_item on public.expenses(household_id, budget_item_id);
create index idx_payment_schedules_household_month on public.payment_schedules(household_id, cash_flow_month);
create index idx_payment_schedules_expense on public.payment_schedules(expense_id);
create index idx_income_schedules_household_month on public.income_schedules(household_id, income_month);
create index idx_card_statements_household_month on public.credit_card_statements(household_id, statement_month);
create index idx_bill_estimates_household_month on public.credit_card_bill_estimates(household_id, bill_month);
create index idx_invoice_drafts_household_status on public.invoice_drafts(household_id, review_status);
create index idx_budget_mapping_drafts_household_status on public.budget_mapping_drafts(household_id, review_status);
create index idx_migration_issues_run on public.migration_issues(migration_run_id, severity);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.budget_groups enable row level security;
alter table public.budget_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.credit_cards enable row level security;
alter table public.expenses enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.income_schedules enable row level security;
alter table public.expense_schedules enable row level security;
alter table public.credit_card_statements enable row level security;
alter table public.credit_card_bill_estimates enable row level security;
alter table public.cash_flow_months enable row level security;
alter table public.merchant_payment_rules enable row level security;
alter table public.merchant_item_rules enable row level security;
alter table public.invoice_import_batches enable row level security;
alter table public.invoice_drafts enable row level security;
alter table public.manual_import_batches enable row level security;
alter table public.budget_mapping_drafts enable row level security;
alter table public.migration_runs enable row level security;
alter table public.migration_issues enable row level security;
```

- [ ] **Step 2: Commit the migration**

Run:

```powershell
git add supabase/migrations/202606010001_initial_accounting_schema.sql
git commit -m "feat: add initial supabase accounting schema"
```

Expected: a local commit is created. Do not run `git push`.

## Task 2: Add SQL Contract Tests

**Files:**
- Create: `tests/supabase-schema.test.mjs`
- Test: `tests/supabase-schema.test.mjs`

- [ ] **Step 1: Write the failing schema contract test**

Create `tests/supabase-schema.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/202606010001_initial_accounting_schema.sql", "utf8");

function expectTable(name) {
  assert.match(sql, new RegExp(`create table public\\.${name} \\(`));
}

function expectColumn(tableName, columnName) {
  const start = sql.indexOf(`create table public.${tableName} (`);
  assert.notEqual(start, -1, `missing table ${tableName}`);
  const end = sql.indexOf(");", start);
  const body = sql.slice(start, end);
  assert.match(body, new RegExp(`\\b${columnName}\\b`), `missing ${tableName}.${columnName}`);
}

test("initial Supabase schema defines all product tables", () => {
  [
    "households",
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
    "migration_issues",
  ].forEach(expectTable);
});

test("migrated core tables preserve Google Sheet traceability", () => {
  ["budget_items", "credit_cards", "expenses", "payment_schedules", "income_schedules"].forEach((tableName) => {
    ["source_system", "source_table", "source_row_id", "imported_at"].forEach((columnName) => {
      expectColumn(tableName, columnName);
    });
  });
});

test("budget taxonomy keeps legacy names and reserves group budget support without enforcing it", () => {
  expectColumn("budget_items", "legacy_code");
  expectColumn("budget_items", "legacy_name");
  expectColumn("budget_groups", "annual_budget");
  expectColumn("budget_groups", "monthly_budget");
  expectColumn("budget_groups", "is_group_budget_enabled");
});

test("real card statements and bill estimates support actual-over-estimated cash flow", () => {
  expectColumn("credit_card_statements", "actual_amount");
  expectColumn("credit_card_statements", "statement_month");
  expectColumn("credit_card_bill_estimates", "estimated_bill_amount");
  expectColumn("credit_card_bill_estimates", "bill_month");
});

test("important month columns reject malformed month keys", () => {
  assert.match(sql, /budget_month char\(7\) not null check \(budget_month ~ '\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'\)/);
  assert.match(sql, /cash_flow_month char\(7\) not null check \(cash_flow_month ~ '\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'\)/);
  assert.match(sql, /statement_month char\(7\) not null check \(statement_month ~ '\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'\)/);
});

test("all public tables in the migration enable RLS", () => {
  const tableMatches = [...sql.matchAll(/create table public\.([a-z_]+) \(/g)].map((match) => match[1]);
  for (const tableName of tableMatches) {
    assert.match(sql, new RegExp(`alter table public\\.${tableName} enable row level security;`), `missing RLS for ${tableName}`);
  }
});
```

- [ ] **Step 2: Run the schema contract test**

Run:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\supabase-schema.test.mjs
```

Expected: PASS after Task 1 exists. If it fails, fix the SQL or the test expectation rather than weakening the schema requirement.

- [ ] **Step 3: Commit the schema test**

Run:

```powershell
git add tests/supabase-schema.test.mjs
git commit -m "test: cover supabase schema contract"
```

Expected: a local commit is created. Do not run `git push`.

## Task 3: Add Budget Taxonomy Mapping Helpers

**Files:**
- Create: `src/core/budget-taxonomy.mjs`
- Create: `tests/budget-taxonomy.test.mjs`

- [ ] **Step 1: Write the failing budget taxonomy tests**

Create `tests/budget-taxonomy.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildBudgetMappingDrafts, parseLegacyBudgetItem } from "../src/core/budget-taxonomy.mjs";

test("parseLegacyBudgetItem separates numeric legacy code from display name", () => {
  assert.deepEqual(parseLegacyBudgetItem("24. 餐費"), {
    legacy_code: 24,
    legacy_name: "24. 餐費",
    item_name: "餐費",
  });
});

test("parseLegacyBudgetItem keeps non-coded names traceable", () => {
  assert.deepEqual(parseLegacyBudgetItem("預算總額"), {
    legacy_code: null,
    legacy_name: "預算總額",
    item_name: "預算總額",
  });
});

test("buildBudgetMappingDrafts creates review-gated mapping suggestions", () => {
  const rows = [
    { budget_item: "01. 老公家用", is_valid_expense_item: true },
    { budget_item: "13. 動動用品與衣物", is_valid_expense_item: "TRUE" },
    { budget_item: "24. 餐費", is_valid_expense_item: true },
    { budget_item: "預算總額", is_valid_expense_item: false },
  ];

  assert.deepEqual(buildBudgetMappingDrafts(rows), [
    {
      legacy_budget_item: "01. 老公家用",
      legacy_code: 1,
      suggested_group_name: "家人",
      suggested_item_name: "老公家用",
      review_status: "needs_review",
      confidence: 90,
    },
    {
      legacy_budget_item: "13. 動動用品與衣物",
      legacy_code: 13,
      suggested_group_name: "小孩",
      suggested_item_name: "動動用品與衣物",
      review_status: "needs_review",
      confidence: 90,
    },
    {
      legacy_budget_item: "24. 餐費",
      legacy_code: 24,
      suggested_group_name: "家庭生活",
      suggested_item_name: "餐費",
      review_status: "needs_review",
      confidence: 80,
    },
  ]);
});
```

- [ ] **Step 2: Run the taxonomy test and verify it fails**

Run:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\budget-taxonomy.test.mjs
```

Expected: FAIL because `src/core/budget-taxonomy.mjs` does not exist yet.

- [ ] **Step 3: Implement the mapping helper**

Create `src/core/budget-taxonomy.mjs`:

```js
const GROUP_RULES = [
  { group: "家人", patterns: ["老公", "家用"] },
  { group: "小孩", patterns: ["動動", "小孩"] },
  { group: "家庭生活", patterns: ["餐費", "日常", "用品"] },
  { group: "旅遊休閒", patterns: ["旅遊", "露營", "奢侈", "娛樂"] },
];

export function parseLegacyBudgetItem(value) {
  const legacyName = String(value || "").trim();
  const match = legacyName.match(/^(\d+)\.\s*(.+)$/);
  if (!match) {
    return {
      legacy_code: null,
      legacy_name: legacyName,
      item_name: legacyName,
    };
  }
  return {
    legacy_code: Number(match[1]),
    legacy_name: legacyName,
    item_name: match[2].trim(),
  };
}

export function buildBudgetMappingDrafts(rows) {
  return rows
    .filter((row) => isValidExpenseItem(row.is_valid_expense_item))
    .map((row) => {
      const parsed = parseLegacyBudgetItem(row.budget_item);
      const groupMatch = GROUP_RULES.find((rule) => rule.patterns.some((pattern) => parsed.item_name.includes(pattern)));
      return {
        legacy_budget_item: parsed.legacy_name,
        legacy_code: parsed.legacy_code,
        suggested_group_name: groupMatch?.group || "待整理",
        suggested_item_name: parsed.item_name,
        review_status: "needs_review",
        confidence: groupMatch ? (groupMatch.group === "家庭生活" ? 80 : 90) : 50,
      };
    });
}

function isValidExpenseItem(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}
```

- [ ] **Step 4: Run the taxonomy test and verify it passes**

Run:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\budget-taxonomy.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the taxonomy helper**

Run:

```powershell
git add src/core/budget-taxonomy.mjs tests/budget-taxonomy.test.mjs
git commit -m "feat: add budget taxonomy mapping drafts"
```

Expected: a local commit is created. Do not run `git push`.

## Task 4: Add Card Statement Comparison Helpers

**Files:**
- Create: `src/core/card-statements.mjs`
- Create: `tests/card-statements.test.mjs`

- [ ] **Step 1: Write the failing card statement tests**

Create `tests/card-statements.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { compareCardBill, getCashFlowCardPaymentAmount } from "../src/core/card-statements.mjs";

test("cash flow uses actual card statement when present", () => {
  assert.equal(getCashFlowCardPaymentAmount({
    estimated_amount: 11993,
    actual_amount: 30500,
  }), 30500);
});

test("cash flow falls back to estimated amount when actual statement is missing", () => {
  assert.equal(getCashFlowCardPaymentAmount({
    estimated_amount: 11993,
    actual_amount: null,
  }), 11993);
});

test("compareCardBill reports amount and percentage variance", () => {
  assert.deepEqual(compareCardBill({
    bill_month: "2026-05",
    credit_card_name: "聯邦",
    estimated_amount: 11993,
    actual_amount: 30500,
  }), {
    bill_month: "2026-05",
    credit_card_name: "聯邦",
    estimated_amount: 11993,
    actual_amount: 30500,
    cash_flow_amount: 30500,
    difference_amount: 18507,
    difference_ratio: 18507 / 11993,
    status: "variance_warning",
  });
});

test("compareCardBill marks missing actual statements as estimated only", () => {
  assert.deepEqual(compareCardBill({
    bill_month: "2026-06",
    credit_card_name: "玉山",
    estimated_amount: 14432,
    actual_amount: null,
  }), {
    bill_month: "2026-06",
    credit_card_name: "玉山",
    estimated_amount: 14432,
    actual_amount: null,
    cash_flow_amount: 14432,
    difference_amount: null,
    difference_ratio: null,
    status: "estimated_only",
  });
});
```

- [ ] **Step 2: Run the card statement test and verify it fails**

Run:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\card-statements.test.mjs
```

Expected: FAIL because `src/core/card-statements.mjs` does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `src/core/card-statements.mjs`:

```js
export function getCashFlowCardPaymentAmount({ estimated_amount = 0, actual_amount = null }) {
  if (actual_amount !== null && actual_amount !== undefined && actual_amount !== "") {
    return Number(actual_amount || 0);
  }
  return Number(estimated_amount || 0);
}

export function compareCardBill({ bill_month, credit_card_name, estimated_amount = 0, actual_amount = null }) {
  const estimated = Number(estimated_amount || 0);
  const hasActual = actual_amount !== null && actual_amount !== undefined && actual_amount !== "";
  const actual = hasActual ? Number(actual_amount || 0) : null;
  const cashFlowAmount = getCashFlowCardPaymentAmount({ estimated_amount: estimated, actual_amount: actual });

  if (!hasActual) {
    return {
      bill_month,
      credit_card_name,
      estimated_amount: estimated,
      actual_amount: null,
      cash_flow_amount: cashFlowAmount,
      difference_amount: null,
      difference_ratio: null,
      status: "estimated_only",
    };
  }

  const differenceAmount = actual - estimated;
  const differenceRatio = estimated > 0 ? differenceAmount / estimated : null;
  return {
    bill_month,
    credit_card_name,
    estimated_amount: estimated,
    actual_amount: actual,
    cash_flow_amount: cashFlowAmount,
    difference_amount: differenceAmount,
    difference_ratio: differenceRatio,
    status: Math.abs(differenceAmount) >= 1000 ? "variance_warning" : "matched",
  };
}
```

- [ ] **Step 4: Run the card statement test and verify it passes**

Run:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\card-statements.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the card statement helper**

Run:

```powershell
git add src/core/card-statements.mjs tests/card-statements.test.mjs
git commit -m "feat: add card statement comparison helpers"
```

Expected: a local commit is created. Do not run `git push`.

## Task 5: Document the Supabase Migration Foundation

**Files:**
- Modify: `docs/data-model.md`
- Modify: `docs/product-development-guide.md`

- [ ] **Step 1: Add the Supabase section to `docs/data-model.md`**

Append this UTF-8 section to the end of `docs/data-model.md`:

```md

## Supabase Migration Model v1

The current deployed MVP still uses Google Sheets as the operational data store. Supabase is the next-system schema and must preserve source traceability during the dual-track transition.

Supabase v1 uses product-oriented tables instead of copying Google Sheet tab names directly:

- `budget_groups` and `budget_items` replace the flat `BudgetItems` view while keeping `legacy_code` and `legacy_name`.
- `expenses`, `payment_schedules`, and `income_schedules` preserve the current accounting model: budget usage follows consumption date, cash flow follows payment date.
- `credit_card_bill_estimates` and `credit_card_statements` support estimated-vs-actual credit card bills. Cash flow uses actual statement amount when present and estimated amount otherwise.
- `budget_mapping_drafts` keeps old-to-new budget taxonomy migration review-gated.
- `migration_runs` and `migration_issues` record import and reconciliation results before switching daily use away from Google Sheets.

All migrated tables that carry Google Sheet data should preserve source fields such as `source_system`, `source_table`, `source_row_id`, `legacy_id`, and `imported_at` where applicable.
```

- [ ] **Step 2: Add the migration note to `docs/product-development-guide.md`**

Append this UTF-8 section to the end of `docs/product-development-guide.md`:

```md

## Supabase and Vercel Migration Direction

The next product direction is a dual-track transition:

- Keep the Google Apps Script and Google Sheet MVP running.
- Build Supabase as the next data foundation.
- Build the Vercel frontend around clearer product areas: Home, Expense Entry, Review Queue, Bill Center, Cash Flow, Budget, Rules, and Settings.
- Import and reconcile data before switching daily usage away from Google Sheets.

Payment schedules remain a low-level source for monthly bill estimates. The user-facing credit-card area is Bill Center, where estimated bills can later be compared with real credit card statements.

Budget Taxonomy v2 introduces `Budget Group / Budget Item` while keeping legacy budget names traceable. Old-to-new budget mapping must remain review-gated and must not silently rewrite official expense classifications.
```

- [ ] **Step 3: Run the existing core tests plus new tests**

Run:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\rules.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\budget.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\cash-flow.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\expenses.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\income.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\invoice-import.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\apps-script-config.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\supabase-schema.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\budget-taxonomy.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\card-statements.test.mjs
```

Expected: every command exits successfully.

- [ ] **Step 4: Commit the documentation**

Run:

```powershell
git add docs/data-model.md docs/product-development-guide.md
git commit -m "docs: describe supabase migration foundation"
```

Expected: a local commit is created. Do not run `git push`.

## Task 6: Final Verification and Handoff

**Files:**
- Verify: `supabase/migrations/202606010001_initial_accounting_schema.sql`
- Verify: `src/core/budget-taxonomy.mjs`
- Verify: `src/core/card-statements.mjs`
- Verify: `tests/supabase-schema.test.mjs`
- Verify: `tests/budget-taxonomy.test.mjs`
- Verify: `tests/card-statements.test.mjs`
- Verify: `docs/data-model.md`
- Verify: `docs/product-development-guide.md`

- [ ] **Step 1: Check git status**

Run:

```powershell
git status --short
```

Expected: clean working tree. If the design spec or plan file is still uncommitted because of earlier Git permission issues, include them in a docs commit before considering the work complete:

```powershell
git add docs\superpowers\specs\2026-06-01-supabase-vercel-ia-design.md docs\superpowers\plans\2026-06-01-supabase-schema-migration-foundation.md
git commit -m "docs: add supabase migration planning"
```

- [ ] **Step 2: Confirm no deployment or push happened**

Run:

```powershell
git log -5 --oneline
```

Expected: local commits exist, but no `git push`, `clasp push`, Apps Script deployment, or Supabase deployment has been run.

- [ ] **Step 3: Report to the user**

Use this format:

```md
已完成本機實作與測試。

本機 commits:
- <hash> feat: add initial supabase accounting schema
- <hash> test: cover supabase schema contract
- <hash> feat: add budget taxonomy mapping drafts
- <hash> feat: add card statement comparison helpers
- <hash> docs: describe supabase migration foundation

這次沒有部署 Apps Script、沒有部署 Supabase、沒有 push GitHub。

測試：
- Existing core tests: pass
- Supabase schema contract: pass
- Budget taxonomy mapping: pass
- Card statement comparison: pass

下一步建議：
1. Review Supabase schema fields.
2. Decide whether bill estimates should be materialized rows or computed views.
3. After confirmation, start the Vercel Frontend IA Shell plan.
```
