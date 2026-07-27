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
  v_target_budget_item_id uuid;
  v_consumption_date date;
  v_paid_total numeric(14, 2);
  v_discount_total numeric(14, 2);
  v_positive_total numeric(14, 2);
  v_discount_remaining numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_allocated_amount numeric(14, 2);
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
         coalesce(sum(amount) filter (where amount < 0), 0),
         coalesce(sum(amount) filter (where amount >= 0), 0)
  into v_expected_items, v_consumption_date, v_paid_total, v_discount_total, v_positive_total
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

  if abs(v_discount_total) > v_positive_total then
    raise exception 'Invoice discount exceeds positive items total';
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
    budget_item_id uuid not null,
    allocated_amount numeric(14, 2) not null
  ) on commit drop;

  create temporary table invoice_allocated_lines (
    draft_id uuid primary key,
    allocated_amount numeric(14, 2) not null,
    discount_applied numeric(14, 2) not null
  ) on commit drop;

  v_discount_remaining := abs(v_discount_total);

  for v_line in
    select id, amount
    from public.invoice_drafts
    where household_id = p_household_id
      and invoice_number = p_invoice_number
      and review_status = 'needs_review'
      and amount >= 0
    order by amount desc, source_order asc, id asc
  loop
    v_line_discount := -least(v_line.amount, v_discount_remaining);
    v_allocated_amount := v_line.amount + v_line_discount;

    insert into invoice_allocated_lines(draft_id, allocated_amount, discount_applied)
    values (v_line.id, v_allocated_amount, v_line_discount);

    v_discount_remaining := v_discount_remaining - abs(v_line_discount);
  end loop;

  if v_discount_remaining > 0 then
    raise exception 'Invoice discount exceeds positive items total';
  end if;

  for v_line in
    select d.*, x.budget_item_id, x.notes as confirmation_notes, a.allocated_amount
    from public.invoice_drafts d
    join invoice_allocated_lines a
      on a.draft_id = d.id
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
      v_line.allocated_amount,
      v_line.amount, p_payment_tool_type, p_credit_card_id, p_installment_count > 1,
      p_installment_count, 'active', p_invoice_number, 'item', v_line.source_line_key,
      'finance_ministry_invoice', 'invoice_drafts', v_line.source_line_key,
      coalesce(v_line.confirmation_notes, v_line.notes), now()
    ) returning id into v_expense_id;

    insert into invoice_created_expenses(draft_id, expense_id, budget_item_id, allocated_amount)
    values (v_line.id, v_expense_id, v_line.budget_item_id, v_line.allocated_amount);

    v_created_count := v_created_count + 1;
  end loop;

  select ice.expense_id, ice.budget_item_id
  into v_payment_parent_id, v_target_budget_item_id
  from invoice_created_expenses ice
  join public.invoice_drafts d on d.id = ice.draft_id
  order by case when ice.allocated_amount > 0 then 0 else 1 end,
           ice.allocated_amount desc,
           d.amount desc,
           d.source_order asc,
           d.id asc
  limit 1;

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