import { NextResponse } from "next/server";

import {
  buildMonthDate,
  buildPaymentPlans,
  monthKeyFromDate,
  normalizeDateInput,
  parseManualExpenseText,
  type EntryCreditCard,
  type ParsedManualExpenseRow,
  type PaymentToolType
} from "@/lib/accounting/entry-utils";
import {
  buildInvoiceDraftConfirmationInputs,
  findInvoiceMerchantItemRule,
  findInvoiceMerchantPaymentRule,
  mapInvoiceDraftReviewItems,
  type InvoiceDraftConfirmation,
  type InvoiceDraftReviewRow,
  type InvoiceMerchantItemRule,
  type InvoiceMerchantPaymentRule
} from "@/lib/accounting/invoice-review";
import {
  buildInvoiceDateKey,
  shouldSkipInvoiceImportRow,
  type ExistingInvoiceImportKeys
} from "@/lib/accounting/invoice-import-dedupe";
import { createSupabaseRestHeaders, getSupabaseRestConfig } from "@/lib/data/supabase-rest";

export const runtime = "nodejs";

type BudgetItemRow = {
  id: string;
  name: string;
  legacy_id: string | null;
  legacy_name: string | null;
};

type CreditCardRow = EntryCreditCard;

type HouseholdRow = {
  id: string;
};

type ExpenseInsertResult = {
  id: string;
};

type CashFlowRow = {
  cash_flow_month: string;
  income_total: string | number;
  cash_expense_total: string | number;
  credit_card_payment_total: string | number;
  net_cash_flow: string | number;
};

type BillEstimateRow = {
  id: string;
  estimated_bill_amount: string | number;
  detail_count: number;
};

type ExpenseMaintenanceRow = {
  id: string;
  status: string;
};

type IncomeMaintenanceRow = {
  id: string;
  income_date: string;
  income_month: string;
  income_item: string;
  income_amount: string | number;
  income_status: IncomeStatus;
  source: string | null;
  notes: string | null;
};
type PaymentScheduleMaintenanceRow = {
  cash_flow_month: string;
  payment_amount: string | number;
  payment_tool_type: PaymentToolType;
  credit_card_id: string | null;
};

type MerchantPaymentRuleRow = InvoiceMerchantPaymentRule;
type MerchantItemRuleRow = InvoiceMerchantItemRule;

type EntryReferences = {
  householdId: string;
  userId: string | null;
  budgetItems: BudgetItemRow[];
  creditCards: CreditCardRow[];
};

type ExpenseInput = {
  consumptionDate: string;
  merchantTaxId?: string | null;
  itemDescription: string;
  amount: number;
  merchantName: string;
  budgetItemId?: string;
  budgetItemName?: string;
  paymentToolType: PaymentToolType;
  creditCardId?: string;
  creditCardName?: string;
  installmentCount?: number;
  notes?: string;
  sourceSystem?: string;
  sourceTable?: string;
  sourceRowId?: string;
};

type InvoiceDraftInput = {
  sourceRecordId: string;
  consumptionDate: string;
  merchantTaxId: string;
  merchantName: string;
  itemDescription: string;
  amount: number;
  sourceLineKey: string;
};

type IncomeStatus = "estimated" | "received" | "corrected";

type SupabaseRequestConfig = {
  restUrl: string;
  headers: Record<string, string>;
};

function readBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function parseUserId(accessToken: string): string | null {
  const [, payload] = accessToken.split(".");

  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { sub?: unknown };

    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

function requireSupabaseRequestConfig(accessToken: string): SupabaseRequestConfig {
  const config = getSupabaseRestConfig();

  if (!config) {
    throw new Error("Supabase REST 尚未設定。");
  }

  return {
    restUrl: config.restUrl,
    headers: {
      ...createSupabaseRestHeaders(config, accessToken),
      "Content-Type": "application/json"
    }
  };
}

async function supabaseRead<T>(
  requestConfig: SupabaseRequestConfig,
  tableName: string,
  query: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${requestConfig.restUrl}/${tableName}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    cache: "no-store",
    headers: requestConfig.headers
  });

  if (!response.ok) {
    throw new Error(`讀取 ${tableName} 失敗：${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T[];
}

async function supabaseInsert<T>(
  requestConfig: SupabaseRequestConfig,
  tableName: string,
  rows: Record<string, unknown>[],
  returning = false
): Promise<T[]> {
  if (rows.length === 0) {
    return [];
  }

  const response = await fetch(`${requestConfig.restUrl}/${tableName}`, {
    method: "POST",
    headers: {
      ...requestConfig.headers,
      Prefer: returning ? "return=representation" : "return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    throw new Error(`寫入 ${tableName} 失敗：${response.status} ${await response.text()}`);
  }

  return returning ? ((await response.json()) as T[]) : [];
}

async function supabasePatch(
  requestConfig: SupabaseRequestConfig,
  tableName: string,
  query: Record<string, string>,
  values: Record<string, unknown>
): Promise<void> {
  const url = new URL(`${requestConfig.restUrl}/${tableName}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...requestConfig.headers,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(values)
  });

  if (!response.ok) {
    throw new Error(`更新 ${tableName} 失敗：${response.status} ${await response.text()}`);
  }
}

async function supabaseDelete(
  requestConfig: SupabaseRequestConfig,
  tableName: string,
  query: Record<string, string>
): Promise<void> {
  const url = new URL(`${requestConfig.restUrl}/${tableName}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...requestConfig.headers,
      Prefer: "return=minimal"
    }
  });

  if (!response.ok) {
    throw new Error(`刪除 ${tableName} 失敗：${response.status} ${await response.text()}`);
  }
}

async function supabaseUpsert(
  requestConfig: SupabaseRequestConfig,
  tableName: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const url = new URL(`${requestConfig.restUrl}/${tableName}`);
  url.searchParams.set("on_conflict", onConflict);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...requestConfig.headers,
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    throw new Error(`更新 ${tableName} 彙總失敗：${response.status} ${await response.text()}`);
  }
}

async function loadReferences(requestConfig: SupabaseRequestConfig, accessToken: string): Promise<EntryReferences> {
  const [households, budgetItems, creditCards] = await Promise.all([
    supabaseRead<HouseholdRow>(requestConfig, "households", {
      select: "id",
      order: "created_at.asc",
      limit: "1"
    }),
    supabaseRead<BudgetItemRow>(requestConfig, "budget_items", {
      select: "id,name,legacy_id,legacy_name",
      is_active: "eq.true",
      order: "legacy_code.asc"
    }),
    supabaseRead<CreditCardRow>(requestConfig, "credit_cards", {
      select: "id,name,legacy_id,cutoff_day,payment_day",
      is_active: "eq.true",
      order: "name.asc"
    })
  ]);

  const householdId = households[0]?.id;

  if (!householdId) {
    throw new Error("目前帳號沒有可讀取的 household。");
  }

  return {
    householdId,
    userId: parseUserId(accessToken),
    budgetItems,
    creditCards
  };
}

function findBudgetItem(references: EntryReferences, input: Pick<ExpenseInput, "budgetItemId" | "budgetItemName">) {
  if (input.budgetItemId) {
    const item = references.budgetItems.find((candidate) => candidate.id === input.budgetItemId);

    if (item) {
      return item;
    }
  }

  const budgetItemName = String(input.budgetItemName || "").trim();
  const item = references.budgetItems.find(
    (candidate) =>
      candidate.name === budgetItemName ||
      candidate.legacy_id === budgetItemName ||
      candidate.legacy_name === budgetItemName
  );

  if (!item) {
    throw new Error(`找不到預算項目：${budgetItemName || "(空白)"}`);
  }

  return item;
}

function findCreditCard(references: EntryReferences, input: Pick<ExpenseInput, "creditCardId" | "creditCardName">) {
  if (input.creditCardId) {
    const card = references.creditCards.find((candidate) => candidate.id === input.creditCardId);

    if (card) {
      return card;
    }
  }

  const cardName = String(input.creditCardName || "").trim();
  const card = references.creditCards.find((candidate) => candidate.name === cardName || candidate.legacy_id === cardName);

  if (!card) {
    throw new Error(`找不到信用卡：${cardName || "(空白)"}`);
  }

  return card;
}

function buildLegacyId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function addCashFlowDelta(
  requestConfig: SupabaseRequestConfig,
  householdId: string,
  month: string,
  deltas: { income?: number; cashExpense?: number; creditCardPayment?: number }
) {
  const [current] = await supabaseRead<CashFlowRow>(requestConfig, "cash_flow_months", {
    select: "cash_flow_month,income_total,cash_expense_total,credit_card_payment_total,net_cash_flow",
    household_id: `eq.${householdId}`,
    cash_flow_month: `eq.${month}`,
    limit: "1"
  });

  const incomeTotal = Number(current?.income_total ?? 0) + Number(deltas.income ?? 0);
  const cashExpenseTotal = Number(current?.cash_expense_total ?? 0) + Number(deltas.cashExpense ?? 0);
  const creditCardPaymentTotal = Number(current?.credit_card_payment_total ?? 0) + Number(deltas.creditCardPayment ?? 0);

  await supabaseUpsert(
    requestConfig,
    "cash_flow_months",
    [
      {
        household_id: householdId,
        cash_flow_month: month,
        income_total: incomeTotal,
        cash_expense_total: cashExpenseTotal,
        credit_card_payment_total: creditCardPaymentTotal,
        net_cash_flow: incomeTotal - cashExpenseTotal - creditCardPaymentTotal,
        generated_at: new Date().toISOString()
      }
    ],
    "household_id,cash_flow_month"
  );
}

async function addBillEstimateDelta(
  requestConfig: SupabaseRequestConfig,
  householdId: string,
  creditCard: EntryCreditCard,
  billMonth: string,
  amountDelta: number,
  detailDelta: number
) {
  const [current] = await supabaseRead<BillEstimateRow>(requestConfig, "credit_card_bill_estimates", {
    select: "id,estimated_bill_amount,detail_count",
    household_id: `eq.${householdId}`,
    credit_card_id: `eq.${creditCard.id}`,
    bill_month: `eq.${billMonth}`,
    limit: "1"
  });

  await supabaseUpsert(
    requestConfig,
    "credit_card_bill_estimates",
    [
      {
        household_id: householdId,
        credit_card_id: creditCard.id,
        bill_month: billMonth,
        estimated_payment_date: buildMonthDate(billMonth, creditCard.payment_day),
        estimated_bill_amount: Number(current?.estimated_bill_amount ?? 0) + amountDelta,
        detail_count: Number(current?.detail_count ?? 0) + detailDelta,
        generated_at: new Date().toISOString()
      }
    ],
    "household_id,credit_card_id,bill_month"
  );
}

async function createExpenses(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  inputs: ExpenseInput[]
): Promise<{
  insertedExpenses: number;
  insertedPaymentSchedules: number;
  createdExpenses: { id: string; sourceRowId: string | null }[];
}> {
  let insertedExpenses = 0;
  let insertedPaymentSchedules = 0;
  const createdExpenses: { id: string; sourceRowId: string | null }[] = [];

  for (const input of inputs) {
    if (!input.consumptionDate || !input.itemDescription || !input.merchantName) {
      throw new Error("消費日、購買品項、消費通路都是必填。");
    }

    if (!Number.isFinite(input.amount)) {
      throw new Error("消費金額必須是有效數字。");
    }

    const normalizedDate = normalizeDateInput(input.consumptionDate);
    const budgetItem = findBudgetItem(references, input);
    const creditCard = input.paymentToolType === "credit_card" ? findCreditCard(references, input) : null;
    const installmentCount = Math.max(1, Math.trunc(Number(input.installmentCount || 1)));
    const legacyId = buildLegacyId(input.sourceSystem === "monthly_fixed_expense" ? "WEB_FIXED_EXPENSE" : "WEB_EXPENSE");
    const sourceRowId = input.sourceRowId ?? legacyId;

    const [expense] = await supabaseInsert<ExpenseInsertResult>(
      requestConfig,
      "expenses",
      [
        {
          household_id: references.householdId,
          user_id: references.userId,
          consumption_date: normalizedDate,
          budget_month: monthKeyFromDate(normalizedDate),
          merchant_tax_id: input.merchantTaxId || null,
          merchant_name: input.merchantName,
          item_description: input.itemDescription,
          budget_item_id: budgetItem.id,
          legacy_budget_item: budgetItem.legacy_name ?? budgetItem.legacy_id ?? budgetItem.name,
          amount: input.amount,
          payment_tool_type: input.paymentToolType,
          credit_card_id: creditCard?.id ?? null,
          is_installment: installmentCount > 1,
          installment_count: installmentCount,
          status: "active",
          source_system: input.sourceSystem ?? "vercel_web",
          source_table: input.sourceTable ?? "expense_entry",
          source_row_id: sourceRowId,
          legacy_id: legacyId,
          notes: input.notes || null,
          imported_at: new Date().toISOString()
        }
      ],
      true
    );

    insertedExpenses += 1;
    createdExpenses.push({ id: expense.id, sourceRowId });

    const paymentPlans = buildPaymentPlans({
      amount: input.amount,
      consumptionDate: normalizedDate,
      paymentToolType: input.paymentToolType,
      installmentCount,
      creditCard
    });

    await supabaseInsert(
      requestConfig,
      "payment_schedules",
      paymentPlans.map((plan) => ({
        household_id: references.householdId,
        expense_id: expense.id,
        payment_sequence: plan.sequence,
        payment_date: plan.paymentDate,
        cash_flow_month: plan.cashFlowMonth,
        payment_amount: plan.amount,
        payment_tool_type: input.paymentToolType,
        credit_card_id: creditCard?.id ?? null,
        payment_status: "estimated",
        source_system: input.sourceSystem ?? "vercel_web",
        source_table: "expense_entry_payment_schedule",
        source_row_id: `${sourceRowId}_P${String(plan.sequence).padStart(2, "0")}`,
        legacy_id: `${legacyId}_P${String(plan.sequence).padStart(2, "0")}`,
        notes: input.notes || null,
        imported_at: new Date().toISOString()
      }))
    );

    insertedPaymentSchedules += paymentPlans.length;

    for (const plan of paymentPlans) {
      await addCashFlowDelta(requestConfig, references.householdId, plan.cashFlowMonth, {
        cashExpense: input.paymentToolType === "cash" ? plan.amount : 0,
        creditCardPayment: input.paymentToolType === "credit_card" ? plan.amount : 0
      });

      if (creditCard) {
        await addBillEstimateDelta(requestConfig, references.householdId, creditCard, plan.cashFlowMonth, plan.amount, 1);
      }
    }
  }

  return { insertedExpenses, insertedPaymentSchedules, createdExpenses };
}

function manualRowToExpenseInput(row: ParsedManualExpenseRow): ExpenseInput {
  return {
    consumptionDate: row.consumptionDate,
    itemDescription: row.itemDescription,
    amount: row.amount,
    merchantName: row.merchantName,
    budgetItemName: row.budgetItemName,
    paymentToolType: row.paymentToolType,
    creditCardName: row.creditCardName,
    installmentCount: 1,
    notes: row.notes,
    sourceSystem: "manual_batch_import",
    sourceTable: "manual_batch_import"
  };
}

async function createMonthlyFixedExpense(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const startMonth = String(payload.startMonth || "");
  const repeatCount = Math.max(1, Math.trunc(Number(payload.repeatCount || 1)));
  const dayOfMonth = Math.max(1, Math.min(31, Math.trunc(Number(payload.dayOfMonth || 1))));
  const amount = Number(payload.amount || 0);
  const budgetItem = findBudgetItem(references, {
    budgetItemId: String(payload.budgetItemId || ""),
    budgetItemName: String(payload.budgetItemName || "")
  });
  const paymentToolType = String(payload.paymentToolType || "cash") === "credit_card" ? "credit_card" : "cash";
  const creditCard =
    paymentToolType === "credit_card"
      ? findCreditCard(references, {
          creditCardId: String(payload.creditCardId || ""),
          creditCardName: String(payload.creditCardName || "")
        })
      : null;

  if (!/^\d{4}-\d{2}$/.test(startMonth)) {
    throw new Error("開始月份必須是 YYYY-MM。");
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("固定消費金額必須大於或等於 0。");
  }

  await supabaseInsert(requestConfig, "expense_schedules", [
    {
      household_id: references.householdId,
      user_id: references.userId,
      schedule_name: String(payload.itemDescription || ""),
      day_of_month: dayOfMonth,
      start_month: startMonth,
      repeat_count: repeatCount,
      amount,
      merchant_name: String(payload.merchantName || ""),
      item_description: String(payload.itemDescription || ""),
      budget_item_id: budgetItem.id,
      payment_tool_type: paymentToolType,
      credit_card_id: creditCard?.id ?? null,
      source_system: "vercel_web",
      source_table: "monthly_fixed_expense",
      source_row_id: buildLegacyId("WEB_FIXED_SCHEDULE"),
      legacy_id: buildLegacyId("WEB_FIXED_SCHEDULE"),
      notes: String(payload.notes || "") || null,
      imported_at: new Date().toISOString()
    }
  ]);

  const expenseInputs: ExpenseInput[] = Array.from({ length: repeatCount }, (_, index) => ({
    consumptionDate: buildMonthDate(addMonthsSafe(startMonth, index), dayOfMonth),
    itemDescription: String(payload.itemDescription || ""),
    amount,
    merchantName: String(payload.merchantName || ""),
    budgetItemId: budgetItem.id,
    paymentToolType,
    creditCardId: creditCard?.id,
    installmentCount: 1,
    notes: String(payload.notes || ""),
    sourceSystem: "monthly_fixed_expense",
    sourceTable: "monthly_fixed_expense"
  }));

  return createExpenses(requestConfig, references, expenseInputs);
}

async function createIncome(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const income = readIncomePayload(payload);
  const legacyId = buildLegacyId("WEB_INCOME");

  await supabaseInsert(requestConfig, "income_schedules", [
    {
      household_id: references.householdId,
      user_id: references.userId,
      income_date: income.incomeDate,
      income_month: income.incomeMonth,
      income_item: income.incomeItem,
      income_amount: income.incomeAmount,
      income_status: income.incomeStatus,
      source: income.source,
      source_system: "vercel_web",
      source_table: "income_entry",
      source_row_id: legacyId,
      legacy_id: legacyId,
      imported_at: new Date().toISOString(),
      notes: income.notes
    }
  ]);

  await addCashFlowDelta(requestConfig, references.householdId, income.incomeMonth, { income: income.incomeAmount });

  return {
    insertedIncomes: 1,
    cashFlowMonth: income.incomeMonth
  };
}

function readIncomePayload(payload: Record<string, unknown>) {
  const incomeDate = normalizeDateInput(String(payload.incomeDate || ""));
  const incomeItem = String(payload.incomeItem || "").trim();
  const incomeAmount = Number(payload.incomeAmount || 0);
  const rawStatus = String(payload.incomeStatus || "received");
  const incomeStatus: IncomeStatus =
    rawStatus === "estimated" || rawStatus === "corrected" || rawStatus === "received" ? rawStatus : "received";
  const source = String(payload.source || "").trim() || "web";
  const notes = String(payload.notes || "").trim() || null;

  if (!incomeDate || !incomeItem) {
    throw new Error("收入日期與收入項目為必填。");
  }

  if (!Number.isFinite(incomeAmount) || incomeAmount < 0) {
    throw new Error("收入金額必須是大於或等於 0 的數字。");
  }

  return {
    incomeDate,
    incomeMonth: monthKeyFromDate(incomeDate),
    incomeItem,
    incomeAmount,
    incomeStatus,
    source,
    notes
  };
}

async function updateIncome(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const incomeId = String(payload.incomeId || "").trim();

  if (!incomeId) {
    throw new Error("請提供要更新的收入資料。");
  }

  const [current] = await supabaseRead<IncomeMaintenanceRow>(requestConfig, "income_schedules", {
    select: "id,income_date,income_month,income_item,income_amount,income_status,source,notes",
    household_id: `eq.${references.householdId}`,
    id: `eq.${incomeId}`,
    limit: "1"
  });

  if (!current) {
    throw new Error("找不到要更新的收入資料。");
  }

  const next = readIncomePayload(payload);
  const previousAmount = Number(current.income_amount || 0);

  await supabasePatch(
    requestConfig,
    "income_schedules",
    {
      household_id: `eq.${references.householdId}`,
      id: `eq.${incomeId}`
    },
    {
      income_date: next.incomeDate,
      income_month: next.incomeMonth,
      income_item: next.incomeItem,
      income_amount: next.incomeAmount,
      income_status: next.incomeStatus,
      source: next.source,
      notes: next.notes,
      updated_at: new Date().toISOString()
    }
  );

  if (current.income_month === next.incomeMonth) {
    await addCashFlowDelta(requestConfig, references.householdId, next.incomeMonth, {
      income: next.incomeAmount - previousAmount
    });
  } else {
    await addCashFlowDelta(requestConfig, references.householdId, current.income_month, { income: -previousAmount });
    await addCashFlowDelta(requestConfig, references.householdId, next.incomeMonth, { income: next.incomeAmount });
  }

  return {
    updatedIncomes: 1,
    cashFlowMonth: next.incomeMonth
  };
}

async function deleteIncome(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const incomeId = String(payload.incomeId || "").trim();

  if (!incomeId) {
    throw new Error("請提供要刪除的收入資料。");
  }

  const [current] = await supabaseRead<IncomeMaintenanceRow>(requestConfig, "income_schedules", {
    select: "id,income_date,income_month,income_item,income_amount,income_status,source,notes",
    household_id: `eq.${references.householdId}`,
    id: `eq.${incomeId}`,
    limit: "1"
  });

  if (!current) {
    throw new Error("找不到要刪除的收入資料。");
  }

  await supabaseDelete(requestConfig, "income_schedules", {
    household_id: `eq.${references.householdId}`,
    id: `eq.${incomeId}`
  });

  await addCashFlowDelta(requestConfig, references.householdId, current.income_month, {
    income: -Number(current.income_amount || 0)
  });

  return {
    deletedIncomes: 1,
    cashFlowMonth: current.income_month
  };
}
function addMonthsSafe(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function importInvoiceDrafts(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const rows = parseInvoiceText(String(payload.text || ""));

  if (rows.length === 0) {
    throw new Error("沒有解析到可匯入的發票明細。");
  }

  const [batch] = await supabaseInsert<{ id: string }>(
    requestConfig,
    "invoice_import_batches",
    [
      {
        household_id: references.householdId,
        imported_by: references.userId,
        row_count: rows.length,
        file_name: String(payload.fileName || "") || null,
        source_system: "finance_ministry_invoice",
        source_table: "invoice_import",
        source_row_id: buildLegacyId("WEB_INVOICE_BATCH"),
        legacy_id: buildLegacyId("WEB_INVOICE_BATCH"),
        imported_at: new Date().toISOString()
      }
    ],
    true
  );

  const [existing, paymentRules, itemRules] = await Promise.all([
    existingInvoiceImportKeys(requestConfig, references.householdId, rows),
    supabaseRead<MerchantPaymentRuleRow>(requestConfig, "merchant_payment_rules", {
      select: "merchant_tax_id,merchant_name_contains,payment_tool_type,credit_card_id,default_budget_item_id,is_active",
      household_id: `eq.${references.householdId}`,
      is_active: "eq.true"
    }),
    supabaseRead<MerchantItemRuleRow>(requestConfig, "merchant_item_rules", {
      select: "merchant_tax_id,merchant_name_contains,item_keyword_contains,budget_item_id,is_active",
      household_id: `eq.${references.householdId}`,
      is_active: "eq.true"
    })
  ]);
  const mealBudgetItem = findDefaultMealBudgetItem(references);
  const insertRows = rows
    .filter((row) => !shouldSkipInvoiceImportRow(row, existing))
    .map((row) => {
      const paymentRule = findMerchantPaymentRule(row, paymentRules);
      const itemRule = findMerchantItemRule(row, itemRules);
      const suggestedBudgetItem =
        references.budgetItems.find((item) => item.id === paymentRule?.default_budget_item_id) ??
        references.budgetItems.find((item) => item.id === itemRule?.budget_item_id) ??
        mealBudgetItem;

      return {
        household_id: references.householdId,
        batch_id: batch.id,
        source_line_key: row.sourceLineKey,
        consumption_date: row.consumptionDate,
        merchant_tax_id: row.merchantTaxId || null,
        merchant_name: row.merchantName || null,
        item_description: row.itemDescription,
        amount: row.amount,
        suggested_payment_tool_type: paymentRule?.payment_tool_type ?? "cash",
        suggested_credit_card_id: paymentRule?.payment_tool_type === "credit_card" ? paymentRule.credit_card_id : null,
        suggested_budget_item_id: suggestedBudgetItem?.id ?? null,
        legacy_suggested_budget_item:
          suggestedBudgetItem?.legacy_name ?? suggestedBudgetItem?.legacy_id ?? suggestedBudgetItem?.name ?? null,
        review_status: "needs_review",
        source_system: "finance_ministry_invoice",
        source_table: "invoice_import",
        source_row_id: row.sourceRecordId || row.sourceLineKey,
        legacy_id: buildLegacyId("WEB_INVOICE_DRAFT"),
        imported_at: new Date().toISOString()
      };
    });

  await supabaseInsert(requestConfig, "invoice_drafts", insertRows);

  return {
    parsedRows: rows.length,
    insertedDrafts: insertRows.length,
    skippedExisting: rows.length - insertRows.length
  };
}

function findMerchantPaymentRule(row: InvoiceDraftInput, rules: MerchantPaymentRuleRow[]) {
  return findInvoiceMerchantPaymentRule(
    {
      merchant_tax_id: row.merchantTaxId || null,
      merchant_name: row.merchantName || null
    },
    rules
  );
}

function findMerchantItemRule(row: InvoiceDraftInput, rules: MerchantItemRuleRow[]) {
  return findInvoiceMerchantItemRule(
    {
      merchant_tax_id: row.merchantTaxId || null,
      merchant_name: row.merchantName || null,
      item_description: row.itemDescription
    },
    rules
  );
}

type ExistingInvoiceDraftIdentityRow = {
  source_line_key: string;
  consumption_date: string;
};

type ExistingInvoiceExpenseIdentityRow = {
  source_row_id: string | null;
  consumption_date: string;
};

async function existingInvoiceImportKeys(
  requestConfig: SupabaseRequestConfig,
  householdId: string,
  rows: InvoiceDraftInput[]
): Promise<ExistingInvoiceImportKeys> {
  if (rows.length === 0) {
    return { sourceLineKeys: new Set(), invoiceDateKeys: new Set() };
  }

  const sourceLineKeys = rows.map((row) => row.sourceLineKey);
  const quotedSourceLineKeys = sourceLineKeys.map((key) => `"${key.replace(/"/g, '\\"')}"`).join(",");
  const dates = [...new Set(rows.map((row) => row.consumptionDate).filter(Boolean))];
  const dateFilter = buildInFilter(dates);

  const [draftRows, invoiceDateDraftRows, expenseRows] = await Promise.all([
    supabaseRead<ExistingInvoiceDraftIdentityRow>(requestConfig, "invoice_drafts", {
      select: "source_line_key,consumption_date",
      household_id: `eq.${householdId}`,
      source_line_key: `in.(${quotedSourceLineKeys})`
    }),
    dates.length > 0
      ? supabaseRead<ExistingInvoiceDraftIdentityRow>(requestConfig, "invoice_drafts", {
          select: "source_line_key,consumption_date",
          household_id: `eq.${householdId}`,
          source_system: "eq.finance_ministry_invoice",
          consumption_date: dateFilter
        })
      : Promise.resolve([]),
    dates.length > 0
      ? supabaseRead<ExistingInvoiceExpenseIdentityRow>(requestConfig, "expenses", {
          select: "source_row_id,consumption_date",
          household_id: `eq.${householdId}`,
          source_system: "eq.finance_ministry_invoice",
          consumption_date: dateFilter
        })
      : Promise.resolve([])
  ]);

  const invoiceDateKeys = new Set<string>();

  for (const row of invoiceDateDraftRows) {
    const key = buildInvoiceDateKey(row.source_line_key, row.consumption_date);
    if (key) {
      invoiceDateKeys.add(key);
    }
  }

  for (const row of expenseRows) {
    const key = buildInvoiceDateKey(row.source_row_id, row.consumption_date);
    if (key) {
      invoiceDateKeys.add(key);
    }
  }

  return {
    sourceLineKeys: new Set(draftRows.map((row) => row.source_line_key)),
    invoiceDateKeys
  };
}
function findDefaultMealBudgetItem(references: EntryReferences): BudgetItemRow | null {
  return (
    references.budgetItems.find((item) => item.legacy_name === "24. 餐費" || item.legacy_id === "24. 餐費") ??
    references.budgetItems.find((item) => item.name.includes("餐費")) ??
    null
  );
}

function parseInvoiceText(text: string): InvoiceDraftInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitLine(lines[0], delimiter).map((header) => header.trim());
  const counts = new Map<string, number>();

  return lines
    .slice(1)
    .map((line) => {
      const cells = splitLine(line, delimiter);
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
      const parsed = normalizeInvoiceRow(row);
      const baseKey = [
        parsed.sourceRecordId,
        parsed.merchantTaxId,
        parsed.consumptionDate,
        parsed.itemDescription,
        parsed.amount
      ]
        .map((value) => String(value ?? "").trim())
        .join("|");
      const count = (counts.get(baseKey) ?? 0) + 1;
      counts.set(baseKey, count);

      return {
        ...parsed,
        sourceLineKey: `${baseKey}|${count}`
      };
    })
    .filter((row) => row.consumptionDate || row.itemDescription || row.amount > 0);
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") {
    return line.split("\t");
  }

  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function normalizeInvoiceRow(row: Record<string, string>): Omit<InvoiceDraftInput, "sourceLineKey"> {
  return {
    sourceRecordId: pickInvoiceField(row, ["發票號碼", "發票字軌號碼", "invoice_number", "source_record_id"]),
    consumptionDate: normalizeDateInput(
      pickInvoiceField(row, ["消費日", "交易日期", "發票日期", "發票開立日期", "invoice_date", "consumption_date"])
    ),
    merchantTaxId: pickInvoiceField(row, ["統編", "店家統編", "營業人統編", "賣方統編", "賣方統一編號", "merchant_tax_id"]),
    merchantName: pickInvoiceField(row, ["店家", "店家名稱", "營業人名稱", "賣方名稱", "merchant_name"]),
    itemDescription: pickInvoiceField(row, ["消費明細_品名", "發票明細_品名", "品項", "品名", "購買品項", "商品名稱", "item_description"]),
    amount:
      Number(
        pickInvoiceField(row, ["消費明細_金額", "發票明細_金額", "發票明細金額", "金額", "消費金額", "發票金額", "amount"]).replace(
          /[,$\s]/g,
          ""
        )
      ) || 0
  };
}

function pickInvoiceField(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return String(row[name] || "").trim();
    }
  }

  return "";
}

function buildInFilter(values: string[]): string {
  return `in.(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",")})`;
}

async function updateExpenseDetails(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const expenseId = String(payload.expenseId || "").trim();
  const itemDescription = String(payload.itemDescription || "").trim();
  const budgetItemId = String(payload.budgetItemId || "").trim();

  if (!expenseId || !itemDescription || !budgetItemId) {
    throw new Error("請填寫品項並選擇預算項目。");
  }

  const budgetItem = findBudgetItem(references, { budgetItemId });

  await supabasePatch(
    requestConfig,
    "expenses",
    {
      household_id: `eq.${references.householdId}`,
      id: `eq.${expenseId}`,
      status: "eq.active"
    },
    {
      item_description: itemDescription,
      budget_item_id: budgetItem.id,
      legacy_budget_item: budgetItem.legacy_name ?? budgetItem.legacy_id ?? budgetItem.name,
      updated_at: new Date().toISOString()
    }
  );

  return {
    updatedExpenses: 1
  };
}
async function updateExpenseItemDescription(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const expenseId = String(payload.expenseId || "").trim();
  const itemDescription = String(payload.itemDescription || "").trim();

  if (!expenseId || !itemDescription) {
    throw new Error("請填寫要更新的品項。");
  }

  await supabasePatch(
    requestConfig,
    "expenses",
    {
      household_id: `eq.${references.householdId}`,
      id: `eq.${expenseId}`,
      status: "eq.active"
    },
    {
      item_description: itemDescription,
      updated_at: new Date().toISOString()
    }
  );

  return {
    updatedExpenses: 1
  };
}

async function deleteExpenses(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const expenseIds = Array.isArray(payload.expenseIds) ? payload.expenseIds.map(String).filter(Boolean) : [];

  if (expenseIds.length === 0) {
    throw new Error("請先選擇要刪除的消費。");
  }

  const expenses = await supabaseRead<ExpenseMaintenanceRow>(requestConfig, "expenses", {
    select: "id,status",
    household_id: `eq.${references.householdId}`,
    id: buildInFilter(expenseIds),
    status: "eq.active"
  });

  for (const expense of expenses) {
    const schedules = await supabaseRead<PaymentScheduleMaintenanceRow>(requestConfig, "payment_schedules", {
      select: "cash_flow_month,payment_amount,payment_tool_type,credit_card_id",
      household_id: `eq.${references.householdId}`,
      expense_id: `eq.${expense.id}`
    });

    for (const schedule of schedules) {
      const amount = Number(schedule.payment_amount || 0);

      await addCashFlowDelta(requestConfig, references.householdId, schedule.cash_flow_month, {
        cashExpense: schedule.payment_tool_type === "cash" ? -amount : 0,
        creditCardPayment: schedule.payment_tool_type === "credit_card" ? -amount : 0
      });

      if (schedule.payment_tool_type === "credit_card" && schedule.credit_card_id) {
        const creditCard = references.creditCards.find((card) => card.id === schedule.credit_card_id);

        if (creditCard) {
          await addBillEstimateDelta(requestConfig, references.householdId, creditCard, schedule.cash_flow_month, -amount, -1);
        }
      }
    }

    await supabasePatch(
      requestConfig,
      "payment_schedules",
      {
        household_id: `eq.${references.householdId}`,
        expense_id: `eq.${expense.id}`
      },
      {
        payment_status: "corrected",
        updated_at: new Date().toISOString()
      }
    );

    await supabasePatch(
      requestConfig,
      "expenses",
      {
        household_id: `eq.${references.householdId}`,
        id: `eq.${expense.id}`,
        status: "eq.active"
      },
      {
        status: "cancelled",
        updated_at: new Date().toISOString()
      }
    );
  }

  return {
    deletedExpenses: expenses.length,
    requestedExpenses: expenseIds.length
  };
}
async function deleteInvoiceDrafts(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const draftIds = Array.isArray(payload.draftIds) ? payload.draftIds.map(String).filter(Boolean) : [];

  if (draftIds.length === 0) {
    throw new Error("請先勾選要刪除的發票。");
  }

  await supabasePatch(
    requestConfig,
    "invoice_drafts",
    {
      household_id: `eq.${references.householdId}`,
      review_status: "eq.needs_review",
      id: buildInFilter(draftIds)
    },
    {
      review_status: "deleted",
      updated_at: new Date().toISOString()
    }
  );

  return {
    deletedDrafts: draftIds.length
  };
}

async function confirmInvoiceDrafts(
  requestConfig: SupabaseRequestConfig,
  references: EntryReferences,
  payload: Record<string, unknown>
) {
  const confirmations = Array.isArray(payload.confirmations)
    ? (payload.confirmations as InvoiceDraftConfirmation[])
    : [];

  if (confirmations.length === 0) {
    throw new Error("No invoice drafts were selected for confirmation.");
  }

  const draftIds = confirmations.map((confirmation) => confirmation.draftId).filter(Boolean);
  const rows = await supabaseRead<InvoiceDraftReviewRow>(requestConfig, "invoice_drafts", {
    select:
      "id,source_line_key,consumption_date,merchant_tax_id,merchant_name,item_description,amount,suggested_payment_tool_type,suggested_credit_card_id,suggested_budget_item_id,legacy_suggested_budget_item,review_status,notes",
    household_id: `eq.${references.householdId}`,
    review_status: "eq.needs_review",
    id: buildInFilter(draftIds)
  });

  if (rows.length !== draftIds.length) {
    throw new Error("Some selected invoice drafts are no longer pending review.");
  }

  const reviewItems = mapInvoiceDraftReviewItems(rows, references.budgetItems, references.creditCards);
  const confirmationInputs = buildInvoiceDraftConfirmationInputs(reviewItems, confirmations);
  const result = await createExpenses(
    requestConfig,
    references,
    confirmationInputs.map((input) => ({
      consumptionDate: input.consumptionDate,
      merchantTaxId: input.merchantTaxId,
      itemDescription: input.itemDescription,
      amount: input.amount,
      merchantName: input.merchantName,
      budgetItemId: input.budgetItemId,
      paymentToolType: input.paymentToolType,
      creditCardId: input.creditCardId,
      installmentCount: 1,
      notes: input.notes,
      sourceSystem: "finance_ministry_invoice",
      sourceTable: "invoice_drafts",
      sourceRowId: input.sourceLineKey
    }))
  );

  for (let index = 0; index < confirmationInputs.length; index += 1) {
    const input = confirmationInputs[index];
    const createdExpense = result.createdExpenses[index];

    await supabasePatch(
      requestConfig,
      "invoice_drafts",
      {
        household_id: `eq.${references.householdId}`,
        id: `eq.${input.draftId}`
      },
      {
        review_status: "confirmed",
        confirmed_expense_id: createdExpense.id,
        suggested_payment_tool_type: input.paymentToolType,
        suggested_credit_card_id: input.creditCardId ?? null,
        suggested_budget_item_id: input.budgetItemId,
        notes: input.notes || null,
        updated_at: new Date().toISOString()
      }
    );
  }

  return {
    confirmedDrafts: confirmationInputs.length,
    insertedExpenses: result.insertedExpenses,
    insertedPaymentSchedules: result.insertedPaymentSchedules
  };
}

export async function POST(request: Request) {
  const accessToken = readBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "缺少 Supabase session，請先登入。" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const requestConfig = requireSupabaseRequestConfig(accessToken);
    const references = await loadReferences(requestConfig, accessToken);
    const action = String(payload.action || "");

    if (action === "singleExpense") {
      const result = await createExpenses(requestConfig, references, [
        {
          consumptionDate: String(payload.consumptionDate || ""),
          itemDescription: String(payload.itemDescription || ""),
          amount: Number(payload.amount || 0),
          merchantName: String(payload.merchantName || ""),
          budgetItemId: String(payload.budgetItemId || ""),
          paymentToolType: String(payload.paymentToolType || "cash") === "credit_card" ? "credit_card" : "cash",
          creditCardId: String(payload.creditCardId || ""),
          installmentCount: Number(payload.installmentCount || 1),
          notes: String(payload.notes || ""),
          sourceSystem: "manual_no_invoice",
          sourceTable: "expense_entry"
        }
      ]);

      return NextResponse.json(result);
    }

    if (action === "batchManualExpenses") {
      const rows = parseManualExpenseText(String(payload.text || ""));

      if (rows.length === 0) {
        throw new Error("沒有解析到可匯入的手動消費。");
      }

      const result = await createExpenses(requestConfig, references, rows.map(manualRowToExpenseInput));

      return NextResponse.json({ ...result, parsedRows: rows.length });
    }

    if (action === "monthlyFixedExpense") {
      const result = await createMonthlyFixedExpense(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "singleIncome") {
      const result = await createIncome(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "updateIncome") {
      const result = await updateIncome(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "deleteIncome") {
      const result = await deleteIncome(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "updateExpenseDetails") {
      const result = await updateExpenseDetails(requestConfig, references, payload);

      return NextResponse.json(result);
    }
    if (action === "updateExpenseItemDescription") {
      const result = await updateExpenseItemDescription(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "deleteExpenses") {
      const result = await deleteExpenses(requestConfig, references, payload);

      return NextResponse.json(result);
    }
    if (action === "invoiceImport") {
      const result = await importInvoiceDrafts(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "deleteInvoiceDrafts") {
      const result = await deleteInvoiceDrafts(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    if (action === "confirmInvoiceDrafts") {
      const result = await confirmInvoiceDrafts(requestConfig, references, payload);

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `不支援的動作：${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "記帳寫入失敗。"
      },
      { status: 500 }
    );
  }
}
