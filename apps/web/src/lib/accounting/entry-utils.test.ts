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
assert.equal(normalizeDateInput("2026/4/7"), "2026-04-07");

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
const taobaoRows = parseManualExpenseText(
  "消費日\t購買品項\t消費金額\t消費通路\t預算項目\t支付方式\t信用卡\t備註\n" +
    "2026/4/7\t飛利浦檯燈+迷宮書\t1407\t淘寶\t15. 動動個人成長\t信用卡\tCTBC\t\n" +
    "2026/4/10\t動動生日派對氣球布置用品\t1617\t淘寶\t14. 動動生日派對\t信用卡\tCTBC\t\n" +
    "2026/4/17\t空氣清淨機濾芯\t573\t淘寶\t10. 日常用品\t信用卡\tCTBC\t"
);

assert.equal(taobaoRows.length, 3);
assert.deepEqual(
  taobaoRows.map((row) => row.consumptionDate),
  ["2026-04-07", "2026-04-10", "2026-04-17"]
);
assert.equal(taobaoRows[0].paymentToolType, "credit_card");
assert.equal(taobaoRows[0].creditCardName, "CTBC");
assert.equal(taobaoRows[0].merchantName, "淘寶");

const pinduoduoRows = parseManualExpenseText(
  "消費日\t購買品項\t消費金額\t消費通路\t預算項目\t支付方式\t信用卡\t備註\n" +
    "2026/8/3\t小卡收納冊\tNT$13\t拼多多\t12. 動動用品與衣物\t信用卡\tUnion\t\n" +
    "2026/7/25\t泰摩小旋風 01S\tNT$2,111\t拼多多\t16. 家人過節\t信用卡\tUnion\t"
);

assert.deepEqual(
  pinduoduoRows.map((row) => row.amount),
  [13, 2111]
);
assert.equal(pinduoduoRows[0].creditCardName, "Union");

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

console.log("entry utils: 14 assertions passed");
