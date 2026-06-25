import assert from "node:assert/strict";

import { validateInvoicePaymentUpdate } from "./invoice-payment.ts";

assert.throws(
  () => validateInvoicePaymentUpdate({ invoiceNumber: "", paymentToolType: "cash", installmentCount: 1 }),
  /Invoice number/
);
assert.throws(
  () =>
    validateInvoicePaymentUpdate({
      invoiceNumber: "AA1",
      paymentToolType: "credit_card",
      creditCardId: "",
      installmentCount: 3
    }),
  /Credit card/
);
assert.throws(
  () =>
    validateInvoicePaymentUpdate({
      invoiceNumber: "AA1",
      paymentToolType: "credit_card",
      creditCardId: "card-1",
      installmentCount: 5
    }),
  /Installment/
);
assert.deepEqual(
  validateInvoicePaymentUpdate({
    invoiceNumber: " AA1 ",
    paymentToolType: "cash",
    creditCardId: "ignored",
    installmentCount: 12
  }),
  { invoiceNumber: "AA1", paymentToolType: "cash", creditCardId: null, installmentCount: 1 }
);
assert.deepEqual(
  validateInvoicePaymentUpdate({
    invoiceNumber: "AA1",
    paymentToolType: "credit_card",
    creditCardId: " card-1 ",
    installmentCount: 12
  }),
  { invoiceNumber: "AA1", paymentToolType: "credit_card", creditCardId: "card-1", installmentCount: 12 }
);

console.log("invoice payment validation: 5 assertions passed");
