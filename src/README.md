# Source Code Overview

This folder contains the current Accounting Automation implementation.

## Folders

- `apps-script/`: Google Apps Script Web App source. This is the deployed application layer.
- `core/`: Node-testable business logic mirrored from key Apps Script behavior.

## Current Scope

- invoice import into a pending review list;
- manual single-expense entry and manual batch import;
- payment schedule generation for cash, credit cards, and installments;
- monthly credit-card bill estimates from `PaymentSchedule`;
- income schedule creation and income status reconciliation;
- budget summary, budget lookup, cash-flow overview, recent expenses;
- merchant payment rules, merchant item rules, and duplicate invoice checks.
