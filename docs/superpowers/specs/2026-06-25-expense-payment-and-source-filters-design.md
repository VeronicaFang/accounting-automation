# Expense Payment And Source Filters Design

Date: 2026-06-25

## Goal

Improve the expense details page so users can:

1. Change the payment settings for an entire invoice.
2. Quickly distinguish invoice-imported expenses from all non-invoice expenses.
3. Search expenses across all stored months.

## Invoice Payment Editing

An invoice is one payment unit. Every item and discount line sharing the same
`household_id` and `invoice_number` must use the same payment settings.

The invoice summary row will provide:

- Payment tool: cash or credit card.
- Credit card selection when the payment tool is credit card.
- Installment count: 1, 3, 6, 12, 18, 24, 30, or 36.
- A save action for the entire invoice.

Item and discount rows will not display independent payment controls.

### Transaction Boundary

Changing an invoice payment setting must be atomic. A Supabase RPC will:

1. Lock and load every active expense line in the invoice group.
2. Validate that all lines belong to the authenticated household.
3. Reverse the existing invoice payment effects from payment schedules,
   credit-card bill estimates, and cash-flow months.
4. Update every invoice line to the new payment tool and credit card.
5. Recreate payment schedules using the invoice total and selected installment
   count.
6. Apply the new bill-estimate and cash-flow effects.
7. Commit all changes together.

If any step fails, the transaction rolls back and the existing payment data
remains unchanged.

Discount lines remain part of the invoice total. The rebuilt payment amount is
the sum of all active invoice lines after discounts.

## Source Filters

The expense details page will add two mutually exclusive quick-filter buttons:

- `發票匯入`: expenses with a non-empty `invoice_number`.
- `手動入帳`: every expense without an `invoice_number`.

`手動入帳` therefore includes single-entry expenses, fixed expenses, batch
imports, and any other non-invoice source. It is not limited to rows whose
`source_system` equals a particular value.

Clicking the active source button again clears the source filter. The source
filter combines with month, merchant tag, keyword, credit-card, and budget-item
filters.

## Month Filter

The month selector will retain the current default:

- Blank/default: current month and previous month.

It will add:

- `全部月份`: no month restriction.
- Existing individual month options.

When `全部月份` is selected, merchant and item keyword searches run across all
expense months stored in Supabase, not only the current year.

Bill and budget drilldown links will continue to apply their supplied month or
bill-month context. A user may explicitly change the month selector to
`全部月份` after entering the expense page.

## Data Loading

The expense repository currently loads all active expense records before
client-side filtering. The new filters will use that existing dataset:

- `invoice_number` determines the source category.
- A dedicated month-filter state distinguishes default, all months, and one
  selected month.

No schema change is required for source or month filtering.

## Error Handling

- Credit-card payment requires a selected credit card.
- Installment count is normalized to one of the supported values.
- Invoice groups with no active lines cannot be updated.
- Mixed or incomplete legacy invoice groups are rejected rather than partially
  updated.
- RPC failures are shown on the invoice summary row and do not change the local
  displayed payment setting.
- The page reloads expense, bill, and cash-flow data after a successful update.

## Test Coverage

Automated tests will cover:

- Source classification by presence or absence of `invoice_number`.
- Source filter mutual exclusion and clearing.
- Default two-month filtering.
- All-month filtering across different years.
- Combination of source, keyword, month, card, and budget filters.
- Invoice payment update input validation.
- Cash-to-card, card-to-cash, card-to-different-card, and installment-count
  changes.
- Discount-inclusive invoice totals.
- Rollback behavior when payment reconstruction fails.

Production verification will cover:

1. An invoice summary payment change updates every child line.
2. The corresponding bill drilldown and cash-flow month show the rebuilt
   amounts.
3. `發票匯入` shows only invoice groups.
4. `手動入帳` shows every row without an invoice number.
5. `全部月份` finds expenses outside the current and previous month.
