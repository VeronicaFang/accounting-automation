import assert from "node:assert/strict";

import {
  buildPaymentPlans,
  normalizeDateInput,
  parseManualExpenseText,
  splitInstallments,
  type EntryCreditCard
} from "./entry-utils.ts";

const unionCard: EntryCreditCard = {
  id: "card-union",
  name: "Union",
  legacy_id: "Union",
  cutoff_day: 5,
  payment_day: 17
};

assert.equal(normalizeDateInput("2026/01"), "2026-01-01");

assert.deepEqual(
  parseManualExpenseText(
    "2026/01\tRice cooker\t1951\tTaobao\t26. Luxury\tcredit_card\tCTBC\t\n" +
      "2026/01\tWinter pants\t250\tTaobao\t13. Clothes\tcredit_card\tCTBC\t"
  ),
  [
    {
      consumptionDate: "2026-01-01",
      itemDescription: "Rice cooker",
      amount: 1951,
      merchantName: "Taobao",
      budgetItemName: "26. Luxury",
      paymentToolType: "credit_card",
      creditCardName: "CTBC",
      notes: ""
    },
    {
      consumptionDate: "2026-01-01",
      itemDescription: "Winter pants",
      amount: 250,
      merchantName: "Taobao",
      budgetItemName: "13. Clothes",
      paymentToolType: "credit_card",
      creditCardName: "CTBC",
      notes: ""
    }
  ]
);

assert.deepEqual(
  buildPaymentPlans({
    amount: 1000,
    consumptionDate: "2026-05-31",
    paymentToolType: "credit_card",
    installmentCount: 1,
    creditCard: unionCard
  }),
  [
    {
      sequence: 1,
      paymentDate: "2026-06-17",
      cashFlowMonth: "2026-06",
      amount: 1000
    }
  ]
);

assert.deepEqual(splitInstallments(100, 3), [
  { sequence: 1, amount: 33.34 },
  { sequence: 2, amount: 33.33 },
  { sequence: 3, amount: 33.33 }
]);

console.log("entry utils: 4 assertions passed");
