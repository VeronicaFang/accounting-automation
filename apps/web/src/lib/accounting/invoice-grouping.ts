export type InvoiceLineInput = {
  id: string;
  invoiceNumber: string;
  sourceOrder: number;
  itemDescription: string;
  originalAmount: number;
};

export type AllocatedInvoiceLine = InvoiceLineInput & {
  lineType: "item" | "discount";
  allocatedAmount: number;
  discountApplied: number;
};

export type InvoiceGroup<T extends InvoiceLineInput = InvoiceLineInput> = {
  invoiceNumber: string;
  lines: T[];
  itemCount: number;
  discountTotal: number;
  paidTotal: number;
};

export function allocateInvoiceDiscounts(lines: InvoiceLineInput[]): AllocatedInvoiceLine[] {
  const positive = lines.filter((line) => line.originalAmount >= 0);
  const discounts = lines.filter((line) => line.originalAmount < 0);

  if (positive.length === 0) {
    throw new Error("Invoice must contain at least one positive item.");
  }

  const target = [...positive].sort(
    (a, b) => b.originalAmount - a.originalAmount || a.sourceOrder - b.sourceOrder
  )[0];
  const discountTotal = discounts.reduce((sum, line) => sum + line.originalAmount, 0);

  if (target.originalAmount + discountTotal < 0) {
    throw new Error("Invoice discount exceeds the highest positive item.");
  }

  return lines.map((line) => {
    if (line.originalAmount < 0) {
      return { ...line, lineType: "discount", allocatedAmount: 0, discountApplied: 0 };
    }

    const discountApplied = line.id === target.id ? discountTotal : 0;
    return {
      ...line,
      lineType: "item",
      allocatedAmount: line.originalAmount + discountApplied,
      discountApplied
    };
  });
}

export function groupInvoiceLines<T extends InvoiceLineInput>(lines: T[]): InvoiceGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const line of lines) {
    groups.set(line.invoiceNumber, [...(groups.get(line.invoiceNumber) ?? []), line]);
  }

  return [...groups.entries()].map(([invoiceNumber, groupedLines]) => ({
    invoiceNumber,
    lines: [...groupedLines].sort((a, b) => a.sourceOrder - b.sourceOrder),
    itemCount: groupedLines.filter((line) => line.originalAmount >= 0).length,
    discountTotal: groupedLines
      .filter((line) => line.originalAmount < 0)
      .reduce((sum, line) => sum + line.originalAmount, 0),
    paidTotal: groupedLines.reduce((sum, line) => sum + line.originalAmount, 0)
  }));
}