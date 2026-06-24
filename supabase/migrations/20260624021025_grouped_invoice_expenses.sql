do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_line_type') then
    create type public.expense_line_type as enum ('item', 'discount');
  end if;
end
$$;

alter table public.invoice_drafts
  add column if not exists invoice_number text,
  add column if not exists source_order integer,
  add column if not exists line_type public.expense_line_type;

alter table public.expenses
  add column if not exists invoice_number text,
  add column if not exists original_amount numeric(14, 2),
  add column if not exists line_type public.expense_line_type,
  add column if not exists payment_parent_expense_id uuid,
  add column if not exists source_line_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'expenses_payment_parent_fk'
  ) then
    alter table public.expenses
      add constraint expenses_payment_parent_fk
      foreign key (household_id, payment_parent_expense_id)
      references public.expenses(household_id, id);
  end if;
end
$$;

create index if not exists idx_invoice_drafts_household_invoice
  on public.invoice_drafts(household_id, invoice_number, source_order);

create index if not exists idx_expenses_household_invoice
  on public.expenses(household_id, invoice_number, created_at);

create index if not exists idx_expenses_household_payment_parent
  on public.expenses(household_id, payment_parent_expense_id)
  where payment_parent_expense_id is not null;

create unique index if not exists uq_expenses_household_source_line
  on public.expenses(household_id, source_line_key)
  where source_line_key is not null;

update public.invoice_drafts
set invoice_number = nullif(split_part(source_line_key, '|', 1), ''),
    line_type = case
      when amount < 0 then 'discount'::public.expense_line_type
      else 'item'::public.expense_line_type
    end,
    source_order = case
      when source_line_key ~ '\|[0-9]+$'
        then substring(source_line_key from '\|([0-9]+)$')::integer
      else 1
    end
where invoice_number is null;

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
  v_payment_parent_id uuid;
  v_target_draft_id uuid;
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
  v_expected_items integer;
  v_submitted_items integer;
  v_matched_items integer;
  v_created_count integer := 0;
  v_discount_count integer := 0;
  v_expense_id uuid;
  v_line record;
begin
  if v_user_id is null or not app_private.is_household_member(p_household_id) then
    raise exception 'Not authorized for household';
  end if;

  if nullif(btrim(p_invoice_number), '') is null then
    raise exception 'Invoice number is required';
  end if;

  if p_installment_count is null or p_installment_count < 1 then
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

  if not found then
    raise exception 'No pending invoice drafts found';
  end if;

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

  select count(*), count(distinct x.draft_id)
  into v_submitted_items, v_matched_items
  from jsonb_to_recordset(p_lines) as x(draft_id uuid, budget_item_id uuid, notes text);

  if v_submitted_items <> v_expected_items or v_matched_items <> v_expected_items then
    raise exception 'Every positive invoice item requires one budget item';
  end if;

  select count(*)
  into v_matched_items
  from public.invoice_drafts d
  join jsonb_to_recordset(p_lines) as x(draft_id uuid, budget_item_id uuid, notes text)
    on x.draft_id = d.id
  join public.budget_items b
    on b.household_id = d.household_id and b.id = x.budget_item_id and b.is_active
  where d.household_id = p_household_id
    and d.invoice_number = p_invoice_number
    and d.review_status = 'needs_review'
    and d.amount >= 0;

  if v_matched_items <> v_expected_items then
    raise exception 'Submitted invoice items or budget items are invalid';
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

  if p_payment_tool_type = 'credit_card' then
    select *
    into v_card
    from public.credit_cards
    where household_id = p_household_id
      and id = p_credit_card_id
      and is_active;

    if not found then
      raise exception 'Credit card not found';
    end if;
  end if;

  create temporary table invoice_created_expenses (
    draft_id uuid primary key,
    expense_id uuid not null,
    budget_item_id uuid not null
  ) on commit drop;

  for v_line in
    select d.*, x.budget_item_id, x.notes as confirmation_notes
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
      item_description, budget_item_id, legacy_budget_item, amount, original_amount,
      payment_tool_type, credit_card_id, is_installment, installment_count, status,
      invoice_number, line_type, source_line_key, source_system, source_table, source_row_id,
      notes, imported_at
    ) values (
      p_household_id, v_user_id, v_line.consumption_date,
      to_char(v_line.consumption_date, 'YYYY-MM'), v_line.merchant_tax_id,
      v_line.merchant_name, v_line.item_description, v_line.budget_item_id,
      (select coalesce(legacy_name, legacy_id, name) from public.budget_items where id = v_line.budget_item_id),
      v_line.amount + case when v_line.id = v_target_draft_id then v_discount_total else 0 end,
      v_line.amount, p_payment_tool_type, p_credit_card_id, p_installment_count > 1,
      p_installment_count, 'active', p_invoice_number, 'item', v_line.source_line_key,
      'finance_ministry_invoice', 'invoice_drafts', v_line.source_line_key,
      coalesce(v_line.confirmation_notes, v_line.notes), now()
    ) returning id into v_expense_id;

    insert into invoice_created_expenses(draft_id, expense_id, budget_item_id)
    values (v_line.id, v_expense_id, v_line.budget_item_id);

    v_created_count := v_created_count + 1;
  end loop;

  select ice.expense_id, ice.budget_item_id
  into v_payment_parent_id, v_target_budget_item_id
  from invoice_created_expenses ice
  where ice.draft_id = v_target_draft_id;

  insert into public.expenses (
    household_id, user_id, consumption_date, budget_month, merchant_tax_id, merchant_name,
    item_description, budget_item_id, legacy_budget_item, amount, original_amount,
    payment_tool_type, credit_card_id, is_installment, installment_count, status,
    invoice_number, line_type, payment_parent_expense_id, source_line_key, source_system,
    source_table, source_row_id, notes, imported_at
  )
  select d.household_id, v_user_id, d.consumption_date, to_char(d.consumption_date, 'YYYY-MM'),
         d.merchant_tax_id, d.merchant_name, d.item_description, v_target_budget_item_id,
         (select coalesce(legacy_name, legacy_id, name) from public.budget_items where id = v_target_budget_item_id),
         0, d.amount, p_payment_tool_type, p_credit_card_id, false, 1, 'active',
         p_invoice_number, 'discount', v_payment_parent_id, d.source_line_key,
         'finance_ministry_invoice', 'invoice_drafts', d.source_line_key, d.notes, now()
  from public.invoice_drafts d
  where d.household_id = p_household_id
    and d.invoice_number = p_invoice_number
    and d.review_status = 'needs_review'
    and d.amount < 0;

  get diagnostics v_discount_count = row_count;

  update public.expenses
  set payment_parent_expense_id = v_payment_parent_id
  where household_id = p_household_id
    and invoice_number = p_invoice_number;

  if p_payment_tool_type = 'credit_card' then
    v_first_bill_month := date_trunc('month', v_consumption_date)::date
      + case
          when extract(day from v_consumption_date) > v_card.cutoff_day then interval '1 month'
          else interval '0 month'
        end;
  end if;

  v_base_cents := trunc((v_paid_total * 100)::numeric / p_installment_count);
  v_remainder := round(v_paid_total * 100)::bigint - v_base_cents * p_installment_count;

  for v_sequence in 1..p_installment_count loop
    v_schedule_amount := (v_base_cents + case when v_sequence <= v_remainder then 1 else 0 end)::numeric / 100;
    v_schedule_month := case
      when p_payment_tool_type = 'cash' then date_trunc('month', v_consumption_date)::date
      else (v_first_bill_month + make_interval(months => v_sequence - 1))::date
    end;

    insert into public.payment_schedules (
      household_id, expense_id, payment_sequence, payment_date, cash_flow_month,
      payment_amount, payment_tool_type, credit_card_id, payment_status, source_system,
      source_table, source_row_id, imported_at
    ) values (
      p_household_id, v_payment_parent_id, v_sequence,
      case
        when p_payment_tool_type = 'cash' then v_consumption_date
        else make_date(
          extract(year from v_schedule_month)::integer,
          extract(month from v_schedule_month)::integer,
          least(
            v_card.payment_day,
            extract(day from (date_trunc('month', v_schedule_month) + interval '1 month - 1 day'))::integer
          )
        )
      end,
      to_char(v_schedule_month, 'YYYY-MM'), v_schedule_amount, p_payment_tool_type,
      p_credit_card_id, 'estimated', 'finance_ministry_invoice', 'invoice_group_payment',
      p_invoice_number || '_P' || lpad(v_sequence::text, 2, '0'), now()
    );

    insert into public.cash_flow_months (
      household_id, cash_flow_month, cash_expense_total, credit_card_payment_total,
      net_cash_flow, generated_at
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
        make_date(
          extract(year from v_schedule_month)::integer,
          extract(month from v_schedule_month)::integer,
          least(
            v_card.payment_day,
            extract(day from (date_trunc('month', v_schedule_month) + interval '1 month - 1 day'))::integer
          )
        ),
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
    and d.review_status = 'needs_review'
    and d.amount < 0
    and e.household_id = d.household_id
    and e.source_line_key = d.source_line_key;

  return jsonb_build_object(
    'invoiceNumber', p_invoice_number,
    'insertedExpenses', v_created_count + v_discount_count,
    'paymentParentExpenseId', v_payment_parent_id,
    'paidTotal', v_paid_total
  );
end;
$$;

revoke all on function public.confirm_invoice_group(uuid, text, public.payment_tool_type, uuid, integer, jsonb) from public;
revoke all on function public.confirm_invoice_group(uuid, text, public.payment_tool_type, uuid, integer, jsonb) from anon;
grant execute on function public.confirm_invoice_group(uuid, text, public.payment_tool_type, uuid, integer, jsonb) to authenticated;