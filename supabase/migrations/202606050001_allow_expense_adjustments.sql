-- Preserve legacy discounts, refunds, and offsets as signed expense adjustments.
-- Positive amounts remain normal spending. Negative amounts reduce budget usage.
alter table public.expenses
  drop constraint if exists expenses_amount_check;
