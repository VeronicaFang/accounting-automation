const LEGACY_CARD_ALIASES = new Map([
  ["玉山", "YuShan"],
  ["聯邦", "Union"],
  ["國泰", "Cathay"],
  ["中信", "CTBC"],
  ["富邦", "Fubon"]
]);

function isPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeCellText(value) {
  return isPresent(value) ? String(value).trim() : "";
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes"].includes(normalizeCellText(value).toLowerCase());
}

function normalizeAmount(value) {
  if (!isPresent(value)) {
    return 0;
  }

  return Number(value);
}

export function normalizeLegacyMonth(value) {
  if (!isPresent(value)) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }

  const text = normalizeCellText(value);

  if (text === "NaN-NaN") {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}`;
  }

  const slashMatch = text.match(/^(\d{4})\/(\d{1,2})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${String(Number(slashMatch[2])).padStart(2, "0")}`;
  }

  return null;
}

export function buildCreditCardAliasMap(creditCardRows = []) {
  const cardNames = new Set(creditCardRows.map((row) => normalizeCellText(row.credit_card_name)).filter(Boolean));
  const aliasMap = new Map();

  for (const cardName of cardNames) {
    aliasMap.set(cardName, cardName);
  }

  for (const [legacyName, targetName] of LEGACY_CARD_ALIASES) {
    if (cardNames.has(targetName)) {
      aliasMap.set(legacyName, targetName);
    }
  }

  return aliasMap;
}

export function normalizeLegacyCreditCardName(value, aliasMap) {
  const cardName = normalizeCellText(value);

  if (!cardName) {
    return "";
  }

  return aliasMap.get(cardName) ?? cardName;
}

function createIssue(type, sheet, rowNumber, details) {
  return { type, sheet, rowNumber, ...details };
}

export function runGoogleSheetMigrationPreflight(workbookRows) {
  const budgetItems = new Set(
    (workbookRows.BudgetItems ?? []).map((row) => normalizeCellText(row.budget_item)).filter(Boolean)
  );
  const expenseIds = new Set(
    (workbookRows.ExpenseRecords ?? []).map((row) => normalizeCellText(row.expense_id)).filter(Boolean)
  );
  const creditCardAliasMap = buildCreditCardAliasMap(workbookRows.CreditCardRules ?? []);
  const mappedCreditCards = new Set(creditCardAliasMap.values());
  const issues = [];

  const budgetColumns = [
    ["ExpenseRecords", "budget_item"],
    ["ExpenseRecords", "suggested_budget_item"],
    ["ImportedInvoiceDrafts", "suggested_budget_item"],
    ["MerchantPaymentRules", "default_budget_item"],
    ["MerchantItemRules", "budget_item"],
    ["ClassificationHistory", "budget_item"]
  ];

  for (const [sheetName, columnName] of budgetColumns) {
    (workbookRows[sheetName] ?? []).forEach((row, index) => {
      const budgetItem = normalizeCellText(row[columnName]);
      if (budgetItem && !budgetItems.has(budgetItem)) {
        issues.push(
          createIssue("invalid_budget_item", sheetName, index + 2, {
            columnName,
            value: budgetItem
          })
        );
      }
    });
  }

  (workbookRows.PaymentSchedule ?? []).forEach((row, index) => {
    const rowNumber = index + 2;
    const cashFlowMonth = normalizeLegacyMonth(row.cash_flow_month);
    const rawCashFlowMonth = normalizeCellText(row.cash_flow_month);
    const paymentDateMonth = normalizeLegacyMonth(row.payment_date);
    const expenseId = normalizeCellText(row.expense_id);
    const amount = normalizeAmount(row.payment_amount);
    const paymentToolType = normalizeCellText(row.payment_tool_type);
    const creditCardName = normalizeLegacyCreditCardName(row.credit_card_name, creditCardAliasMap);

    if (!cashFlowMonth) {
      issues.push(
        createIssue("invalid_payment_month", "PaymentSchedule", rowNumber, {
          paymentId: normalizeCellText(row.payment_id),
          value: rawCashFlowMonth
        })
      );
    }

    if (cashFlowMonth === "1970-01" || paymentDateMonth === "1970-01") {
      issues.push(
        createIssue("legacy_epoch_payment_month", "PaymentSchedule", rowNumber, {
          paymentId: normalizeCellText(row.payment_id),
          paymentDate: normalizeCellText(row.payment_date),
          cashFlowMonth: rawCashFlowMonth
        })
      );
    }

    if (expenseId && !expenseIds.has(expenseId)) {
      issues.push(
        createIssue("orphan_payment_schedule", "PaymentSchedule", rowNumber, {
          paymentId: normalizeCellText(row.payment_id),
          expenseId
        })
      );
    }

    if (amount < 0) {
      issues.push(
        createIssue("negative_payment_amount", "PaymentSchedule", rowNumber, {
          paymentId: normalizeCellText(row.payment_id),
          amount
        })
      );
    }

    if (paymentToolType === "credit_card" && !mappedCreditCards.has(creditCardName)) {
      issues.push(
        createIssue("unmapped_credit_card", "PaymentSchedule", rowNumber, {
          paymentId: normalizeCellText(row.payment_id),
          value: normalizeCellText(row.credit_card_name)
        })
      );
    }
  });

  const issueCounts = {
    invalidBudgetItems: issues.filter((issue) => issue.type === "invalid_budget_item").length,
    invalidPaymentMonths: issues.filter((issue) => issue.type === "invalid_payment_month").length,
    legacyEpochPaymentMonths: issues.filter((issue) => issue.type === "legacy_epoch_payment_month").length,
    orphanPaymentSchedules: issues.filter((issue) => issue.type === "orphan_payment_schedule").length,
    negativePaymentAmounts: issues.filter((issue) => issue.type === "negative_payment_amount").length,
    unmappedCreditCards: issues.filter((issue) => issue.type === "unmapped_credit_card").length
  };

  return {
    issueCounts,
    issues,
    sheetRowCounts: Object.fromEntries(
      Object.entries(workbookRows).map(([sheetName, rows]) => [sheetName, rows.length])
    ),
    activeBudgetItemCount: (workbookRows.BudgetItems ?? []).filter((row) =>
      normalizeBoolean(row.is_valid_expense_item)
    ).length,
    creditCardAliases: Object.fromEntries(creditCardAliasMap)
  };
}
