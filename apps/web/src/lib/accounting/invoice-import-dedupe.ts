export type InvoiceImportIdentityInput = {
  sourceRecordId: string;
  consumptionDate: string;
  sourceLineKey: string;
};

export type ExistingInvoiceImportKeys = {
  sourceLineKeys: Set<string>;
  invoiceDateKeys: Set<string>;
};

export function buildInvoiceDateKey(sourceRecordId: string | null | undefined, consumptionDate: string | null | undefined) {
  const invoiceNumber = String(sourceRecordId ?? "").split("|")[0]?.trim();
  const date = String(consumptionDate ?? "").trim();

  if (!invoiceNumber || !date) {
    return null;
  }

  return `${invoiceNumber}|${date}`;
}

export function shouldSkipInvoiceImportRow(row: InvoiceImportIdentityInput, existing: ExistingInvoiceImportKeys) {
  if (existing.sourceLineKeys.has(row.sourceLineKey)) {
    return true;
  }

  const invoiceDateKey = buildInvoiceDateKey(row.sourceRecordId, row.consumptionDate);
  return invoiceDateKey ? existing.invoiceDateKeys.has(invoiceDateKey) : false;
}
