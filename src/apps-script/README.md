# Google Apps Script MVP

This folder contains the deployed cloud web app implementation for Accounting Automation.

For full product and maintenance context, read:

- `docs/product-development-guide.md`

## Current Features

The Apps Script web app currently supports:

- Google Sheet database setup via `setupDatabase()`;
- budget status dashboard;
- cash-flow overview;
- upcoming credit-card payment summary;
- recent expense list;
- single manual no-invoice expense entry;
- manual expense CSV / pasted batch import;
- Ministry of Finance invoice CSV / pasted import into a pending review list;
- pending invoice batch confirm, batch delete, and batch confirm plus merchant payment rule save;
- merchant payment rules with default budget item support;
- merchant + item budget classification rules;
- duplicate invoice import detection;
- invoice discount / zero amount / negative amount lines.

## Files

| File | Purpose |
|---|---|
| `Config.gs` | Spreadsheet ID, sheet names, headers, enums, initial merchant payment rules. |
| `Sheets.gs` | Sheet setup, header maintenance, generic read/write/update helpers. |
| `Rules.gs` | Date, month, card payment date, installment, budget status, merchant rule helpers. |
| `Budget.gs` | Budget item reads, budget summary, per-expense budget impact. |
| `Expenses.gs` | Manual expense creation, payment schedules, recent expenses, manual batch import. |
| `Income.gs` | Income creation, cash-flow overview, upcoming credit-card payment summary. |
| `InvoiceImport.gs` | Invoice import, pending drafts, duplicate detection, confirmation, deletion, history backfill. |
| `Code.gs` | Web app entrypoint and dashboard payload. |
| `Index.html` | Page structure. |
| `Client.html` | Frontend logic and calls to Apps Script server functions. |
| `Styles.html` | Styling. |

## Setup

1. Confirm `SPREADSHEET_ID` in `Config.gs` points to the intended Google Sheet.
2. Push this folder to Apps Script.
3. Run `setupDatabase()` from Apps Script or the Web App setup button.
4. Confirm the Google Sheet has the 10 formal tables listed in `Config.gs`.
5. Fill `BudgetItems` with valid budget rows.
6. Deploy as a web app.

## Deployment

Local source of truth is `src/apps-script/`.

The deployment staging folder is usually:

```powershell
C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github\temp-apps-script
```

After syncing `src/apps-script/` into `temp-apps-script/`, deploy with:

```powershell
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github\temp-apps-script"
clasp push --force
```

Then create a new Apps Script Web App deployment version if needed.

## Deployment Settings

- Execute as: Me
- Who has access: Only myself
- Time zone: Asia/Taipei

## Testing Notes

Business rules are also mirrored under `src/core/` and tested in `tests/`. Before changing Apps Script behavior, update or add local tests first, then keep Apps Script logic aligned.

Useful Apps Script debug functions:

- `debugGetDatabaseName()` in `Sheets.gs`
- `debugGetBudgetRows()` in `Sheets.gs`
- `debugGetDashboardData()` in `Code.gs`
- `debugImportInvoiceSample()` in `InvoiceImport.gs`
- `debugImportManualExpenseSample()` in `Expenses.gs`
- `debugBackfillImportedInvoiceSourceLineKeys()` in `InvoiceImport.gs`
- `debugBackfillExpenseRecordInvoiceSourceFields()` in `InvoiceImport.gs`

## Known Limits

- Beginning cash balance and bank account balances are not included yet.
- Payment reconciliation UI is not complete yet.
- Rule learning is partially supported through history tables and manual rule saving, but automatic 4-of-5 rule promotion still needs more implementation.
- Templates and older docs still need a later cleanup pass to fully match the current 10-sheet schema.
