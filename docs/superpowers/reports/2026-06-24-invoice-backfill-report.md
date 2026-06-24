# Invoice Expense Backfill Report

Date: 2026-06-24

## Matching Rule

Existing expenses were considered only when they matched a confirmed `invoice_drafts` row through an exact `source_line_key` or the existing `source_row_id` value. Date and merchant name were not used for grouping.

## Dry Run

- Safe one-to-one expense matches: 127
- Ambiguous expense matches: 0
- Candidate invoice groups: 72
- Fully reconciled invoice groups: 72
- Unreconciled invoice groups: 0
- Reconciled expense lines: 127

High-volume merchant sampling confirmed that each candidate group came from exact source keys. Examples included 17 invoices / 30 lines for 7-Eleven New Taipei branches and 4 invoices / 12 lines for Shopee.

## Applied Fields

The migration backfills only:

- `invoice_number`
- `original_amount`
- `line_type`
- `source_line_key`

It does not assign `payment_parent_expense_id` and does not rebuild existing payment schedules, bill estimates, or cash-flow totals. Existing financial effects remain unchanged.

## Applied Result

The migration was applied to the production Supabase project on 2026-06-24.

- Backfilled expense lines: 127
- Backfilled invoice groups: 72
- Discount lines: 9
- Missing source keys: 0
- Invoice groups with amount mismatches: 0
- Unmatched confirmed draft lines: 0

## Safety Boundary

Rows with ambiguous source matches or invoice-level amount differences are skipped. No expenses are grouped from date or merchant similarity.