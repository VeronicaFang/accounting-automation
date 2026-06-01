# Supabase and Vercel IA Design

Date: 2026-06-01

## Summary

This design defines the next product direction for the accounting automation MVP before moving from Google Apps Script and Google Sheets to Supabase and Vercel.

The migration will use a dual-track transition:

- Keep the current Google Sheet system running.
- Build the Supabase data model as the next source of truth.
- Build the Vercel frontend around clearer product areas.
- Import and reconcile data before switching daily usage away from Google Sheets.

The first implementation phase is design-first. It does not deploy Apps Script, push to GitHub, or replace the current MVP.

## Goals

- Make the frontend easier to understand for daily use.
- Separate user-facing concepts from internal process tables.
- Preserve current accounting rules: budget by consumption date, cash flow by payment date.
- Prepare for real credit card statements and estimated-vs-actual bill comparison.
- Introduce a two-level budget taxonomy without breaking existing budget history.
- Keep the first version private and single-user, while reserving schema support for household sharing.
- Keep Google Sheet traceability during migration.

## Non-Goals

- Do not immediately remove Google Sheets.
- Do not rewrite the current Apps Script MVP in this phase.
- Do not deploy a production Supabase or Vercel app in this phase.
- Do not build a multi-user household UI in the first version.
- Do not enable budget limits at the budget group level in the first version.
- Do not let rule learning silently change final classifications.
- Do not make payment schedules the primary user-facing page.

## Product IA

The Vercel frontend should use these top-level areas:

1. Home
2. Expense Entry
3. Review Queue
4. Bill Center
5. Cash Flow
6. Budget
7. Rules
8. Settings

### Home

Home is the daily starting point. It should not be a full function list.

The top section shows the current month:

- Opening balance
- Estimated ending balance
- Income
- Cash expenses
- Credit card payments
- Monthly net flow
- Budget warnings
- Bill tasks

The lower section is a task workbench:

- Pending invoice drafts
- Pending manual import drafts
- Missing real credit card statements
- Large estimated-vs-actual bill differences
- Income confirmations
- Overdue unpaid card payments
- Quick actions for expense, income, and fixed expense entry

### Expense Entry

Expense Entry is for creating records only. It should have three tabs:

- Single expense
- Monthly fixed expense
- Batch import

Budget preview for new expenses must continue to use the expense consumption month.

### Review Queue

Review Queue centralizes records that should not directly become official accounting data:

- Finance Ministry invoice drafts
- Manual batch import drafts
- Future rule-learning suggestions
- Future low-confidence classification suggestions

The core rule remains: imported data requires confirmation before it can affect official records.

### Bill Center

Bill Center replaces payment schedule as the main credit-card-facing area.

Users should primarily see monthly bill estimates by card, for example:

- May Federal card estimated bill
- June E.Sun card estimated bill

Only when a bill looks wrong should the user expand lower-level details.

Bill Center sections:

- Monthly bill estimates
- Real credit card statements
- Estimated vs actual difference
- Underlying payment schedule details

PaymentSchedule remains an internal source for bill estimate calculation and reconciliation.

### Cash Flow

Cash Flow answers whether cash is enough by month.

It should show:

- Opening balance
- Income
- Cash expenses
- Credit card payments
- Monthly net flow
- Ending balance

When a real credit card statement exists, cash flow uses the real statement amount. When it does not exist, cash flow uses the estimated card bill amount.

### Budget

Budget answers whether spending is still allowed.

It should include:

- Budget overview
- Pre-spend lookup
- Annual and monthly usage
- Budget Group and Budget Item management
- Budget mapping draft review

Budget usage remains based on consumption date.

### Rules

Rules make daily accounting easier over time.

It should include:

- Merchant payment rules
- Merchant item classification rules
- Rule learning suggestions
- Rule hit history

Rule learning remains conservative: suggestions require confirmation before changing final rules.

### Settings

Settings is for lower-frequency configuration:

- Opening balance
- Credit card cutoff and payment day rules
- Household settings
- Import and export
- Google Sheet migration status
- Supabase migration reports

## Supabase Schema Layers

The schema should not copy Google Sheet table names directly. It should use product-oriented names while preserving source traceability.

All migrated records that come from Google Sheets should keep fields such as:

- source_system
- source_table
- source_row_id
- legacy_id
- imported_at

### Layer 1: Account and Household

Tables:

- users
- households
- household_members

The first product version is private and single-user. Even so, core records should reserve user_id and household_id so family sharing can be added later without remigrating data.

### Layer 2: Master Data and Rules

Tables:

- budget_groups
- budget_items
- payment_methods
- credit_cards
- merchant_payment_rules
- merchant_item_rules

budget_items stores legacy_code and legacy_name so current Google Sheet budget items can be traced after migration.

### Layer 3: Daily Records

Tables:

- expenses
- income_schedules
- expense_schedules
- payment_schedules

expenses is the official spending table. payment_schedules is the detail table used to calculate bill estimates and cash flow timing.

### Layer 4: Bills and Cash Flow

Tables:

- credit_card_bill_estimates
- credit_card_statements
- cash_flow_months

credit_card_bill_estimates can be materialized or derived from payment_schedules. credit_card_statements stores real statement amounts entered by the user.

Cash flow should prefer credit_card_statements when available and fall back to credit_card_bill_estimates when the statement is not available.

### Layer 5: Import and Migration

Tables:

- invoice_import_batches
- invoice_drafts
- manual_import_batches
- migration_runs
- migration_issues
- budget_mapping_drafts

This layer supports the dual-track transition from Google Sheets to Supabase and gives the user a way to inspect differences before switching over.

## Budget Taxonomy v2

The new budget model uses two levels:

- Budget Group
- Budget Item

Examples:

- Family / Husband household support
- Child / Child personal growth
- Household Living / Meals
- Travel and Leisure / Domestic travel

The UI should display the new group and item labels. It should not display old item codes by default.

The database should preserve legacy fields:

- legacy_code
- legacy_name

For example:

- legacy_code: 24
- legacy_name: 24. 餐費
- display path: 家庭生活 / 餐費

### Budget Amount Scope

The first version stores budget amounts only on Budget Item.

Budget Group only aggregates child Budget Items. The schema may reserve fields for future group-level budget limits, but the first UI must not enforce group-level budget caps.

This avoids inconsistent two-level budget math during migration.

### Mapping Migration

Old budget items should be converted through a draft workflow:

1. Import old BudgetItems from Google Sheets.
2. Generate suggested Budget Group and Budget Item mappings.
3. Show mapping drafts for human review.
4. Apply confirmed mappings only.
5. Keep unconfirmed items out of final remapping.

No official expense classification should be changed by an unconfirmed mapping draft.

## Real Credit Card Statements

The future real statement feature is a first-class requirement, not an afterthought.

credit_card_statements should store:

- statement_id
- household_id
- user_id
- credit_card_id
- statement_month
- payment_due_date
- actual_amount
- statement_status
- source
- notes

Bill Center should compare:

- estimated bill amount from payment schedules
- actual statement amount from real credit card statements
- difference amount
- difference percentage

Cash Flow should use this priority:

1. Actual statement amount, if a statement exists for card and month.
2. Estimated bill amount, if no actual statement exists.

## Data Flow

### Expense to Bill Estimate

1. User enters or confirms an expense.
2. The system stores an official expense record.
3. The system creates payment schedule rows from payment method, installment count, and credit card rules.
4. Bill Center aggregates payment schedules by card and payment month.
5. Cash Flow uses the monthly card amount unless replaced by a real statement.

### Real Statement to Cash Flow

1. User enters a real credit card statement.
2. Bill Center compares actual and estimated amounts.
3. If the difference is large, Home shows a task.
4. Cash Flow uses the actual statement amount for that card and month.
5. Underlying payment schedule details remain available for investigation.

### Budget Mapping

1. The system imports legacy budget items.
2. The system creates mapping drafts.
3. The user confirms mappings.
4. Future expense entry and reporting use the new taxonomy.
5. Legacy names remain available for audit and migration reports.

## Error Handling and Reconciliation

Migration should never silently overwrite official data.

The system should record migration issues for:

- Missing required legacy fields
- Invalid dates or malformed months
- Budget item with no confirmed mapping
- Merchant rule with missing merchant identity
- Payment schedule without a linked expense
- Card bill estimate that does not match the imported source total
- Real credit card statement that differs significantly from estimate

The UI should treat these as workbench tasks, not hidden logs.

## Testing Strategy

Phase 1 is a design and planning phase, so testing is document review and consistency checking.

Later implementation should include:

- Schema migration tests for required fields and foreign keys
- Data import tests using sanitized Google Sheet exports
- Budget mapping draft tests
- Bill estimate aggregation tests
- Actual statement override tests for cash flow
- Frontend tests for Home, Bill Center, Cash Flow, Budget, and Review Queue

## Phase 1 Deliverables

Phase 1 should deliver:

- This IA and migration design spec
- A Supabase schema implementation plan
- A frontend IA implementation plan
- A migration and reconciliation implementation plan

Phase 1 should not deploy Apps Script or push to GitHub automatically.

## Open Follow-Up Decisions

These decisions are intentionally left for the implementation planning step:

- Exact Supabase RLS policies for private-first household data
- Whether bill estimates are stored as materialized rows or computed views
- Whether the first Vercel app imports from Google Sheets directly or from exported files
- Exact visual direction for the Vercel frontend
- Exact old-to-new budget mapping seed list
