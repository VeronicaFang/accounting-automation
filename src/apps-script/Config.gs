const SPREADSHEET_ID = "1CmdU1cM2eYSAQ-dCASlynAQFyGrG5FCvrlQOS3RZP38";

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
  importedInvoiceDrafts: "ImportedInvoiceDrafts",
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
  ImportedInvoiceDrafts: [
    "import_id",
    "source_type",
    "source_record_id",
    "source_line_key",
    "consumption_date",
    "merchant_tax_id",
    "merchant_name",
    "item_description",
    "amount",
    "suggested_payment_tool_type",
    "suggested_credit_card_name",
    "suggested_budget_item",
    "classification_status",
    "import_status",
    "expense_id",
    "notes",
  ],
  MerchantPaymentRules: [
    "rule_id",
    "merchant_tax_id",
    "merchant_name_contains",
    "payment_tool_type",
    "credit_card_name",
    "is_active",
    "notes",
  ],
  MerchantItemRules: [
    "rule_id",
    "merchant_tax_id",
    "merchant_name_contains",
    "item_keyword_contains",
    "budget_item",
    "is_active",
    "notes",
  ],
  ClassificationHistory: [
    "history_id",
    "merchant_tax_id",
    "merchant_name",
    "item_description",
    "budget_item",
    "confirmed_at",
    "notes",
  ],
  PaymentChoiceHistory: [
    "history_id",
    "merchant_tax_id",
    "merchant_name",
    "payment_tool_type",
    "credit_card_name",
    "confirmed_at",
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
  creditCards: ["玉山", "聯邦", "國泰", "富邦", "中信"],
  expenseStatuses: ["normal", "cancelled"],
  paymentStatuses: ["estimated", "reconciled", "paid", "corrected", "offset"],
  incomeStatuses: ["estimated", "received", "corrected"],
  classificationStatuses: ["auto_confirmed", "needs_review", "manually_confirmed", "unable_to_classify"],
};
const INITIAL_MERCHANT_PAYMENT_RULES = [
  {
    "merchant_tax_id": "60383907",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=109; confidence=98.17%"
  },
  {
    "merchant_tax_id": "56801904",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "國泰",
    "notes": "initial ready rule; count=56; confidence=94.64%"
  },
  {
    "merchant_tax_id": "",
    "merchant_name_contains": "淘寶",
    "payment_tool_type": "credit_card",
    "credit_card_name": "中信",
    "notes": "initial ready rule; count=43; confidence=100.00%"
  },
  {
    "merchant_tax_id": "",
    "merchant_name_contains": "拼多多",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=42; confidence=97.62%"
  },
  {
    "merchant_tax_id": "91229383",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=27; confidence=96.30%"
  },
  {
    "merchant_tax_id": "94226261",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=20; confidence=100.00%"
  },
  {
    "merchant_tax_id": "41145135",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=15; confidence=100.00%"
  },
  {
    "merchant_tax_id": "82836485",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=13; confidence=100.00%"
  },
  {
    "merchant_tax_id": "95160126",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=12; confidence=91.67%"
  },
  {
    "merchant_tax_id": "91054948",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=11; confidence=100.00%"
  },
  {
    "merchant_tax_id": "27243938",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=9; confidence=100.00%"
  },
  {
    "merchant_tax_id": "60599890",
    "merchant_name_contains": "",
    "payment_tool_type": "cash",
    "credit_card_name": "",
    "notes": "initial ready rule; count=8; confidence=100.00%"
  },
  {
    "merchant_tax_id": "80019435",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=7; confidence=100.00%"
  },
  {
    "merchant_tax_id": "",
    "merchant_name_contains": "蝦皮",
    "payment_tool_type": "credit_card",
    "credit_card_name": "國泰",
    "notes": "initial ready rule; count=6; confidence=83.33%"
  },
  {
    "merchant_tax_id": "28992277",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=5; confidence=100.00%"
  },
  {
    "merchant_tax_id": "16606102",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "中信",
    "notes": "initial ready rule; count=5; confidence=100.00%"
  },
  {
    "merchant_tax_id": "25682050",
    "merchant_name_contains": "",
    "payment_tool_type": "cash",
    "credit_card_name": "",
    "notes": "initial ready rule; count=5; confidence=100.00%"
  },
  {
    "merchant_tax_id": "85327610",
    "merchant_name_contains": "",
    "payment_tool_type": "cash",
    "credit_card_name": "",
    "notes": "initial ready rule; count=5; confidence=100.00%"
  },
  {
    "merchant_tax_id": "",
    "merchant_name_contains": "World Gym",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=4; confidence=100.00%"
  },
  {
    "merchant_tax_id": "83076928",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "玉山",
    "notes": "initial ready rule; count=4; confidence=100.00%"
  },
  {
    "merchant_tax_id": "85458443",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=4; confidence=100.00%"
  },
  {
    "merchant_tax_id": "50646363",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=4; confidence=100.00%"
  },
  {
    "merchant_tax_id": "23415683",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=4; confidence=100.00%"
  },
  {
    "merchant_tax_id": "41381502",
    "merchant_name_contains": "",
    "payment_tool_type": "cash",
    "credit_card_name": "",
    "notes": "initial ready rule; count=4; confidence=100.00%"
  },
  {
    "merchant_tax_id": "24332140",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=3; confidence=100.00%"
  },
  {
    "merchant_tax_id": "16082870",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=3; confidence=100.00%"
  },
  {
    "merchant_tax_id": "80028727",
    "merchant_name_contains": "",
    "payment_tool_type": "credit_card",
    "credit_card_name": "聯邦",
    "notes": "initial ready rule; count=3; confidence=100.00%"
  },
  {
    "merchant_tax_id": "42747579",
    "merchant_name_contains": "",
    "payment_tool_type": "cash",
    "credit_card_name": "",
    "notes": "initial ready rule; count=3; confidence=100.00%"
  }
];
