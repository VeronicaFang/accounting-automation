function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("個人記帳管理")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardData() {
  return {
    budgetSummary: getBudgetSummary(),
    cashFlowOverview: getCashFlowOverview(),
    cashFlowSettings: getCashFlowSettings(),
    incomeSchedule: getIncomeSchedule(12),
    paymentSchedule: getPaymentSchedule(6),
    monthlyCreditCardBillEstimates: getMonthlyCreditCardBillEstimates(6),
    upcomingCreditCardPayments: getUpcomingCreditCardPayments(6),
    recentExpenses: getRecentExpenses(10),
    pendingInvoiceDraftPage: getPendingInvoiceDraftPage(0, 50),
    budgetItems: getBudgetItems(),
    enums: ENUMS,
  };
}

function getDashboardDataJson() {
  return JSON.stringify(getDashboardData());
}

function debugGetDashboardData() {
  const data = getDashboardData();
  Logger.log(JSON.stringify(data, null, 2));
  return data;
}
