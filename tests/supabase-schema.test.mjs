import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '202606010001_initial_accounting_schema.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

const requiredTables = [
  'households',
  'household_members',
  'budget_groups',
  'budget_items',
  'payment_methods',
  'credit_cards',
  'expenses',
  'payment_schedules',
  'income_schedules',
  'expense_schedules',
  'credit_card_statements',
  'credit_card_bill_estimates',
  'cash_flow_months',
  'merchant_payment_rules',
  'merchant_item_rules',
  'invoice_import_batches',
  'invoice_drafts',
  'manual_import_batches',
  'budget_mapping_drafts',
  'migration_runs',
  'migration_issues',
];

const traceabilityFields = [
  'source_system',
  'source_table',
  'source_row_id',
  'legacy_id',
  'imported_at',
];

const tableBodies = new Map(
  [...sql.matchAll(/create table public\.([a-z_]+) \(([\s\S]*?)\n\);/g)].map(
    ([, table, body]) => [table, body],
  ),
);

function tableBody(table) {
  const body = tableBodies.get(table);
  assert.ok(body, `Expected table public.${table} to exist`);
  return body;
}

function assertColumn(table, column) {
  assert.match(
    tableBody(table),
    new RegExp(`(^|\\n)\\s*${column}\\s+`, 'm'),
    `Expected public.${table}.${column} to exist`,
  );
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function assertIndex(indexName, table, columns) {
  const expectedIndex = `create index ${indexName} on public.${table}(${columns});`;

  assert.ok(
    normalizeWhitespace(sql).includes(expectedIndex),
    `Expected ${expectedIndex}`,
  );
}

function assertTableForeignKey(table, foreignKey) {
  assert.ok(
    normalizeWhitespace(tableBody(table)).includes(foreignKey),
    `Expected public.${table} to include composite household foreign key: ${foreignKey}`,
  );
}

test('migration defines all required accounting tables', () => {
  assert.equal(tableBodies.size, requiredTables.length);

  for (const table of requiredTables) {
    assert.ok(tableBodies.has(table), `Missing public.${table}`);
  }
});

test('migrated tables keep source traceability columns', () => {
  const traceableTables = requiredTables.filter((table) => table !== 'household_members');

  for (const table of traceableTables) {
    for (const field of traceabilityFields) {
      assertColumn(table, field);
    }
  }
});

test('budget taxonomy fields are preserved', () => {
  assertColumn('budget_groups', 'annual_budget');
  assertColumn('budget_groups', 'monthly_budget');
  assertColumn('budget_groups', 'is_group_budget_enabled');
  assertColumn('budget_items', 'legacy_code');
  assertColumn('budget_items', 'legacy_name');
});

test('statement and estimate fields support actual and projected card bills', () => {
  assertColumn('credit_card_statements', 'actual_amount');
  assertColumn('credit_card_statements', 'statement_month');
  assertColumn('credit_card_statements', 'payment_due_date');
  assertColumn('credit_card_bill_estimates', 'estimated_bill_amount');
  assertColumn('credit_card_bill_estimates', 'bill_month');
});

test('month fields reject invalid calendar months', () => {
  const validMonthRegex = "'^[0-9]{4}-(0[1-9]|1[0-2])$'";
  const monthColumns = [
    ['expenses', 'budget_month'],
    ['payment_schedules', 'cash_flow_month'],
    ['income_schedules', 'income_month'],
    ['expense_schedules', 'start_month'],
    ['credit_card_statements', 'statement_month'],
    ['credit_card_bill_estimates', 'bill_month'],
    ['cash_flow_months', 'cash_flow_month'],
  ];

  for (const [table, column] of monthColumns) {
    assert.ok(
      normalizeWhitespace(tableBody(table)).includes(
        `${column} char(7) not null check (${column} ~ ${validMonthRegex})`,
      ),
      `Expected ${table}.${column} to use the valid month regex`,
    );
  }
});

test('all required tables enable row level security', () => {
  for (const table of requiredTables) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security;`),
      `Expected public.${table} to enable row level security`,
    );
  }
});

test('migration defines important lookup indexes', () => {
  const requiredIndexes = [
    [
      'idx_budget_items_household_group',
      'budget_items',
      'household_id, budget_group_id',
    ],
    [
      'idx_expenses_household_budget_month',
      'expenses',
      'household_id, budget_month',
    ],
    [
      'idx_expenses_household_status',
      'expenses',
      'household_id, status',
    ],
    [
      'idx_payment_schedules_household_month',
      'payment_schedules',
      'household_id, cash_flow_month',
    ],
    [
      'idx_payment_schedules_household_status',
      'payment_schedules',
      'household_id, payment_status',
    ],
    [
      'idx_income_schedules_household_month',
      'income_schedules',
      'household_id, income_month',
    ],
    [
      'idx_card_statements_household_month',
      'credit_card_statements',
      'household_id, statement_month',
    ],
    [
      'idx_bill_estimates_household_month',
      'credit_card_bill_estimates',
      'household_id, bill_month',
    ],
    [
      'idx_cash_flow_months_household_month',
      'cash_flow_months',
      'household_id, cash_flow_month',
    ],
    [
      'idx_invoice_drafts_household_status',
      'invoice_drafts',
      'household_id, review_status',
    ],
    [
      'idx_budget_mapping_drafts_household_status',
      'budget_mapping_drafts',
      'household_id, review_status',
    ],
    [
      'idx_migration_issues_run',
      'migration_issues',
      'migration_run_id, severity',
    ],
  ];

  for (const [indexName, table, columns] of requiredIndexes) {
    assertIndex(indexName, table, columns);
  }
});

test('household-scoped composite foreign keys protect cross-household references', () => {
  const requiredCompositeHouseholdFks = [
    [
      'budget_items',
      'foreign key (household_id, budget_group_id) references public.budget_groups(household_id, id)',
    ],
    [
      'expenses',
      'foreign key (household_id, budget_item_id) references public.budget_items(household_id, id)',
    ],
    [
      'expenses',
      'foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'payment_schedules',
      'foreign key (household_id, expense_id) references public.expenses(household_id, id)',
    ],
    [
      'payment_schedules',
      'foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'expense_schedules',
      'foreign key (household_id, budget_item_id) references public.budget_items(household_id, id)',
    ],
    [
      'expense_schedules',
      'foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'credit_card_statements',
      'foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'credit_card_bill_estimates',
      'foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'merchant_payment_rules',
      'foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'merchant_payment_rules',
      'foreign key (household_id, default_budget_item_id) references public.budget_items(household_id, id)',
    ],
    [
      'merchant_item_rules',
      'foreign key (household_id, budget_item_id) references public.budget_items(household_id, id)',
    ],
    [
      'invoice_drafts',
      'foreign key (household_id, batch_id) references public.invoice_import_batches(household_id, id)',
    ],
    [
      'invoice_drafts',
      'foreign key (household_id, suggested_credit_card_id) references public.credit_cards(household_id, id)',
    ],
    [
      'invoice_drafts',
      'foreign key (household_id, suggested_budget_item_id) references public.budget_items(household_id, id)',
    ],
    [
      'invoice_drafts',
      'foreign key (household_id, confirmed_expense_id) references public.expenses(household_id, id)',
    ],
    [
      'budget_mapping_drafts',
      'foreign key (household_id, confirmed_budget_group_id) references public.budget_groups(household_id, id)',
    ],
    [
      'budget_mapping_drafts',
      'foreign key (household_id, confirmed_budget_item_id) references public.budget_items(household_id, id)',
    ],
    [
      'migration_issues',
      'foreign key (household_id, migration_run_id) references public.migration_runs(household_id, id)',
    ],
  ];

  for (const [table, foreignKey] of requiredCompositeHouseholdFks) {
    assertTableForeignKey(table, foreignKey);
  }
});

test('payment tool type and card references stay consistent', () => {
  const expectedCheck = normalizeWhitespace(`
    check (
      (payment_tool_type = 'cash' and credit_card_id is null)
      or (payment_tool_type = 'credit_card' and credit_card_id is not null)
    )
  `);

  for (const table of [
    'expenses',
    'payment_schedules',
    'expense_schedules',
    'merchant_payment_rules',
  ]) {
    assert.ok(
      normalizeWhitespace(tableBody(table)).includes(expectedCheck),
      `Expected ${table} to require cash without card and credit_card with card`,
    );
  }
});

test('invoice draft suggested payment and card references preserve unknown state', () => {
  const expectedCheck = normalizeWhitespace(`
    check (
      (suggested_payment_tool_type is null and suggested_credit_card_id is null)
      or (suggested_payment_tool_type = 'cash' and suggested_credit_card_id is null)
      or (suggested_payment_tool_type = 'credit_card' and suggested_credit_card_id is not null)
    )
  `);

  assert.ok(
    normalizeWhitespace(tableBody('invoice_drafts')).includes(expectedCheck),
    'Expected invoice_drafts to allow unknown suggested payment/card and require cards only for credit_card suggestions',
  );
});
