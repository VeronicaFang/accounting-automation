# Expense Payment And Source Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users atomically change an entire invoice's payment method and installments, filter expenses by invoice/non-invoice source, and search across all stored months.

**Architecture:** Add pure TypeScript validation and filtering helpers first, then add a `SECURITY INVOKER` Supabase RPC that reverses and rebuilds all invoice payment effects in one transaction. The existing Next.js API route will validate the request and call the RPC, while the expense page will own only UI state and reload data after a successful update.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/PostgREST RPC, Node assertion tests.

---

## File Structure

- Modify `apps/web/src/lib/accounting/dashboard-filters.ts`
  - Add invoice/manual source classification and filtering.
- Modify `apps/web/src/lib/accounting/dashboard-filters.test.ts`
  - Cover source filters and unrestricted all-month filtering.
- Create `apps/web/src/lib/accounting/invoice-payment.ts`
  - Normalize and validate invoice payment update input.
- Create `apps/web/src/lib/accounting/invoice-payment.test.ts`
  - Cover payment type, card, installment, and invoice-number validation.
- Modify `apps/web/package.json`
  - Add the invoice payment test to the test command.
- Modify `apps/web/src/lib/types.ts`
  - Expose `creditCardId` and `installmentCount` required by group controls.
- Modify `apps/web/src/lib/data/supabase-mappers.ts`
  - Map payment metadata into `ExpenseRecord`.
- Modify `apps/web/src/lib/data/supabase-mappers.test.ts`
  - Verify the mapped payment metadata.
- Modify `apps/web/src/lib/data/supabase-repository.ts`
  - Select `installment_count` with expenses.
- Modify `apps/web/src/lib/accounting/invoice-grouping.ts`
  - Expose one consistent payment setting for an invoice display row.
- Modify `apps/web/src/lib/accounting/invoice-grouping.test.ts`
  - Reject mixed legacy payment settings and verify group payment metadata.
- Fill `supabase/migrations/20260625070207_update_invoice_payment_settings.sql`
  - Add the atomic `update_invoice_payment_settings` RPC.
- Modify `apps/web/src/app/api/accounting/expense-entry/route.ts`
  - Add the `updateInvoicePaymentSettings` action.
- Modify `apps/web/src/app/expenses/expenses-client.tsx`
  - Add invoice payment controls, source chips, and the all-month option.
- Modify `apps/web/src/app/globals.css`
  - Style source chips and invoice payment controls using existing control patterns.
- Modify `docs/work-log.md`
  - Record implementation, migration, verification, and deployment status.

### Task 1: Source And All-Month Filtering

**Files:**
- Modify: `apps/web/src/lib/accounting/dashboard-filters.ts`
- Modify: `apps/web/src/lib/accounting/dashboard-filters.test.ts`

- [ ] **Step 1: Write failing source-filter tests**

Add `sourceType?: "invoice" | "manual"` to the wished-for filter API and test:

```ts
const invoiceExpense = { ...expense, id: "invoice", invoiceNumber: "AA12345678" };
const manualExpense = { ...expense, id: "manual", invoiceNumber: undefined };
const oldInvoiceExpense = {
  ...invoiceExpense,
  id: "old-invoice",
  consumptionDate: "2025-01-02",
  budgetMonth: "2025-01"
};

assert.equal(expenseMatchesFilters(invoiceExpense, { sourceType: "invoice" }), true);
assert.equal(expenseMatchesFilters(manualExpense, { sourceType: "invoice" }), false);
assert.equal(expenseMatchesFilters(manualExpense, { sourceType: "manual" }), true);
assert.equal(expenseMatchesFilters(invoiceExpense, { sourceType: "manual" }), false);
assert.equal(
  expenseMatchesFilters(oldInvoiceExpense, { months: undefined, query: "usb", sourceType: "invoice" }),
  true
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github\apps\web"
node --experimental-strip-types src/lib/accounting/dashboard-filters.test.ts
```

Expected: TypeScript or assertion failure because `sourceType` is not implemented.

- [ ] **Step 3: Implement source classification**

Extend the filter type and add this check before keyword filtering:

```ts
export type ExpenseSourceType = "invoice" | "manual";

export type ExpenseFilters = {
  month?: string;
  months?: string[];
  creditCardName?: string;
  budgetItemName?: string;
  query?: string;
  merchantTag?: string;
  billMonth?: string;
  creditCardCutoffDay?: number;
  sourceType?: ExpenseSourceType;
};

export function getExpenseSourceType(expense: ExpenseRecord): ExpenseSourceType {
  return String(expense.invoiceNumber ?? "").trim() ? "invoice" : "manual";
}

if (filters.sourceType && getExpenseSourceType(expense) !== filters.sourceType) {
  return false;
}
```

Do not introduce a special all-month value inside `expenseMatchesFilters`. All months is represented by omitting both `month` and `months`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2.

Expected: all dashboard-filter assertions pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/accounting/dashboard-filters.ts apps/web/src/lib/accounting/dashboard-filters.test.ts
git commit -m "feat: filter expenses by invoice source"
```

### Task 2: Invoice Payment Input Validation

**Files:**
- Create: `apps/web/src/lib/accounting/invoice-payment.ts`
- Create: `apps/web/src/lib/accounting/invoice-payment.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing validation test**

Create the test with the desired API:

```ts
import assert from "node:assert/strict";
import { validateInvoicePaymentUpdate } from "./invoice-payment.ts";

assert.throws(
  () => validateInvoicePaymentUpdate({ invoiceNumber: "", paymentToolType: "cash", installmentCount: 1 }),
  /Invoice number/
);
assert.throws(
  () => validateInvoicePaymentUpdate({
    invoiceNumber: "AA1",
    paymentToolType: "credit_card",
    creditCardId: "",
    installmentCount: 3
  }),
  /Credit card/
);
assert.throws(
  () => validateInvoicePaymentUpdate({
    invoiceNumber: "AA1",
    paymentToolType: "credit_card",
    creditCardId: "card-1",
    installmentCount: 5
  }),
  /Installment/
);
assert.deepEqual(
  validateInvoicePaymentUpdate({
    invoiceNumber: " AA1 ",
    paymentToolType: "cash",
    creditCardId: "ignored",
    installmentCount: 12
  }),
  { invoiceNumber: "AA1", paymentToolType: "cash", creditCardId: null, installmentCount: 1 }
);
assert.deepEqual(
  validateInvoicePaymentUpdate({
    invoiceNumber: "AA1",
    paymentToolType: "credit_card",
    creditCardId: "card-1",
    installmentCount: 12
  }),
  { invoiceNumber: "AA1", paymentToolType: "credit_card", creditCardId: "card-1", installmentCount: 12 }
);

console.log("invoice payment validation: 5 assertions passed");
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
node --experimental-strip-types src/lib/accounting/invoice-payment.test.ts
```

Expected: module-not-found failure because `invoice-payment.ts` does not exist.

- [ ] **Step 3: Implement minimal validation**

Create:

```ts
export const supportedInstallmentCounts = [1, 3, 6, 12, 18, 24, 30, 36] as const;

export type InvoicePaymentUpdate = {
  invoiceNumber: string;
  paymentToolType: "cash" | "credit_card";
  creditCardId?: string | null;
  installmentCount?: number;
};

export function validateInvoicePaymentUpdate(input: InvoicePaymentUpdate) {
  const invoiceNumber = String(input.invoiceNumber ?? "").trim();
  const paymentToolType = input.paymentToolType === "credit_card" ? "credit_card" : "cash";
  const creditCardId = String(input.creditCardId ?? "").trim();
  const installmentCount = Math.trunc(Number(input.installmentCount ?? 1));

  if (!invoiceNumber) throw new Error("Invoice number is required.");
  if (paymentToolType === "credit_card" && !creditCardId) throw new Error("Credit card is required.");
  if (paymentToolType === "credit_card" && !supportedInstallmentCounts.includes(installmentCount as never)) {
    throw new Error("Installment count is not supported.");
  }

  return {
    invoiceNumber,
    paymentToolType,
    creditCardId: paymentToolType === "credit_card" ? creditCardId : null,
    installmentCount: paymentToolType === "credit_card" ? installmentCount : 1
  };
}
```

Append the new test command to `npm test`.

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
node --experimental-strip-types src/lib/accounting/invoice-payment.test.ts
npm test
```

Expected: focused test reports 5 assertions; full suite passes.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/accounting/invoice-payment.ts apps/web/src/lib/accounting/invoice-payment.test.ts apps/web/package.json
git commit -m "feat: validate invoice payment updates"
```

### Task 3: Map Invoice Payment Metadata

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/data/supabase-mappers.ts`
- Modify: `apps/web/src/lib/data/supabase-mappers.test.ts`
- Modify: `apps/web/src/lib/data/supabase-repository.ts`
- Modify: `apps/web/src/lib/accounting/invoice-grouping.ts`
- Modify: `apps/web/src/lib/accounting/invoice-grouping.test.ts`

- [ ] **Step 1: Write failing mapper and grouping tests**

Extend the existing Supabase expense fixture:

```ts
credit_card_id: "card-1",
installment_count: 6,
```

Assert:

```ts
assert.equal(expenses[0].creditCardId, "card-1");
assert.equal(expenses[0].installmentCount, 6);
```

Extend invoice grouping fixtures and assert:

```ts
assert.equal(displayRows[0].kind, "invoice");
if (displayRows[0].kind === "invoice") {
  assert.equal(displayRows[0].paymentToolType, "credit_card");
  assert.equal(displayRows[0].creditCardId, "card-1");
  assert.equal(displayRows[0].installmentCount, 6);
}
```

Add a mixed-payment fixture and assert that `buildExpenseDisplayRows` throws `/inconsistent payment settings/`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --experimental-strip-types src/lib/data/supabase-mappers.test.ts
node --experimental-strip-types src/lib/accounting/invoice-grouping.test.ts
```

Expected: missing mapped fields and missing invoice group payment metadata.

- [ ] **Step 3: Add the fields and group consistency check**

Add to `ExpenseRecord`:

```ts
creditCardId?: string;
installmentCount?: number;
```

Add to `SupabaseExpenseRow` and mapper:

```ts
installment_count?: number;

creditCardId: row.credit_card_id ?? undefined,
installmentCount: row.installment_count ?? 1,
```

Add `installment_count` to both expense select lists in `supabase-repository.ts`.

Add to the invoice display row:

```ts
paymentToolType: "cash" | "credit_card";
creditCardId?: string;
creditCardName?: string;
installmentCount: number;
```

When finishing each invoice group, compare every line against the first line's payment tool, card ID, and installment count. Throw:

```ts
throw new Error(`Invoice ${invoiceNumber} has inconsistent payment settings.`);
```

- [ ] **Step 4: Run focused and full tests**

Run the two focused commands, then `npm test`.

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/types.ts apps/web/src/lib/data/supabase-mappers.ts apps/web/src/lib/data/supabase-mappers.test.ts apps/web/src/lib/data/supabase-repository.ts apps/web/src/lib/accounting/invoice-grouping.ts apps/web/src/lib/accounting/invoice-grouping.test.ts
git commit -m "feat: expose invoice payment metadata"
```

### Task 4: Atomic Supabase Payment Reconstruction

**Files:**
- Modify: `supabase/migrations/20260625070207_update_invoice_payment_settings.sql`

- [ ] **Step 1: Write SQL precondition checks first**

The RPC signature must be:

```sql
public.update_invoice_payment_settings(
  p_household_id uuid,
  p_invoice_number text,
  p_payment_tool_type public.payment_tool_type,
  p_credit_card_id uuid,
  p_installment_count integer
) returns jsonb
```

Use `security invoker` and `set search_path = public, pg_temp`.

Validate:

```sql
if auth.uid() is null or not app_private.is_household_member(p_household_id) then
  raise exception 'Not authorized for household';
end if;

if nullif(btrim(p_invoice_number), '') is null then
  raise exception 'Invoice number is required';
end if;

if p_installment_count not in (1, 3, 6, 12, 18, 24, 30, 36) then
  raise exception 'Installment count is not supported';
end if;
```

Cash must force one installment and a null card. Credit card must reference an active card in the same household.

- [ ] **Step 2: Lock and validate the invoice group**

Lock all active rows:

```sql
perform 1
from public.expenses
where household_id = p_household_id
  and invoice_number = p_invoice_number
  and status = 'active'
for update;
```

Require:

- At least one active line.
- Exactly one non-null `payment_parent_expense_id` shared by every line.
- Exactly one payment parent row in the group.
- A non-negative total from `sum(original_amount)`.
- A single consumption date for schedule reconstruction.

Reject incomplete legacy groups instead of partially updating them.

- [ ] **Step 3: Reverse old schedules**

For every existing schedule linked to the payment parent:

```sql
update public.cash_flow_months
set cash_expense_total = cash_expense_total
      - case when old_schedule.payment_tool_type = 'cash' then old_schedule.payment_amount else 0 end,
    credit_card_payment_total = credit_card_payment_total
      - case when old_schedule.payment_tool_type = 'credit_card' then old_schedule.payment_amount else 0 end,
    net_cash_flow = income_total
      - (cash_expense_total
         - case when old_schedule.payment_tool_type = 'cash' then old_schedule.payment_amount else 0 end)
      - (credit_card_payment_total
         - case when old_schedule.payment_tool_type = 'credit_card' then old_schedule.payment_amount else 0 end),
    generated_at = now()
where household_id = p_household_id
  and cash_flow_month = old_schedule.cash_flow_month;
```

For old credit-card schedules, subtract the amount and one detail from the matching estimate. Clamp `detail_count` to zero, and delete bill-estimate rows whose resulting amount and detail count are both zero.

Delete all old payment schedules for the payment parent only after their effects are reversed.

- [ ] **Step 4: Update all expense lines and rebuild schedules**

Update every active line in the invoice:

```sql
update public.expenses
set payment_tool_type = p_payment_tool_type,
    credit_card_id = case when p_payment_tool_type = 'credit_card' then p_credit_card_id else null end,
    is_installment = p_payment_tool_type = 'credit_card' and p_installment_count > 1,
    installment_count = case when p_payment_tool_type = 'credit_card' then p_installment_count else 1 end,
    updated_at = now()
where household_id = p_household_id
  and invoice_number = p_invoice_number
  and status = 'active';
```

Recreate cent-accurate schedules using the same remainder allocation, cutoff-day, payment-day, cash-flow upsert, and bill-estimate upsert logic already used by `confirm_invoice_group`.

Return:

```sql
jsonb_build_object(
  'invoiceNumber', p_invoice_number,
  'updatedExpenses', v_expense_count,
  'insertedPaymentSchedules', p_installment_count,
  'paidTotal', v_paid_total
)
```

- [ ] **Step 5: Restrict function execution**

```sql
revoke all on function public.update_invoice_payment_settings(uuid, text, public.payment_tool_type, uuid, integer) from public;
revoke all on function public.update_invoice_payment_settings(uuid, text, public.payment_tool_type, uuid, integer) from anon;
grant execute on function public.update_invoice_payment_settings(uuid, text, public.payment_tool_type, uuid, integer) to authenticated;
```

- [ ] **Step 6: Apply and verify on Supabase**

Apply the migration to project `frbqvouttwlgteizwxub`.

Before changing a real invoice, run read-only checks for:

- Invoice group count and shared payment parent.
- Current schedule sum equals invoice original-amount total.
- Current cash-flow and bill-estimate effects.

Execute the RPC against one controlled invoice, verify cash-to-card and card-to-cash reconstruction, then restore the original setting. Confirm all grouped invoices remain internally consistent:

```sql
with schedule_totals as (
  select household_id, expense_id, sum(payment_amount) as schedule_total
  from public.payment_schedules
  group by household_id, expense_id
)
select
  e.household_id,
  e.invoice_number,
  count(distinct e.payment_tool_type) as payment_tool_count,
  count(distinct e.credit_card_id) as card_count,
  count(distinct e.installment_count) as installment_count_variants,
  sum(e.original_amount) as invoice_total,
  max(st.schedule_total) as schedule_total
from public.expenses e
left join schedule_totals st
  on st.household_id = e.household_id
 and st.expense_id = e.payment_parent_expense_id
where e.invoice_number is not null
  and e.status = 'active'
group by e.household_id, e.invoice_number
having count(distinct e.payment_tool_type) <> 1
    or count(distinct e.installment_count) <> 1
    or sum(e.original_amount) <> max(st.schedule_total);
```

Expected: zero rows.

Run Supabase security and performance advisors. The new function must not create an `anon` or `authenticated` security-definer warning.

- [ ] **Step 7: Commit**

```powershell
git add supabase/migrations/20260625070207_update_invoice_payment_settings.sql
git commit -m "feat: rebuild invoice payment schedules atomically"
```

### Task 5: API Action

**Files:**
- Modify: `apps/web/src/app/api/accounting/expense-entry/route.ts`

- [ ] **Step 1: Add validation import and action handler**

Import:

```ts
import { validateInvoicePaymentUpdate } from "@/lib/accounting/invoice-payment";
```

Add:

```ts
async function updateInvoicePaymentSettings(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const input = validateInvoicePaymentUpdate({
    invoiceNumber: String(payload.invoiceNumber ?? ""),
    paymentToolType: String(payload.paymentToolType) === "credit_card" ? "credit_card" : "cash",
    creditCardId: String(payload.creditCardId ?? ""),
    installmentCount: Number(payload.installmentCount ?? 1)
  });

  return supabaseRpc(requestConfig, "update_invoice_payment_settings", {
    p_household_id: references.householdId,
    p_invoice_number: input.invoiceNumber,
    p_payment_tool_type: input.paymentToolType,
    p_credit_card_id: input.creditCardId,
    p_installment_count: input.installmentCount
  });
}
```

Route the action:

```ts
if (action === "updateInvoicePaymentSettings") {
  const result = await updateInvoicePaymentSettings(requestConfig, references, payload);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Run typecheck and full tests**

Run:

```powershell
npm run typecheck
npm test
```

Expected: both pass.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/api/accounting/expense-entry/route.ts
git commit -m "feat: add invoice payment update action"
```

### Task 6: Expense Page Controls

**Files:**
- Modify: `apps/web/src/app/expenses/expenses-client.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add explicit filter state**

Use:

```ts
type MonthFilterValue = "" | "all" | string;
type SourceFilterValue = "" | "invoice" | "manual";

const [selectedMonth, setSelectedMonth] = useState<MonthFilterValue>(queryMonth);
const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>("");
```

Build month filters as:

```ts
const isAllMonths = selectedMonth === "all";

month: activeBillMonth || isAllMonths ? undefined : (selectedMonth || undefined),
months: activeBillMonth || selectedMonth ? undefined : defaultMonths,
sourceType: sourceFilter || undefined,
```

Add:

```tsx
<option value="all">全部月份</option>
```

- [ ] **Step 2: Add mutually exclusive source chips**

Render before merchant tags:

```tsx
{[
  { label: "手動入帳", value: "manual" as const },
  { label: "發票匯入", value: "invoice" as const }
].map((filter) => (
  <button
    key={filter.value}
    className={sourceFilter === filter.value ? "tag-button tag-button-active" : "tag-button"}
    type="button"
    onClick={() => setSourceFilter((current) => current === filter.value ? "" : filter.value)}
  >
    {filter.label}
  </button>
))}
```

The clear button must reset `sourceFilter`. Active context must show `全部月份`, `手動入帳`, or `發票匯入` when active.

- [ ] **Step 3: Add invoice payment edit state**

Add group state keyed by invoice number:

```ts
type InvoicePaymentEdit = {
  paymentToolType: "cash" | "credit_card";
  creditCardId: string;
  installmentCount: number;
};

const [invoicePaymentEdits, setInvoicePaymentEdits] =
  useState<Record<string, InvoicePaymentEdit>>({});
```

After loading rows, derive each invoice group's initial values from `buildExpenseDisplayRows(rows)`.

- [ ] **Step 4: Add the save function**

```ts
async function saveInvoicePayment(invoiceNumber: string) {
  const edit = invoicePaymentEdits[invoiceNumber];
  if (!edit) return;
  if (edit.paymentToolType === "credit_card" && !edit.creditCardId) {
    setMessage({ tone: "error", text: "請選擇信用卡。" });
    return;
  }

  setBusyExpenseId(invoiceNumber);
  try {
    await submitExpenseAction("updateInvoicePaymentSettings", {
      invoiceNumber,
      paymentToolType: edit.paymentToolType,
      creditCardId: edit.paymentToolType === "credit_card" ? edit.creditCardId : null,
      installmentCount: edit.paymentToolType === "credit_card" ? edit.installmentCount : 1
    });
    setMessage({ tone: "success", text: `已更新發票 ${invoiceNumber} 的支付方式與付款排程。` });
  } catch (caughtError) {
    setMessage({
      tone: "error",
      text: caughtError instanceof Error ? caughtError.message : "更新發票支付方式失敗。"
    });
  } finally {
    setBusyExpenseId(null);
  }
}
```

- [ ] **Step 5: Render group-level controls**

Replace the invoice summary payment label with:

```tsx
<div className="invoice-payment-editor">
  <select
    value={edit.paymentToolType}
    onChange={(event) => updateInvoicePaymentEdit(row.invoiceNumber, {
      paymentToolType: event.target.value === "credit_card" ? "credit_card" : "cash",
      creditCardId: event.target.value === "credit_card" ? edit.creditCardId : "",
      installmentCount: 1
    })}
  >
    <option value="cash">現金</option>
    <option value="credit_card">信用卡</option>
  </select>
  {edit.paymentToolType === "credit_card" ? (
    <>
      <select
        value={edit.creditCardId}
        onChange={(event) => updateInvoicePaymentEdit(row.invoiceNumber, {
          creditCardId: event.target.value
        })}
      >
        <option value="">請選擇信用卡</option>
        {creditCards.map((card) => (
          <option key={card.id} value={card.id}>{card.name}</option>
        ))}
      </select>
      <select
        value={edit.installmentCount}
        onChange={(event) => updateInvoicePaymentEdit(row.invoiceNumber, {
          installmentCount: Number(event.target.value)
        })}
      >
        {[1, 3, 6, 12, 18, 24, 30, 36].map((count) => (
          <option key={count} value={count}>{count} 期</option>
        ))}
      </select>
    </>
  ) : null}
  <button
    className="secondary-action"
    disabled={busyExpenseId === row.invoiceNumber || !paymentChanged}
    onClick={() => saveInvoicePayment(row.invoiceNumber)}
    type="button"
  >
    儲存支付方式
  </button>
</div>
```

Child item and discount rows continue to show `使用發票支付設定` and never expose independent payment controls.

- [ ] **Step 6: Add responsive styles**

Add styles that:

- Keep the group controls in one wrapping flex row.
- Give selects stable minimum widths.
- Preserve the existing table width and horizontal scroll on narrow screens.
- Reuse current `tag-button`, `secondary-action`, and form-control visual language.

- [ ] **Step 7: Run typecheck, tests, and build**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected:

- Typecheck passes.
- Tests pass.
- Next.js compilation succeeds. If the local process ends with the known Windows `spawn EPERM` after compilation, record it accurately rather than treating compilation as failed.

- [ ] **Step 8: Browser verification**

Start the local development server and verify desktop and mobile:

1. `手動入帳` and `發票匯入` are mutually exclusive and can be cleared.
2. `全部月份` reveals records outside the default two months.
3. Keyword search combines with all months.
4. Invoice summary controls fit without overlap.
5. Changing payment settings updates the summary after reload.
6. Child rows still allow item/budget editing but not payment editing.

- [ ] **Step 9: Commit**

```powershell
git add apps/web/src/app/expenses/expenses-client.tsx apps/web/src/app/globals.css
git commit -m "feat: edit invoice payments and filter expense sources"
```

### Task 7: Documentation And Final Verification

**Files:**
- Modify: `docs/work-log.md`

- [ ] **Step 1: Update the work log**

Record:

- All implementation commits.
- Supabase migration and RPC permissions.
- The controlled invoice reconstruction test.
- Test, typecheck, and build results.
- Production deployment remains pending user push.

- [ ] **Step 2: Run fresh verification**

Run:

```powershell
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github\apps\web"
npm test
npm run typecheck
npm run build
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github"
git diff --check
git status --short --branch
```

Expected: tests and typecheck pass, compilation succeeds, no whitespace errors, and only the user-owned `tests/rules.fixture.mjs` remains untracked.

- [ ] **Step 3: Commit documentation**

```powershell
git add docs/work-log.md
git commit -m "docs: record invoice payment and expense filters"
```

- [ ] **Step 4: Ask the user to deploy**

Provide the complete commands:

```powershell
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github"
git push origin main
```

- [ ] **Step 5: Verify Production after push**

Confirm Vercel Production is `READY` for the latest commit, then test:

- Source chips.
- All-month search.
- Invoice payment update.
- Bill drilldown and cash-flow reconstruction.
- No new Vercel runtime errors.
