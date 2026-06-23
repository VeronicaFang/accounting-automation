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

## 2026-06-23（三）

### UI 方向調整：彩繪風格、去除 Emoji

- No code commit（設計探索）。
- 依使用者反饋，從深森林綠系改為繽紛多色彩繪風格（第二版 "Pastel Storybook"）。
- 最終確認方向：薄荷綠、天藍、橘橙、紫羅蘭四色統計卡，分類標籤各自獨立顏色，白底乾淨背景，去除全部 emoji，改用色塊與圓點。
- 更新 `docs/superpowers/accounting-ui-philosophy.md` 為 "Pastel Storybook" 哲學。

### 消費明細新增支付工具與金額修改

- Commit: `60158df feat: allow editing payment tool and amount on expense records`
- Scope:
  - **API** (`route.ts`): `updateExpenseDetails` 擴充接受 `paymentToolType`、`creditCardName`、`amount`。有金融欄位變動時：讀取現有 `payment_schedules`，逆轉舊現金流 delta 和信用卡帳單預估 delta，更新 schedule，寫入新 delta，最後更新 `expenses` 主表。分期付款消費拒絕修改。
  - **UI** (`expenses-client.tsx`): 載入信用卡列表；支付工具欄改為下拉選單（現金/信用卡），選信用卡時出現卡片名稱下拉；金額欄改為數字 input。
  - **CSS**: `.expense-payment-cell`、`.expense-amount-input` 樣式。

### 信用卡結算規則設定頁

- Commit: `3b80128 feat: credit card billing rules management in settings page`
- Scope:
  - 新 API `/api/settings/credit-cards`: GET 列出全部卡片（含停用）；POST 支援 `create`（新增）和 `update`（名稱、結帳日、繳款日、啟用狀態）。
  - 新 `settings-client.tsx`: 信用卡清單 table，行內編輯（名稱、結帳日、繳款日），可停用；「新增信用卡」插入新行表單。
  - `settings/page.tsx` 引用 `SettingsClient`。

### 帳單月份篩選 Bug

- Commit: `1a9e341 fix: filter expenses by credit card bill month instead of budget month`
- 問題：從帳單預估表點擊信用卡連結後，消費明細頁顯示的是「消費月份」而非「帳單月份」。
- Root cause: `bill-estimate-table.tsx` 連結傳 `?month=2026-06&card=YuShan`，`filterExpenses` 用 `expense.budgetMonth` 比對 `month`。`budgetMonth` 是消費月，不是帳單月。以玉山結帳日 25 為例，5/26–6/25 的消費都屬於 6 月帳單，但 5 月消費的 `budgetMonth = 2026-05`，被錯誤過濾掉。
- Fix:
  - `dashboard-filters.ts`：加 `billMonth` + `creditCardCutoffDay` 至 `ExpenseFilters`；啟用時用 `consumptionDate` + 結帳日推算帳單月比對，而非 `budgetMonth`。
  - `expenses-client.tsx`：fetch credit cards 加入 `cutoff_day`；解析 `queryBillMonth` URL param；建 name→cutoff_day Map 傳給 filter；`activeContext` 顯示帳單月。
  - `bill-estimate-table.tsx`：連結改用 `billMonth=` param。

## 2026-06-23（四）

### 下一步計畫

優先順序（使用者確認）：
1. 補三個明顯功能缺口
2. 實作新 UI 設計

**缺口清單：**
- A. 首頁 KPI 統計卡（收入/支出/待付信用卡/月結餘）缺少 UI 呈現
- B. 帳單中心「真實帳單金額」無法填入，只顯示「尚未輸入」
- C. 消費明細頁沒有行內新增單筆消費的入口

### 功能缺口 B：帳單真實金額輸入 + 功能缺口 C：消費明細快速新增

- Commit: `494c614 feat: bill statement amount entry and inline expense quick-add`
- 範圍：

  **Gap B — 帳單真實金額輸入**
  - `BillEstimate` 型別加入 `creditCardId: string`；`mapBillEstimateRows` 與 mock-data 同步更新。
  - `BillEstimateTable` 新增選擇性 `statementEdit` prop；「真實帳單」欄位顯示「輸入」/「修改」按鈕，點擊後出現行內數字 input + 確認/取消按鈕。
  - `bills-client.tsx` 加入 `editingId`、`statementEdits`、`busy`、`saveMessage` 狀態及 `saveStatement` 函式。
  - `saveStatement` 呼叫 expense-entry API 新 action `updateBillStatement`，後端查詢 `credit_card_statements` 是否已存在，存在則 PATCH，不存在則 INSERT，欄位包含 `household_id`、`credit_card_id`、`statement_month`、`actual_amount`、`payment_due_date`、`statement_status = "confirmed"`。

  **Gap C — 消費明細快速新增**
  - `expenses-client.tsx` 增加 `showAddForm`、`newExpense`、`addBusy` 狀態。
  - 消費列表上方出現「+ 新增消費」按鈕；點擊展開含消費日、店家、品項、金額、預算項目、支付工具（選信用卡時顯示卡片選單）的表單。
  - 提交呼叫既有 `submitExpenseAction("singleExpense", {...})`，成功後重新載入並收合表單。
  - `globals.css` 加入 `.quick-add-form`、`.quick-add-fields`、`.quick-add-actions`、`.primary-action` 樣式；帳單頁加入 `.bill-statement-edit-cell`、`.bill-statement-display-cell`、`.action-btn-sm`、`.save-message`。

- 本地驗證：
  - `npm run typecheck`：通過。
  - `npm test`：9 個測試檔全部通過（77 assertions）。

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
