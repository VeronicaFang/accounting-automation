import assert from "node:assert/strict";

import { allocateInvoiceDiscounts, buildExpenseDisplayRows, groupInvoiceLines } from "./invoice-grouping.ts";

const lines = [
  { id: "1", invoiceNumber: "AW99003017", sourceOrder: 1, itemDescription: "Corn", originalAmount: 55 },
  { id: "2", invoiceNumber: "AW99003017", sourceOrder: 2, itemDescription: "Milk", originalAmount: 27 },
  { id: "3", invoiceNumber: "AW99003017", sourceOrder: 3, itemDescription: "Coupon", originalAmount: -1 }
];

const allocated = allocateInvoiceDiscounts(lines);
assert.deepEqual(allocated.map((line) => line.allocatedAmount), [54, 27, 0]);
assert.equal(allocated.find((line) => line.id === "3")?.lineType, "discount");
assert.equal(allocated.reduce((sum, line) => sum + line.originalAmount, 0), 81);
assert.equal(allocated.reduce((sum, line) => sum + line.allocatedAmount, 0), 81);

const tied = allocateInvoiceDiscounts([
  { id: "a", invoiceNumber: "X1", sourceOrder: 1, itemDescription: "A", originalAmount: 50 },
  { id: "b", invoiceNumber: "X1", sourceOrder: 2, itemDescription: "B", originalAmount: 50 },
  { id: "c", invoiceNumber: "X1", sourceOrder: 3, itemDescription: "Coupon", originalAmount: -10 }
]);
assert.deepEqual(tied.map((line) => line.allocatedAmount), [40, 50, 0]);

const groups = groupInvoiceLines(lines);
assert.equal(groups[0].invoiceNumber, "AW99003017");
assert.equal(groups[0].itemCount, 2);
assert.equal(groups[0].discountTotal, -1);
assert.equal(groups[0].paidTotal, 81);

assert.throws(
  () => allocateInvoiceDiscounts([
    { id: "d", invoiceNumber: "X2", sourceOrder: 1, itemDescription: "Coupon", originalAmount: -10 }
  ]),
  /positive item/
);

assert.throws(
  () => allocateInvoiceDiscounts([
    { id: "e", invoiceNumber: "X3", sourceOrder: 1, itemDescription: "Item", originalAmount: 5 },
    { id: "f", invoiceNumber: "X3", sourceOrder: 2, itemDescription: "Coupon", originalAmount: -10 }
  ]),
  /exceeds/
);


const displayRows = buildExpenseDisplayRows([
  {
    id: "expense-1", consumptionDate: "2026-06-05", budgetMonth: "2026-06", merchantName: "Store",
    itemDescription: "Corn", budgetItemId: "b1", budgetItemName: "Food", amount: 54,
    originalAmount: 55, paymentToolType: "credit_card", creditCardId: "card-1", creditCardName: "Cathay",
    installmentCount: 6, status: "active", invoiceNumber: "AW99003017", lineType: "item"
  },
  {
    id: "expense-2", consumptionDate: "2026-06-05", budgetMonth: "2026-06", merchantName: "Store",
    itemDescription: "Coupon", budgetItemId: "b1", budgetItemName: "Food", amount: 0,
    originalAmount: -1, paymentToolType: "credit_card", creditCardId: "card-1", creditCardName: "Cathay",
    installmentCount: 6, status: "active", invoiceNumber: "AW99003017", lineType: "discount"
  },
  {
    id: "manual-1", consumptionDate: "2026-06-06", budgetMonth: "2026-06", merchantName: "Cafe",
    itemDescription: "Coffee", budgetItemId: "b1", budgetItemName: "Food", amount: 100,
    paymentToolType: "cash", status: "active"
  }
]);
assert.equal(displayRows.length, 2);
assert.equal(displayRows[0].kind, "invoice");
if (displayRows[0].kind === "invoice") {
  assert.equal(displayRows[0].paidTotal, 54);
  assert.equal(displayRows[0].discountTotal, -1);
  assert.equal(displayRows[0].paymentToolType, "credit_card");
  assert.equal(displayRows[0].creditCardId, "card-1");
  assert.equal(displayRows[0].creditCardName, "Cathay");
  assert.equal(displayRows[0].installmentCount, 6);
}
assert.equal(displayRows[1].kind, "manual");

const mixedPaymentRows = buildExpenseDisplayRows([
  {
    id: "mixed-1", consumptionDate: "2026-06-05", budgetMonth: "2026-06", merchantName: "Store",
    itemDescription: "Corn", budgetItemId: "b1", budgetItemName: "Food", amount: 54,
    paymentToolType: "cash", status: "active", invoiceNumber: "MIXED-1"
  },
  {
    id: "mixed-2", consumptionDate: "2026-06-05", budgetMonth: "2026-06", merchantName: "Store",
    itemDescription: "Milk", budgetItemId: "b1", budgetItemName: "Food", amount: 27,
    paymentToolType: "credit_card", creditCardId: "card-1", installmentCount: 1,
    status: "active", invoiceNumber: "MIXED-1"
  }
]);
assert.equal(mixedPaymentRows.length, 2);
assert.equal(mixedPaymentRows[0].kind, "manual");
assert.equal(mixedPaymentRows[1].kind, "manual");
console.log("invoice grouping: 22 assertions passed");
