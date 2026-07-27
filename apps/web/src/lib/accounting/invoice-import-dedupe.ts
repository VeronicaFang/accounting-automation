export type InvoiceImportIdentityInput = { sourceRecordId: string; consumptionDate: string; sourceLineKey: string };
export type ExistingInvoiceImportKeys = { sourceLineKeys: Set<string>; invoiceDateKeys: Set<string> };
export type ExistingInvoiceDraftIdentityInput = {
  invoiceNumber?: string | null | undefined;
  sourceLineKey: string | null | undefined;
  consumptionDate: string | null | undefined;
  reviewStatus: string | null | undefined;
};
export type ExistingInvoiceExpenseIdentityInput = {
  invoiceNumber?: string | null | undefined;
  sourceLineKey: string | null | undefined;
  consumptionDate?: string | null | undefined;
  status?: string | null | undefined;
};

export function buildInvoiceDateKey(sourceRecordId: string | null | undefined, consumptionDate: string | null | undefined) {
  const invoiceNumber = String(sourceRecordId ?? "").split("|")[0]?.trim();
  const date = String(consumptionDate ?? "").trim();
  return invoiceNumber && date ? invoiceNumber + "|" + date : null;
}

export function buildExistingInvoiceImportKeys(draftRows: ExistingInvoiceDraftIdentityInput[], expenseRows: ExistingInvoiceExpenseIdentityInput[]): ExistingInvoiceImportKeys {
  const sourceLineKeys = new Set<string>();
  const invoiceDateKeys = new Set<string>();

  for (const row of draftRows) {
    if (row.reviewStatus === "deleted") continue;
    if (row.sourceLineKey) sourceLineKeys.add(row.sourceLineKey);
    const invoiceDateKey = buildInvoiceDateKey(row.invoiceNumber ?? row.sourceLineKey, row.consumptionDate);
    if (invoiceDateKey) invoiceDateKeys.add(invoiceDateKey);
  }

  for (const row of expenseRows) {
    if (row.status && row.status !== "active") continue;
    if (row.sourceLineKey) sourceLineKeys.add(row.sourceLineKey);
    const invoiceDateKey = buildInvoiceDateKey(row.invoiceNumber ?? row.sourceLineKey, row.consumptionDate);
    if (invoiceDateKey) invoiceDateKeys.add(invoiceDateKey);
  }

  return { sourceLineKeys, invoiceDateKeys };
}

export function shouldSkipInvoiceImportRow(row: InvoiceImportIdentityInput, existing: ExistingInvoiceImportKeys) {
  const invoiceDateKey = buildInvoiceDateKey(row.sourceRecordId, row.consumptionDate);
  return existing.sourceLineKeys.has(row.sourceLineKey) || Boolean(invoiceDateKey && existing.invoiceDateKeys.has(invoiceDateKey));
}
