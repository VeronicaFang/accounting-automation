export type InvoiceImportIdentityInput = { sourceRecordId: string; consumptionDate: string; sourceLineKey: string };
export type ExistingInvoiceImportKeys = { sourceLineKeys: Set<string>; invoiceDateKeys: Set<string> };
export type ExistingInvoiceDraftIdentityInput = { sourceLineKey: string | null | undefined; consumptionDate: string | null | undefined; reviewStatus: string | null | undefined };
export type ExistingInvoiceExpenseIdentityInput = { sourceLineKey: string | null | undefined; status?: string | null | undefined };

export function buildInvoiceDateKey(sourceRecordId: string | null | undefined, consumptionDate: string | null | undefined) {
  const invoiceNumber = String(sourceRecordId ?? "").split("|")[0]?.trim();
  const date = String(consumptionDate ?? "").trim();
  return invoiceNumber && date ? `${invoiceNumber}|${date}` : null;
}

export function buildExistingInvoiceImportKeys(draftRows: ExistingInvoiceDraftIdentityInput[], expenseRows: ExistingInvoiceExpenseIdentityInput[]): ExistingInvoiceImportKeys {
  const sourceLineKeys = new Set<string>();
  for (const row of draftRows) if (row.reviewStatus !== "deleted" && row.sourceLineKey) sourceLineKeys.add(row.sourceLineKey);
  for (const row of expenseRows) if ((!row.status || row.status === "active") && row.sourceLineKey) sourceLineKeys.add(row.sourceLineKey);
  return { sourceLineKeys, invoiceDateKeys: new Set<string>() };
}

export function shouldSkipInvoiceImportRow(row: InvoiceImportIdentityInput, existing: ExistingInvoiceImportKeys) {
  return existing.sourceLineKeys.has(row.sourceLineKey);
}