function createManualExpense(input) {
  validateManualExpense_(input);
  const expenseId = makeId_("E");
  const consumptionDate = toDateText_(input.consumption_date);
  const budgetMonth = toMonthKey_(consumptionDate);
  const installmentCount = input.is_installment === "yes" ? Number(input.installment_count) : 1;
  const amount = Number(input.amount);

  const expense = {
    expense_id: expenseId,
    source_type: "manual_no_invoice",
    source_record_id: "",
    consumption_date: consumptionDate,
    budget_month: budgetMonth,
    merchant_tax_id: "",
    merchant_name: input.channel,
    item_description: input.purchase_item,
    budget_item: input.budget_item,
    suggested_budget_item: input.suggested_budget_item || input.budget_item,
    classification_status: "needs_review",
    classification_basis: "manual",
    amount,
    payment_tool_type: input.payment_tool_type,
    credit_card_name: input.payment_tool_type === "credit_card" ? input.credit_card_name : "",
    is_installment: input.is_installment,
    installment_count: installmentCount,
    expense_status: "normal",
    notes: input.notes || "",
  };
  appendObject_("ExpenseRecords", expense);

  const schedules = createPaymentSchedulesForExpense_(expense);
  schedules.forEach((schedule) => appendObject_("PaymentSchedule", schedule));

  return {
    expense,
    payment_schedules: schedules,
    budget_impact: getBudgetImpact(consumptionDate, input.budget_item, amount),
  };
}

function validateManualExpense_(input) {
  if (!input.consumption_date) throw new Error("Consumption date is required.");
  if (!input.purchase_item) throw new Error("Purchase item is required.");
  if (!input.channel) throw new Error("Channel is required.");
  if (!input.budget_item) throw new Error("Budget item is required.");
  if (!input.payment_tool_type) throw new Error("Payment tool type is required.");
  if (input.payment_tool_type === "credit_card" && !input.credit_card_name) {
    throw new Error("Credit card name is required for credit-card payments.");
  }
  if (Number(input.amount) <= 0) throw new Error("Amount must be greater than 0.");
}

function createPaymentSchedulesForExpense_(expense) {
  const firstPaymentDate = getPaymentDate_(expense.consumption_date, expense.payment_tool_type, expense.credit_card_name);
  const payments = splitInstallments_(expense.amount, Number(expense.installment_count || 1));
  return payments.map((paymentAmount, index) => {
    const paymentDate = index === 0 ? firstPaymentDate : addMonths_(firstPaymentDate, index);
    return {
      payment_id: makeId_("P") + String(index + 1).padStart(2, "0"),
      expense_id: expense.expense_id,
      payment_sequence: index + 1,
      payment_date: paymentDate,
      cash_flow_month: toMonthKey_(paymentDate),
      payment_amount: paymentAmount,
      payment_tool_type: expense.payment_tool_type,
      credit_card_name: expense.credit_card_name,
      payment_status: "estimated",
      notes: "",
    };
  });
}
