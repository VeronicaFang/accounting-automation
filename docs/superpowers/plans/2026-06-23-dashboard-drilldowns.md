# Dashboard Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the finance dashboard reflect the current month, add annual overview, and let bills/budgets drill into the related expense details.

**Architecture:** Keep Supabase reads in the existing repository layer and add client-side filters for the currently loaded expense set. Use URL query parameters for drilldown links so Home, Bills, Budget, and Expenses remain loosely coupled.

**Tech Stack:** Next.js App Router, React client components, Supabase REST helpers, Node strip-types tests.

---

### Task 1: Shared Month And Expense Filter Helpers

**Files:**
- Create: `apps/web/src/lib/accounting/dashboard-filters.ts`
- Create: `apps/web/src/lib/accounting/dashboard-filters.test.ts`
- Modify: `apps/web/package.json`

- [ ] Add helpers for current month, prior month, future bill filtering, annual dashboard rows, and expense filtering by month/card/budget/search/tag.
- [ ] Add tests covering June 2026 behavior, future-only bills, and query matching.

### Task 2: Home Dashboard Current Month And Annual View

**Files:**
- Modify: `apps/web/src/app/home-dashboard-client.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] Use today-derived month for the page title and stat cards.
- [ ] Show future bill estimates from current month onward.
- [ ] Add an annual dashboard table showing monthly estimated spend, income, and net cash flow.

### Task 3: Bill Drilldown Links

**Files:**
- Modify: `apps/web/src/components/bill-estimate-table.tsx`
- Modify: `apps/web/src/app/bills/bills-client.tsx`

- [ ] Make month/card rows link to `/expenses?month=YYYY-MM&card=CardName`.
- [ ] Add a compact historical/future split on the Bills page.

### Task 4: Expense Search, Month, Tags, And URL Filters

**Files:**
- Modify: `apps/web/src/app/expenses/expenses-client.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] Read `month`, `card`, `budget`, `merchant`, `tag`, and `q` query params.
- [ ] Add month selector, search input, and merchant tags for Shopee/Pinduoduo/Taobao.
- [ ] Default the list to current and previous month when no month is selected.

### Task 5: Budget Drilldown

**Files:**
- Modify: `apps/web/src/components/budget-status-list.tsx`
- Modify: `apps/web/src/app/budget/budget-client.tsx`

- [ ] Link each budget item to `/expenses?budget=BudgetName`.
- [ ] Keep budget status card dense and scannable.

### Task 6: Invoice Import Redirect Check

**Files:**
- Inspect: `apps/web/src/app/expense-entry/expense-entry-client.tsx`

- [ ] Confirm redirect only happens after the import response resolves.
- [ ] If needed, delay route navigation until success state is set and avoid interrupting the request.

### Task 7: Verification

**Files:**
- Run: `npm run typecheck`
- Run: `npm test`

- [ ] Validate helper tests.
- [ ] Validate TypeScript.
- [ ] Commit and report whether push succeeded.
