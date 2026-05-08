# Google Apps Script MVP

This folder contains the first-version cloud website implementation.

## Manual Setup

1. Create a Google Sheet for the accounting database.
2. Open Extensions > Apps Script.
3. Copy each file from this folder into the Apps Script project.
4. Run `setupDatabase`.
5. Add valid budget item rows to the `BudgetItems` sheet.
6. Deploy as a web app.

## Deployment Settings

- Execute as: Me
- Who has access: Only myself
- Time zone: Asia/Taipei

## First-Version Limits

- Manual no-invoice expense entry is supported.
- Invoice import automation is not included yet.
- Merchant learning automation is not included yet.
- Beginning cash balance is not included yet.
