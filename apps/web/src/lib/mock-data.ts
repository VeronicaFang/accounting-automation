import type { BillEstimate, BudgetStatus, CashFlowMonth, ReviewTask } from "./types";

export const currentMonth = "2026-05";

export const cashFlowMonths: CashFlowMonth[] = [
  {
    month: "2026-05",
    income: 95000,
    cashExpense: 71070,
    estimatedCardPayment: 11993,
    actualCardPayment: 30680,
    netFlow: -6750,
    openingBalance: 120000,
    endingBalance: 113250
  },
  {
    month: "2026-06",
    income: 80000,
    cashExpense: 47311,
    estimatedCardPayment: 14432,
    netFlow: 18257,
    openingBalance: 113250,
    endingBalance: 131507
  }
];

export const billEstimates: BillEstimate[] = [
  {
    id: "bill-2026-05-lianbang",
    month: "2026-05",
    creditCardName: "聯邦",
    estimatedAmount: 11993,
    statementAmount: 30680,
    paymentDate: "2026-05-23",
    cutoffLabel: "5 月帳單",
    status: "needs_review",
    scheduleCount: 18
  },
  {
    id: "bill-2026-06-yushan",
    month: "2026-06",
    creditCardName: "玉山",
    estimatedAmount: 14432,
    paymentDate: "2026-06-17",
    cutoffLabel: "6 月帳單",
    status: "estimated",
    scheduleCount: 9
  }
];

export const budgetStatuses: BudgetStatus[] = [
  {
    groupName: "家庭生活",
    itemName: "24. 餐費",
    annualBudget: 240000,
    usedAmount: 153000,
    remainingAmount: 87000,
    usageRatio: 0.6375,
    severity: "normal"
  },
  {
    groupName: "家人",
    itemName: "01. 老公家用",
    annualBudget: 120000,
    usedAmount: 116000,
    remainingAmount: 4000,
    usageRatio: 0.9667,
    severity: "warning"
  },
  {
    groupName: "旅遊休閒",
    itemName: "32. 其他國內旅遊(含露營)",
    annualBudget: 60000,
    usedAmount: 65000,
    remainingAmount: -5000,
    usageRatio: 1.0833,
    severity: "over_budget"
  }
];

export const reviewTasks: ReviewTask[] = [
  {
    id: "task-invoice-1",
    type: "invoice_draft",
    title: "50 筆待確認發票",
    description: "需要確認預算項目與支付方式後才正式入帳。",
    createdAt: "2026-05-14"
  },
  {
    id: "task-bill-1",
    type: "bill_variance",
    title: "聯邦 5 月帳單差異",
    description: "真實帳單高於預估帳單，需要回查付款排程或手動修正。",
    amount: 18687,
    createdAt: "2026-05-14"
  }
];
