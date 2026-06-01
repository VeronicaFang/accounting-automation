create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function app_private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

create or replace function app_private.handle_new_user_accounting_household()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_household_id uuid;
  new_display_name text;
begin
  new_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.email, ''),
    'Accounting user'
  );

  insert into public.households (name, source_system, source_table, source_row_id, legacy_id, imported_at)
  values (new_display_name || '''s household', 'supabase_auth', 'auth.users', new.id::text, new.id::text, now())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (new_household_id, new.id, 'owner', new_display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_accounting_household on auth.users;

create trigger on_auth_user_created_create_accounting_household
after insert on auth.users
for each row execute function app_private.handle_new_user_accounting_household();

grant execute on function app_private.is_household_member(uuid) to authenticated;
grant execute on function app_private.is_household_owner(uuid) to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy household_select on public.households
for select to authenticated
using (app_private.is_household_member(id));

create policy household_owner_update on public.households
for update to authenticated
using (app_private.is_household_owner(id))
with check (app_private.is_household_owner(id));

create policy household_owner_delete on public.households
for delete to authenticated
using (app_private.is_household_owner(id));

create policy household_members_member_select on public.household_members
for select to authenticated
using (app_private.is_household_member(household_id));

create policy household_members_member_insert on public.household_members
for insert to authenticated
with check (app_private.is_household_owner(household_id));

create policy household_members_member_update on public.household_members
for update to authenticated
using (app_private.is_household_owner(household_id))
with check (app_private.is_household_owner(household_id));

create policy household_members_member_delete on public.household_members
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy budget_groups_member_select on public.budget_groups
for select to authenticated
using (app_private.is_household_member(household_id));

create policy budget_groups_member_insert on public.budget_groups
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy budget_groups_member_update on public.budget_groups
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy budget_groups_member_delete on public.budget_groups
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy budget_items_member_select on public.budget_items
for select to authenticated
using (app_private.is_household_member(household_id));

create policy budget_items_member_insert on public.budget_items
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy budget_items_member_update on public.budget_items
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy budget_items_member_delete on public.budget_items
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy payment_methods_member_select on public.payment_methods
for select to authenticated
using (app_private.is_household_member(household_id));

create policy payment_methods_member_insert on public.payment_methods
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy payment_methods_member_update on public.payment_methods
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy payment_methods_member_delete on public.payment_methods
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy credit_cards_member_select on public.credit_cards
for select to authenticated
using (app_private.is_household_member(household_id));

create policy credit_cards_member_insert on public.credit_cards
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy credit_cards_member_update on public.credit_cards
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy credit_cards_member_delete on public.credit_cards
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy expenses_member_select on public.expenses
for select to authenticated
using (app_private.is_household_member(household_id));

create policy expenses_member_insert on public.expenses
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy expenses_member_update on public.expenses
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy expenses_member_delete on public.expenses
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy payment_schedules_member_select on public.payment_schedules
for select to authenticated
using (app_private.is_household_member(household_id));

create policy payment_schedules_member_insert on public.payment_schedules
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy payment_schedules_member_update on public.payment_schedules
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy payment_schedules_member_delete on public.payment_schedules
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy income_schedules_member_select on public.income_schedules
for select to authenticated
using (app_private.is_household_member(household_id));

create policy income_schedules_member_insert on public.income_schedules
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy income_schedules_member_update on public.income_schedules
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy income_schedules_member_delete on public.income_schedules
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy expense_schedules_member_select on public.expense_schedules
for select to authenticated
using (app_private.is_household_member(household_id));

create policy expense_schedules_member_insert on public.expense_schedules
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy expense_schedules_member_update on public.expense_schedules
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy expense_schedules_member_delete on public.expense_schedules
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy credit_card_statements_member_select on public.credit_card_statements
for select to authenticated
using (app_private.is_household_member(household_id));

create policy credit_card_statements_member_insert on public.credit_card_statements
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy credit_card_statements_member_update on public.credit_card_statements
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy credit_card_statements_member_delete on public.credit_card_statements
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy credit_card_bill_estimates_member_select on public.credit_card_bill_estimates
for select to authenticated
using (app_private.is_household_member(household_id));

create policy credit_card_bill_estimates_member_insert on public.credit_card_bill_estimates
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy credit_card_bill_estimates_member_update on public.credit_card_bill_estimates
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy credit_card_bill_estimates_member_delete on public.credit_card_bill_estimates
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy cash_flow_months_member_select on public.cash_flow_months
for select to authenticated
using (app_private.is_household_member(household_id));

create policy cash_flow_months_member_insert on public.cash_flow_months
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy cash_flow_months_member_update on public.cash_flow_months
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy cash_flow_months_member_delete on public.cash_flow_months
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy merchant_payment_rules_member_select on public.merchant_payment_rules
for select to authenticated
using (app_private.is_household_member(household_id));

create policy merchant_payment_rules_member_insert on public.merchant_payment_rules
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy merchant_payment_rules_member_update on public.merchant_payment_rules
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy merchant_payment_rules_member_delete on public.merchant_payment_rules
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy merchant_item_rules_member_select on public.merchant_item_rules
for select to authenticated
using (app_private.is_household_member(household_id));

create policy merchant_item_rules_member_insert on public.merchant_item_rules
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy merchant_item_rules_member_update on public.merchant_item_rules
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy merchant_item_rules_member_delete on public.merchant_item_rules
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy invoice_import_batches_member_select on public.invoice_import_batches
for select to authenticated
using (app_private.is_household_member(household_id));

create policy invoice_import_batches_member_insert on public.invoice_import_batches
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy invoice_import_batches_member_update on public.invoice_import_batches
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy invoice_import_batches_member_delete on public.invoice_import_batches
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy invoice_drafts_member_select on public.invoice_drafts
for select to authenticated
using (app_private.is_household_member(household_id));

create policy invoice_drafts_member_insert on public.invoice_drafts
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy invoice_drafts_member_update on public.invoice_drafts
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy invoice_drafts_member_delete on public.invoice_drafts
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy manual_import_batches_member_select on public.manual_import_batches
for select to authenticated
using (app_private.is_household_member(household_id));

create policy manual_import_batches_member_insert on public.manual_import_batches
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy manual_import_batches_member_update on public.manual_import_batches
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy manual_import_batches_member_delete on public.manual_import_batches
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy budget_mapping_drafts_member_select on public.budget_mapping_drafts
for select to authenticated
using (app_private.is_household_member(household_id));

create policy budget_mapping_drafts_member_insert on public.budget_mapping_drafts
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy budget_mapping_drafts_member_update on public.budget_mapping_drafts
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy budget_mapping_drafts_member_delete on public.budget_mapping_drafts
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy migration_runs_member_select on public.migration_runs
for select to authenticated
using (app_private.is_household_member(household_id));

create policy migration_runs_member_insert on public.migration_runs
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy migration_runs_member_update on public.migration_runs
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy migration_runs_member_delete on public.migration_runs
for delete to authenticated
using (app_private.is_household_owner(household_id));

create policy migration_issues_member_select on public.migration_issues
for select to authenticated
using (app_private.is_household_member(household_id));

create policy migration_issues_member_insert on public.migration_issues
for insert to authenticated
with check (app_private.is_household_member(household_id));

create policy migration_issues_member_update on public.migration_issues
for update to authenticated
using (app_private.is_household_member(household_id))
with check (app_private.is_household_member(household_id));

create policy migration_issues_member_delete on public.migration_issues
for delete to authenticated
using (app_private.is_household_owner(household_id));
