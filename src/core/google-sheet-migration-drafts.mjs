import {
  buildCreditCardAliasMap,
  normalizeLegacyCreditCardName,
  runGoogleSheetMigrationPreflight
} from "./google-sheet-migration-preflight.mjs";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function budgetCode(value) {
  const match = text(value).match(/^(\d+)\./);
  return match ? Number(match[1]) : null;
}

function budgetLabel(value) {
  return text(value).replace(/^\d+\.\s*/, "").toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function getBudgetReferences(workbookRows) {
  const references = [];
  const columns = [
    ["ExpenseRecords", "budget_item"],
    ["ExpenseRecords", "suggested_budget_item"],
    ["ImportedInvoiceDrafts", "suggested_budget_item"],
    ["MerchantPaymentRules", "default_budget_item"],
    ["MerchantItemRules", "budget_item"],
    ["ClassificationHistory", "budget_item"]
  ];

  for (const [sheetName, columnName] of columns) {
    for (const row of workbookRows[sheetName] ?? []) {
      const value = text(row[columnName]);
      if (value) {
        references.push(value);
      }
    }
  }

  return uniqueSorted(references);
}

function getBudgetReferenceCounts(workbookRows) {
  const counts = new Map();
  const columns = [
    ["ExpenseRecords", "budget_item"],
    ["ExpenseRecords", "suggested_budget_item"],
    ["ImportedInvoiceDrafts", "suggested_budget_item"],
    ["MerchantPaymentRules", "default_budget_item"],
    ["MerchantItemRules", "budget_item"],
    ["ClassificationHistory", "budget_item"]
  ];

  for (const [sheetName, columnName] of columns) {
    for (const row of workbookRows[sheetName] ?? []) {
      const value = text(row[columnName]);
      if (value) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
  }

  return counts;
}

function buildBudgetCatalog(budgetRows = []) {
  return budgetRows
    .map((row) => ({
      category: text(row.category),
      budgetItem: text(row.budget_item),
      code: budgetCode(row.budget_item)
    }))
    .filter((item) => item.budgetItem);
}

function findSuggestedBudgetTarget(legacyBudgetItem, budgetCatalog) {
  const code = budgetCode(legacyBudgetItem);
  const legacyLabel = budgetLabel(legacyBudgetItem);

  const labelMatch = budgetCatalog.find((item) => budgetLabel(item.budgetItem) === legacyLabel);
  if (labelMatch) {
    return {
      suggested_group_name: labelMatch.category || "Unmapped",
      suggested_item_name: labelMatch.budgetItem,
      confidence: 90,
      notes: "Suggested by matching legacy budget label."
    };
  }

  const tokenMatch = budgetCatalog.find((item) => {
    const itemLabel = budgetLabel(item.budgetItem);
    return legacyLabel.includes(itemLabel) || itemLabel.includes(legacyLabel);
  });

  if (tokenMatch) {
    return {
      suggested_group_name: tokenMatch.category || "Unmapped",
      suggested_item_name: tokenMatch.budgetItem,
      confidence: 70,
      notes: "Suggested by close legacy budget label match."
    };
  }

  if (code !== null) {
    const sameCode = budgetCatalog.find((item) => item.code === code);
    if (sameCode) {
      return {
        suggested_group_name: sameCode.category || "Unmapped",
        suggested_item_name: sameCode.budgetItem,
        confidence: 30,
        notes: "Suggested by legacy budget code only; manual review required because labels differ."
      };
    }
  }

  return {
    suggested_group_name: "Unmapped",
    suggested_item_name: legacyBudgetItem,
    confidence: 0,
    notes: "No safe automatic target found; manual review required."
  };
}

export function generateBudgetMappingDrafts(workbookRows) {
  const budgetCatalog = buildBudgetCatalog(workbookRows.BudgetItems ?? []);
  const validBudgetItems = new Set(budgetCatalog.map((item) => item.budgetItem));

  return getBudgetReferences(workbookRows)
    .filter((legacyBudgetItem) => !validBudgetItems.has(legacyBudgetItem))
    .map((legacyBudgetItem) => {
      const suggestion = findSuggestedBudgetTarget(legacyBudgetItem, budgetCatalog);

      return {
        legacy_budget_item: legacyBudgetItem,
        suggested_group_name: suggestion.suggested_group_name,
        suggested_item_name: suggestion.suggested_item_name,
        confidence: suggestion.confidence,
        review_status: "needs_review",
        source_system: "google_sheets",
        source_table: "migration_preflight",
        notes: suggestion.notes
      };
    });
}

export function generateBudgetMappingReviewRows(workbookRows) {
  const counts = getBudgetReferenceCounts(workbookRows);

  return generateBudgetMappingDrafts(workbookRows).map((draft) => ({
    legacy_budget_item: draft.legacy_budget_item,
    occurrence_count: counts.get(draft.legacy_budget_item) ?? 0,
    suggested_group_name: draft.suggested_group_name,
    suggested_item_name: draft.suggested_item_name,
    confidence: draft.confidence,
    confirmed_budget_item: "",
    review_status: draft.review_status,
    notes: draft.notes
  }));
}

export function applyConfirmedBudgetMappings(workbookRows, confirmedMappings) {
  const mapping = new Map(
    confirmedMappings
      .filter((row) => text(row.legacy_budget_item) && text(row.confirmed_budget_item))
      .map((row) => [text(row.legacy_budget_item), text(row.confirmed_budget_item)])
  );
  const columns = [
    ["ExpenseRecords", "budget_item"],
    ["ExpenseRecords", "suggested_budget_item"],
    ["ImportedInvoiceDrafts", "suggested_budget_item"],
    ["MerchantPaymentRules", "default_budget_item"],
    ["MerchantItemRules", "budget_item"],
    ["ClassificationHistory", "budget_item"]
  ];
  const clonedRows = Object.fromEntries(
    Object.entries(workbookRows).map(([sheetName, rows]) => [
      sheetName,
      rows.map((row) => ({ ...row }))
    ])
  );

  for (const [sheetName, columnName] of columns) {
    for (const row of clonedRows[sheetName] ?? []) {
      const value = text(row[columnName]);
      if (mapping.has(value)) {
        row[columnName] = mapping.get(value);
      }
    }
  }

  return clonedRows;
}

function getCreditCardReferences(workbookRows) {
  const references = [];
  const columns = [
    ["ExpenseRecords", "credit_card_name"],
    ["PaymentSchedule", "credit_card_name"],
    ["ImportedInvoiceDrafts", "suggested_credit_card_name"],
    ["MerchantPaymentRules", "credit_card_name"],
    ["PaymentChoiceHistory", "credit_card_name"]
  ];

  for (const [sheetName, columnName] of columns) {
    for (const row of workbookRows[sheetName] ?? []) {
      const value = text(row[columnName]);
      if (value) {
        references.push(value);
      }
    }
  }

  return uniqueSorted(references);
}

export function generateCreditCardMappingDrafts(workbookRows) {
  const aliasMap = buildCreditCardAliasMap(workbookRows.CreditCardRules ?? []);

  return getCreditCardReferences(workbookRows)
    .map((legacyName) => ({
      legacy_credit_card_name: legacyName,
      target_credit_card_name: normalizeLegacyCreditCardName(legacyName, aliasMap),
      confidence: aliasMap.has(legacyName) ? 100 : 0,
      review_status: aliasMap.has(legacyName) ? "confirmed_by_alias" : "needs_review",
      source_system: "google_sheets"
    }))
    .filter((draft) => draft.legacy_credit_card_name !== draft.target_credit_card_name || draft.confidence === 0);
}

function issueSeverity(issueType) {
  if (
    [
      "invalid_budget_item",
      "invalid_payment_month",
      "legacy_epoch_payment_month",
      "orphan_payment_schedule",
      "unmapped_credit_card"
    ].includes(issueType)
  ) {
    return "error";
  }

  return "warning";
}

function issueMessage(issue) {
  const source = `${issue.sheet} row ${issue.rowNumber}`;

  if (issue.type === "invalid_budget_item") {
    return `${source}: budget item "${issue.value}" is not present in BudgetItems.`;
  }

  if (issue.type === "invalid_payment_month") {
    return `${source}: cash_flow_month "${issue.value}" is invalid.`;
  }

  if (issue.type === "legacy_epoch_payment_month") {
    return `${source}: payment date or cash flow month resolved to 1970-01.`;
  }

  if (issue.type === "orphan_payment_schedule") {
    return `${source}: payment schedule references missing expense_id "${issue.expenseId}".`;
  }

  if (issue.type === "negative_payment_amount") {
    return `${source}: payment amount ${issue.amount} is negative.`;
  }

  if (issue.type === "unmapped_credit_card") {
    return `${source}: credit card "${issue.value}" has no mapping target.`;
  }

  return `${source}: ${issue.type}`;
}

function issueRecommendedAction(issueType) {
  if (issueType === "orphan_payment_schedule") {
    return "delete_before_import";
  }

  if (issueType === "negative_payment_amount") {
    return "preserve_as_payment_adjustment";
  }

  if (issueType === "invalid_payment_month" || issueType === "legacy_epoch_payment_month") {
    return "review_payment_month_before_import";
  }

  if (issueType === "invalid_budget_item") {
    return "resolve_budget_mapping_before_import";
  }

  if (issueType === "unmapped_credit_card") {
    return "resolve_credit_card_mapping_before_import";
  }

  return "review_before_import";
}

export function generateMigrationIssueDrafts(preflightReport) {
  return preflightReport.issues.map((issue) => ({
    severity: issueSeverity(issue.type),
    issue_type: issue.type,
    source_system: "google_sheets",
    source_table: issue.sheet,
    source_row_id: String(issue.rowNumber),
    legacy_id: issue.paymentId ?? issue.expenseId ?? null,
    message: issueMessage(issue),
    payload: {
      ...issue,
      recommended_action: issueRecommendedAction(issue.type)
    }
  }));
}

export function generateMigrationReviewDrafts(workbookRows) {
  const preflight = runGoogleSheetMigrationPreflight(workbookRows);
  const budgetMappingDrafts = generateBudgetMappingDrafts(workbookRows);
  const creditCardMappingDrafts = generateCreditCardMappingDrafts(workbookRows);
  const migrationIssueDrafts = generateMigrationIssueDrafts(preflight);

  return {
    summary: {
      sheetRowCounts: preflight.sheetRowCounts,
      issueCounts: preflight.issueCounts,
      budgetMappingDraftCount: budgetMappingDrafts.length,
      creditCardMappingDraftCount: creditCardMappingDrafts.length,
      migrationIssueDraftCount: migrationIssueDrafts.length,
      canImportDirectly: migrationIssueDrafts.filter((issue) => issue.severity === "error").length === 0
    },
    budgetMappingDrafts,
    creditCardMappingDrafts,
    migrationIssueDrafts
  };
}
