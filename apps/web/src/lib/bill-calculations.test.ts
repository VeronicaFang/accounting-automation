import assert from "node:assert/strict";
import { getDisplayedBillAmount, getStatementVariance } from "./bill-calculations.ts";

assert.equal(getDisplayedBillAmount({ estimatedAmount: 11993, statementAmount: 30680 }), 30680);
assert.equal(getDisplayedBillAmount({ estimatedAmount: 11993 }), 11993);

assert.equal(getStatementVariance({ estimatedAmount: 11993, statementAmount: 30680 }), 18687);
assert.equal(getStatementVariance({ estimatedAmount: 11993 }), null);

console.log("bill calculations: 4 assertions passed");
