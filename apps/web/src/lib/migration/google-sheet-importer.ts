import { readFile } from "node:fs/promises";
import path from "node:path";

import { createSupabaseRestHeaders, getSupabaseRestConfig } from "../data/supabase-rest";

type LegacyPackage = {
  expenses: LegacyExpense[];
  paymentSchedules: LegacyPaymentSchedule[];
  incomeSchedules: LegacyIncomeSchedule[];
};

type LegacyExpense = {
  consumption_date: string;
  budget_month: string;
  merchant_tax_id?: string;
  merchant_name?: string;
  item_description: string;
  budget_item_legacy_name: string;
  legacy_budget_item: string;
  amount: number;
  payment_tool_type: "cash" | "credit_card";
  credit_card_legacy_name?: string;
  is_installment: boolean;
  installment_count: number;
  status: "active" | "cancelled";
  source_system: string;
  source_table: string;
  source_row_id: string;
  legacy_id: string;
  notes?: string;
};

type LegacyPaymentSchedule = {
  expense_temp_id: string;
  payment_sequence: number;
  payment_date: string;
  cash_flow_month: string;
  payment_amount: number;
  payment_tool_type: "cash" | "credit_card";
  credit_card_legacy_name?: string;
  payment_status: "estimated" | "reconciled" | "paid" | "corrected" | "offset";
  source_system: string;
  source_table: string;
  source_row_id: string;
  legacy_id: string;
  notes?: string;
};

type LegacyIncomeSchedule = {
  income_date: string;
  income_month: string;
  income_item: string;
  income_amount: number;
  income_status: "estimated" | "received" | "corrected";
  source?: string;
  source_system: string;
  source_table: string;
  source_row_id: string;
  legacy_id: string;
  notes?: string;
};

type BudgetItemLookupRow = {
  id: string;
  legacy_name: string | null;
};

type CreditCardLookupRow = {
  id: string;
  name: string;
  legacy_id: string | null;
};

type ExpenseLookupRow = {
  id: string;
  legacy_id: string | null;
};

type ImportStats = {
  inserted: number;
  skippedExisting: number;
  skippedMissingReference: number;
};

export type GoogleSheetImportResult = {
  householdId: string;
  expenses: ImportStats;
  paymentSchedules: ImportStats;
  incomeSchedules: ImportStats;
};

const BATCH_SIZE = 100;

function packagePathCandidates(): string[] {
  return [
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "tmp/supabase-import-package.json"),
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../tmp/supabase-import-package.json")
  ];
}

async function readPackage(): Promise<LegacyPackage> {
  const candidates = packagePathCandidates();

  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, "utf-8")) as LegacyPackage;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Import package not found near ${candidates[0]}`);
}

function chunk<T>(rows: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function legacyExpenseIdFromTempId(tempId: string): string {
  return tempId.replace(/^legacy:expense:/, "");
}

function requireConfig(accessToken: string) {
  const config = getSupabaseRestConfig();

  if (!config) {
    throw new Error("Supabase REST is not configured.");
  }

  return {
    ...config,
    headers: {
      ...createSupabaseRestHeaders(config, accessToken),
      "Content-Type": "application/json"
    }
  };
}

async function supabaseRead<T>(
  tableName: string,
  query: Record<string, string>,
  accessToken: string
): Promise<T[]> {
  const config = requireConfig(accessToken);
  const url = new URL(`${config.restUrl}/${tableName}`);

  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    cache: "no-store",
    headers: config.headers
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed for ${tableName}: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T[];
}

async function supabaseInsert(
  tableName: string,
  rows: Record<string, unknown>[],
  accessToken: string
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const config = requireConfig(accessToken);
  const response = await fetch(`${config.restUrl}/${tableName}`, {
    method: "POST",
    headers: {
      ...config.headers,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    throw new Error(`Supabase insert failed for ${tableName}: ${response.status} ${await response.text()}`);
  }

  return rows.length;
}

async function existingLegacyIds(tableName: string, householdId: string, legacyIds: string[], accessToken: string) {
  if (legacyIds.length === 0) {
    return new Set<string>();
  }

  const quotedIds = legacyIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(",");
  const rows = await supabaseRead<{ legacy_id: string }>(
    tableName,
    {
      select: "legacy_id",
      household_id: `eq.${householdId}`,
      legacy_id: `in.(${quotedIds})`
    },
    accessToken
  );

  return new Set(rows.map((row) => row.legacy_id));
}

async function importIncomeSchedules(
  rows: LegacyIncomeSchedule[],
  householdId: string,
  accessToken: string
): Promise<ImportStats> {
  const stats: ImportStats = { inserted: 0, skippedExisting: 0, skippedMissingReference: 0 };

  for (const batch of chunk(rows)) {
    const existing = await existingLegacyIds(
      "income_schedules",
      householdId,
      batch.map((row) => row.legacy_id),
      accessToken
    );
    const insertRows = batch
      .filter((row) => !existing.has(row.legacy_id))
      .map((row) => ({
        household_id: householdId,
        income_date: row.income_date,
        income_month: row.income_month,
        income_item: row.income_item,
        income_amount: row.income_amount,
        income_status: row.income_status,
        source: row.source ?? null,
        source_system: row.source_system,
        source_table: row.source_table,
        source_row_id: row.source_row_id,
        legacy_id: row.legacy_id,
        notes: row.notes ?? null,
        imported_at: new Date().toISOString()
      }));

    stats.skippedExisting += batch.length - insertRows.length;
    stats.inserted += await supabaseInsert("income_schedules", insertRows, accessToken);
  }

  return stats;
}

async function importExpenses(
  rows: LegacyExpense[],
  householdId: string,
  accessToken: string
): Promise<ImportStats> {
  const budgetItems = await supabaseRead<BudgetItemLookupRow>(
    "budget_items",
    {
      select: "id,legacy_name",
      household_id: `eq.${householdId}`
    },
    accessToken
  );
  const creditCards = await supabaseRead<CreditCardLookupRow>(
    "credit_cards",
    {
      select: "id,name,legacy_id",
      household_id: `eq.${householdId}`
    },
    accessToken
  );
  const budgetItemByLegacyName = new Map(budgetItems.map((row) => [row.legacy_name, row.id]));
  const creditCardByLegacyName = new Map<string, string>();

  creditCards.forEach((row) => {
    creditCardByLegacyName.set(row.name, row.id);
    if (row.legacy_id) {
      creditCardByLegacyName.set(row.legacy_id, row.id);
    }
  });

  const stats: ImportStats = { inserted: 0, skippedExisting: 0, skippedMissingReference: 0 };

  for (const batch of chunk(rows)) {
    const existing = await existingLegacyIds(
      "expenses",
      householdId,
      batch.map((row) => row.legacy_id),
      accessToken
    );
    const insertRows: Record<string, unknown>[] = [];

    for (const row of batch) {
      if (existing.has(row.legacy_id)) {
        stats.skippedExisting += 1;
        continue;
      }

      const budgetItemId = budgetItemByLegacyName.get(row.budget_item_legacy_name);
      const creditCardId =
        row.payment_tool_type === "credit_card" && row.credit_card_legacy_name
          ? creditCardByLegacyName.get(row.credit_card_legacy_name)
          : null;

      if (!budgetItemId || (row.payment_tool_type === "credit_card" && !creditCardId)) {
        stats.skippedMissingReference += 1;
        continue;
      }

      insertRows.push({
        household_id: householdId,
        consumption_date: row.consumption_date,
        budget_month: row.budget_month,
        merchant_tax_id: row.merchant_tax_id ?? null,
        merchant_name: row.merchant_name ?? null,
        item_description: row.item_description,
        budget_item_id: budgetItemId,
        legacy_budget_item: row.legacy_budget_item,
        amount: row.amount,
        payment_tool_type: row.payment_tool_type,
        credit_card_id: creditCardId,
        is_installment: row.is_installment,
        installment_count: row.installment_count,
        status: row.status,
        source_system: row.source_system,
        source_table: row.source_table,
        source_row_id: row.source_row_id,
        legacy_id: row.legacy_id,
        notes: row.notes ?? null,
        imported_at: new Date().toISOString()
      });
    }

    stats.inserted += await supabaseInsert("expenses", insertRows, accessToken);
  }

  return stats;
}

async function importPaymentSchedules(
  rows: LegacyPaymentSchedule[],
  householdId: string,
  accessToken: string
): Promise<ImportStats> {
  const expenseRows = await supabaseRead<ExpenseLookupRow>(
    "expenses",
    {
      select: "id,legacy_id",
      household_id: `eq.${householdId}`
    },
    accessToken
  );
  const creditCards = await supabaseRead<CreditCardLookupRow>(
    "credit_cards",
    {
      select: "id,name,legacy_id",
      household_id: `eq.${householdId}`
    },
    accessToken
  );
  const expenseByLegacyId = new Map(expenseRows.map((row) => [row.legacy_id, row.id]));
  const creditCardByLegacyName = new Map<string, string>();

  creditCards.forEach((row) => {
    creditCardByLegacyName.set(row.name, row.id);
    if (row.legacy_id) {
      creditCardByLegacyName.set(row.legacy_id, row.id);
    }
  });

  const stats: ImportStats = { inserted: 0, skippedExisting: 0, skippedMissingReference: 0 };

  for (const batch of chunk(rows)) {
    const existing = await existingLegacyIds(
      "payment_schedules",
      householdId,
      batch.map((row) => row.legacy_id),
      accessToken
    );
    const insertRows: Record<string, unknown>[] = [];

    for (const row of batch) {
      if (existing.has(row.legacy_id)) {
        stats.skippedExisting += 1;
        continue;
      }

      const expenseId = expenseByLegacyId.get(legacyExpenseIdFromTempId(row.expense_temp_id));
      const creditCardId =
        row.payment_tool_type === "credit_card" && row.credit_card_legacy_name
          ? creditCardByLegacyName.get(row.credit_card_legacy_name)
          : null;

      if (!expenseId || (row.payment_tool_type === "credit_card" && !creditCardId)) {
        stats.skippedMissingReference += 1;
        continue;
      }

      insertRows.push({
        household_id: householdId,
        expense_id: expenseId,
        payment_sequence: row.payment_sequence,
        payment_date: row.payment_date,
        cash_flow_month: row.cash_flow_month,
        payment_amount: row.payment_amount,
        payment_tool_type: row.payment_tool_type,
        credit_card_id: creditCardId,
        payment_status: row.payment_status,
        source_system: row.source_system,
        source_table: row.source_table,
        source_row_id: row.source_row_id,
        legacy_id: row.legacy_id,
        notes: row.notes ?? null,
        imported_at: new Date().toISOString()
      });
    }

    stats.inserted += await supabaseInsert("payment_schedules", insertRows, accessToken);
  }

  return stats;
}

export async function importGoogleSheetPackage(
  householdId: string,
  accessToken: string
): Promise<GoogleSheetImportResult> {
  const data = await readPackage();
  const incomeSchedules = await importIncomeSchedules(data.incomeSchedules, householdId, accessToken);
  const expenses = await importExpenses(data.expenses, householdId, accessToken);
  const paymentSchedules = await importPaymentSchedules(data.paymentSchedules, householdId, accessToken);

  return {
    householdId,
    incomeSchedules,
    expenses,
    paymentSchedules
  };
}
