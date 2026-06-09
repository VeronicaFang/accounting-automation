import assert from "node:assert/strict";

import {
  buildInvoiceDraftConfirmationInputs,
  mapInvoiceDraftReviewItems,
  type InvoiceDraftConfirmation
} from "./invoice-review.ts";

const rows = [
  {
    id: "draft-1",
    source_line_key: "AA123|2026-06-01|coffee|120|1",
    consumption_date: "2026-06-01",
    merchant_tax_id: "12345678",
    merchant_name: "Corner Cafe",
    item_description: "Coffee beans",
    amount: "120",
    suggested_payment_tool_type: "credit_card" as const,
    suggested_credit_card_id: "card-1",
    suggested_budget_item_id: "budget-1",
    legacy_suggested_budget_item: "24. Food",
    review_status: "needs_review",
    notes: null
  }
];

const budgetItems = [
  {
    id: "budget-1",
    name: "Food",
    legacy_id: "24",
    legacy_name: "24. Food"
  }
];

const creditCards = [
  {
    id: "card-1",
    name: "Main Card",
    legacy_id: "VISA"
  }
];

assert.deepEqual(mapInvoiceDraftReviewItems(rows, budgetItems, creditCards), [
  {
    id: "draft-1",
    sourceLineKey: "AA123|2026-06-01|coffee|120|1",
    consumptionDate: "2026-06-01",
    merchantTaxId: "12345678",
    merchantName: "Corner Cafe",
    itemDescription: "Coffee beans",
    amount: 120,
    suggestedPaymentToolType: "credit_card",
    suggestedCreditCardId: "card-1",
    suggestedCreditCardName: "VISA",
    suggestedBudgetItemId: "budget-1",
    suggestedBudgetItemName: "24. Food",
    reviewStatus: "needs_review",
    notes: null
  }
]);

const confirmations: InvoiceDraftConfirmation[] = [
  {
    draftId: "draft-1",
    budgetItemId: "budget-1",
    paymentToolType: "credit_card",
    creditCardId: "card-1",
    notes: "confirmed in review"
  }
];

assert.deepEqual(buildInvoiceDraftConfirmationInputs(mapInvoiceDraftReviewItems(rows, budgetItems, creditCards), confirmations), [
  {
    draftId: "draft-1",
    consumptionDate: "2026-06-01",
    merchantTaxId: "12345678",
    merchantName: "Corner Cafe",
    itemDescription: "Coffee beans",
    amount: 120,
    budgetItemId: "budget-1",
    paymentToolType: "credit_card",
    creditCardId: "card-1",
    notes: "confirmed in review",
    sourceLineKey: "AA123|2026-06-01|coffee|120|1"
  }
]);

assert.throws(
  () =>
    buildInvoiceDraftConfirmationInputs(mapInvoiceDraftReviewItems(rows, budgetItems, creditCards), [
      {
        draftId: "draft-1",
        budgetItemId: "budget-1",
        paymentToolType: "credit_card",
        creditCardId: "",
        notes: ""
      }
    ]),
  /Credit card is required/
);

console.log("invoice review: 3 assertions passed");
