import { normalizeDateInput, parseDelimitedLine } from "./entry-utils.ts";

export type InvoiceDraftInput = {
  invoiceNumber: string;
  sourceOrder: number;
  lineType: "item" | "discount";
  sourceRecordId: string;
  consumptionDate: string;
  merchantTaxId: string;
  merchantName: string;
  itemDescription: string;
  amount: number;
  sourceLineKey: string;
};

function pickInvoiceField(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return String(row[name] || "").trim();
  }
  return "";
}

export function normalizeInvoiceRow(row: Record<string, string>, sourceOrder: number): Omit<InvoiceDraftInput, "sourceLineKey"> {
  const invoiceNumber = pickInvoiceField(row, ["發票號碼", "發票字軌號碼", "invoice_number", "source_record_id"]);
  const amount = Number(pickInvoiceField(row, ["消費明細_金額", "發票明細_金額", "發票明細金額", "金額", "消費金額", "發票金額", "amount"]).replace(/[,$\s]/g, "")) || 0;
  return {
    invoiceNumber,
    sourceOrder,
    lineType: amount < 0 ? "discount" : "item",
    sourceRecordId: invoiceNumber,
    consumptionDate: normalizeDateInput(pickInvoiceField(row, ["消費日", "交易日期", "發票日期", "發票開立日期", "invoice_date", "consumption_date"])),
    merchantTaxId: pickInvoiceField(row, ["統編", "店家統編", "營業人統編", "賣方統編", "賣方統一編號", "merchant_tax_id"]),
    merchantName: pickInvoiceField(row, ["店家", "店家名稱", "營業人名稱", "賣方名稱", "merchant_name"]),
    itemDescription: pickInvoiceField(row, ["消費明細_品名", "發票明細_品名", "品項", "品名", "購買品項", "商品名稱", "item_description"]),
    amount
  };
}

export function parseInvoiceText(text: string): InvoiceDraftInput[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) => header.trim());
  const counts = new Map<string, number>();
  return lines.slice(1).map((line, index) => {
    const cells = parseDelimitedLine(line, delimiter);
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
    const parsed = normalizeInvoiceRow(row, index + 1);
    const baseKey = [parsed.sourceRecordId, parsed.merchantTaxId, parsed.consumptionDate, parsed.itemDescription, parsed.amount].map((value) => String(value ?? "").trim()).join("|");
    const count = (counts.get(baseKey) ?? 0) + 1;
    counts.set(baseKey, count);
    return { ...parsed, sourceLineKey: `${baseKey}|${count}` };
  }).filter((row) => row.consumptionDate || row.itemDescription || row.amount !== 0);
}