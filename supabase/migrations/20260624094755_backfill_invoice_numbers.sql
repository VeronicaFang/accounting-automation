with matched as (
  select
    e.id as expense_id,
    e.household_id,
    e.amount as expense_amount,
    d.invoice_number,
    d.source_line_key,
    d.amount as draft_amount,
    case when d.amount < 0 then 'discount'::public.expense_line_type else 'item'::public.expense_line_type end as line_type,
    count(*) over (partition by e.id) as match_count
  from public.expenses e
  join public.invoice_drafts d
    on d.household_id = e.household_id
   and d.review_status = 'confirmed'
   and (e.source_row_id = d.source_line_key or e.source_line_key = d.source_line_key)
  where e.invoice_number is null
),
safe as (
  select * from matched where match_count = 1
),
reconciled_groups as (
  select household_id, invoice_number
  from safe
  group by household_id, invoice_number
  having sum(expense_amount) = sum(draft_amount)
),
updates as (
  select s.*
  from safe s
  join reconciled_groups g
    on g.household_id = s.household_id
   and g.invoice_number = s.invoice_number
)
update public.expenses e
set invoice_number = u.invoice_number,
    original_amount = u.draft_amount,
    line_type = u.line_type,
    source_line_key = u.source_line_key,
    updated_at = now()
from updates u
where e.id = u.expense_id
  and e.household_id = u.household_id
  and e.invoice_number is null;