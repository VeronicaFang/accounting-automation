export type BillComparisonInput = {
  estimatedAmount: number;
  statementAmount?: number;
};

export function getDisplayedBillAmount(input: BillComparisonInput): number {
  return input.statementAmount ?? input.estimatedAmount;
}

export function getStatementVariance(input: BillComparisonInput): number | null {
  if (input.statementAmount === undefined) {
    return null;
  }

  return input.statementAmount - input.estimatedAmount;
}
