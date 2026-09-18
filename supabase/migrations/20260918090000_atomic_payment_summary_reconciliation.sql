create or replace function public.apply_payment_summary_delta(
  p_household_id uuid,
  p_cash_flow_month char(7),
  p_income_delta numeric default 0,
  p_cash_expense_delta numeric default 0,
  p_credit_card_payment_delta numeric default 0,
  p_credit_card_id uuid default null,
  p_bill_amount_delta numeric default 0,
  p_bill_detail_delta integer default 0,
  p_estimated_payment_date date default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_household_member(p_household_id) then
    raise exception 'Household access denied';
  end if;

  if p_cash_flow_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid cash flow month';
  end if;

  if (coalesce(p_bill_amount_delta, 0) <> 0 or coalesce(p_bill_detail_delta, 0) <> 0)
    and p_credit_card_id is null then
    raise exception 'Credit card is required for bill estimate changes';
  end if;

  insert into public.cash_flow_months (
    household_id,
    cash_flow_month,
    income_total,
    cash_expense_total,
    credit_card_payment_total,
    net_cash_flow,
    generated_at
  )
  values (
    p_household_id,
    p_cash_flow_month,
    coalesce(p_income_delta, 0),
    coalesce(p_cash_expense_delta, 0),
    coalesce(p_credit_card_payment_delta, 0),
    coalesce(p_income_delta, 0) - coalesce(p_cash_expense_delta, 0) - coalesce(p_credit_card_payment_delta, 0),
    now()
  )
  on conflict (household_id, cash_flow_month)
  do update set
    income_total = public.cash_flow_months.income_total + excluded.income_total,
    cash_expense_total = public.cash_flow_months.cash_expense_total + excluded.cash_expense_total,
    credit_card_payment_total = public.cash_flow_months.credit_card_payment_total + excluded.credit_card_payment_total,
    net_cash_flow =
      (public.cash_flow_months.income_total + excluded.income_total)
      - (public.cash_flow_months.cash_expense_total + excluded.cash_expense_total)
      - (public.cash_flow_months.credit_card_payment_total + excluded.credit_card_payment_total),
    generated_at = now();

  if p_credit_card_id is not null
    and (coalesce(p_bill_amount_delta, 0) <> 0 or coalesce(p_bill_detail_delta, 0) <> 0) then
    insert into public.credit_card_bill_estimates (
      household_id,
      credit_card_id,
      bill_month,
      estimated_payment_date,
      estimated_bill_amount,
      detail_count,
      generated_at
    )
    values (
      p_household_id,
      p_credit_card_id,
      p_cash_flow_month,
      p_estimated_payment_date,
      coalesce(p_bill_amount_delta, 0),
      greatest(coalesce(p_bill_detail_delta, 0), 0),
      now()
    )
    on conflict (household_id, credit_card_id, bill_month)
    do update set
      estimated_payment_date = coalesce(excluded.estimated_payment_date, public.credit_card_bill_estimates.estimated_payment_date),
      estimated_bill_amount = public.credit_card_bill_estimates.estimated_bill_amount + excluded.estimated_bill_amount,
      detail_count = greatest(public.credit_card_bill_estimates.detail_count + p_bill_detail_delta, 0),
      generated_at = now();
  end if;
end;
$$;

revoke all on function public.apply_payment_summary_delta(uuid, char(7), numeric, numeric, numeric, uuid, numeric, integer, date) from public;
revoke all on function public.apply_payment_summary_delta(uuid, char(7), numeric, numeric, numeric, uuid, numeric, integer, date) from anon;
grant execute on function public.apply_payment_summary_delta(uuid, char(7), numeric, numeric, numeric, uuid, numeric, integer, date) to authenticated;

comment on function public.apply_payment_summary_delta(uuid, char(7), numeric, numeric, numeric, uuid, numeric, integer, date)
is 'Atomically applies cash-flow and credit-card bill estimate deltas for one household month.';

-- Both tables below are derived summaries. Rebuild them from their source rows so
-- earlier concurrent web imports no longer leave missing amounts or detail counts.
delete from public.credit_card_bill_estimates;

insert into public.credit_card_bill_estimates (
  household_id,
  credit_card_id,
  bill_month,
  estimated_payment_date,
  estimated_bill_amount,
  detail_count,
  source_system,
  source_table,
  generated_at
)
select
  payment.household_id,
  payment.credit_card_id,
  payment.cash_flow_month,
  min(payment.payment_date),
  sum(payment.payment_amount),
  count(*)::integer,
  'reconciliation',
  'payment_schedules',
  now()
from public.payment_schedules payment
where payment.payment_tool_type = 'credit_card'
  and payment.credit_card_id is not null
  and payment.payment_status in ('estimated', 'reconciled', 'paid')
group by payment.household_id, payment.credit_card_id, payment.cash_flow_month;

create temporary table reconciled_cash_flow_months on commit drop as
with income_totals as (
  select
    income.household_id,
    income.income_month as cash_flow_month,
    sum(income.income_amount) as income_total
  from public.income_schedules income
  where income.income_status in ('estimated', 'received')
  group by income.household_id, income.income_month
),
payment_totals as (
  select
    payment.household_id,
    payment.cash_flow_month,
    sum(payment.payment_amount) filter (where payment.payment_tool_type = 'cash') as cash_expense_total,
    sum(payment.payment_amount) filter (where payment.payment_tool_type = 'credit_card') as credit_card_payment_total
  from public.payment_schedules payment
  where payment.payment_status in ('estimated', 'reconciled', 'paid')
  group by payment.household_id, payment.cash_flow_month
)
select
  coalesce(income.household_id, payment.household_id) as household_id,
  coalesce(income.cash_flow_month, payment.cash_flow_month) as cash_flow_month,
  coalesce(income.income_total, 0) as income_total,
  coalesce(payment.cash_expense_total, 0) as cash_expense_total,
  coalesce(payment.credit_card_payment_total, 0) as credit_card_payment_total
from income_totals income
full join payment_totals payment
  on payment.household_id = income.household_id
  and payment.cash_flow_month = income.cash_flow_month;

update public.cash_flow_months cash_flow
set
  income_total = reconciled.income_total,
  cash_expense_total = reconciled.cash_expense_total,
  credit_card_payment_total = reconciled.credit_card_payment_total,
  net_cash_flow = reconciled.income_total - reconciled.cash_expense_total - reconciled.credit_card_payment_total,
  generated_at = now()
from reconciled_cash_flow_months reconciled
where reconciled.household_id = cash_flow.household_id
  and reconciled.cash_flow_month = cash_flow.cash_flow_month;

update public.cash_flow_months cash_flow
set
  income_total = 0,
  cash_expense_total = 0,
  credit_card_payment_total = 0,
  net_cash_flow = 0,
  generated_at = now()
where not exists (
  select 1
  from reconciled_cash_flow_months reconciled
  where reconciled.household_id = cash_flow.household_id
    and reconciled.cash_flow_month = cash_flow.cash_flow_month
);

insert into public.cash_flow_months (
  household_id,
  cash_flow_month,
  income_total,
  cash_expense_total,
  credit_card_payment_total,
  net_cash_flow,
  source_system,
  source_table,
  generated_at
)
select
  reconciled.household_id,
  reconciled.cash_flow_month,
  reconciled.income_total,
  reconciled.cash_expense_total,
  reconciled.credit_card_payment_total,
  reconciled.income_total - reconciled.cash_expense_total - reconciled.credit_card_payment_total,
  'reconciliation',
  'income_schedules,payment_schedules',
  now()
from reconciled_cash_flow_months reconciled
on conflict (household_id, cash_flow_month) do nothing;
