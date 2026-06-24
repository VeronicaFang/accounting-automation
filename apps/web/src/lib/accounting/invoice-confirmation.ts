export type InvoiceGroupConfirmationLine = {
  draftId: string;
  budgetItemId: string;
  notes?: string;
};

export type InvoiceGroupConfirmation = {
  invoiceNumber: string;
  paymentToolType?: "cash" | "credit_card";
  creditCardId?: string;
  installmentCount?: number;
  lines: InvoiceGroupConfirmationLine[];
};

export function validateInvoiceGroupConfirmation(input: InvoiceGroupConfirmation): Required<Omit<InvoiceGroupConfirmation, "creditCardId">> & { creditCardId: string | null } {
  const invoiceNumber = String(input.invoiceNumber ?? "").trim();
  const paymentToolType = input.paymentToolType === "credit_card" ? "credit_card" : "cash";
  const creditCardId = String(input.creditCardId ?? "").trim();
  const installmentCount = Math.max(1, Math.trunc(Number(input.installmentCount || 1)));
  const lines = Array.isArray(input.lines)
    ? input.lines.map((line) => ({
        draftId: String(line.draftId ?? "").trim(),
        budgetItemId: String(line.budgetItemId ?? "").trim(),
        notes: String(line.notes ?? "")
      }))
    : [];

  if (!invoiceNumber) throw new Error("Invoice number is required.");
  if (paymentToolType === "credit_card" && !creditCardId) throw new Error("Credit card is required.");
  if (lines.length === 0) throw new Error("At least one positive item is required.");
  if (lines.some((line) => !line.draftId || !line.budgetItemId)) throw new Error("Every positive item requires a budget item.");

  return { invoiceNumber, paymentToolType, creditCardId: paymentToolType === "credit_card" ? creditCardId : null, installmentCount, lines };
}