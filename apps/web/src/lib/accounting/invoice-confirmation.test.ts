import assert from "node:assert/strict";

import { validateInvoiceGroupConfirmation } from "./invoice-confirmation.ts";

assert.throws(() => validateInvoiceGroupConfirmation({ invoiceNumber: "", lines: [] }), /Invoice number/);
assert.throws(
  () => validateInvoiceGroupConfirmation({
    invoiceNumber: "AW1",
    paymentToolType: "credit_card",
    creditCardId: "",
    installmentCount: 1,
    lines: [{ draftId: "d1", budgetItemId: "b1" }]
  }),
  /Credit card/
);
assert.throws(
  () => validateInvoiceGroupConfirmation({
    invoiceNumber: "AW1",
    paymentToolType: "cash",
    installmentCount: 1,
    lines: []
  }),
  /positive item/
);
const valid = validateInvoiceGroupConfirmation({
  invoiceNumber: " AW1 ",
  paymentToolType: "cash",
  installmentCount: 1,
  lines: [{ draftId: "d1", budgetItemId: "b1", notes: "ok" }]
});
assert.equal(valid.invoiceNumber, "AW1");
assert.equal(valid.lines.length, 1);

console.log("invoice confirmation: 5 assertions passed");