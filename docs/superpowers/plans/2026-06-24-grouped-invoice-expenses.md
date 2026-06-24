# Grouped Invoice Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group Finance Ministry invoice lines by invoice number, preserve item and discount detail, classify each positive item independently, and create exactly one payment effect per invoice.

**Architecture:** Keep one `expenses` row per imported line so budget classification remains item-level, while adding explicit invoice metadata and a payment-parent relationship. Pure TypeScript functions calculate invoice groups and discount allocation; a PostgreSQL `SECURITY INVOKER` RPC performs grouped confirmation atomically under existing RLS. Review and expense pages consume grouped view models while manual expenses retain the current flat behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/PostgREST, Node assertion tests, existing CSS design system.

---

## File Structure

- Create: `apps/web/src/lib/accounting/invoice-grouping.ts` — pure invoice grouping, discount allocation, and grouped expense view-model helpers.
- Create: `apps/web/src/lib/accounting/invoice-grouping.test.ts` — regression tests for totals, allocation, tie-breaking, and grouping.
- Modify: `apps/web/src/lib/accounting/invoice-review.ts` — carry invoice number, source order, line type, and grouped confirmations.
- Modify: `apps/web/src/lib/accounting/invoice-review.test.ts` — verify grouped confirmation input behavior.
- Modify: `apps/web/src/lib/accounting/invoice-import-dedupe.ts` — keep line-level dedupe independent from invoice grouping.
- Modify: `apps/web/src/app/api/accounting/expense-entry/route.ts` — persist invoice metadata, call atomic confirmation RPC, and support grouped edits/deletes.
- Modify: `apps/web/src/lib/types.ts` — add invoice fields to `ExpenseRecord`.
- Modify: `apps/web/src/lib/data/supabase-mappers.ts` — map invoice fields from Supabase.
- Modify: `apps/web/src/lib/data/supabase-mappers.test.ts` — verify invoice field mapping.
- Modify: `apps/web/src/lib/data/supabase-repository.ts` — select invoice fields and return grouped-compatible records.
- Modify: `apps/web/src/app/review/review-client.tsx` — render and submit invoice groups.
- Modify: `apps/web/src/app/expenses/expenses-client.tsx` — render invoice summaries with expandable lines.
- Modify: `apps/web/src/styles/globals.css` — grouped invoice summary and detail styling.
- Create via `supabase migration new grouped_invoice_expenses`: Supabase migration containing columns, indexes, constraints, backfill, and RPC.
- Modify: `apps/web/package.json` — include invoice-grouping tests in `npm test`.
- Modify: `docs/data-model.md`, `docs/workflow.md`, `docs/work-log.md` — document final schema and behavior.

## Task 1: Pure Invoice Grouping and Discount Allocation

**Files:**
- Create: `apps/web/src/lib/accounting/invoice-grouping.ts`
- Create: `apps/web/src/lib/accounting/invoice-grouping.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing allocation tests**

```ts
import assert from "node:assert/strict";
import { allocateInvoiceDiscounts, groupInvoiceLines } from "./invoice-grouping.ts";

const lines = [
  { id: "1", invoiceNumber: "AW99003017", sourceOrder: 1, itemDescription: "Corn", originalAmount: 55 },
  { id: "2", invoiceNumber: "AW99003017", sourceOrder: 2, itemDescription: "Milk", originalAmount: 27 },
  { id: "3", invoiceNumber: "AW99003017", sourceOrder: 3, itemDescription: "Coupon", originalAmount: -1 }
];

const allocated = allocateInvoiceDiscounts(lines);
assert.deepEqual(allocated.map((line) => line.allocatedAmount), [54, 27, 0]);
assert.equal(allocated.find((line) => line.id === "3")?.lineType, "discount");
assert.equal(allocated.reduce((sum, line) => sum + line.originalAmount, 0), 81);
assert.equal(allocated.reduce((sum, line) => sum + line.allocatedAmount, 0), 81);

const tied = allocateInvoiceDiscounts([
  { id: "a", invoiceNumber: "X1", sourceOrder: 1, itemDescription: "A", originalAmount: 50 },
  { id: "b", invoiceNumber: "X1", sourceOrder: 2, itemDescription: "B", originalAmount: 50 },
  { id: "c", invoiceNumber: "X1", sourceOrder: 3, itemDescription: "Coupon", originalAmount: -10 }
]);
assert.deepEqual(tied.map((line) => line.allocatedAmount), [40, 50, 0]);

const groups = groupInvoiceLines(lines);
assert.equal(groups[0].invoiceNumber, "AW99003017");
assert.equal(groups[0].itemCount, 2);
assert.equal(groups[0].discountTotal, -1);
assert.equal(groups[0].paidTotal, 81);

assert.throws(
  () => allocateInvoiceDiscounts([
    { id: "d", invoiceNumber: "X2", sourceOrder: 1, itemDescription: "Coupon", originalAmount: -10 }
  ]),
  /positive item/
);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
cd apps/web
node --experimental-strip-types src/lib/accounting/invoice-grouping.test.ts
```

Expected: FAIL because `invoice-grouping.ts` does not exist.

- [ ] **Step 3: Implement the pure grouping module**

```ts
export type InvoiceLineInput = {
  id: string;
  invoiceNumber: string;
  sourceOrder: number;
  itemDescription: string;
  originalAmount: number;
};

export type AllocatedInvoiceLine = InvoiceLineInput & {
  lineType: "item" | "discount";
  allocatedAmount: number;
  discountApplied: number;
};

export type InvoiceGroup<T extends InvoiceLineInput = InvoiceLineInput> = {
  invoiceNumber: string;
  lines: T[];
  itemCount: number;
  discountTotal: number;
  paidTotal: number;
};

export function allocateInvoiceDiscounts(lines: InvoiceLineInput[]): AllocatedInvoiceLine[] {
  const positive = lines.filter((line) => line.originalAmount >= 0);
  const discounts = lines.filter((line) => line.originalAmount < 0);

  if (positive.length === 0) {
    throw new Error("Invoice must contain at least one positive item.");
  }

  const target = [...positive].sort(
    (a, b) => b.originalAmount - a.originalAmount || a.sourceOrder - b.sourceOrder
  )[0];
  const discountTotal = discounts.reduce((sum, line) => sum + line.originalAmount, 0);

  if (target.originalAmount + discountTotal < 0) {
    throw new Error("Invoice discount exceeds the highest positive item.");
  }

  return lines.map((line) => {
    if (line.originalAmount < 0) {
      return { ...line, lineType: "discount", allocatedAmount: 0, discountApplied: 0 };
    }

    const discountApplied = line.id === target.id ? discountTotal : 0;
    return {
      ...line,
      lineType: "item",
      allocatedAmount: line.originalAmount + discountApplied,
      discountApplied
    };
  });
}

export function groupInvoiceLines<T extends InvoiceLineInput>(lines: T[]): InvoiceGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    groups.set(line.invoiceNumber, [...(groups.get(line.invoiceNumber) ?? []), line]);
  }

  return [...groups.entries()].map(([invoiceNumber, groupedLines]) => ({
    invoiceNumber,
    lines: groupedLines.sort((a, b) => a.sourceOrder - b.sourceOrder),
    itemCount: groupedLines.filter((line) => line.originalAmount >= 0).length,
    discountTotal: groupedLines.filter((line) => line.originalAmount < 0).reduce((sum, line) => sum + line.originalAmount, 0),
    paidTotal: groupedLines.reduce((sum, line) => sum + line.originalAmount, 0)
  }));
}
```

- [ ] **Step 4: Add the test to the package script and verify GREEN**

Add this command before the invoice review test in `apps/web/package.json`:

```json
"node --experimental-strip-types src/lib/accounting/invoice-grouping.test.ts"
```

Run:

```powershell
npm test
npm run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/accounting/invoice-grouping.ts apps/web/src/lib/accounting/invoice-grouping.test.ts apps/web/package.json
git commit -m "feat: add invoice grouping calculations"
```

## Task 2: Add Invoice Metadata and Atomic Confirmation Schema

**Files:**
- Create via CLI: migration named `grouped_invoice_expenses`
- Modify generated migration file under `supabase/migrations/`

- [ ] **Step 1: Verify the Supabase CLI command and create the migration**

Run:

```powershell
supabase --version
supabase migration new grouped_invoice_expenses
```

Expected: CLI prints the exact generated migration path. Store that path in `$migration` for the remaining steps.

- [ ] **Step 2: Write the schema migration**

The migration must add:

```sql
create type public.expense_line_type as enum ('item', 'discount');

alter table public.invoice_drafts
  add column invoice_number text,
  add column source_order integer,
  add column line_type public.expense_line_type;

alter table public.expenses
  add column invoice_number text,
  add column original_amount numeric(14, 2),
  add column line_type public.expense_line_type,
  add column payment_parent_expense_id uuid,
  add column source_line_key text;

alter table public.expenses
  add constraint expenses_payment_parent_fk
  foreign key (household_id, payment_parent_expense_id)
  references public.expenses(household_id, id);

create index idx_invoice_drafts_household_invoice
  on public.invoice_drafts(household_id, invoice_number, source_order);

create index idx_expenses_household_invoice
  on public.expenses(household_id, invoice_number, created_at);

create unique index uq_expenses_household_source_line
  on public.expenses(household_id, source_line_key)
  where source_line_key is not null;
```

Backfill `invoice_drafts` only from the stable first segment of `source_line_key`:

```sql
update public.invoice_drafts
set invoice_number = nullif(split_part(source_line_key, '|', 1), ''),
    line_type = case when amount < 0 then 'discount'::public.expense_line_type else 'item'::public.expense_line_type end,
    source_order = coalesce(nullif(regexp_replace(source_line_key, '^.*\|([0-9]+)$', '\1'), source_line_key)::integer, 1)
where invoice_number is null;
```

Do not auto-group old expenses by date or merchant.

- [ ] **Step 3: Add the `SECURITY INVOKER` confirmation RPC**

Create a public function with this contract:

`````sql
create or replace function public.confirm_invoice_group(
  p_household_id uuid,
  p_invoice_number text,
  p_payment_tool_type public.payment_tool_type,
  p_credit_card_id uuid,
  p_installment_count integer,
  p_lines jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_draft_id uuid;
  v_payment_parent_id uuid;
  v_target_budget_item_id uuid;
  v_consumption_date date;
  v_paid_total numeric(14, 2);
  v_discount_total numeric(14, 2);
  v_target_amount numeric(14, 2);
  v_card public.credit_cards%rowtype;
  v_first_bill_month date;
  v_schedule_month date;
  v_schedule_amount numeric(14, 2);
  v_base_cents bigint;
  v_remainder bigint;
  v_sequence integer;
  v_created_count integer := 0;
  v_expected_items integer;
  v_submitted_items integer;
  v_expense_id uuid;
begin
  if v_user_id is null or not app_private.is_household_member(p_household_id) then
    raise exception 'Not authorized for household';
  end if;
  if nullif(btrim(p_invoice_number), '') is null then
    raise exception 'Invoice number is required';
  end if;
  if p_installment_count < 1 then
    raise exception 'Installment count must be positive';
  end if;
  if p_payment_tool_type = 'credit_card' and p_credit_card_id is null then
    raise exception 'Credit card is required';
  end if;
  if p_payment_tool_type = 'cash' and p_credit_card_id is not null then
    raise exception 'Cash payment cannot include a credit card';
  end if;

  perform 1
  from public.invoice_drafts
  where household_id = p_household_id
    and invoice_number = p_invoice_number
    and review_status = 'needs_review'
  for update;

  select count(*) filter (where amount >= 0),
         min(consumption_date),
         sum(amount),
         coalesce(sum(amount) filter (where amount < 0), 0)
  into v_expected_items, v_consumption_date, v_paid_total, v_discount_total
  from public.invoice_drafts
  where household_id = p_household_id
    and invoice_number = p_invoice_number
    and review_status = 'needs_review';

  if v_expected_items = 0 then
    raise exception 'Invoice must contain at least one positive item';
  end if;
  if v_paid_total < 0 then
    raise exception 'Invoice paid total cannot be negative';
  end if;

  select count(*) into v_submitted_items
  from jsonb_to_recordset(p_lines) as x(draft_id uuid, budget_item_id uuid, notes text);
  if v_submitted_items <> v_expected_items then
    raise exception 'Every positive invoice item requires a budget item';
  end if;

  select id, amount
  into v_target_draft_id, v_target_amount
  from public.invoice_drafts
  where household_id = p_household_id
    and invoice_number = p_invoice_number
    and review_status = 'needs_review'
    and amount >= 0
  order by amount desc, source_order asc, id asc
  limit 1;

  if v_target_amount + v_discount_total < 0 then
    raise exception 'Invoice discount exceeds the highest positive item';
  end if;

  create temporary table invoice_created_expenses (
    draft_id uuid primary key,
    expense_id uuid not null,
    budget_item_id uuid not null
  ) on commit drop;

  for v_target_draft_id, v_target_budget_item_id in
    select d.id, x.budget_item_id
    from public.invoice_drafts d
    join jsonb_to_recordset(p_lines) as x(draft_id uuid, budget_item_id uuid, notes text)
      on x.draft_id = d.id
    where d.household_id = p_household_id
      and d.invoice_number = p_invoice_number
      and d.review_status = 'needs_review'
      and d.amount >= 0
    order by d.source_order, d.id
  loop
    insert into public.expenses (
      household_id, user_id, consumption_date, budget_month, merchant_tax_id, merchant_name,
      item_description, budget_item_id, amount, original_amount, payment_tool_type, credit_card_id,
      is_installment, installment_count, status, invoice_number, line_type, source_line_key,
      source_system, source_table, source_row_id, notes, imported_at
    )
    select d.household_id, v_user_id, d.consumption_date, to_char(d.consumption_date, 'YYYY-MM'),
           d.merchant_tax_id, d.merchant_name, d.item_description, v_target_budget_item_id,
           d.amount + case when d.id = (
             select id from public.invoice_drafts
             where household_id = p_household_id and invoice_number = p_invoice_number
               and review_status = 'needs_review' and amount >= 0
             order by amount desc, source_order asc, id asc limit 1
           ) then v_discount_total else 0 end,
           d.amount, p_payment_tool_type, p_credit_card_id, p_installment_count > 1,
           p_installment_count, 'active', p_invoice_number, 'item', d.source_line_key,
           'finance_ministry_invoice', 'invoice_drafts', d.source_line_key,
           coalesce((select x.notes from jsonb_to_recordset(p_lines) as x(draft_id uuid, budget_item_id uuid, notes text)
                     where x.draft_id = d.id), d.notes), now()
    from public.invoice_drafts d
    where d.id = v_target_draft_id
    returning id into v_expense_id;

    insert into invoice_created_expenses values (v_target_draft_id, v_expense_id, v_target_budget_item_id);
    v_created_count := v_created_count + 1;
  end loop;

  select ice.expense_id, ice.budget_item_id
  into v_payment_parent_id, v_target_budget_item_id
  from invoice_created_expenses ice
  join public.invoice_drafts d on d.id = ice.draft_id
  order by d.amount desc, d.source_order asc, d.id asc
  limit 1;

  insert into public.expenses (
    household_id, user_id, consumption_date, budget_month, merchant_tax_id, merchant_name,
    item_description, budget_item_id, amount, original_amount, payment_tool_type, credit_card_id,
    is_installment, installment_count, status, invoice_number, line_type, payment_parent_expense_id,
    source_line_key, source_system, source_table, source_row_id, notes, imported_at
  )
  select d.household_id, v_user_id, d.consumption_date, to_char(d.consumption_date, 'YYYY-MM'),
         d.merchant_tax_id, d.merchant_name, d.item_description, v_target_budget_item_id,
         0, d.amount, p_payment_tool_type, p_credit_card_id, false, 1, 'active',
         p_invoice_number, 'discount', v_payment_parent_id, d.source_line_key,
         'finance_ministry_invoice', 'invoice_drafts', d.source_line_key, d.notes, now()
  from public.invoice_drafts d
  where d.household_id = p_household_id
    and d.invoice_number = p_invoice_number
    and d.review_status = 'needs_review'
    and d.amount < 0;

  update public.expenses
  set payment_parent_expense_id = v_payment_parent_id
  where household_id = p_household_id and invoice_number = p_invoice_number;

  if p_payment_tool_type = 'credit_card' then
    select * into v_card
    from public.credit_cards
    where household_id = p_household_id and id = p_credit_card_id and is_active;
    if not found then raise exception 'Credit card not found'; end if;
    v_first_bill_month := date_trunc('month', v_consumption_date)::date
      + case when extract(day from v_consumption_date) > v_card.cutoff_day then interval '1 month' else interval '0 month' end;
  end if;

  v_base_cents := trunc((v_paid_total * 100)::numeric / p_installment_count);
  v_remainder := round(v_paid_total * 100)::bigint - v_base_cents * p_installment_count;

  for v_sequence in 1..p_installment_count loop
    v_schedule_amount := (v_base_cents + case when v_sequence <= v_remainder then 1 else 0 end)::numeric / 100;
    v_schedule_month := case when p_payment_tool_type = 'cash'
      then date_trunc('month', v_consumption_date)::date
      else (v_first_bill_month + make_interval(months => v_sequence - 1))::date end;

    insert into public.payment_schedules (
      household_id, expense_id, payment_sequence, payment_date, cash_flow_month, payment_amount,
      payment_tool_type, credit_card_id, payment_status, source_system, source_table, source_row_id,
      imported_at
    ) values (
      p_household_id, v_payment_parent_id, v_sequence,
      case when p_payment_tool_type = 'cash' then v_consumption_date
           else make_date(extract(year from v_schedule_month)::integer,
                          extract(month from v_schedule_month)::integer,
                          least(v_card.payment_day,
                            extract(day from (date_trunc('month', v_schedule_month) + interval '1 month - 1 day'))::integer)) end,
      to_char(v_schedule_month, 'YYYY-MM'), v_schedule_amount, p_payment_tool_type,
      p_credit_card_id, 'estimated', 'finance_ministry_invoice', 'invoice_group_payment',
      p_invoice_number || '_P' || lpad(v_sequence::text, 2, '0'), now()
    );

    insert into public.cash_flow_months (
      household_id, cash_flow_month, cash_expense_total, credit_card_payment_total, net_cash_flow, generated_at
    ) values (
      p_household_id, to_char(v_schedule_month, 'YYYY-MM'),
      case when p_payment_tool_type = 'cash' then v_schedule_amount else 0 end,
      case when p_payment_tool_type = 'credit_card' then v_schedule_amount else 0 end,
      -v_schedule_amount, now()
    )
    on conflict (household_id, cash_flow_month) do update
    set cash_expense_total = public.cash_flow_months.cash_expense_total + excluded.cash_expense_total,
        credit_card_payment_total = public.cash_flow_months.credit_card_payment_total + excluded.credit_card_payment_total,
        net_cash_flow = public.cash_flow_months.income_total
          - (public.cash_flow_months.cash_expense_total + excluded.cash_expense_total)
          - (public.cash_flow_months.credit_card_payment_total + excluded.credit_card_payment_total),
        generated_at = now();

    if p_payment_tool_type = 'credit_card' then
      insert into public.credit_card_bill_estimates (
        household_id, credit_card_id, bill_month, estimated_payment_date,
        estimated_bill_amount, detail_count, generated_at
      ) values (
        p_household_id, p_credit_card_id, to_char(v_schedule_month, 'YYYY-MM'),
        make_date(extract(year from v_schedule_month)::integer,
                  extract(month from v_schedule_month)::integer,
                  least(v_card.payment_day,
                    extract(day from (date_trunc('month', v_schedule_month) + interval '1 month - 1 day'))::integer)),
        v_schedule_amount, 1, now()
      )
      on conflict (household_id, credit_card_id, bill_month) do update
      set estimated_bill_amount = public.credit_card_bill_estimates.estimated_bill_amount + excluded.estimated_bill_amount,
          detail_count = public.credit_card_bill_estimates.detail_count + 1,
          generated_at = now();
    end if;
  end loop;

  update public.invoice_drafts d
  set review_status = 'confirmed',
      confirmed_expense_id = ice.expense_id,
      updated_at = now()
  from invoice_created_expenses ice
  where d.id = ice.draft_id;

  update public.invoice_drafts d
  set review_status = 'confirmed',
      confirmed_expense_id = e.id,
      updated_at = now()
  from public.expenses e
  where d.household_id = p_household_id
    and d.invoice_number = p_invoice_number
    and d.amount < 0
    and e.household_id = d.household_id
    and e.source_line_key = d.source_line_key;

  return jsonb_build_object(
    'invoiceNumber', p_invoice_number,
    'insertedExpenses', v_created_count + (select count(*) from public.invoice_drafts where household_id = p_household_id and invoice_number = p_invoice_number and amount < 0),
    'paymentParentExpenseId', v_payment_parent_id,
    'paidTotal', v_paid_total
  );
end;
$$;

revoke all on function public.confirm_invoice_group(uuid, text, public.payment_tool_type, uuid, integer, jsonb) from public;
revoke all on function public.confirm_invoice_group(uuid, text, public.payment_tool_type, uuid, integer, jsonb) from anon;
grant execute on function public.confirm_invoice_group(uuid, text, public.payment_tool_type, uuid, integer, jsonb) to authenticated;
```

The SQL uses `jsonb_to_recordset`, locks the invoice drafts with `FOR UPDATE`, allocates all discounts to the highest positive line, inserts zero-budget-impact discount rows, creates schedules only for the payment-parent expense, updates monthly aggregates, and confirms every draft in the same transaction.

- [ ] **Step 4: Apply and verify on a Supabase development branch or transaction-safe test environment**

Use Supabase MCP/CLI to execute the migration SQL, then query:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('invoice_drafts', 'expenses')
  and column_name in ('invoice_number', 'source_order', 'line_type', 'original_amount', 'payment_parent_expense_id', 'source_line_key')
order by table_name, column_name;
```

Expected: all new columns returned.

Verify permissions:

```sql
select has_function_privilege('anon', 'public.confirm_invoice_group(uuid,text,public.payment_tool_type,uuid,integer,jsonb)', 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', 'public.confirm_invoice_group(uuid,text,public.payment_tool_type,uuid,integer,jsonb)', 'EXECUTE') as authenticated_execute;
```

Expected: `anon_execute = false`, `authenticated_execute = true`.

- [ ] **Step 5: Run database advisors and commit**

Run the available Supabase advisor command/MCP tool. Resolve any function search-path, RLS, or permission findings before committing.

```powershell
git add supabase/migrations
git commit -m "feat: add grouped invoice expense schema"
```

## Task 3: Persist Invoice Number and Line Metadata During Import

**Files:**
- Modify: `apps/web/src/app/api/accounting/expense-entry/route.ts`
- Modify: `apps/web/src/lib/accounting/invoice-import-dedupe.test.ts`

- [ ] **Step 1: Write a failing parser test around exported pure normalization**

Extract `normalizeInvoiceRow` and `parseInvoiceText` into a testable export or move them to `invoice-grouping.ts`. Add assertions:

```ts
const parsed = parseInvoiceText([
  "發票日期,發票號碼,賣方統一編號,賣方名稱,消費明細_金額,消費明細_品名",
  "20260605,AW99003017,60383907,統一超商,55,糯玉米",
  "20260605,AW99003017,60383907,統一超商,-1,OPEN錢包聯邦"
].join("\n"));

assert.equal(parsed[0].invoiceNumber, "AW99003017");
assert.equal(parsed[0].sourceOrder, 1);
assert.equal(parsed[0].lineType, "item");
assert.equal(parsed[1].sourceOrder, 2);
assert.equal(parsed[1].lineType, "discount");
assert.notEqual(parsed[0].sourceLineKey, parsed[1].sourceLineKey);
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
cd apps/web
node --experimental-strip-types src/lib/accounting/invoice-import-dedupe.test.ts
```

Expected: FAIL because invoice metadata is not returned.

- [ ] **Step 3: Extend import types and persistence**

Update `InvoiceDraftInput`:

```ts
type InvoiceDraftInput = {
  invoiceNumber: string;
  sourceOrder: number;
  lineType: "item" | "discount";
  sourceRecordId: string;
  consumptionDate: string;
  merchantTaxId: string;
  merchantName: string;
  itemDescription: string;
  amount: number;
  sourceLineKey: string;
};
```

Persist these columns in the `invoice_drafts` upsert:

```ts
invoice_number: row.invoiceNumber,
source_order: row.sourceOrder,
line_type: row.lineType,
```

Keep `source_line_key` uniqueness unchanged. Remove invoice/date-level blocking from `shouldSkipInvoiceImportRow`; only exact source-line keys and existing active expenses with the same `source_line_key` may block a line.

- [ ] **Step 4: Verify focused and full tests**

```powershell
npm test
npm run typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/api/accounting/expense-entry/route.ts apps/web/src/lib/accounting/invoice-import-dedupe.ts apps/web/src/lib/accounting/invoice-import-dedupe.test.ts
git commit -m "feat: preserve invoice grouping metadata on import"
```

## Task 4: Build Grouped Review Models and Controls

**Files:**
- Modify: `apps/web/src/lib/accounting/invoice-review.ts`
- Modify: `apps/web/src/lib/accounting/invoice-review.test.ts`
- Modify: `apps/web/src/lib/data/supabase-repository.ts`
- Modify: `apps/web/src/app/review/review-client.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Write failing grouped review tests**

Add invoice fields to fixtures and assert:

```ts
const groups = buildInvoiceDraftGroups(reviewItems);
assert.equal(groups.length, 1);
assert.equal(groups[0].invoiceNumber, "AW99003017");
assert.equal(groups[0].paidTotal, 81);
assert.equal(groups[0].itemLines.length, 2);
assert.equal(groups[0].discountLines.length, 1);
```

Also assert `buildInvoiceGroupConfirmation` accepts one shared payment configuration and item-specific budget selections.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --experimental-strip-types src/lib/accounting/invoice-review.test.ts
```

Expected: FAIL because grouped helpers are missing.

- [ ] **Step 3: Extend review types and repository select**

Add to `InvoiceDraftReviewRow` and `InvoiceDraftReviewItem`:

```ts
invoice_number: string;
source_order: number;
line_type: "item" | "discount";
```

Select them in both review reads:

```ts
"id,invoice_number,source_order,line_type,source_line_key,consumption_date,merchant_tax_id,merchant_name,item_description,amount,suggested_payment_tool_type,suggested_credit_card_id,suggested_budget_item_id,legacy_suggested_budget_item,review_status,notes"
```

Add `buildInvoiceDraftGroups()` using `groupInvoiceLines()` and return groups sorted by consumption date then invoice number.

- [ ] **Step 4: Change review selection from line IDs to invoice numbers**

In `review-client.tsx`:

- `selectedIds` becomes `selectedInvoiceNumbers`.
- Shared payment/card/installment state is stored per invoice number.
- Budget edits remain stored per positive draft ID.
- Discount rows render read-only with negative amount and no budget selector.
- The confirm request shape becomes:

```ts
{
  action: "confirmInvoiceGroups",
  groups: [{
    invoiceNumber,
    paymentToolType,
    creditCardId,
    installmentCount,
    lines: itemLines.map((line) => ({
      draftId: line.id,
      budgetItemId: draftEdits[line.id].budgetItemId,
      notes: draftEdits[line.id].notes
    }))
  }]
}
```

- [ ] **Step 5: Add grouped review styling**

Add stable classes such as:

```css
.invoice-review-group { border-top: 1px solid var(--line); padding: 16px 0; }
.invoice-review-summary { display: grid; grid-template-columns: minmax(160px, 1fr) auto auto; gap: 12px; align-items: center; }
.invoice-review-lines { margin-top: 12px; }
.invoice-discount-row { color: var(--rose); }
```

Use existing buttons and form controls; do not introduce nested cards.

- [ ] **Step 6: Run tests and typecheck**

```powershell
npm test
npm run typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/lib/accounting/invoice-review.ts apps/web/src/lib/accounting/invoice-review.test.ts apps/web/src/lib/data/supabase-repository.ts apps/web/src/app/review/review-client.tsx apps/web/src/styles/globals.css
git commit -m "feat: group invoice drafts in review"
```

## Task 5: Call the Atomic Group Confirmation RPC

**Files:**
- Modify: `apps/web/src/app/api/accounting/expense-entry/route.ts`
- Create: `apps/web/src/lib/accounting/invoice-confirmation.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write failing payload validation tests**

Extract `validateInvoiceGroupConfirmation` as a pure function. Test:

```ts
assert.throws(() => validateInvoiceGroupConfirmation({ invoiceNumber: "", lines: [] }), /Invoice number/);
assert.throws(() => validateInvoiceGroupConfirmation({
  invoiceNumber: "AW1",
  paymentToolType: "credit_card",
  creditCardId: "",
  installmentCount: 1,
  lines: [{ draftId: "d1", budgetItemId: "b1" }]
}), /Credit card/);
```

- [ ] **Step 2: Run test and verify RED**

```powershell
node --experimental-strip-types src/lib/accounting/invoice-confirmation.test.ts
```

Expected: FAIL because validator does not exist.

- [ ] **Step 3: Add a reusable RPC caller**

```ts
async function supabaseRpc<T>(
  requestConfig: SupabaseRequestConfig,
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${requestConfig.restUrl}/rpc/${functionName}`, {
    method: "POST",
    headers: requestConfig.headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`執行 ${functionName} 失敗：${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}
```

- [ ] **Step 4: Implement `confirmInvoiceGroups` action**

For each validated group, call:

```ts
await supabaseRpc(requestConfig, "confirm_invoice_group", {
  p_household_id: references.householdId,
  p_invoice_number: group.invoiceNumber,
  p_payment_tool_type: group.paymentToolType,
  p_credit_card_id: group.paymentToolType === "credit_card" ? group.creditCardId : null,
  p_installment_count: group.installmentCount,
  p_lines: group.lines
});
```

Return aggregated counts. Keep the old `confirmInvoiceDrafts` action temporarily for compatibility, but remove its UI caller in Task 4.

- [ ] **Step 5: Verify tests, typecheck, and an authenticated RPC call on a development branch**

```powershell
npm test
npm run typecheck
```

Then confirm a fixture invoice and query:

```sql
select invoice_number, line_type, original_amount, amount, payment_parent_expense_id
from public.expenses
where invoice_number = 'TEST-GROUP-001'
order by created_at;

select count(*) as schedules, sum(payment_amount) as scheduled_total
from public.payment_schedules ps
join public.expenses e on e.id = ps.expense_id
where e.invoice_number = 'TEST-GROUP-001';
```

Expected: item and discount rows preserved; scheduled total equals invoice paid total; only the payment-parent expense has schedules.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/app/api/accounting/expense-entry/route.ts apps/web/src/lib/accounting/invoice-confirmation.test.ts apps/web/package.json
git commit -m "feat: confirm invoice groups atomically"
```

## Task 6: Map and Group Confirmed Expenses

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/data/supabase-mappers.ts`
- Modify: `apps/web/src/lib/data/supabase-mappers.test.ts`
- Modify: `apps/web/src/lib/data/supabase-repository.ts`
- Modify: `apps/web/src/lib/accounting/invoice-grouping.ts`
- Modify: `apps/web/src/lib/accounting/invoice-grouping.test.ts`

- [ ] **Step 1: Write failing mapper and view-model tests**

Assert mapped expense fields:

```ts
assert.equal(expenses[0].invoiceNumber, "AW99003017");
assert.equal(expenses[0].originalAmount, 55);
assert.equal(expenses[0].lineType, "item");
assert.equal(expenses[0].paymentParentExpenseId, expenses[0].id);
```

Assert `buildExpenseDisplayRows()` returns one invoice group plus unchanged manual rows.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
node --experimental-strip-types src/lib/data/supabase-mappers.test.ts
node --experimental-strip-types src/lib/accounting/invoice-grouping.test.ts
```

Expected: FAIL on missing fields/helper.

- [ ] **Step 3: Extend `ExpenseRecord`**

```ts
invoiceNumber?: string;
originalAmount?: number;
lineType?: "item" | "discount";
paymentParentExpenseId?: string;
sourceLineKey?: string;
```

Update the repository select and mapper for these columns.

- [ ] **Step 4: Add expense display view models**

```ts
export type ExpenseDisplayRow =
  | { kind: "manual"; expense: ExpenseRecord }
  | { kind: "invoice"; invoiceNumber: string; expenses: ExpenseRecord[]; paidTotal: number; discountTotal: number; itemCount: number };
```

`buildExpenseDisplayRows()` groups only records with a non-empty invoice number. Preserve the first-occurrence ordering from the filtered expense list.

- [ ] **Step 5: Run full verification and commit**

```powershell
npm test
npm run typecheck
git add apps/web/src/lib/types.ts apps/web/src/lib/data/supabase-mappers.ts apps/web/src/lib/data/supabase-mappers.test.ts apps/web/src/lib/data/supabase-repository.ts apps/web/src/lib/accounting/invoice-grouping.ts apps/web/src/lib/accounting/invoice-grouping.test.ts
git commit -m "feat: map grouped invoice expenses"
```

## Task 7: Render Expandable Invoice Groups in Expense Details

**Files:**
- Modify: `apps/web/src/app/expenses/expenses-client.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Refactor rendering to consume `ExpenseDisplayRow[]`**

Compute:

```ts
const displayRows = useMemo(() => buildExpenseDisplayRows(visibleExpenses), [visibleExpenses]);
```

Maintain `expandedInvoices: Set<string>` and use an icon-only chevron button with an accessible label:

```tsx
<button
  className="invoice-expand-button"
  aria-label={expanded ? `收合發票 ${row.invoiceNumber}` : `展開發票 ${row.invoiceNumber}`}
  onClick={() => toggleInvoice(row.invoiceNumber)}
  type="button"
>
  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
</button>
```

Use the project icon library if present; otherwise use a text disclosure symbol without adding a dependency.

- [ ] **Step 2: Render the invoice summary row**

The summary must show date, merchant, invoice number, item count, discount total, payment label, and paid total. Use a single `<tbody>` fragment per invoice and an expanded detail row with `colSpan={8}`.

- [ ] **Step 3: Render editable item lines and read-only discount lines**

Positive items reuse existing name, budget, amount, save, and delete controls. Discount lines show original negative amount and no budget/payment controls. Display the allocated item as:

```tsx
<span>{formatCurrency(expense.originalAmount ?? expense.amount)}</span>
{discountApplied !== 0 ? <span className="muted">折扣 {formatCurrency(discountApplied)}</span> : null}
<strong>計入 {formatCurrency(expense.amount)}</strong>
```

- [ ] **Step 4: Route grouped amount/delete changes through group-aware actions**

Add API actions:

- `updateInvoiceLine`: update an item or discount original amount, recompute allocation, payment schedule, bill estimate, and cash-flow aggregates in one RPC.
- `deleteInvoiceLine`: delete/cancel a line, recompute allocation; reject deleting the final positive item.
- `deleteInvoiceGroup`: cancel all expenses and schedules for the invoice.

Do not reuse the current `updateExpenseDetails` amount path for grouped invoice rows because it rejects installments and cannot recompute siblings.

- [ ] **Step 5: Add responsive CSS**

Use stable grid/table dimensions, no nested cards, and make expanded details horizontally scrollable below 920px. Ensure invoice numbers and long item names wrap without overlapping controls.

- [ ] **Step 6: Run automated checks**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: tests/typecheck pass; build compiles. If the known Windows child-process `spawn EPERM` occurs after successful compilation, record it separately.

- [ ] **Step 7: Run browser QA**

Target flow:

`/expenses -> invoice summary -> expand -> verify positive items and discount -> edit budget item -> collapse`

Check page identity, nonblank content, no framework overlay, console errors, screenshot evidence, and one mobile viewport. Also verify a manual expense still renders as a normal single row.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/src/app/expenses/expenses-client.tsx apps/web/src/app/api/accounting/expense-entry/route.ts apps/web/src/styles/globals.css
git commit -m "feat: show expandable invoice expense groups"
```

## Task 8: Backfill Reliably Identifiable Existing Data

**Files:**
- Modify the grouped-invoice Supabase migration or create a second CLI-generated migration named `backfill_invoice_numbers`
- Create: `docs/superpowers/reports/2026-06-24-invoice-backfill-report.md`

- [ ] **Step 1: Produce a dry-run report query**

Query candidates where an expense can be matched to exactly one confirmed draft by `source_line_key/source_row_id`:

```sql
with candidates as (
  select e.id as expense_id,
         d.invoice_number,
         d.source_line_key,
         count(*) over (partition by e.id) as match_count
  from public.expenses e
  join public.invoice_drafts d
    on d.household_id = e.household_id
   and d.review_status = 'confirmed'
   and (e.source_row_id = d.source_line_key or e.source_line_key = d.source_line_key)
  where e.invoice_number is null
)
select count(*) filter (where match_count = 1) as safe_matches,
       count(*) filter (where match_count <> 1) as ambiguous_matches
from candidates;
```

- [ ] **Step 2: Backfill only exact one-to-one matches**

Update `invoice_number`, `original_amount`, `line_type`, and `source_line_key` only for `match_count = 1`. Do not assign `payment_parent_expense_id` automatically unless all lines of the invoice and their schedules can be reconciled exactly.

- [ ] **Step 3: Reconcile totals before applying payment-parent grouping**

For every proposed group require:

```sql
sum(invoice_drafts.amount) = sum(expenses.amount)
```

and require exactly one existing payment schedule owner or an exact schedule-total match. Leave all failing groups ungrouped and list counts in the report.

- [ ] **Step 4: Verify no accidental same-day merchant grouping**

Query several high-volume merchants and confirm every grouped expense has a matching invoice draft source key. The report must state candidate count, applied count, skipped ambiguous count, and skipped unreconciled count.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations docs/superpowers/reports/2026-06-24-invoice-backfill-report.md
git commit -m "data: backfill reliable invoice expense groups"
```

## Task 9: Documentation, Production Deployment, and End-to-End Verification

**Files:**
- Modify: `docs/data-model.md`
- Modify: `docs/workflow.md`
- Modify: `docs/work-log.md`

- [ ] **Step 1: Update documentation**

Document:

- `invoice_number`, `original_amount`, `line_type`, `payment_parent_expense_id`, and `source_line_key`.
- Invoice-number grouping versus source-line dedupe.
- Highest-positive-item discount allocation and tie-breaking.
- One payment schedule owner per invoice.
- Group-aware edit/delete behavior.

- [ ] **Step 2: Run final local verification**

```powershell
cd apps/web
npm test
npm run typecheck
npm run build
cd ../..
git diff --check
git status --short --branch
```

Expected: tests and typecheck pass; build compiles; only known unrelated `tests/rules.fixture.mjs` remains untracked.

- [ ] **Step 3: Commit documentation**

```powershell
git add docs/data-model.md docs/workflow.md docs/work-log.md
git commit -m "docs: record grouped invoice expense workflow"
```

- [ ] **Step 4: Ask the user to deploy**

Do not run `git push`. Tell the user to execute:

```powershell
git push origin main
```

- [ ] **Step 5: Verify Vercel and production data**

After the user pushes:

1. Confirm the latest Vercel deployment is `READY` for the expected commit.
2. Import a fixture with two positive items and one negative discount.
3. Confirm the review page shows one invoice group and item-level budget selectors.
4. Confirm it creates one expense group, preserves discount detail, and creates one payment effect.
5. Open `/expenses`, expand the invoice, and verify totals and item rows.
6. Re-import the same file and verify exact line dedupe prevents duplicates.
7. Capture desktop and mobile screenshots and record results in `docs/work-log.md`.