# Workflow

## Invoice Import

1. Import Ministry of Finance invoice details.
2. Keep seller tax ID, seller name, invoice date, invoice number, amount, and item name.
3. Suggest payment method from merchant payment rules.
4. Suggest budget item from merchant and item rules.
5. Mark low-confidence or ambiguous classifications as `needs_review`.
6. Confirm or edit payment method and budget item.
7. Write standardized expense records.
8. Generate payment schedules.

## Manual No-Invoice Expense

Manual entry requires:

- consumption date;
- purchase item;
- amount;
- channel;
- payment tool type;
- credit card name when applicable;
- installment flag;
- installment count.

The system suggests budget item from channel plus purchase item, but every manual no-invoice expense starts as `needs_review`.

## Reconciliation

1. Review payment schedules against credit-card statements or cash records.
2. If date and amount match, mark as `reconciled`.
3. If date or amount changes, edit the row and mark as `corrected`.
4. When money actually leaves the account, mark as `paid`.
5. Refunds, offsets, or cancelled payments are marked as `offset`.

## Cancelling Expense Records

Expense status supports:

- normal;
- cancelled.

When an expense is cancelled, the system asks whether linked payment schedule rows should also be changed to `offset`.

If synchronized:

- the expense is excluded from budget reports;
- linked payment schedules are excluded from cash-flow expense reports.

If not synchronized:

- the expense is excluded from budget reports;
- payment schedules retain their current state for exceptional real-world handling.

