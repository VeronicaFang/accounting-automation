# Accounting Automation

Personal accounting automation web app for separating budget control from cash-flow tracking.

## Start Here

工程師或 Agent 接手時，請先讀：

- [產品開發交接文件](docs/product-development-guide.md)

這份文件說明目前產品功能、Apps Script 架構、Google Sheet 10 張資料表、主要規則、部署方式與測試方式。

## Purpose

This project supports:

- importing Taiwan Ministry of Finance invoice details;
- entering single expenses without invoices;
- batch importing manual no-invoice shopping-cart style expenses;
- classifying expenses into budget items from the annual budget table;
- tracking credit-card payments, installments, and cash-flow timing;
- forecasting income and monthly net cash flow;
- keeping sensitive real accounting workbooks out of GitHub.

## Current Implementation

The current MVP is a Google Apps Script web app backed by Google Sheets.

- App source: `src/apps-script/`
- Locally testable core logic: `src/core/`
- Tests: `tests/`
- Deployment staging folder: `temp-apps-script/` using clasp

## Data Safety

Real Excel files, Google Sheet exports, and personal accounting data stay local and must not be committed.

The repository is intended for a private GitHub repo and contains only:

- product/development documentation;
- source code;
- rule/template examples;
- anonymized samples;
- local tests.

## Supporting Docs

These older docs remain useful as background, but the product handoff guide is the current source of truth for implementation status:

- [Requirements](docs/requirements.md)
- [Data Model](docs/data-model.md)
- [Workflow](docs/workflow.md)
- [Rules](docs/rules.md)
- [Reports](docs/reports.md)
- [Apps Script README](src/apps-script/README.md)
