-- Preserve Finance Ministry discount and offset lines while they are still pending review.
-- Positive amounts remain normal invoice lines. Negative amounts reduce the eventual expense/payment totals.
alter table public.invoice_drafts
  drop constraint if exists invoice_drafts_amount_check;
