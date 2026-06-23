export type InvoiceImportIdentityInput = {
  sourceRecordId: string;
  consumptionDate: string;
  sourceLineKey: string;
};

export type ExistingInvoiceImportKeys = {
  sourceLineKeys: Set<string>;
  invoiceDateKeys: Set<string>;
};

export type ExistingInvoiceDraftIdentityInput = {
  sourceLineKey: string | null | undefined;
  consumptionDate: string | null | undefined;
  reviewStatus: string | null | undefined;
};

export type ExistingInvoiceExpenseIdentityInput = {
  sourceRecordId: string | null | undefined;
  consumptionDate: string | null | undefined;
  status?: string | null | undefined;
};

export function buildInvoiceDateKey(sourceRecordId: string | null | undefined, consumptionDate: string | null | undefined) {
  const invoiceNumber = String(sourceRecordId ?? "").split("|")[0]?.trim();
  const date = String(consumptionDate ?? "").trim();

  if (!invoiceNumber || !date) {
    return null;
  }

  return `${invoiceNumber}|${date}`;
}

export function buildExistingInvoiceImportKeys(
  draftRows: ExistingInvoiceDraftIdentityInput[],
  expenseRows: ExistingInvoiceExpenseIdentityInput[]
): ExistingInvoiceImportKeys {
  const sourceLineKeys = new Set<string>();
  const invoiceDateKeys = new Set<string>();

  for (const row of draftRows) {
    if (row.reviewStatus === "deleted") {
      continue;
    }

    if (row.sourceLineKey) {
      sourceLineKeys.add(row.sourceLineKey);
    }

    const key = buildInvoiceDateKey(row.sourceLineKey, row.consumptionDate);
    if (key) {
      invoiceDateKeys.add(key);
    }
  }

  for (const row of expenseRows) {
    if (row.status && row.status !== "active") {
      continue;
    }

    const key = buildInvoiceDateKey(row.sourceRecordId, row.consumptionDate);
    if (key) {
      invoiceDateKeys.add(key);
    }
  }

  return { sourceLineKeys, invoiceDateKeys };
}

export function shouldSkipInvoiceImportRow(row: InvoiceImportIdentityInput, existing: ExistingInvoiceImportKeys) {
  if (existing.sourceLineKeys.has(row.sourceLineKey)) {
    return true;
  }

  const invoiceDateKey = buildInvoiceDateKey(row.sourceRecordId, row.consumptionDate);
  return invoiceDateKey ? existing.invoiceDateKeys.has(invoiceDateKey) : false;
}
