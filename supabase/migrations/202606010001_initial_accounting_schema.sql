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
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
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
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, name)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_group_id uuid not null,
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
  legacy_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, budget_group_id, name),
  foreign key (household_id, budget_group_id) references public.budget_groups(household_id, id)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tool_type public.payment_tool_type not null,
  name text not null,
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
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
  legacy_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, name)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  consumption_date date not null,
  budget_month char(7) not null check (budget_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  merchant_tax_id text,
  merchant_name text,
  item_description text not null,
  budget_item_id uuid not null,
  legacy_budget_item text,
  amount numeric(14, 2) not null check (amount >= 0),
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid,
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
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, budget_item_id) references public.budget_items(household_id, id),
  foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id),
  check (
    (payment_tool_type = 'cash' and credit_card_id is null)
    or (payment_tool_type = 'credit_card' and credit_card_id is not null)
  )
);

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid,
  payment_sequence integer not null default 1,
  payment_date date not null,
  cash_flow_month char(7) not null check (cash_flow_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  payment_amount numeric(14, 2) not null check (payment_amount >= 0),
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid,
  payment_status public.payment_status not null default 'estimated',
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, expense_id) references public.expenses(household_id, id),
  foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id),
  check (
    (payment_tool_type = 'cash' and credit_card_id is null)
    or (payment_tool_type = 'credit_card' and credit_card_id is not null)
  )
);

create table public.income_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  income_date date not null,
  income_month char(7) not null check (income_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
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
  start_month char(7) not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  repeat_count integer not null check (repeat_count >= 1),
  amount numeric(14, 2) not null check (amount >= 0),
  merchant_name text,
  item_description text not null,
  budget_item_id uuid not null,
  payment_tool_type public.payment_tool_type not null,
  credit_card_id uuid,
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, budget_item_id) references public.budget_items(household_id, id),
  foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id),
  check (
    (payment_tool_type = 'cash' and credit_card_id is null)
    or (payment_tool_type = 'credit_card' and credit_card_id is not null)
  )
);

create table public.credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  credit_card_id uuid not null,
  statement_month char(7) not null check (statement_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
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
  unique (household_id, credit_card_id, statement_month),
  foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)
);

create table public.credit_card_bill_estimates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  credit_card_id uuid not null,
  bill_month char(7) not null check (bill_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  billing_period_start date,
  billing_period_end date,
  estimated_payment_date date,
  estimated_bill_amount numeric(14, 2) not null default 0,
  detail_count integer not null default 0,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  generated_at timestamptz not null default now(),
  unique (household_id, credit_card_id, bill_month),
  foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id)
);

create table public.cash_flow_months (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  cash_flow_month char(7) not null check (cash_flow_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  opening_balance numeric(14, 2),
  income_total numeric(14, 2) not null default 0,
  cash_expense_total numeric(14, 2) not null default 0,
  credit_card_payment_total numeric(14, 2) not null default 0,
  net_cash_flow numeric(14, 2) not null default 0,
  ending_balance numeric(14, 2),
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
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
  credit_card_id uuid,
  default_budget_item_id uuid,
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, credit_card_id) references public.credit_cards(household_id, id),
  foreign key (household_id, default_budget_item_id) references public.budget_items(household_id, id),
  check (
    (payment_tool_type = 'cash' and credit_card_id is null)
    or (payment_tool_type = 'credit_card' and credit_card_id is not null)
  ),
  check (merchant_tax_id is not null or merchant_name_contains is not null)
);

create table public.merchant_item_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_tax_id text,
  merchant_name_contains text,
  item_keyword_contains text not null,
  budget_item_id uuid not null,
  is_active boolean not null default true,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, budget_item_id) references public.budget_items(household_id, id),
  check (merchant_tax_id is not null or merchant_name_contains is not null)
);

create table public.invoice_import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_system text not null default 'finance_ministry_invoice',
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  file_name text,
  imported_by uuid references auth.users(id),
  row_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  batch_id uuid,
  source_line_key text not null,
  consumption_date date not null,
  merchant_tax_id text,
  merchant_name text,
  item_description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  suggested_payment_tool_type public.payment_tool_type,
  suggested_credit_card_id uuid,
  check (
    (suggested_payment_tool_type is null and suggested_credit_card_id is null)
    or (suggested_payment_tool_type = 'cash' and suggested_credit_card_id is null)
    or (suggested_payment_tool_type = 'credit_card' and suggested_credit_card_id is not null)
  ),
  suggested_budget_item_id uuid,
  legacy_suggested_budget_item text,
  review_status public.review_status not null default 'needs_review',
  confirmed_expense_id uuid,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, source_line_key),
  foreign key (household_id, batch_id) references public.invoice_import_batches(household_id, id),
  foreign key (household_id, suggested_credit_card_id) references public.credit_cards(household_id, id),
  foreign key (household_id, suggested_budget_item_id) references public.budget_items(household_id, id),
  foreign key (household_id, confirmed_expense_id) references public.expenses(household_id, id)
);

create table public.manual_import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  imported_by uuid references auth.users(id),
  row_count integer not null default 0,
  review_status public.review_status not null default 'draft',
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.budget_mapping_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_budget_item text not null,
  suggested_group_name text not null,
  suggested_item_name text not null,
  confirmed_budget_group_id uuid,
  confirmed_budget_item_id uuid,
  review_status public.review_status not null default 'needs_review',
  confidence numeric(5, 2) not null default 0,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, legacy_budget_item),
  foreign key (household_id, confirmed_budget_group_id) references public.budget_groups(household_id, id),
  foreign key (household_id, confirmed_budget_item_id) references public.budget_items(household_id, id)
);

create table public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_system text not null default 'google_sheets',
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.migration_status not null default 'started',
  summary jsonb not null default '{}'::jsonb,
  unique (household_id, id)
);

create table public.migration_issues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  migration_run_id uuid,
  severity public.migration_issue_severity not null default 'warning',
  issue_type text not null,
  source_system text,
  source_table text,
  source_row_id text,
  legacy_id text,
  imported_at timestamptz,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (household_id, migration_run_id) references public.migration_runs(household_id, id) on delete cascade
);

create index idx_household_members_user on public.household_members(user_id);
create index idx_budget_groups_household on public.budget_groups(household_id);
create index idx_budget_items_household_group on public.budget_items(household_id, budget_group_id);
create index idx_payment_methods_household_type on public.payment_methods(household_id, tool_type);
create index idx_credit_cards_household_active on public.credit_cards(household_id, is_active);
create index idx_expenses_household_budget_month on public.expenses(household_id, budget_month);
create index idx_expenses_household_status on public.expenses(household_id, status);
create index idx_expenses_household_budget_item on public.expenses(household_id, budget_item_id);
create index idx_payment_schedules_household_month on public.payment_schedules(household_id, cash_flow_month);
create index idx_payment_schedules_household_status on public.payment_schedules(household_id, payment_status);
create index idx_payment_schedules_expense on public.payment_schedules(expense_id);
create index idx_income_schedules_household_month on public.income_schedules(household_id, income_month);
create index idx_income_schedules_household_status on public.income_schedules(household_id, income_status);
create index idx_expense_schedules_household_start_month on public.expense_schedules(household_id, start_month);
create index idx_card_statements_household_month on public.credit_card_statements(household_id, statement_month);
create index idx_card_statements_household_status on public.credit_card_statements(household_id, statement_status);
create index idx_bill_estimates_household_month on public.credit_card_bill_estimates(household_id, bill_month);
create index idx_cash_flow_months_household_month on public.cash_flow_months(household_id, cash_flow_month);
create index idx_merchant_payment_rules_household_active on public.merchant_payment_rules(household_id, is_active);
create index idx_merchant_item_rules_household_active on public.merchant_item_rules(household_id, is_active);
create index idx_invoice_batches_household on public.invoice_import_batches(household_id);
create index idx_invoice_drafts_household_status on public.invoice_drafts(household_id, review_status);
create index idx_manual_import_batches_household_status on public.manual_import_batches(household_id, review_status);
create index idx_budget_mapping_drafts_household_status on public.budget_mapping_drafts(household_id, review_status);
create index idx_migration_runs_household_status on public.migration_runs(household_id, status);
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
