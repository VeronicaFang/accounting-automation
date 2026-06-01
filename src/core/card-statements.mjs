export function getCashFlowCardPaymentAmount({ estimated_amount = 0, actual_amount = null }) {
  if (actual_amount !== null && actual_amount !== undefined && actual_amount !== "") {
    return Number(actual_amount || 0);
  }
  return Number(estimated_amount || 0);
}

export function compareCardBill({ bill_month, credit_card_name, estimated_amount = 0, actual_amount = null }) {
  const estimatedAmount = Number(estimated_amount || 0);
  const hasActual = actual_amount !== null && actual_amount !== undefined && actual_amount !== "";
  const actualAmount = hasActual ? Number(actual_amount || 0) : null;
  const cashFlowAmount = getCashFlowCardPaymentAmount({
    estimated_amount: estimatedAmount,
    actual_amount: actualAmount,
  });

  if (!hasActual) {
    return {
      bill_month,
      credit_card_name,
      estimated_amount: estimatedAmount,
      actual_amount: null,
      cash_flow_amount: cashFlowAmount,
      difference_amount: null,
      difference_ratio: null,
      status: "estimated_only",
    };
  }

  const differenceAmount = actualAmount - estimatedAmount;
  const differenceRatio = estimatedAmount > 0 ? differenceAmount / estimatedAmount : null;

  return {
    bill_month,
    credit_card_name,
    estimated_amount: estimatedAmount,
    actual_amount: actualAmount,
    cash_flow_amount: cashFlowAmount,
    difference_amount: differenceAmount,
    difference_ratio: differenceRatio,
    status: Math.abs(differenceAmount) >= 1000 ? "variance_warning" : "matched",
  };
}
