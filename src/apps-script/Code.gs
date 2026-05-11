function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Accounting Automation")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardData() {
  return {
    budgetSummary: getBudgetSummary(),
    cashFlowOverview: getCashFlowOverview(),
    upcomingCreditCardPayments: getUpcomingCreditCardPayments(3),
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
