import assert from "node:assert/strict";

import { allocateInvoiceDiscounts, groupInvoiceLines } from "./invoice-grouping.ts";

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

console.log("invoice grouping: 10 assertions passed");