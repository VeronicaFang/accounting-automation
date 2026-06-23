# Work Log

## Operating Rules

- Production updates are triggered by the user manually running `git push origin main`.
- The push triggers the Vercel GitHub integration for the `accounting-automation` project.
- Codex should not attempt `git push` from this Windows environment because local GitHub credential access fails with `SEC_E_NO_CREDENTIALS`.
- Codex should make and verify local commits, then remind the user to run `git push origin main`.
- After the user pushes, Codex should check Vercel deployments and confirm whether production reached `READY` for the expected commit.
- If Vercel deployment is `ERROR`, Codex should inspect build logs, fix the cause, commit the fix, and again ask the user to push.

## Vercel Project

- Team: `heartfish0309-9529s-projects`
- Team ID: `team_nyi3DTXGOPS7UKhWHpEunSl0`
- Project: `accounting-automation`
- Project ID: `prj_9YOLmvNnDmspmWgrhcRdypbNds0d`
- Production domain: `https://accounting-automation-ten.vercel.app`
- GitHub repo: `VeronicaFang/accounting-automation`
- Production branch: `main`

## 2026-06-23

### Dashboard Drilldowns And Filters

- Commit: `65e6523 feat: add dashboard drilldowns and filters`
- Scope:
  - Home page uses the current month for the headline and current-month stat cards.
  - Home page bill estimates are filtered to current month and later.
  - Annual dashboard table added for estimated spend, income, and net cash flow.
  - Bill estimate credit-card names link to expense details filtered by month and card.
  - Bills page is split into current/future bills and historical bills.
  - Budget items link to expense details filtered by budget item.
  - Expenses page adds month filter, keyword search, and merchant tags.
- Local verification:
  - `npm run typecheck`: passed.
  - `npm test`: passed.
  - `npm run build`: compiled, then failed locally with known Windows/Codex `spawn EPERM`.
- Production deployment result:
  - Vercel deployment: `dpl_B5x1vqSUf2NjPLciAeStM5QhXYvS`
  - State: `ERROR`
  - Cause: Next.js build error on `/expenses`: `useSearchParams() should be wrapped in a suspense boundary`.
  - Result: Production stayed on the previous successful deployment, so most dashboard/filter changes were not visible.

### Expenses Suspense Fix

- Commit: `b969547 fix: wrap expenses filters in suspense`
- Scope:
  - Wrapped `ExpensesClient` in `Suspense` in `apps/web/src/app/expenses/page.tsx`.
  - This addresses the Vercel build failure caused by `useSearchParams()`.
- Local verification:
  - `npm run typecheck`: passed.
  - `npm test`: passed.
  - `npm run build`: compiled, then failed locally with known Windows/Codex `spawn EPERM`.
- Production deployment status:
  - Awaiting user manual push: `git push origin main`.
  - After push, Codex should check Vercel deployments for commit `b969547` and confirm `READY` before treating production as updated.


### Income Detail Management

- Commit: `this commit feat: manage income details`
- Scope:
  - Income page now loads existing `income_schedules` rows from Supabase.
  - Added annual total income cards grouped by year.
  - Added editable income detail rows for date, item, amount, status, source, and notes.
  - Added delete support for income rows.
  - Income add, edit, and delete actions update the matching cash-flow month totals.
- Local verification:
  - `npm run typecheck` from `apps/web`: passed.
  - `npm test` from `apps/web`: passed.
  - `npm run build` from `apps/web`: compiled successfully, then failed locally with known Windows/Codex `spawn EPERM` during the post-compile TypeScript child process.
- Production deployment status:
  - Awaiting user manual push: `git push origin main`.
  - After push, Codex should check Vercel deployments for the latest local commit and confirm `READY` before treating production as updated.

## Pending Production Check Procedure

1. User runs:

   ```powershell
   git push origin main
   ```

2. Codex checks latest Vercel deployment for project `prj_9YOLmvNnDmspmWgrhcRdypbNds0d` under team `team_nyi3DTXGOPS7UKhWHpEunSl0`.
3. Expected deployment commit: latest local `main` commit.
4. If state is `READY`, production should show the committed changes.
5. If state is `ERROR`, inspect Vercel build logs and fix before asking the user to push again.
## 2026-06-23（續）

### Three Bug Fixes — Invoice 409, Budget Editing, Budget Drilldown

- Commit: `d025945 fix: invoice upsert on reimport, budget amount editing, budget drilldown`
- Root causes and scope:

  **1. 發票匯入 409 錯誤**
  - Root cause: `6265e52` 修正了應用層 skip 邏輯（跳過 deleted drafts），但 DB 上 `invoice_drafts` 有 UNIQUE constraint `(household_id, source_line_key)`，INSERT 已軟刪除的 draft 仍然違反 constraint。
  - Fix: 將 `route.ts` 中 `invoice_drafts` 的 `supabaseInsert` 改為 `supabaseUpsert(onConflict: "household_id,source_line_key")`。已刪除的 draft 重新匯入時會以 `resolution=merge-duplicates` 覆寫欄位並還原為 `needs_review`；已確認的 draft 和已轉為 expense 的紀錄仍由應用層 dedupe 邏輯保護，不會被覆寫。

  **2. 預算金額無法編輯**
  - Root cause: 完全未實作。`BudgetStatus` 型別沒有 `id`，`mapBudgetStatuses` 不輸出 `id`，`budget-client.tsx` 沒有編輯狀態。
  - Fix:
    - `types.ts`：`BudgetStatus` 加入 `id: string`。
    - `supabase-mappers.ts`：`mapBudgetStatuses` 輸出 `id: item.id`。
    - `mock-data.ts`：mock 資料補 `id`（TypeScript 需要）。
    - `budget-status-list.tsx`：加 edit props（`budgetEdits`, `editingId`, `savingId`, callbacks）；每行右側新增 ✏️ 按鈕，點擊後顯示金額 input + 儲存/取消按鈕。
    - `budget-client.tsx`：加入 edit state 和 `saveBudget()` 函式，直接呼叫 Supabase REST PATCH `budget_items?id=eq.{id}`，儲存後重新載入資料。
    - `globals.css`：補 `.budget-edit-row`、`.budget-amount-input`、`.budget-edit-btn` 樣式。

  **3. 預算項目點擊篩選**
  - Root cause: 功能已在 `65e6523` 實作，但 Vercel build 失敗（`useSearchParams` Suspense 問題），後續修正 commit 都卡在等 push。本次 commit 一併包含所有未 push 的改動。
  - Fix: 隨本次 commit push 到 production，Link 和 filter 邏輯均已正確實作。

- Local verification:
  - `npm run typecheck` from `apps/web`: passed.
  - `npm test` from `apps/web`: passed (77 assertions, 9 test files).
- Production deployment:
  - User pushed: `git push origin main`.
  - Vercel deployment `dpl_i2piTkFicEeabFDVZpyvz7RaZ8Mh`: state `READY`.
  - Production confirmed live on commit `d025945`.

### UI Redesign — 澄帳 Design Philosophy

- No commit (design exploration only, not yet implemented in code).
- Scope:
  - Conducted UI review of current app; identified three directional gaps: no at-a-glance KPI summary, budget status lacks visual hierarchy (no progress bars, no inline amounts), navigation requires too many page hops.
  - Created design philosophy document `docs/superpowers/accounting-ui-philosophy.md` under the canvas-design skill, named "澄帳 (Lucid Ledger)" — structured warmth combining East Asian spatial philosophy and Swiss systematic precision.
  - Generated interactive HTML mockup showing full redesigned dashboard: fixed left sidebar (deep forest green `#1A3A2A`), warm off-white background (`#F5F3EE`), 4 KPI stat cards, dual-column main area (expense list with search+filter chips on left, budget progress bars on right), bill due-date table at bottom.
  - Key UX improvements in the design: budget bars with color-coded severity (green/amber/red), monospaced amounts for alignment, today-due bill highlighted in red, click-to-drilldown arrows on budget items, inline search without leaving the page.
- Next step: User to decide which page to implement first.

---

### Invoice Reimport After Deleted Drafts

- Commit: `this commit fix: allow reimporting deleted invoice drafts`
- Root cause:
  - The latest `1535437_20260623103253.csv` import batch was created with `row_count = 107`, but inserted 0 `invoice_drafts` rows.
  - Live Supabase check showed 59 valid invoice/date keys from the CSV, 0 pending draft keys, 59 deleted draft keys, 20 confirmed draft keys, and 20 active expense keys.
  - The importer treated deleted `invoice_drafts` as existing import records, so every row in the reimport was skipped before writing new `needs_review` drafts.
- Scope:
  - Deleted invoice drafts no longer block reimport.
  - Confirmed drafts and active expenses still block reimport to prevent real duplicates.
  - Added a regression test for deleted-only drafts being reimportable.
- Expected effect for the checked CSV:
  - 20 invoice/date keys remain blocked because they are already confirmed/active expenses.
  - 39 deleted-only invoice/date keys become reimportable and should return to the review page after deployment and reimport.
- Local verification:
  - `node --experimental-strip-types src/lib/accounting/invoice-import-dedupe.test.ts` from `apps/web`: passed.
  - `npm run typecheck` from `apps/web`: passed.
  - `npm test` from `apps/web`: passed.
  - `npm run build` from `apps/web`: compiled successfully, then failed locally with known Windows/Codex `spawn EPERM` during the post-compile TypeScript child process.
- Production deployment status:
  - Awaiting user manual push: `git push origin main`.
  - After push, Codex should check Vercel deployments for the latest local commit and confirm `READY` before treating production as updated.
