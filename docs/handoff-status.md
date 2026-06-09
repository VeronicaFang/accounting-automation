# Current Handoff Status

Last reviewed: 2026-06-09

This file summarizes what has already been executed so the next engineer or agent can continue without rereading the full chat history.

## Current Product Direction

- The legacy daily-use MVP is still Google Apps Script + Google Sheet.
- The new system is a dual-track Supabase + Vercel migration.
- Google Sheet data has been imported into Supabase for the active household.
- Vercel is now the target frontend for the new daily UI, but not every Apps Script workflow has been rebuilt yet.
- Apps Script deployment and GitHub push must be explicitly communicated before execution.

## Latest Known Commits

| Commit | Summary |
|---|---|
| `49e4066` | Added Supabase-backed expense entry flows in the Vercel app. |
| `0ad712a` | Added Supabase web migration foundation and import tooling. |
| `ddd2f50` | Wired dashboard pages to Supabase session data. |
| `94f2636` | Fixed Supabase magic-link hash redirect/session storage. |
| `b90dfbd` | Added Supabase auth household foundation. |
| `b7984a1` | Added the Vercel frontend IA shell. |
| `ac4875f` / `e76e198` | Added Supabase migration foundation. |

## Deployed / Runtime Surfaces

| Area | Status | Main files |
|---|---|---|
| Vercel frontend shell | Implemented under `apps/web`; deployed through GitHub/Vercel flow. | `apps/web/src/app/*` |
| Supabase magic-link login | Implemented; stores browser session and shows logged-in state/sign-out. | `apps/web/src/app/login/*`, `apps/web/src/app/auth/callback/*`, `apps/web/src/lib/auth/supabase-auth.ts` |
| Supabase dashboard reads | Implemented for Home, Bill Center, Cash Flow, Budget, Review, Expenses. | `apps/web/src/lib/data/supabase-repository.ts`, `apps/web/src/lib/data/supabase-mappers.ts` |
| Expense detail page | Implemented; shows recent Supabase expenses. | `apps/web/src/app/expenses/*` |
| Expense entry page | Implemented for single expense, monthly fixed expense, manual batch import, and invoice draft import. | `apps/web/src/app/expense-entry/*`, `apps/web/src/app/api/accounting/expense-entry/route.ts` |
| Google Sheet migration import tool | Implemented as local/development migration route and UI. | `apps/web/src/app/migration/import-google-sheet/*`, `apps/web/src/app/api/migration/import-google-sheet/route.ts`, `apps/web/src/lib/migration/google-sheet-importer.ts` |
| Apps Script MVP | Existing legacy production app remains in repo. | `src/apps-script/*`, `src/core/*`, `tests/*.test.mjs` |

## Supabase Data Model Status

Implemented migrations:

- `202606010001_initial_accounting_schema.sql`: core accounting schema, budget taxonomy, bill estimates, real statements, migration tracking.
- `202606010002_auth_household_rls.sql`: auth-triggered household provisioning and RLS policies.
- `202606020001_allow_payment_schedule_adjustments.sql`: allows signed payment schedule adjustments.
- `202606030002_add_transaction_legacy_import_keys.sql`: idempotent legacy import keys.
- `202606050001_allow_expense_adjustments.sql`: allows signed expense adjustments.

Important model decisions:

- `credit_card_bill_estimates` is a physical table for the first Supabase version.
- `credit_card_statements` is reserved for real card bills; cash flow should prefer actual statements when present.
- `payment_schedules` remains the traceable detail source behind monthly bill estimates.
- Budget taxonomy is moving from flat Google Sheet `BudgetItems` to `budget_groups` + `budget_items`.
- Budget mapping from legacy labels must stay review-gated through mapping drafts.
- Single-user private use is the current product mode; `households` and `household_members` reserve future family sharing.

## Imported Data Status

Known completed import:

- Google Sheet transaction package was imported to Supabase for household `ad465329-34a8-43a8-8b89-198de2d0cec4`.
- Import result observed in the Web UI:
  - `IncomeSchedule`: 24 existing, 0 new in the later idempotent run.
  - `ExpenseRecords`: 821 inserted.
  - `PaymentSchedule`: 831 inserted.
- Orphan payment schedules were treated as delete-before-import and should not be imported.
- Invalid legacy budget labels were handled through budget mapping before import.
- Negative expense/payment adjustments are supported by Supabase migrations.

## Vercel Expense Entry Behavior

The Vercel `記帳` page currently supports:

- Single manual expense entry.
- Monthly fixed expense schedule creation.
- Manual batch expense import from pasted CSV/TSV text or a file.
- Finance Ministry invoice import into `invoice_drafts`.

Write behavior:

- Single and batch manual expenses write to `expenses`.
- Credit-card expenses automatically generate `payment_schedules`.
- Cash expenses and card payments increment `cash_flow_months`.
- Credit-card payments increment `credit_card_bill_estimates`.
- Monthly fixed expenses create an `expense_schedules` row and generate repeated expenses/payment schedules.
- Invoice imports create `invoice_import_batches` and `invoice_drafts`; they do not directly create formal expenses.

Known limitations:

- Confirming Supabase `invoice_drafts` into `expenses` still needs a Vercel review/confirmation workflow.
- There is not yet a Vercel UI for real credit-card statement entry/import.
- Cash-flow recomputation is incremental in the new entry API; a full recompute/reconciliation tool is still needed.
- The Vercel entry API currently rejects negative manual entry amounts at the write path; legacy signed adjustments are supported by schema and migration importer.
- Merchant rule management in Vercel is still a read/use behavior, not a full management UI.

## Apps Script Status

Apps Script currently remains the mature workflow for:

- Finance Ministry invoice import review and batch confirmation.
- Merchant payment rule saving from invoice confirmation.
- Manual expense flows in the Google Sheet MVP.
- Income schedule and payment status operations.

Do not assume Vercel has feature parity with Apps Script until the missing confirmation and rule-management workflows are rebuilt.

## Verification Commands

From repo root:

```powershell
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github"
```

Apps Script/core tests:

```powershell
npm test
```

Vercel web checks:

```powershell
cd apps\web
npm run typecheck
npm test
npm run build
```

Known local caveat:

- On this Windows/Codex environment, `next build` has previously compiled successfully and then failed later with a local `spawn EPERM` worker/process issue. Treat that separately from TypeScript/test failures.

## Environment Variables

The Vercel app needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_ACCOUNTING_USE_SUPABASE=true`
- `NEXT_PUBLIC_SITE_URL` or equivalent site URL configuration for magic-link redirects, if used by the auth helper.

Never commit real `.env.local` values.

## Suggested Next Work

Recommended next sequence:

1. Verify the deployed Vercel `記帳` page against real Supabase data.
2. Build the Supabase invoice-draft confirmation workflow in Vercel.
3. Add real credit-card statement entry/import and comparison against `credit_card_bill_estimates`.
4. Add a cash-flow full recompute/reconciliation tool.
5. Add merchant rule management UI.
6. Continue budget taxonomy v2 UI after daily accounting flows are stable.

## Operational Rules

- Tell the user before running Apps Script deployment.
- Tell the user before GitHub push or any connector action that will update GitHub.
- Keep private Excel/Google Sheet exports out of Git.
- Prefer Supabase RLS/session-backed reads and writes in the Vercel app.
- Keep legacy source IDs and source table fields when importing data.
