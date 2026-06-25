export const supportedInstallmentCounts = [1, 3, 6, 12, 18, 24, 30, 36] as const;

export type InvoicePaymentUpdate = {
  invoiceNumber: string;
  paymentToolType: "cash" | "credit_card";
  creditCardId?: string | null;
  installmentCount?: number;
};

export function validateInvoicePaymentUpdate(input: InvoicePaymentUpdate) {
  const invoiceNumber = String(input.invoiceNumber ?? "").trim();
  const paymentToolType = input.paymentToolType === "credit_card" ? "credit_card" : "cash";
  const creditCardId = String(input.creditCardId ?? "").trim();
  const installmentCount = Math.trunc(Number(input.installmentCount ?? 1));

  if (!invoiceNumber) {
    throw new Error("Invoice number is required.");
  }

  if (paymentToolType === "credit_card" && !creditCardId) {
    throw new Error("Credit card is required.");
  }

  if (paymentToolType === "credit_card" && !supportedInstallmentCounts.includes(installmentCount as never)) {
    throw new Error("Installment count is not supported.");
  }

  return {
    invoiceNumber,
    paymentToolType,
    creditCardId: paymentToolType === "credit_card" ? creditCardId : null,
    installmentCount: paymentToolType === "credit_card" ? installmentCount : 1
  };
}
