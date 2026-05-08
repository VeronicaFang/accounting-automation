# Accounting Automation

Personal accounting automation project for separating budget control from cash-flow tracking.

## Purpose

This project defines the first-version requirements, data model, rules, templates, and implementation-ready structure for:

- importing Taiwan Ministry of Finance invoice details;
- entering expenses without invoices;
- classifying expenses into budget items from the annual budget table;
- tracking credit-card payments, installments, and cash-flow timing;
- forecasting income and monthly net cash flow;
- keeping sensitive real accounting workbooks out of GitHub.

## Data Safety

Real Excel files stay local and must not be committed.

The repository is intended for a private GitHub repo and only contains:

- specification documents;
- rule templates;
- data templates;
- anonymized samples;
- future automation code.

## First Version Scope

The first version focuses on requirements and repository structure. It does not implement the Excel automation or app yet.

See:

- [Requirements](docs/requirements.md)
- [Data Model](docs/data-model.md)
- [Workflow](docs/workflow.md)
- [Rules](docs/rules.md)
- [Reports](docs/reports.md)

