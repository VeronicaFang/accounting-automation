import assert from "node:assert/strict";

import {
  buildInvoiceDraftConfirmationInputs,
  buildInvoiceDraftGroups,
  mapInvoiceDraftReviewItems,
  type InvoiceDraftConfirmation
} from "./invoice-review.ts";

const rows = [
  {
    id: "draft-1",
    invoice_number: "AA123",
    source_order: 1,
    line_type: "item" as const,
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
  },
  {
    id: "card-2",
    name: "Rule Card",
    legacy_id: "RULE"
  }
];

assert.deepEqual(mapInvoiceDraftReviewItems(rows, budgetItems, creditCards), [
  {
    id: "draft-1",
    invoiceNumber: "AA123",
    sourceOrder: 1,
    lineType: "item",
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

assert.deepEqual(
  mapInvoiceDraftReviewItems(
    [
      {
        ...rows[0],
        suggested_payment_tool_type: "cash",
        suggested_credit_card_id: null,
        suggested_budget_item_id: "budget-1"
      }
    ],
    [
      ...budgetItems,
      {
        id: "budget-2",
        name: "Online Shopping",
        legacy_id: "26",
        legacy_name: "26. Online Shopping"
      }
    ],
    creditCards,
    {
      paymentRules: [
        {
          merchant_tax_id: "12345678",
          merchant_name_contains: null,
          payment_tool_type: "credit_card",
          credit_card_id: "card-2",
          default_budget_item_id: "budget-2",
          is_active: true
        }
      ],
      itemRules: []
    }
  )[0],
  {
    id: "draft-1",
    invoiceNumber: "AA123",
    sourceOrder: 1,
    lineType: "item",
    sourceLineKey: "AA123|2026-06-01|coffee|120|1",
    consumptionDate: "2026-06-01",
    merchantTaxId: "12345678",
    merchantName: "Corner Cafe",
    itemDescription: "Coffee beans",
    amount: 120,
    suggestedPaymentToolType: "credit_card",
    suggestedCreditCardId: "card-2",
    suggestedCreditCardName: "RULE",
    suggestedBudgetItemId: "budget-2",
    suggestedBudgetItemName: "26. Online Shopping",
    reviewStatus: "needs_review",
    notes: null
  }
);

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
    invoiceNumber: "AA123",
    sourceOrder: 1,
    lineType: "item",
    sourceLineKey: "AA123|2026-06-01|coffee|120|1",
    installmentCount: 1
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


const groupedReviewItems = mapInvoiceDraftReviewItems(
  [
    rows[0],
    {
      ...rows[0],
      id: "draft-2",
      source_order: 2,
      source_line_key: "AA123|2026-06-01|milk|27|1",
      item_description: "Milk",
      amount: "27"
    },
    {
      ...rows[0],
      id: "draft-3",
      source_order: 3,
      line_type: "discount",
      source_line_key: "AA123|2026-06-01|coupon|-1|1",
      item_description: "Coupon",
      amount: "-1"
    }
  ],
  budgetItems,
  creditCards
);
const invoiceGroups = buildInvoiceDraftGroups(groupedReviewItems);
assert.equal(invoiceGroups.length, 1);
assert.equal(invoiceGroups[0].invoiceNumber, "AA123");
assert.equal(invoiceGroups[0].paidTotal, 146);
assert.equal(invoiceGroups[0].itemLines.length, 2);
assert.equal(invoiceGroups[0].discountLines.length, 1);
console.log("invoice review: 9 assertions passed");
