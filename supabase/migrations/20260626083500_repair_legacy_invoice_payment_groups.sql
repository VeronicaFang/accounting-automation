create or replace function public.update_invoice_payment_settings(
  p_household_id uuid,
  p_invoice_number text,
  p_payment_tool_type public.payment_tool_type,
  p_credit_card_id uuid,
  p_installment_count integer
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice_number text := btrim(p_invoice_number);
  v_effective_credit_card_id uuid;
  v_effective_installment_count integer;
  v_payment_parent_id uuid;
  v_expense_count integer;
  v_parent_count integer;
  v_parent_reference_count integer;
  v_distinct_parent_count integer;
  v_null_original_amount_count integer;
  v_non_estimated_schedule_count integer;
  v_consumption_date_count integer;
  v_consumption_date date;
  v_paid_total numeric(14, 2);
  v_card public.credit_cards%rowtype;
  v_first_bill_month date;
  v_schedule_month date;
  v_schedule_amount numeric(14, 2);
  v_base_cents bigint;
  v_remainder bigint;
  v_sequence integer;
  v_old_schedule record;
  v_existing_schedule_count integer;
  v_existing_schedule_total numeric(14, 2);
begin
  if v_user_id is null or not app_private.is_household_owner(p_household_id) then
    raise exception 'Not authorized for household';
  end if;

  if nullif(v_invoice_number, '') is null then
    raise exception 'Invoice number is required';
  end if;

  if p_payment_tool_type is null then
    raise exception 'Payment tool type is required';
  end if;

  if p_payment_tool_type = 'cash' then
    if p_installment_count is not null and p_installment_count not in (1, 3, 6, 12, 18, 24, 30, 36) then
      raise exception 'Unsupported installment count';
    end if;

    v_effective_credit_card_id := null;
    v_effective_installment_count := 1;
  else
    if p_installment_count is null or p_installment_count not in (1, 3, 6, 12, 18, 24, 30, 36) then
      raise exception 'Unsupported installment count';
    end if;

    if p_credit_card_id is null then
      raise exception 'Credit card is required';
    end if;

    select *
    into v_card
    from public.credit_cards
    where household_id = p_household_id
      and id = p_credit_card_id
      and is_active;

    if not found then
      raise exception 'Credit card not found';
    end if;

    v_effective_credit_card_id := p_credit_card_id;
    v_effective_installment_count := p_installment_count;
  end if;

  perform 1
  from public.expenses
  where household_id = p_household_id
    and invoice_number = v_invoice_number
    and status = 'active'
  for update;

  if not found then
    raise exception 'No active invoice expenses found';
  end if;

  select
    count(*),
    count(payment_parent_expense_id),
    count(distinct payment_parent_expense_id),
    count(*) filter (where original_amount is null),
    coalesce(sum(original_amount), 0),
    count(distinct consumption_date),
    min(consumption_date)
  into
    v_expense_count,
    v_parent_reference_count,
    v_distinct_parent_count,
    v_null_original_amount_count,
    v_paid_total,
    v_consumption_date_count,
    v_consumption_date
  from public.expenses
  where household_id = p_household_id
    and invoice_number = v_invoice_number
    and status = 'active';

  if v_null_original_amount_count <> 0 then
    raise exception 'Invoice group is missing original amounts';
  end if;

  if v_paid_total < 0 then
    raise exception 'Invoice paid total cannot be negative';
  end if;

  if v_consumption_date_count <> 1 then
    raise exception 'Invoice group must use one consumption date';
  end if;

  drop table if exists pg_temp.invoice_locked_payment_schedules;

  create temporary table invoice_locked_payment_schedules
  (like public.payment_schedules including defaults)
  on commit drop;

  if v_parent_reference_count = v_expense_count and v_distinct_parent_count = 1 then
    select payment_parent_expense_id
    into v_payment_parent_id
    from public.expenses
    where household_id = p_household_id
      and invoice_number = v_invoice_number
      and status = 'active'
    limit 1;

    select count(*)
    into v_parent_count
    from public.expenses
    where household_id = p_household_id
      and invoice_number = v_invoice_number
      and status = 'active'
      and id = v_payment_parent_id;

    if v_parent_count <> 1 then
      raise exception 'Invoice payment parent is incomplete';
    end if;

    insert into invoice_locked_payment_schedules
    select *
    from public.payment_schedules
    where household_id = p_household_id
      and expense_id = v_payment_parent_id
    for update;
  elsif v_parent_reference_count = 0 and v_distinct_parent_count = 0 then
    select id
    into v_payment_parent_id
    from public.expenses
    where household_id = p_household_id
      and invoice_number = v_invoice_number
      and status = 'active'
    order by
      case when coalesce(original_amount, amount) > 0 then 0 else 1 end,
      coalesce(amount, 0) desc,
      id
    limit 1;

    insert into invoice_locked_payment_schedules
    select ps.*
    from public.payment_schedules ps
    join public.expenses e
      on e.household_id = ps.household_id
     and e.id = ps.expense_id
    where e.household_id = p_household_id
      and e.invoice_number = v_invoice_number
      and e.status = 'active'
    for update of ps;

    select count(*), coalesce(sum(payment_amount), 0)
    into v_existing_schedule_count, v_existing_schedule_total
    from invoice_locked_payment_schedules;

    if v_existing_schedule_count <> 0 and v_existing_schedule_total <> v_paid_total then
      raise exception 'Legacy invoice payment schedules do not match invoice total';
    end if;
  else
    raise exception 'Invoice group is incomplete';
  end if;

  select count(*)
  into v_non_estimated_schedule_count
  from invoice_locked_payment_schedules
  where payment_status <> 'estimated';

  if v_non_estimated_schedule_count <> 0 then
    raise exception 'Invoice payment schedules must be estimated before payment settings can be changed';
  end if;

  for v_old_schedule in
    select *
    from invoice_locked_payment_schedules
  loop
    update public.cash_flow_months
    set cash_expense_total = public.cash_flow_months.cash_expense_total
          - case when v_old_schedule.payment_tool_type = 'cash' then v_old_schedule.payment_amount else 0 end,
        credit_card_payment_total = public.cash_flow_months.credit_card_payment_total
          - case when v_old_schedule.payment_tool_type = 'credit_card' then v_old_schedule.payment_amount else 0 end,
        net_cash_flow = public.cash_flow_months.income_total
          - (public.cash_flow_months.cash_expense_total
            - case when v_old_schedule.payment_tool_type = 'cash' then v_old_schedule.payment_amount else 0 end)
          - (public.cash_flow_months.credit_card_payment_total
            - case when v_old_schedule.payment_tool_type = 'credit_card' then v_old_schedule.payment_amount else 0 end),
        generated_at = now()
    where household_id = p_household_id
      and cash_flow_month = v_old_schedule.cash_flow_month;

    if v_old_schedule.payment_tool_type = 'credit_card' then
      update public.credit_card_bill_estimates
      set estimated_bill_amount = public.credit_card_bill_estimates.estimated_bill_amount - v_old_schedule.payment_amount,
          detail_count = greatest(public.credit_card_bill_estimates.detail_count - 1, 0),
          generated_at = now()
      where household_id = p_household_id
        and credit_card_id = v_old_schedule.credit_card_id
        and bill_month = v_old_schedule.cash_flow_month;

      delete from public.credit_card_bill_estimates
      where household_id = p_household_id
        and credit_card_id = v_old_schedule.credit_card_id
        and bill_month = v_old_schedule.cash_flow_month
        and estimated_bill_amount = 0
        and detail_count = 0;
    end if;
  end loop;

  delete from public.payment_schedules
  where household_id = p_household_id
    and id in (select id from invoice_locked_payment_schedules);

  update public.expenses
  set payment_parent_expense_id = v_payment_parent_id,
      payment_tool_type = p_payment_tool_type,
      credit_card_id = v_effective_credit_card_id,
      is_installment = p_payment_tool_type = 'credit_card' and v_effective_installment_count > 1,
      installment_count = v_effective_installment_count,
      updated_at = now()
  where household_id = p_household_id
    and invoice_number = v_invoice_number
    and status = 'active';

  if p_payment_tool_type = 'credit_card' then
    v_first_bill_month := date_trunc('month', v_consumption_date)::date
      + case
          when extract(day from v_consumption_date) > v_card.cutoff_day then interval '1 month'
          else interval '0 month'
        end;
  end if;

  v_base_cents := trunc((v_paid_total * 100)::numeric / v_effective_installment_count);
  v_remainder := round(v_paid_total * 100)::bigint - v_base_cents * v_effective_installment_count;

  for v_sequence in 1..v_effective_installment_count loop
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
      v_effective_credit_card_id, 'estimated', 'finance_ministry_invoice', 'invoice_group_payment',
      v_invoice_number || '_P' || lpad(v_sequence::text, 2, '0'), now()
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
        p_household_id, v_effective_credit_card_id, to_char(v_schedule_month, 'YYYY-MM'),
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

  return jsonb_build_object(
    'invoiceNumber', v_invoice_number,
    'updatedExpenses', v_expense_count,
    'insertedPaymentSchedules', v_effective_installment_count,
    'paidTotal', v_paid_total
  );
end;
$$;

revoke all on function public.update_invoice_payment_settings(uuid, text, public.payment_tool_type, uuid, integer) from public;
revoke all on function public.update_invoice_payment_settings(uuid, text, public.payment_tool_type, uuid, integer) from anon;
grant execute on function public.update_invoice_payment_settings(uuid, text, public.payment_tool_type, uuid, integer) to authenticated;
