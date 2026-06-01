export type Severity = "normal" | "reminder" | "warning" | "over_budget";

export type BillStatus = "estimated" | "statement_received" | "paid" | "needs_review";

export type ReviewTaskType =
  | "invoice_draft"
  | "manual_import"
  | "bill_variance"
  | "budget_mapping";

export type CashFlowMonth = {
  month: string;
  income: number;
  cashExpense: number;
  estimatedCardPayment: number;
  actualCardPayment?: number;
  netFlow: number;
  openingBalance?: number;
  endingBalance?: number;
};

export type BillEstimate = {
  id: string;
  month: string;
  creditCardName: string;
  estimatedAmount: number;
  statementAmount?: number;
  paymentDate: string;
  cutoffLabel: string;
  status: BillStatus;
  scheduleCount: number;
};

export type BudgetStatus = {
  groupName: string;
  itemName: string;
  annualBudget: number;
  usedAmount: number;
  remainingAmount: number;
  usageRatio: number;
  severity: Severity;
};

export type ReviewTask = {
  id: string;
  type: ReviewTaskType;
  title: string;
  description: string;
  amount?: number;
  createdAt: string;
};
