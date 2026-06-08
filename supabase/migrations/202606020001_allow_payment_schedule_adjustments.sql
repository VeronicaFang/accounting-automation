-- Preserve legacy refunds, offsets, and corrections as signed payment schedule adjustments.
-- Positive amounts remain normal outflows. Negative amounts reduce the payment total.
alter table public.payment_schedules
  drop constraint if exists payment_schedules_payment_amount_check;
