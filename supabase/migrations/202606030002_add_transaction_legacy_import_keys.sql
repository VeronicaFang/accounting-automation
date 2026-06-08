-- Make transaction imports idempotent per household and legacy Google Sheet row.
create unique index if not exists expenses_household_legacy_id_uidx
  on public.expenses(household_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists payment_schedules_household_legacy_id_uidx
  on public.payment_schedules(household_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists income_schedules_household_legacy_id_uidx
  on public.income_schedules(household_id, legacy_id)
  where legacy_id is not null;
