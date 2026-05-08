# Google Apps Script MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first cloud website MVP with Google Apps Script as the web app and Google Sheets as the database.

**Architecture:** The Google Sheet stores records in separate tabs for budget items, expenses, payment schedules, income schedules, and rules. Apps Script exposes server functions for setup, budget lookup, manual expense entry, payment schedule generation, and cash-flow overview. A simple HTML web app calls those server functions and shows budget/cash-flow data.

**Tech Stack:** Google Apps Script V8, Google Sheets, HTML/CSS/vanilla JavaScript, Node.js built-in test runner for pure rule functions.

---

## File Structure

- Create: `src/apps-script/appsscript.json` - Apps Script manifest.
- Create: `src/apps-script/Code.gs` - web app entry point and HTML templating helper.
- Create: `src/apps-script/Config.gs` - sheet names, headers, enum values, and credit-card rules.
- Create: `src/apps-script/Sheets.gs` - spreadsheet setup, sheet creation, row append/read helpers.
- Create: `src/apps-script/Rules.gs` - date, budget status, installment, and payment-date rules.
- Create: `src/apps-script/Budget.gs` - budget item reads and budget summary calculations.
- Create: `src/apps-script/Expenses.gs` - manual expense creation and linked payment schedule generation.
- Create: `src/apps-script/Income.gs` - income schedule reads and cash-flow aggregation.
- Create: `src/apps-script/Index.html` - first-version web app UI.
- Create: `src/apps-script/Styles.html` - CSS for compact dashboard and forms.
- Create: `src/apps-script/Client.html` - browser-side JavaScript.
- Create: `src/apps-script/README.md` - deployment and manual copy instructions.
- Create: `tests/rules.test.mjs` - pure JavaScript tests for date and installment rules.
- Create: `tests/rules.fixture.mjs` - testable copy of pure rules used by `tests/rules.test.mjs`.
- Modify: `README.md` - add a link to the Apps Script MVP instructions.
- Modify: `.gitignore` - ignore local clasp and generated deployment files without ignoring source.

## Scope Notes

This MVP intentionally includes only no-invoice manual entry and dashboard flows. Invoice import, merchant learning, and automatic classification are represented by sheet tabs and data model fields, but their automation is a later implementation plan.

The user must manually create or open a Google Sheet, then paste/copy the Apps Script source files into Apps Script. A later plan may add `clasp` deployment.

---

### Task 1: Add Testable Core Rule Fixtures

**Files:**
- Create: `tests/rules.fixture.mjs`
- Create: `tests/rules.test.mjs`

- [ ] **Step 1: Create the pure rule fixture**

Create `tests/rules.fixture.mjs`:

```javascript
export function toMonthKey(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function addMonths(dateText, monthOffset) {
  const date = new Date(`${dateText}T00:00:00`);
  const result = new Date(date.getFullYear(), date.getMonth() + monthOffset, date.getDate());
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, "0");
  const day = String(result.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPaymentDate(consumptionDateText, paymentToolType, creditCardName) {
  if (paymentToolType === "cash") {
    return consumptionDateText;
  }

  const date = new Date(`${consumptionDateText}T00:00:00`);
  const day = date.getDate();
  const isYuShan = creditCardName === "YuShan";
  const cutoffDay = isYuShan ? 12 : 5;
  const paymentDay = isYuShan ? 23 : 17;
  const paymentMonthOffset = day <= cutoffDay ? 0 : 1;
  const base = new Date(date.getFullYear(), date.getMonth() + paymentMonthOffset, paymentDay);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${String(paymentDay).padStart(2, "0")}`;
}

export function splitInstallments(totalAmount, installmentCount) {
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw new Error("installmentCount must be a positive integer");
  }

  const base = Math.floor(totalAmount / installmentCount);
  const payments = Array.from({ length: installmentCount }, () => base);
  payments[installmentCount - 1] = totalAmount - base * (installmentCount - 1);
  return payments;
}

export function getBudgetStatus(usageRatio) {
  if (usageRatio >= 1) return "over_budget";
  if (usageRatio >= 0.9) return "warning";
  if (usageRatio >= 0.7) return "reminder";
  return "normal";
}
```

- [ ] **Step 2: Add rule tests**

Create `tests/rules.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  getBudgetStatus,
  getPaymentDate,
  splitInstallments,
  toMonthKey,
} from "./rules.fixture.mjs";

test("month key comes from consumption date", () => {
  assert.equal(toMonthKey("2026-02-10"), "2026-02");
});

test("cash payment date is the consumption date", () => {
  assert.equal(getPaymentDate("2026-05-08", "cash", ""), "2026-05-08");
});

test("other credit cards pay on current month 17th before or on day 5", () => {
  assert.equal(getPaymentDate("2026-05-05", "credit_card", "Union"), "2026-05-17");
});

test("other credit cards pay on next month 17th after day 5", () => {
  assert.equal(getPaymentDate("2026-05-06", "credit_card", "Cathay"), "2026-06-17");
});

test("YuShan pays on current month 23rd before or on day 12", () => {
  assert.equal(getPaymentDate("2026-05-12", "credit_card", "YuShan"), "2026-05-23");
});

test("YuShan pays on next month 23rd after day 12", () => {
  assert.equal(getPaymentDate("2026-05-13", "credit_card", "YuShan"), "2026-06-23");
});

test("installment split puts rounding remainder in last payment", () => {
  assert.deepEqual(splitInstallments(10000, 3), [3333, 3333, 3334]);
});

test("month addition preserves payment day", () => {
  assert.equal(addMonths("2026-05-17", 2), "2026-07-17");
});

test("budget status thresholds match requirements", () => {
  assert.equal(getBudgetStatus(0.69), "normal");
  assert.equal(getBudgetStatus(0.7), "reminder");
  assert.equal(getBudgetStatus(0.9), "warning");
  assert.equal(getBudgetStatus(1), "over_budget");
});
```

- [ ] **Step 3: Run tests**

Run:

```powershell
node --test tests/rules.test.mjs
```

Expected: all tests pass. If `node` is not available globally, use the bundled Node path from Codex workspace dependencies or install Node locally outside the repo.

- [ ] **Step 4: Commit**

```powershell
git add tests/rules.fixture.mjs tests/rules.test.mjs
git commit -m "test: add accounting rule coverage"
```

---

### Task 2: Add Apps Script Manifest and Configuration

**Files:**
- Create: `src/apps-script/appsscript.json`
- Create: `src/apps-script/Config.gs`

- [ ] **Step 1: Create Apps Script manifest**

Create `src/apps-script/appsscript.json`:

```json
{
  "timeZone": "Asia/Taipei",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "MYSELF"
  }
}
```

- [ ] **Step 2: Create central config**

Create `src/apps-script/Config.gs`:

```javascript
const SHEET_NAMES = {
  budgetItems: "BudgetItems",
  expenseRecords: "ExpenseRecords",
  paymentSchedule: "PaymentSchedule",
  incomeSchedule: "IncomeSchedule",
  creditCardRules: "CreditCardRules",
  merchantPaymentRules: "MerchantPaymentRules",
  merchantItemRules: "MerchantItemRules",
  classificationHistory: "ClassificationHistory",
  paymentChoiceHistory: "PaymentChoiceHistory",
};

const HEADERS = {
  BudgetItems: [
    "year",
    "category",
    "budget_item",
    "annual_budget",
    "month_01",
    "month_02",
    "month_03",
    "month_04",
    "month_05",
    "month_06",
    "month_07",
    "month_08",
    "month_09",
    "month_10",
    "month_11",
    "month_12",
    "is_valid_expense_item",
    "notes",
  ],
  ExpenseRecords: [
    "expense_id",
    "source_type",
    "source_record_id",
    "consumption_date",
    "budget_month",
    "merchant_tax_id",
    "merchant_name",
    "item_description",
    "budget_item",
    "suggested_budget_item",
    "classification_status",
    "classification_basis",
    "amount",
    "payment_tool_type",
    "credit_card_name",
    "is_installment",
    "installment_count",
    "expense_status",
    "notes",
  ],
  PaymentSchedule: [
    "payment_id",
    "expense_id",
    "payment_sequence",
    "payment_date",
    "cash_flow_month",
    "payment_amount",
    "payment_tool_type",
    "credit_card_name",
    "payment_status",
    "notes",
  ],
  IncomeSchedule: [
    "income_id",
    "income_date",
    "income_month",
    "income_item",
    "income_amount",
    "income_status",
    "source",
    "notes",
  ],
  CreditCardRules: [
    "credit_card_name",
    "card_group",
    "cutoff_day",
    "payment_day",
    "is_default_for_other_cards",
    "notes",
  ],
};

const ENUMS = {
  paymentToolTypes: ["cash", "credit_card"],
  creditCards: ["YuShan", "Union", "Cathay", "Fubon", "CTBC"],
  expenseStatuses: ["normal", "cancelled"],
  paymentStatuses: ["estimated", "reconciled", "paid", "corrected", "offset"],
  incomeStatuses: ["estimated", "received", "corrected"],
  classificationStatuses: ["auto_confirmed", "needs_review", "manually_confirmed", "unable_to_classify"],
};
```

- [ ] **Step 3: Commit**

```powershell
git add src/apps-script/appsscript.json src/apps-script/Config.gs
git commit -m "feat: add apps script config"
```

---

### Task 3: Add Spreadsheet Setup Helpers

**Files:**
- Create: `src/apps-script/Sheets.gs`

- [ ] **Step 1: Create sheet setup code**

Create `src/apps-script/Sheets.gs`:

```javascript
function getDatabase_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function setupDatabase() {
  const spreadsheet = getDatabase_();
  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = getOrCreateSheet_(spreadsheet, sheetName);
    ensureHeaders_(sheet, HEADERS[sheetName]);
  });
  seedCreditCardRules_();
  return { ok: true, message: "Database sheets are ready." };
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureHeaders_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0];
  const hasHeaders = current.some((value) => String(value || "").trim() !== "");
  if (!hasHeaders) {
    range.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function seedCreditCardRules_() {
  const sheet = getDatabase_().getSheetByName("CreditCardRules");
  if (sheet.getLastRow() > 1) return;
  appendObject_("CreditCardRules", {
    credit_card_name: "YuShan",
    card_group: "yushan",
    cutoff_day: 12,
    payment_day: 23,
    is_default_for_other_cards: false,
    notes: "YuShan purchases from day 1 to 12 pay on the 23rd of the same month.",
  });
  ["Union", "Cathay", "Fubon", "CTBC"].forEach((name) => {
    appendObject_("CreditCardRules", {
      credit_card_name: name,
      card_group: "other",
      cutoff_day: 5,
      payment_day: 17,
      is_default_for_other_cards: true,
      notes: "Other card purchases from day 1 to 5 pay on the 17th of the same month.",
    });
  });
}

function appendObject_(sheetName, record) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "");
  sheet.appendRow(row);
}

function readObjects_(sheetName) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((value) => value !== "")).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
}

function makeId_(prefix) {
  return `${prefix}${Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmssSSS")}`;
}
```

- [ ] **Step 2: Manual Apps Script verification**

In Apps Script, run:

```javascript
setupDatabase();
```

Expected: the Google Sheet contains tabs named `BudgetItems`, `ExpenseRecords`, `PaymentSchedule`, `IncomeSchedule`, and `CreditCardRules`; `CreditCardRules` has YuShan and other-card rows.

- [ ] **Step 3: Commit**

```powershell
git add src/apps-script/Sheets.gs
git commit -m "feat: add spreadsheet setup helpers"
```

---

### Task 4: Add Accounting Rules in Apps Script

**Files:**
- Create: `src/apps-script/Rules.gs`

- [ ] **Step 1: Create Apps Script rule functions**

Create `src/apps-script/Rules.gs`:

```javascript
function toDateText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Taipei", "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function toMonthKey_(dateValue) {
  const date = new Date(`${toDateText_(dateValue)}T00:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths_(dateText, monthOffset) {
  const date = new Date(`${dateText}T00:00:00`);
  const result = new Date(date.getFullYear(), date.getMonth() + monthOffset, date.getDate());
  return Utilities.formatDate(result, "Asia/Taipei", "yyyy-MM-dd");
}

function getPaymentDate_(consumptionDate, paymentToolType, creditCardName) {
  const consumptionDateText = toDateText_(consumptionDate);
  if (paymentToolType === "cash") return consumptionDateText;

  const date = new Date(`${consumptionDateText}T00:00:00`);
  const isYuShan = creditCardName === "YuShan";
  const cutoffDay = isYuShan ? 12 : 5;
  const paymentDay = isYuShan ? 23 : 17;
  const monthOffset = date.getDate() <= cutoffDay ? 0 : 1;
  const paymentDate = new Date(date.getFullYear(), date.getMonth() + monthOffset, paymentDay);
  return Utilities.formatDate(paymentDate, "Asia/Taipei", "yyyy-MM-dd");
}

function splitInstallments_(totalAmount, installmentCount) {
  const count = Number(installmentCount || 1);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Installment count must be a positive integer.");
  }
  const amount = Number(totalAmount);
  const base = Math.floor(amount / count);
  const payments = Array.from({ length: count }, () => base);
  payments[count - 1] = amount - base * (count - 1);
  return payments;
}

function getBudgetStatus_(usageRatio) {
  if (usageRatio >= 1) return "over_budget";
  if (usageRatio >= 0.9) return "warning";
  if (usageRatio >= 0.7) return "reminder";
  return "normal";
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/apps-script/Rules.gs
git commit -m "feat: add apps script accounting rules"
```

---

### Task 5: Add Budget Summary Functions

**Files:**
- Create: `src/apps-script/Budget.gs`

- [ ] **Step 1: Create budget functions**

Create `src/apps-script/Budget.gs`:

```javascript
function getBudgetItems() {
  return readObjects_("BudgetItems")
    .filter((item) => item.is_valid_expense_item === true || String(item.is_valid_expense_item).toLowerCase() === "true")
    .map((item) => ({
      budget_item: item.budget_item,
      category: item.category,
      annual_budget: Number(item.annual_budget || 0),
    }));
}

function getBudgetSummary() {
  const budgetItems = getBudgetItems();
  const expenses = readObjects_("ExpenseRecords").filter((expense) => expense.expense_status !== "cancelled");
  return budgetItems.map((item) => {
    const used = expenses
      .filter((expense) => expense.budget_item === item.budget_item)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const remaining = item.annual_budget - used;
    const usageRatio = item.annual_budget > 0 ? used / item.annual_budget : 0;
    return {
      budget_item: item.budget_item,
      category: item.category,
      annual_budget: item.annual_budget,
      used,
      remaining,
      usage_ratio: usageRatio,
      status: getBudgetStatus_(usageRatio),
    };
  }).sort((a, b) => {
    const order = { over_budget: 0, warning: 1, reminder: 2, normal: 3 };
    return order[a.status] - order[b.status] || b.usage_ratio - a.usage_ratio;
  });
}

function getBudgetImpact(consumptionDate, budgetItem, amount) {
  const summary = getBudgetSummary().find((row) => row.budget_item === budgetItem);
  if (!summary) {
    throw new Error(`Budget item not found: ${budgetItem}`);
  }
  const amountNumber = Number(amount || 0);
  const afterUsed = summary.used + amountNumber;
  const afterRemaining = summary.annual_budget - afterUsed;
  const afterRatio = summary.annual_budget > 0 ? afterUsed / summary.annual_budget : 0;
  return {
    budget_month: toMonthKey_(consumptionDate),
    budget_item: budgetItem,
    before_remaining: summary.remaining,
    after_remaining: afterRemaining,
    after_usage_ratio: afterRatio,
    after_status: getBudgetStatus_(afterRatio),
  };
}
```

- [ ] **Step 2: Manual verification**

Add at least one valid row to `BudgetItems`, then run in Apps Script:

```javascript
getBudgetSummary();
```

Expected: returns an array containing annual budget, used, remaining, usage ratio, and status.

- [ ] **Step 3: Commit**

```powershell
git add src/apps-script/Budget.gs
git commit -m "feat: add budget summary functions"
```

---

### Task 6: Add Manual Expense and Payment Schedule Creation

**Files:**
- Create: `src/apps-script/Expenses.gs`

- [ ] **Step 1: Create expense creation code**

Create `src/apps-script/Expenses.gs`:

```javascript
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
```

- [ ] **Step 2: Manual verification**

Run in Apps Script after setup and after adding a valid `BudgetItems` row:

```javascript
createManualExpense({
  consumption_date: "2026-05-13",
  purchase_item: "sample purchase",
  amount: 10000,
  channel: "Sample Store",
  payment_tool_type: "credit_card",
  credit_card_name: "YuShan",
  is_installment: "yes",
  installment_count: 3,
  budget_item: "23. 餐費",
  notes: "manual test"
});
```

Expected: one `ExpenseRecords` row and three `PaymentSchedule` rows. The first payment date is `2026-06-23`, and amounts are `3333`, `3333`, `3334`.

- [ ] **Step 3: Commit**

```powershell
git add src/apps-script/Expenses.gs
git commit -m "feat: add manual expense entry"
```

---

### Task 7: Add Income and Cash Flow Summary

**Files:**
- Create: `src/apps-script/Income.gs`

- [ ] **Step 1: Create income and cash-flow functions**

Create `src/apps-script/Income.gs`:

```javascript
function createIncome(input) {
  if (!input.income_date) throw new Error("Income date is required.");
  if (!input.income_item) throw new Error("Income item is required.");
  if (Number(input.income_amount) <= 0) throw new Error("Income amount must be greater than 0.");
  const incomeDate = toDateText_(input.income_date);
  const record = {
    income_id: makeId_("I"),
    income_date: incomeDate,
    income_month: toMonthKey_(incomeDate),
    income_item: input.income_item,
    income_amount: Number(input.income_amount),
    income_status: input.income_status || "estimated",
    source: input.source || "manual",
    notes: input.notes || "",
  };
  appendObject_("IncomeSchedule", record);
  return record;
}

function getCashFlowOverview() {
  const incomes = readObjects_("IncomeSchedule");
  const payments = readObjects_("PaymentSchedule").filter((payment) => payment.payment_status !== "offset");
  const monthKeys = Array.from(new Set([
    ...incomes.map((income) => income.income_month),
    ...payments.map((payment) => payment.cash_flow_month),
  ])).filter(Boolean).sort();

  return monthKeys.map((month) => {
    const incomeTotal = incomes
      .filter((income) => income.income_month === month)
      .reduce((sum, income) => sum + Number(income.income_amount || 0), 0);
    const paymentTotal = payments
      .filter((payment) => payment.cash_flow_month === month)
      .reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0);
    return {
      month,
      income_total: incomeTotal,
      payment_total: paymentTotal,
      net_cash_flow: incomeTotal - paymentTotal,
    };
  });
}

function getUpcomingCreditCardPayments(monthLimit) {
  const limit = Number(monthLimit || 3);
  const today = new Date();
  const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const allowedMonths = Array.from({ length: limit }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const payments = readObjects_("PaymentSchedule")
    .filter((payment) => payment.payment_tool_type === "credit_card")
    .filter((payment) => payment.payment_status !== "paid" && payment.payment_status !== "offset")
    .filter((payment) => allowedMonths.includes(payment.cash_flow_month));

  const grouped = {};
  payments.forEach((payment) => {
    const key = `${payment.cash_flow_month}|${payment.credit_card_name}`;
    grouped[key] = grouped[key] || {
      month: payment.cash_flow_month,
      credit_card_name: payment.credit_card_name,
      amount: 0,
    };
    grouped[key].amount += Number(payment.payment_amount || 0);
  });
  return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month) || a.credit_card_name.localeCompare(b.credit_card_name));
}
```

- [ ] **Step 2: Manual verification**

Run in Apps Script:

```javascript
createIncome({
  income_date: "2026-05-05",
  income_item: "Salary",
  income_amount: 65000,
  income_status: "estimated",
  source: "manual"
});
getCashFlowOverview();
```

Expected: cash-flow overview includes May 2026 income and any May 2026 payment schedule totals.

- [ ] **Step 3: Commit**

```powershell
git add src/apps-script/Income.gs
git commit -m "feat: add income and cash flow summary"
```

---

### Task 8: Add Web App UI

**Files:**
- Create: `src/apps-script/Code.gs`
- Create: `src/apps-script/Index.html`
- Create: `src/apps-script/Styles.html`
- Create: `src/apps-script/Client.html`

- [ ] **Step 1: Create web app entry point**

Create `src/apps-script/Code.gs`:

```javascript
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
```

- [ ] **Step 2: Create HTML shell**

Create `src/apps-script/Index.html`:

```html
<!doctype html>
<html>
  <head>
    <base target="_top">
    <?!= include("Styles"); ?>
  </head>
  <body>
    <main class="app">
      <section class="toolbar">
        <h1>Accounting Automation</h1>
        <button type="button" onclick="setup()">Setup Sheets</button>
        <button type="button" onclick="refresh()">Refresh</button>
      </section>

      <section class="grid">
        <section>
          <h2>Budget Status</h2>
          <div id="budgetSummary" class="table"></div>
        </section>
        <section>
          <h2>Cash Flow</h2>
          <div id="cashFlowOverview" class="table"></div>
        </section>
      </section>

      <section>
        <h2>New Manual Expense</h2>
        <form id="expenseForm" onsubmit="submitExpense(event)">
          <label>Consumption Date <input name="consumption_date" type="date" required></label>
          <label>Purchase Item <input name="purchase_item" required></label>
          <label>Amount <input name="amount" type="number" min="1" required></label>
          <label>Channel <input name="channel" required></label>
          <label>Budget Item <select name="budget_item" id="budgetItemSelect" required></select></label>
          <label>Payment Type
            <select name="payment_tool_type" id="paymentToolType" onchange="toggleCard()">
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </label>
          <label id="cardField">Credit Card
            <select name="credit_card_name">
              <option value="YuShan">YuShan</option>
              <option value="Union">Union</option>
              <option value="Cathay">Cathay</option>
              <option value="Fubon">Fubon</option>
              <option value="CTBC">CTBC</option>
            </select>
          </label>
          <label>Installment
            <select name="is_installment">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label>Installment Count <input name="installment_count" type="number" min="1" value="1"></label>
          <label>Notes <input name="notes"></label>
          <button type="submit">Save Expense</button>
        </form>
        <pre id="expenseResult"></pre>
      </section>
    </main>
    <?!= include("Client"); ?>
  </body>
</html>
```

- [ ] **Step 3: Create styles**

Create `src/apps-script/Styles.html`:

```html
<style>
  body { font-family: Arial, sans-serif; margin: 0; background: #f7f7f4; color: #202124; }
  .app { max-width: 1180px; margin: 0 auto; padding: 24px; }
  .toolbar { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
  h1, h2 { margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
  section { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
  button { border: 0; border-radius: 6px; background: #1a73e8; color: #fff; padding: 9px 12px; cursor: pointer; }
  form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  label { display: grid; gap: 4px; font-size: 13px; }
  input, select { min-height: 34px; border: 1px solid #c7c7c7; border-radius: 6px; padding: 6px 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #e6e6e6; padding: 8px; text-align: left; }
  .over_budget { background: #ffe5e5; font-weight: 700; }
  .warning { background: #fff2cc; }
  .reminder { background: #e8f0fe; }
  pre { white-space: pre-wrap; background: #f1f3f4; padding: 12px; border-radius: 6px; }
  @media (max-width: 820px) { .grid, form { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 4: Create browser-side script**

Create `src/apps-script/Client.html`:

```html
<script>
  let dashboardData = null;

  function setup() {
    google.script.run.withSuccessHandler(() => refresh()).setupDatabase();
  }

  function refresh() {
    google.script.run.withSuccessHandler((data) => {
      dashboardData = data;
      renderBudget(data.budgetSummary);
      renderCashFlow(data.cashFlowOverview);
      renderBudgetOptions(data.budgetItems);
      toggleCard();
    }).getDashboardData();
  }

  function renderBudget(rows) {
    const html = [
      "<table><thead><tr><th>Item</th><th>Budget</th><th>Used</th><th>Remaining</th><th>Status</th></tr></thead><tbody>",
      ...rows.map((row) => `<tr class="${row.status}"><td>${row.budget_item}</td><td>${row.annual_budget}</td><td>${row.used}</td><td>${row.remaining}</td><td>${row.status}</td></tr>`),
      "</tbody></table>",
    ].join("");
    document.getElementById("budgetSummary").innerHTML = html;
  }

  function renderCashFlow(rows) {
    const html = [
      "<table><thead><tr><th>Month</th><th>Income</th><th>Payments</th><th>Net</th></tr></thead><tbody>",
      ...rows.map((row) => `<tr><td>${row.month}</td><td>${row.income_total}</td><td>${row.payment_total}</td><td>${row.net_cash_flow}</td></tr>`),
      "</tbody></table>",
    ].join("");
    document.getElementById("cashFlowOverview").innerHTML = html;
  }

  function renderBudgetOptions(items) {
    const select = document.getElementById("budgetItemSelect");
    select.innerHTML = items.map((item) => `<option value="${item.budget_item}">${item.budget_item}</option>`).join("");
  }

  function toggleCard() {
    const isCard = document.getElementById("paymentToolType").value === "credit_card";
    document.getElementById("cardField").style.display = isCard ? "grid" : "none";
  }

  function submitExpense(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const input = Object.fromEntries(formData.entries());
    google.script.run.withSuccessHandler((result) => {
      document.getElementById("expenseResult").textContent = JSON.stringify(result, null, 2);
      event.target.reset();
      refresh();
    }).withFailureHandler((error) => {
      document.getElementById("expenseResult").textContent = error.message;
    }).createManualExpense(input);
  }

  refresh();
</script>
```

- [ ] **Step 5: Manual verification**

Deploy the Apps Script as a web app with access set to yourself. Open the web app URL.

Expected:

- `Setup Sheets` creates required tabs.
- `Budget Status` renders after at least one valid `BudgetItems` row exists.
- `New Manual Expense` creates one expense and one or more payment schedule rows.

- [ ] **Step 6: Commit**

```powershell
git add src/apps-script/Code.gs src/apps-script/Index.html src/apps-script/Styles.html src/apps-script/Client.html
git commit -m "feat: add apps script web app ui"
```

---

### Task 9: Add Deployment Notes and README Link

**Files:**
- Create: `src/apps-script/README.md`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add Apps Script README**

Create `src/apps-script/README.md`:

```markdown
# Google Apps Script MVP

This folder contains the first-version cloud website implementation.

## Manual Setup

1. Create a Google Sheet for the accounting database.
2. Open Extensions > Apps Script.
3. Copy each file from this folder into the Apps Script project.
4. Run `setupDatabase`.
5. Add valid budget item rows to the `BudgetItems` sheet.
6. Deploy as a web app.

## Deployment Settings

- Execute as: Me
- Who has access: Only myself
- Time zone: Asia/Taipei

## First-Version Limits

- Manual no-invoice expense entry is supported.
- Invoice import automation is not included yet.
- Merchant learning automation is not included yet.
- Beginning cash balance is not included yet.
```

- [ ] **Step 2: Update root README**

Append to `README.md`:

```markdown

## Google Apps Script MVP

The first implementation target is a Google Apps Script web app backed by Google Sheets.

See [Apps Script MVP instructions](src/apps-script/README.md).
```

- [ ] **Step 3: Update ignore rules**

Append to `.gitignore`:

```text
.clasp.json
dist/
```

- [ ] **Step 4: Commit**

```powershell
git add README.md .gitignore src/apps-script/README.md
git commit -m "docs: add apps script deployment notes"
```

---

### Task 10: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run local rule tests**

```powershell
node --test tests/rules.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Confirm no real Excel files are tracked**

```powershell
git ls-files | Select-String -Pattern "\.xlsx$|\.xls$"
```

Expected: no output.

- [ ] **Step 3: Confirm Git status is clean**

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 4: Push to GitHub**

```powershell
git push
```

Expected: new commits are pushed to `origin/main`.

---

## Self-Review

- Spec coverage: The plan covers Google Sheets storage, manual expense entry, budget item validation, credit-card payment date rules, installment generation, income records, cash-flow overview, and GitHub-safe source control. Invoice import automation and merchant learning are intentionally deferred and documented as out of scope for this MVP.
- Placeholder scan: No step relies on unspecified file names or undefined commands. The only manual verification steps are explicit Apps Script checks that require the Google UI.
- Type consistency: Field names match `docs/data-model.md` and existing CSV templates. Rule status names match `docs/rules.md`.

