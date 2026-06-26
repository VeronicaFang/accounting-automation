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

### 下一步計畫（已全部完成）

優先順序（使用者確認）：
1. 補三個明顯功能缺口 → 全數完成
2. 實作新 UI 設計 → 完成

**缺口清單完成狀態：**
- A. 首頁 KPI 統計卡 → `StatStrip` 本已存在；UI 實作（`bc8c57b`）將四張卡片改為彩繪風格（teal/sky/orange/violet），Gap A 結案。
- B. 帳單中心「真實帳單金額」無法填入 → `494c614` 完成。
- C. 消費明細頁沒有行內新增單筆消費的入口 → `494c614` 完成。

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

### UI 實作 — Pastel Storybook 彩繪風格

- Commit: `bc8c57b feat: colorful UI redesign — Pastel Storybook style`
- 範圍：

  **CSS 變數與底色**
  - 背景改為冷色調白 `#f4f6fb`，panel 改為純白 `#ffffff`
  - 新增四色卡片 CSS 變數：`--teal`、`--sky`、`--orange`、`--violet`、`--rose` 及對應 `*-bg`、`*-border`

  **KPI 統計卡（首頁）**
  - 收入：薄荷綠 `--teal`，淡綠底，4px 左邊框
  - 現金支出：天藍 `--sky`，淡藍底
  - 信用卡付款：橘橙 `--orange`，淡橙底
  - 月淨流量：正值紫羅蘭 `--violet`，負值玫瑰紅 `--rose`
  - 卡片 border-radius 12px，hover 有陰影提升效果
  - 標籤全大寫 uppercase + 寬字距，金額字重加重 26px

  **預算使用狀態**
  - 每個預算項目加入 `.budget-bar-track / .budget-bar-fill` 進度條
  - 進度條顏色跟隨 severity：normal=綠、reminder=藍、warning=橘、over_budget=紅
  - `budget-row` 左側邊框顏色依 severity 區分
  - 超預算列加玫瑰底色
  - ✏️ emoji 改為文字按鈕「編輯」

  **整體排版**
  - `section-heading h2` 加 3px teal 左邊框 + padding-left，使章節感更明確
  - page-header eyebrow 改為全大寫 11px 寬字距
  - page-header h1 改為 28px 800 字重負字距
  - Surface border-radius 升為 12px
  - Sidebar 改為深色 teal 漸層（from `#1a2a28` to `#0f1f1d`）
  - Nav item hover 改為 teal 半透明底色

  **元件更新**
  - `stat-strip.tsx`：tone 型別擴充 teal/sky/orange/violet/rose
  - `home-dashboard-client.tsx`：套用新色彩 tone
  - `budget-status-list.tsx`：進度條 + 移除 emoji

- 本地驗證：
  - `npm run typecheck`：通過
  - `npm test`：9 個測試檔全部通過（77 assertions）
- Production 部署狀態：
  - 使用者已 push `87f48d6`，Vercel 部署成功。
  - 使用者回報畫面與原始 mockup 有落差，啟動 UI 第二輪修正（見下方）。

### UI 第二輪修正 — 貼近 Mockup

- Commit: `3c281d2 feat: UI closer to mockup — light sidebar, stat subtitles, bill badges`
- 觸發原因：使用者對比截圖發現：sidebar 深色、統計卡無副標題、預算條細、帳單無狀態 badge。
- 範圍：

  **Sidebar 淺色重設計**
  - 背景改為白色 `#ffffff`，邊框改為淺線
  - Navigation 分三組（瀏覽/記帳/管理），每組有小標題
  - 每個 nav item 左側加彩色圓點（每條目獨立色）
  - `usePathname()` 偵測 active → teal pill 底色高亮
  - Brand mark 改為 violet→teal 漸層圓角，品牌名稱 "澄帳"
  - `navigation.ts` 加 `group`、`color` 欄位；`navigation.tsx` 改為 client component

  **統計卡副標題**
  - `StatStrip` 新增 `subtitle` 選填 prop
  - `home-dashboard-client.tsx` 即時計算：
    - 收入：與上月差異（持平 / 多 X / 少 X）
    - 支出：與上月差異
    - 信用卡：本月帳單所有信用卡名稱（如「玉山 + 富邦」）
    - 結餘：「現金流健康」/「本月超支」
  - 標籤改為：待付信用卡、本月結餘

  **帳單狀態 Badge**
  - `BillEstimateTable` 新增「狀態」欄，顯示彩色膠囊 badge：
    - 今日到期（紅）、已付款（綠）、帳單確認（天藍）、預估中（橘）、待確認（紅）
  - 根據 `bill.status` 與 `bill.paymentDate` vs 今日動態產生

  **預算進度條**
  - 高度 5px → 8px
  - warning/over_budget 使用漸層色（sky→orange、orange→red）
  - 超標/警告時百分比數字加色

- 本地驗證：
  - `npm run typecheck`：通過
  - `npm test`：9 個測試檔全部通過
- Production 部署狀態：
  - 等待使用者手動執行 `git push origin main`

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

---

## 2026-06-23（五）

### 三項功能實作：漢堡選單、最近消費 Feed、月份切換器

#### 1. 漢堡選單（Mobile hamburger navigation）

- 目標：視窗寬度 ≤ 920px 時，sidebar 收合、顯示漢堡按鈕；點擊後 sidebar 從左側滑入，backdrop overlay 點擊可關閉。
- 範圍：
  - `app-shell.tsx`（components）：改為 "use client" 元件；加入 `mobileOpen` state；漢堡按鈕（固定定位左上角）；`sidebar-overlay` div。
  - `navigation.tsx`：接受 `onClose?` prop，每個 Link 點擊後呼叫 `onClose` 關閉 sidebar。
  - `globals.css`：新增 `.hamburger-btn`、`.sidebar-overlay`、`.sidebar-mobile-open`；@media (max-width: 920px) sidebar `position: fixed; left: -260px`，開啟時 `left: 0`；`.main-panel` 加 `padding-top: 64px`。

#### 2. 首頁「最近消費」動態 Feed

- 新建 `recent-expenses-feed.tsx`（"use client"）：接受 `accessToken` prop；useEffect 呼叫 `getSupabaseExpensesByMonth`；顯示消費列表（日期、店家、品項、分類 chip、支付工具、金額）。
- `supabase-repository.ts`：新增 `getSupabaseExpensesByMonth(month, accessToken)`，加 `budget_month: eq.${month}` filter。
- `home-dashboard-client.tsx`：import `RecentExpensesFeed`，放在首頁 grid 左欄；帳單/現金流表格移到下方。

#### 3. 分類 Chip 篩選 + 月份切換器

- Chip 從當月消費動態提取唯一分類（最多 8 類 + 全部），client-side filter。
- 月份切換器：右上角 `‹ 2026-06 ›`；切換月份後自動重新 fetch 並清除 chip 篩選；不可超過當月。
- CSS：`.chip-row`、`.category-chip`、`.chip-active`、`.month-picker`、`.month-arrow`、`.month-label`。

- 本地驗證：`npm run typecheck` 通過（0 errors）
- Commit: `1134c79 feat: mobile hamburger menu, homepage recent-expenses feed, month picker & category chips`
- Production 部署狀態：使用者已 `git push origin main`，Vercel 部署成功。

---

## 2026-06-23（六）

### 登入 Session 過期 + 429 修復

- 問題：Session 過期後嘗試寄 Magic Link 收到 429（rate limit），導致完全無法登入；連 Supabase Dashboard 後台補寄也受限。
- 根本原因（雙層問題）：
  1. Supabase 內建 email 服務的 OTP rate limit（free tier 約每小時 3–4 封）鎖住整個 email，包含後台操作。
  2. localStorage 的 session 若已被清空，refresh token 不存在，只能靠寄信。

#### 修復範圍（Commit: `0f4aee3`）：

**`supabase-auth.ts`**
- `requestMagicLink`：偵測 429 狀態碼，回傳 `rateLimited: true` 及友善訊息「寄送太頻繁，請等約 60 秒後再試。」
- 新增 `refreshSupabaseSession(refreshToken)` 函式：POST `/auth/v1/token?grant_type=refresh_token`，成功時回傳新的 `accessToken`、`refreshToken`、`expiresAt`；400/401 時回傳「Refresh token 已失效，請重新登入。」

**`login-form.tsx`**
- Session 過期時（localStorage 仍有 refresh token），顯示「重新整理 Session（不需重新收信）」按鈕，呼叫 `refreshSupabaseSession`，成功後直接寫入 localStorage 並更新畫面至「已登入」。
- Magic link 表單移到 divider 下方，作為 refresh 失效時的備用入口。
- 429 錯誤附加說明文字。

**`actions.ts`**：`LoginActionState` 加入 `rateLimited?: boolean` 欄位。

**`globals.css`**：新增 `.auth-divider`、`.rate-limit-hint`。

#### 根本解法：Supabase 自訂 SMTP（Resend）

- 問題：Supabase 內建 email rate limit 無法靠程式繞過，連 Dashboard 後台寄信也受限。
- 解法：在 Supabase Dashboard → Project Settings → Auth → SMTP Settings 啟用自訂 SMTP，使用 Resend。
- 設定值：Host `smtp.resend.com`、Port `587`、User `resend`、Password = Resend API Key、Sender `onboarding@resend.dev`（免費版，無 domain 驗證時使用）。
- 結果：設定完成後，Supabase Dashboard 後台補寄 magic link 成功，rate limit 問題永久解決。

- Production 部署狀態：Commit `0f4aee3` 已 push，Vercel 部署成功。

---

## 2026-06-24

### 分期消費設定（發票審核頁 + 消費明細快速新增）

- Commit: `b3e3619 feat: installment count on invoice review and quick-add (progressive disclosure)`

#### 需求背景
使用者希望在特定信用卡消費可以設定分期，但分期不是常態場景，UI 不應在每列顯示分期欄位造成擁擠。

#### 設計原則：漸進式展開（Progressive Disclosure）
- 預設不顯示分期控制項
- 選擇「信用卡」付款後，才出現一個小綠色 `[分期]` 膠囊按鈕
- 點擊後才展開：3/6/12/18/24/30/36 期下拉選單 + `×` 取消鍵
- 取消或切換回現金：自動清除分期設定（回到 `installmentCount: 1`）

#### 實作範圍

**`invoice-review.ts`（型別層）**
- `InvoiceDraftConfirmation`：加入 `installmentCount?: number`
- `InvoiceDraftConfirmationInput`：加入 `installmentCount: number`
- `buildInvoiceDraftConfirmationInputs`：傳遞 `installmentCount`（`Math.max(1, Math.trunc(Number(...)))`）

**`route.ts`（後端）**
- `confirmInvoiceDrafts`：原本寫死 `installmentCount: 1`，改為讀取 `input.installmentCount`

**`review-client.tsx`（發票審核頁）**
- `DraftEdit` 型別：加入 `installmentCount: number` 和 `showInstallment: boolean`
- `buildDefaultDraftEdit`：初始化兩個新欄位（`installmentCount: 1, showInstallment: false`）
- 確認時的 `confirmations` mapping：傳遞 `installmentCount`
- Table row 付款欄：信用卡選完後顯示 `[分期]` 按鈕；點擊展開分期選單；切換回現金自動清除

**`expenses-client.tsx`（消費明細快速新增）**
- `newExpense` state：加入 `installmentCount: 1, showInstallment: false`
- `resetAddForm`：同步包含新欄位
- `addExpense`：解構 `installmentCount`，信用卡付款時傳遞給 `submitExpenseAction`
- 快速新增表單：信用卡選完後顯示 `[分期]` 按鈕；點擊展開分期選單

**`globals.css`**
- `.installment-toggle-btn`：teal 色系膠囊按鈕
- `.installment-inline`：分期選單 + 取消按鈕的橫向排列
- `.installment-cancel-btn`：`×` 取消按鈕

---

### 帳單信用卡鑽取頁面顯示分期付款明細

- Commit: `8651a91 feat: show installment payment schedules in bill-month expense view`

#### 需求背景
在帳單中心點信用卡名稱（如國泰/富邦）後進入的消費明細，目前只顯示原始消費記錄。分期消費（第 2 期以後）在後續帳單月看不到，因為 `consumptionDate` 固定指向購買日，`billMonth` 過濾器抓不到後續各期。

#### 根本原因
分期消費在 DB 的結構：
- 1 筆 `expenses` 記錄（`is_installment = true`，`consumptionDate` = 購買日）
- N 筆 `payment_schedules` 記錄（各期分別有 `cash_flow_month`、`payment_amount`、`payment_sequence`）

現有 `billMonth` 過濾只看 `expenses.consumptionDate`，第 2 期以後的 `payment_schedules` 完全不會出現。

#### 修復範圍

**`supabase-repository.ts`**
- 新增型別 `InstallmentScheduleRecord`（scheduleId, expenseId, merchantName, itemDescription, paymentSequence, installmentCount, scheduleAmount, cashFlowMonth, creditCardId）
- 新增型別 `RawInstallmentScheduleRow`（含 Supabase 嵌入 join `expenses(merchant_name, item_description, installment_count)`）
- 新增函式 `getSupabaseInstallmentSchedulesByMonth(cashFlowMonth, creditCardId, accessToken)`：
  - 查詢 `payment_schedules`，篩選 `cash_flow_month = X`、`credit_card_id = Y`、`payment_sequence > 1`（第 1 期已被一般消費顯示）
  - 用 PostgREST 嵌入 join 取得商家、品項、總期數

**`expenses-client.tsx`**
- 加入 `installmentSchedules` state（`InstallmentScheduleRecord[]`）
- `loadExpenses` 完成後：若 `queryBillMonth` + `queryCard` 同時存在，根據 card name 找到 card ID，呼叫 `getSupabaseInstallmentSchedulesByMonth`，結果寫入 state
- JSX 尾部：`installmentSchedules.length > 0` 時渲染「分期付款（本月應繳）」區塊，顯示：商家、品項、`第N期/共M期` 標籤、本期金額

#### 顯示效果
- 一般消費明細：上方 section（不變）
- 分期付款本月份：下方額外 section，只在 `billMonth + card` 篩選模式下出現，一般瀏覽時隱藏
- 本地驗證：`npm run typecheck` 通過（0 errors）
- Production 部署狀態：等待使用者手動執行 `git push origin main`
### 帳單鑽取分期付款明細測試與首期修正

- 測試日期：2026-06-24。
- 問題確認：原實作只查詢 `payment_sequence > 1`，因此漏掉第 1 期；同時一般消費列表會顯示分期消費的原始總額，而非該月應繳金額。
- 正式資料案例：
  - 富邦 2026-06：原始消費 13,510 元，本月第 1 期應繳 2,251 元；舊畫面不會顯示分期區塊，且可能顯示 13,510 元。
  - 國泰 2026-07：應顯示 4 筆分期排程，合計 4,051.33 元；舊查詢漏掉 2 筆第 1 期，共 2,279.67 元。
- 修正：
  - 分期排程查詢改為包含所有期數，不再排除第 1 期。
  - `ExpenseRecord` 加入 `isInstallment`，Supabase expense 查詢與 mapper 傳遞 `is_installment`。
  - 帳單月份鑽取模式下，一般消費列表排除分期原始消費；分期金額統一由 `payment_schedules.cash_flow_month + credit_card_id` 顯示。
  - 新增回歸測試，確認分期原始總額不進入帳單鑽取的一般列表，且查詢條件包含第 1 期。
  - 補正既有發票確認測試的預設 `installmentCount: 1` 預期值。
- 本機驗證：
  - `npm test`：通過。
  - `npm run typecheck`：通過。
  - `npm run build`：編譯成功，之後在本機 Windows/Codex 已知的 TypeScript child process 階段發生 `spawn EPERM`。
- Production 狀態：等待使用者執行 `git push origin main`，再由 Codex 確認 Vercel deployment 與正式畫面。

### 發票號碼群組、品項分類與折扣保存

- 日期：2026-06-24。
- 本機 commits：
  - `a8dc6fa feat: add invoice grouping calculations`
  - `9108835 feat: add grouped invoice expense schema`
  - `3accb50 feat: preserve invoice grouping metadata on import`
  - `8b51c7b feat: group invoice drafts in review`
  - `69c867f feat: confirm invoice groups atomically`
  - `466a089 feat: map grouped invoice expenses`
  - `6989eac feat: show expandable invoice expense groups`
- 完成項目：
  - 發票號碼作為群組鍵，`source_line_key` 保持逐列去重。
  - 折扣合計歸入最高金額正數品項；同額依匯入順序。
  - Supabase 新增 invoice metadata、payment parent 與 `confirm_invoice_group` 原子確認 RPC。
  - 待確認頁依發票群組，共用付款設定，正數品項分別分類，折扣列只讀。
  - 消費明細顯示一張發票一列，展開後呈現品項、折扣、原始與計入金額。
- Supabase schema 已套用並驗證：353 筆 draft 回填發票號碼與順序，19 筆辨識為折扣列；RPC 權限 `anon=false`、`authenticated=true`。
- 本機驗證：`npm test` 與 `npm run typecheck` 通過；`npm run build` 編譯成功後遇到既知 Windows `spawn EPERM`。
- 舊 expenses 安全回填已於 2026-06-24 完成；待完成：Production Vercel deployment 與實際匯入畫面驗證。

### Grouped Invoice Expense Backfill

- Date: 2026-06-24
- Migration: `20260624094755_backfill_invoice_numbers.sql`
- Production Supabase result:
  - Backfilled 127 existing expense lines into 72 invoice groups.
  - Identified 9 discount lines.
  - Missing source keys: 0.
  - Invoice amount mismatches: 0.
  - Unmatched confirmed invoice draft lines: 0.
- Safety:
  - Matching used exact `source_line_key` / `source_row_id` only.
  - Date and merchant similarity were not used.
  - Existing payment schedules, bill estimates, and cash-flow totals were not rebuilt.
- Production application deployment:
  - Awaiting user manual push: `git push origin main`.
  - After push, Codex must confirm the Vercel deployment is `READY` and test the grouped invoice display on production.

---

## 2026-06-26

### Invoice Payment Editing And Expense Source Filters

- Branch: `feature/expense-payment-filters`
- Commits:
  - `6d79f81 feat: filter expenses by invoice source`
  - `4bb993e test: cover combined expense source filters`
  - `04d3fe1 feat: validate invoice payment updates`
  - `9f97d0d feat: expose invoice payment metadata`
  - `3a693c3 feat: rebuild invoice payment schedules atomically`
  - `797074f feat: add invoice payment update action`
  - `2158290 feat: edit invoice payments and filter expense sources`

#### Compared With Previous Work Log

Previous grouped-invoice work completed invoice grouping/backfill and made invoice expenses display as one summary row with expandable item/discount details. This session adds the next layer on top of that work:

- Whole-invoice payment editing:
  - One invoice summary row now owns the payment method.
  - Child item/discount rows no longer expose independent payment controls.
  - Invoice payment can be changed between cash and credit card, including installment count for credit-card payments.
- Source filtering in expense details:
  - Added quick filters for `手動入帳` and `發票匯入`.
  - `手動入帳` means expenses without `invoice_number`.
  - `發票匯入` means expenses with `invoice_number`.
  - Buttons are mutually exclusive and can be clicked again to clear.
- Month filtering in expense details:
  - Added `全部月份` option.
  - When selected, month restriction is removed, so search can cover all stored expense data.
- Backend support:
  - Added validation helper for invoice payment updates.
  - Supabase expense mappers now expose `creditCardId` and `installmentCount` to the frontend.
  - API action `updateInvoicePaymentSettings` calls Supabase RPC `update_invoice_payment_settings`.
- Supabase RPC:
  - Migration `20260626024203 update_invoice_payment_settings` was applied to production Supabase project `frbqvouttwlgteizwxub`.
  - Function is `security invoker`, not `security definer`.
  - Execute permission is granted to `authenticated`, revoked from `public` and `anon`.
  - Function requires household owner because existing delete RLS on `payment_schedules` is owner-only.
  - Function rejects invoice groups with non-estimated payment schedules before rebuilding, to avoid rewriting paid/reconciled schedules as estimated.
  - Function locks existing payment schedules before status checks to avoid race conditions.

#### Supabase Verification

- Function existence and permission check:
  - `update_invoice_payment_settings` exists.
  - `security_definer = false`.
  - execute roles include `authenticated`, `postgres`, `service_role`.
- Rollback test:
  - Created a temporary invoice group inside a transaction.
  - Changed it from cash to credit card with 3 installments using the RPC.
  - Verified 3 estimated credit-card schedules were created.
  - Verified schedule total remained `90.00`.
  - Rolled back the transaction.
  - Verified no `ZZTESTROLLBACK01` test expenses remained.
- Advisors after migration:
  - Security advisor only reported existing `auth_leaked_password_protection` warning.
  - Performance advisor reported existing index warnings; no new function-specific warning was observed.

#### Important Data Finding

- Production Supabase currently has 70 existing invoice groups where `payment_parent_expense_id` is still missing.
- Because the new RPC intentionally rejects incomplete legacy invoice groups, those old invoice rows cannot yet use whole-invoice payment editing.
- New invoice groups confirmed through `confirm_invoice_group` should have the required parent linkage.
- Remaining data task: add a safe backfill/repair migration for old invoice expenses to set `payment_parent_expense_id` and create/reconcile parent payment schedules where possible.

#### Local Verification

- `npm run typecheck` from `apps/web`: passed.
- `npm test` from `apps/web`: passed.
- `npm run build` from `apps/web`: Next.js compiled successfully, then ended with known local Windows/Codex `spawn EPERM` during the post-compile TypeScript child process.
- `git diff --check`: passed.

#### Remaining TODO

1. Merge `feature/expense-payment-filters` back to local `main` after final verification.
2. User manually pushes production:

   ```powershell
   cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github"
   git push origin main
   ```

3. Codex checks Vercel production deployment for the latest commit and confirms `READY`.
4. Production smoke test after deployment:
   - `/expenses` loads.
   - `手動入帳` and `發票匯入` filters work and can be cleared.
   - `全部月份` works with keyword search.
   - Invoice summary row shows payment editor.
   - Whole-invoice payment update works for invoice groups that have `payment_parent_expense_id` and estimated schedules.
5. Separate follow-up task:
   - Repair the 70 legacy invoice groups missing `payment_parent_expense_id` before expecting whole-invoice payment editing to work on old imported invoices.

### Production Fix: Mixed Payment Invoice Fallback

- Date: 2026-06-26
- Production symptom: `/expenses` showed `Invoice BQ58428276 has inconsistent payment settings.` and stopped loading expense details.
- Root cause:
  - Production data for invoice `BQ58428276` has two item rows under the same invoice number.
  - One row is `cash` for `3000.00`; the other row is `credit_card` for `1200.00`.
  - Both are legacy grouped-invoice rows without `payment_parent_expense_id`.
  - The new grouped invoice display assumed one payment setting per invoice and threw when rows disagreed.
- Fix:
  - `buildExpenseDisplayRows` no longer throws for mixed payment settings.
  - Mixed-payment legacy invoices now fall back to individual expense rows so the page can continue loading and each row can still be inspected/edited.
  - Consistent invoice groups still render as one invoice summary row with expandable details and whole-invoice payment editing.
- Verification:
  - Added regression coverage in `invoice-grouping.test.ts` for mixed-payment invoice fallback.
  - `npm test`: passed.
  - `npm run typecheck`: passed.
- Follow-up:
  - Data cleanup/backfill is still needed for legacy invoice groups missing `payment_parent_expense_id` before whole-invoice payment editing can work on those old records.
