import { buildCreditCardAliasMap, normalizeLegacyCreditCardName, normalizeLegacyMonth } from "./google-sheet-migration-preflight.mjs";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(value);
}

function boolValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "yes", "1"].includes(text(value).toLowerCase());
}

function dateValue(value) {
  const valueText = text(value);

  if (!valueText) {
    return null;
  }

  return valueText.slice(0, 10);
}

function legacyId(prefix, value) {
  return `legacy:${prefix}:${text(value)}`;
}

function statusValue(value, activeValue = "active") {
  const valueText = text(value);

  if (valueText === "cancelled") {
    return "cancelled";
  }

  return activeValue;
}

function budgetCode(value) {
  const match = text(value).match(/^(\d+)\./);
  return match ? Number(match[1]) : null;
}

function uniqueByKey(rows, keyFn) {
  const result = [];
  const seen = new Set();

  for (const row of rows) {
    const key = keyFn(row);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }

  return result;
}

function buildBudgetGroups(budgetRows) {
  return uniqueByKey(
    budgetRows
      .map((row, index) => ({
        temp_id: legacyId("budget_group", row.category),
        name: text(row.category),
        display_order: index + 1,
        source_system: "google_sheets",
        source_table: "BudgetItems"
      }))
      .filter((row) => row.name),
    (row) => row.name
  );
}

function buildBudgetItems(budgetRows) {
  return budgetRows
    .filter((row) => text(row.budget_item))
    .map((row, index) => ({
      temp_id: legacyId("budget_item", row.budget_item),
      budget_group_temp_id: legacyId("budget_group", row.category),
      name: text(row.budget_item).replace(/^\d+\.\s*/, ""),
      display_order: index + 1,
      annual_budget: numberValue(row.annual_budget),
      month_01: numberValue(row.month_01),
      month_02: numberValue(row.month_02),
      month_03: numberValue(row.month_03),
      month_04: numberValue(row.month_04),
      month_05: numberValue(row.month_05),
      month_06: numberValue(row.month_06),
      month_07: numberValue(row.month_07),
      month_08: numberValue(row.month_08),
      month_09: numberValue(row.month_09),
      month_10: numberValue(row.month_10),
      month_11: numberValue(row.month_11),
      month_12: numberValue(row.month_12),
      is_active: boolValue(row.is_valid_expense_item),
      legacy_code: budgetCode(row.budget_item),
      legacy_name: text(row.budget_item),
      source_system: "google_sheets",
      source_table: "BudgetItems"
    }));
}

function buildCreditCards(cardRows) {
  return cardRows
    .filter((row) => text(row.credit_card_name))
    .map((row) => ({
      temp_id: legacyId("credit_card", row.credit_card_name),
      name: text(row.credit_card_name),
      card_group: text(row.card_group),
      cutoff_day: numberValue(row.cutoff_day),
      payment_day: numberValue(row.payment_day),
      is_active: true,
      source_system: "google_sheets",
      source_table: "CreditCardRules",
      legacy_id: text(row.credit_card_name)
    }));
}

function buildPaymentMethods() {
  return [
    {
      temp_id: legacyId("payment_method", "cash"),
      tool_type: "cash",
      name: "cash",
      is_active: true,
      source_system: "google_sheets",
      source_table: "derived"
    },
    {
      temp_id: legacyId("payment_method", "credit_card"),
      tool_type: "credit_card",
      name: "credit_card",
      is_active: true,
      source_system: "google_sheets",
      source_table: "derived"
    }
  ];
}

function buildExpenses(expenseRows, cardAliasMap) {
  return expenseRows
    .filter((row) => text(row.expense_id))
    .map((row) => {
      const paymentToolType = text(row.payment_tool_type);
      const creditCardName = normalizeLegacyCreditCardName(row.credit_card_name, cardAliasMap);

      return {
        temp_id: legacyId("expense", row.expense_id),
        consumption_date: dateValue(row.consumption_date),
        budget_month: normalizeLegacyMonth(row.budget_month),
        merchant_tax_id: text(row.merchant_tax_id),
        merchant_name: text(row.merchant_name),
        item_description: text(row.item_description),
        budget_item_temp_id: legacyId("budget_item", row.budget_item),
        budget_item_legacy_name: text(row.budget_item),
        legacy_budget_item: text(row.budget_item),
        amount: numberValue(row.amount),
        payment_tool_type: paymentToolType,
        credit_card_temp_id: paymentToolType === "credit_card" ? legacyId("credit_card", creditCardName) : null,
        credit_card_legacy_name: paymentToolType === "credit_card" ? creditCardName : "",
        is_installment: text(row.is_installment).toLowerCase() === "yes",
        installment_count: numberValue(row.installment_count) || 1,
        status: statusValue(row.expense_status),
        source_system: "google_sheets",
        source_table: "ExpenseRecords",
        source_row_id: text(row.expense_id),
        legacy_id: text(row.expense_id),
        notes: text(row.notes)
      };
    });
}

function buildPaymentSchedules(paymentRows, expenseIds, cardAliasMap) {
  const paymentSchedules = [];
  const skippedPaymentSchedules = [];

  for (const row of paymentRows) {
    const expenseId = text(row.expense_id);
    const cashFlowMonth = normalizeLegacyMonth(row.cash_flow_month);
    const paymentMonth = normalizeLegacyMonth(row.payment_date);
    const isOrphan = expenseId && !expenseIds.has(expenseId);

    if (isOrphan) {
      skippedPaymentSchedules.push({
        source_table: "PaymentSchedule",
        source_row_id: text(row.payment_id),
        legacy_id: text(row.payment_id),
        expense_id: expenseId,
        payment_date: dateValue(row.payment_date),
        cash_flow_month: text(row.cash_flow_month),
        payment_amount: numberValue(row.payment_amount),
        migration_action: "delete_before_import",
        reason: "PaymentSchedule references a missing ExpenseRecords.expense_id."
      });
      continue;
    }

    if (!cashFlowMonth || paymentMonth === "1970-01" || cashFlowMonth === "1970-01") {
      skippedPaymentSchedules.push({
        source_table: "PaymentSchedule",
        source_row_id: text(row.payment_id),
        legacy_id: text(row.payment_id),
        expense_id: expenseId,
        payment_date: dateValue(row.payment_date),
        cash_flow_month: text(row.cash_flow_month),
        payment_amount: numberValue(row.payment_amount),
        migration_action: "review_payment_month_before_import",
        reason: "PaymentSchedule has an invalid payment month."
      });
      continue;
    }

    const paymentToolType = text(row.payment_tool_type);
    const creditCardName = normalizeLegacyCreditCardName(row.credit_card_name, cardAliasMap);
    const paymentAmount = numberValue(row.payment_amount);

    paymentSchedules.push({
      temp_id: legacyId("payment_schedule", row.payment_id),
      expense_temp_id: legacyId("expense", expenseId),
      payment_sequence: numberValue(row.payment_sequence) || 1,
      payment_date: dateValue(row.payment_date),
      cash_flow_month: cashFlowMonth,
      payment_amount: paymentAmount,
      payment_tool_type: paymentToolType,
      credit_card_temp_id: paymentToolType === "credit_card" ? legacyId("credit_card", creditCardName) : null,
      credit_card_legacy_name: paymentToolType === "credit_card" ? creditCardName : "",
      payment_status: text(row.payment_status) || "estimated",
      migration_action: paymentAmount < 0 ? "preserve_as_payment_adjustment" : "import",
      source_system: "google_sheets",
      source_table: "PaymentSchedule",
      source_row_id: text(row.payment_id),
      legacy_id: text(row.payment_id),
      notes: text(row.notes)
    });
  }

  return { paymentSchedules, skippedPaymentSchedules };
}

function buildIncomeSchedules(incomeRows) {
  return incomeRows
    .filter((row) => text(row.income_id))
    .map((row) => ({
      temp_id: legacyId("income", row.income_id),
      income_date: dateValue(row.income_date),
      income_month: normalizeLegacyMonth(row.income_month),
      income_item: text(row.income_item),
      income_amount: numberValue(row.income_amount),
      income_status: text(row.income_status) || "estimated",
      source: text(row.source),
      source_system: "google_sheets",
      source_table: "IncomeSchedule",
      source_row_id: text(row.income_id),
      legacy_id: text(row.income_id),
      notes: text(row.notes)
    }));
}

export function buildSupabaseImportPackage(workbookRows) {
  const cardAliasMap = buildCreditCardAliasMap(workbookRows.CreditCardRules ?? []);
  const budgetGroups = buildBudgetGroups(workbookRows.BudgetItems ?? []);
  const budgetItems = buildBudgetItems(workbookRows.BudgetItems ?? []);
  const creditCards = buildCreditCards(workbookRows.CreditCardRules ?? []);
  const paymentMethods = buildPaymentMethods();
  const expenses = buildExpenses(workbookRows.ExpenseRecords ?? [], cardAliasMap);
  const expenseIds = new Set((workbookRows.ExpenseRecords ?? []).map((row) => text(row.expense_id)).filter(Boolean));
  const { paymentSchedules, skippedPaymentSchedules } = buildPaymentSchedules(
    workbookRows.PaymentSchedule ?? [],
    expenseIds,
    cardAliasMap
  );
  const incomeSchedules = buildIncomeSchedules(workbookRows.IncomeSchedule ?? []);

  return {
    summary: {
      budgetGroups: budgetGroups.length,
      budgetItems: budgetItems.length,
      creditCards: creditCards.length,
      paymentMethods: paymentMethods.length,
      expenses: expenses.length,
      paymentSchedules: paymentSchedules.length,
      skippedPaymentSchedules: skippedPaymentSchedules.length,
      incomeSchedules: incomeSchedules.length
    },
    budgetGroups,
    budgetItems,
    creditCards,
    paymentMethods,
    expenses,
    paymentSchedules,
    skippedPaymentSchedules,
    incomeSchedules
  };
}

export function validateSupabaseImportPackage(importPackage) {
  const issues = [];
  const budgetItemIds = new Set(importPackage.budgetItems.map((row) => row.temp_id));
  const creditCardIds = new Set(importPackage.creditCards.map((row) => row.temp_id));
  const expenseIds = new Set(importPackage.expenses.map((row) => row.temp_id));
  const validMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

  for (const row of importPackage.expenses) {
    if (!budgetItemIds.has(row.budget_item_temp_id)) {
      issues.push({
        type: "missing_budget_item_reference",
        source_table: "expenses",
        legacy_id: row.legacy_id,
        value: row.budget_item_legacy_name
      });
    }

    if (row.payment_tool_type === "credit_card" && !creditCardIds.has(row.credit_card_temp_id)) {
      issues.push({
        type: "missing_credit_card_reference",
        source_table: "expenses",
        legacy_id: row.legacy_id,
        value: row.credit_card_legacy_name
      });
    }

    if (!validMonthPattern.test(row.budget_month ?? "")) {
      issues.push({
        type: "invalid_budget_month",
        source_table: "expenses",
        legacy_id: row.legacy_id,
        value: row.budget_month
      });
    }
  }

  for (const row of importPackage.paymentSchedules) {
    if (!expenseIds.has(row.expense_temp_id)) {
      issues.push({
        type: "missing_expense_reference",
        source_table: "payment_schedules",
        legacy_id: row.legacy_id,
        value: row.expense_temp_id
      });
    }

    if (row.payment_tool_type === "credit_card" && !creditCardIds.has(row.credit_card_temp_id)) {
      issues.push({
        type: "missing_credit_card_reference",
        source_table: "payment_schedules",
        legacy_id: row.legacy_id,
        value: row.credit_card_legacy_name
      });
    }

    if (!validMonthPattern.test(row.cash_flow_month ?? "")) {
      issues.push({
        type: "invalid_cash_flow_month",
        source_table: "payment_schedules",
        legacy_id: row.legacy_id,
        value: row.cash_flow_month
      });
    }
  }

  for (const row of importPackage.incomeSchedules) {
    if (!validMonthPattern.test(row.income_month ?? "")) {
      issues.push({
        type: "invalid_income_month",
        source_table: "income_schedules",
        legacy_id: row.legacy_id,
        value: row.income_month
      });
    }
  }

  return issues;
}
