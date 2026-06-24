# 資料模型

本文件描述 Google Sheet 資料庫的 11 張正式資料表。表結構以 `src/apps-script/Config.gs` 的 `HEADERS` 為準。

## 資料庫總覽

| 表名 | 用途 |
|---|---|
| `BudgetItems` | 年度與月份預算項目，是預算分類的唯一合法來源。 |
| `ExpenseRecords` | 已確認入帳的標準化消費紀錄。 |
| `PaymentSchedule` | 每筆消費產生的付款排程，供現金流與每月帳單預估使用。 |
| `IncomeSchedule` | 收入排程或實際收入紀錄，可用於薪資入帳/修正。 |
| `ImportedInvoiceDrafts` | 發票匯入後、尚未確認入帳的草稿清單。 |
| `MerchantPaymentRules` | 店家預設支付方式、信用卡與預設預算項目。 |
| `MerchantItemRules` | 店家 + 品項關鍵字對應預算項目。 |
| `ClassificationHistory` | 使用者確認過的預算分類歷史。 |
| `PaymentChoiceHistory` | 使用者確認過的支付方式歷史。 |
| `CreditCardRules` | 信用卡結帳日與付款日規則。 |
| `AppSettings` | 系統設定，例如現金流期初餘額。 |

## BudgetItems

預算項目表。Web App 的預算下拉選單與預算總覽都來自此表。

| 欄位 | 說明 |
|---|---|
| `year` | 預算年度。 |
| `category` | 預算大類。 |
| `budget_item` | 預算項目名稱，例如 `24. 餐費`。 |
| `annual_budget` | 年度預算金額。 |
| `month_01` 到 `month_12` | 各月份預算配置。 |
| `is_valid_expense_item` | 是否可作為消費分類。true 才可選。 |
| `notes` | 備註。 |

## ExpenseRecords

正式消費紀錄。預算報表以此表為準。

| 欄位 | 說明 |
|---|---|
| `expense_id` | 消費紀錄 ID。 |
| `source_type` | 來源類型：`manual_no_invoice`、`manual_batch_import`、`finance_ministry_invoice`。 |
| `source_record_id` | 來源識別，例如發票號碼。 |
| `consumption_date` | 消費日。 |
| `budget_month` | 預算月份，由消費日推得。 |
| `merchant_tax_id` | 店家統編。 |
| `merchant_name` | 店家或消費通路。 |
| `item_description` | 品項描述。 |
| `budget_item` | 最終確認的預算項目。 |
| `suggested_budget_item` | 系統原始建議的預算項目。 |
| `classification_status` | 分類狀態。 |
| `classification_basis` | 分類依據，例如 manual、invoice_import、manual_batch_import。 |
| `amount` | 消費金額。 |
| `payment_tool_type` | `cash` 或 `credit_card`。 |
| `credit_card_name` | 信用卡名稱；現金可空白。 |
| `is_installment` | 是否分期，`yes` 或 `no`。 |
| `installment_count` | 分期期數。 |
| `expense_status` | `normal` 或 `cancelled`。 |
| `notes` | 備註。 |

## PaymentSchedule

付款排程。現金流報表以此表為付款支出來源。

| 欄位 | 說明 |
|---|---|
| `payment_id` | 付款排程 ID。 |
| `expense_id` | 對應的消費 ID。 |
| `payment_sequence` | 第幾期付款。 |
| `payment_date` | 預估或實際付款日。 |
| `cash_flow_month` | 現金流月份。 |
| `payment_amount` | 該期付款金額。 |
| `payment_tool_type` | `cash` 或 `credit_card`。 |
| `credit_card_name` | 信用卡名稱。 |
| `payment_status` | `estimated`、`reconciled`、`paid`、`corrected`、`offset`。 |
| `notes` | 備註。 |

## IncomeSchedule

收入表。現金流報表以此表為收入來源。

| 欄位 | 說明 |
|---|---|
| `income_id` | 收入 ID。 |
| `income_date` | 收入入帳日。 |
| `income_month` | 收入月份。 |
| `income_item` | 收入項目。 |
| `income_amount` | 收入金額。 |
| `income_status` | `estimated`、`received`、`corrected`。 |
| `source` | 來源，例如 manual、actual_income。 |
| `notes` | 備註。 |

## ImportedInvoiceDrafts

發票匯入草稿表。資料先進此表，使用者確認後才寫入 `ExpenseRecords`。

| 欄位 | 說明 |
|---|---|
| `import_id` | 匯入草稿 ID。 |
| `source_type` | 固定為 `finance_ministry_invoice`。 |
| `source_record_id` | 發票號碼。 |
| `source_line_key` | 發票明細重複檢查 key。 |
| `consumption_date` | 消費日。 |
| `merchant_tax_id` | 店家統編。 |
| `merchant_name` | 店家名稱。 |
| `item_description` | 發票品項。 |
| `amount` | 明細金額，可為 0 或負數。 |
| `suggested_payment_tool_type` | 建議支付方式。 |
| `suggested_credit_card_name` | 建議信用卡。 |
| `suggested_budget_item` | 建議預算項目。 |
| `classification_status` | 目前多為 `needs_review`。 |
| `import_status` | `pending`、`confirmed`、`deleted`。 |
| `expense_id` | 確認入帳後對應的消費 ID。 |
| `notes` | 備註。 |

## Rule and History Tables

### MerchantPaymentRules

| 欄位 | 說明 |
|---|---|
| `rule_id` | 規則 ID。 |
| `merchant_tax_id` | 店家統編，可空白。 |
| `merchant_name_contains` | 店名包含文字，可空白。 |
| `merchant_display_name` | 店家顯示名稱，只供人工辨識，不參與規則比對。 |
| `payment_tool_type` | 預設支付方式。 |
| `credit_card_name` | 預設信用卡。 |
| `default_budget_item` | 該店家預設預算項目。 |
| `is_active` | 是否啟用。 |
| `notes` | 備註。 |

### MerchantItemRules

| 欄位 | 說明 |
|---|---|
| `rule_id` | 規則 ID。 |
| `merchant_tax_id` | 店家統編，可空白。 |
| `merchant_name_contains` | 店名包含文字，可空白。 |
| `item_keyword_contains` | 品項關鍵字。 |
| `budget_item` | 對應預算項目。 |
| `is_active` | 是否啟用。 |
| `notes` | 備註。 |

### ClassificationHistory

記錄發票確認時的預算分類結果：`history_id`、`merchant_tax_id`、`merchant_name`、`item_description`、`budget_item`、`confirmed_at`、`notes`。

### PaymentChoiceHistory

記錄發票確認時的支付方式結果：`history_id`、`merchant_tax_id`、`merchant_name`、`payment_tool_type`、`credit_card_name`、`confirmed_at`、`notes`。

### CreditCardRules

| 欄位 | 說明 |
|---|---|
| `credit_card_name` | 信用卡名稱。 |
| `card_group` | 規則群組，例如 yushan、other。 |
| `cutoff_day` | 結帳切分日。 |
| `payment_day` | 付款日。 |
| `is_default_for_other_cards` | 是否為其他信用卡預設規則。 |
| `notes` | 備註。 |

### AppSettings

系統設定表。此表儲存不適合放進收入或消費紀錄的全域設定，例如現金流期初餘額。

| 欄位 | 說明 |
|---|---|
| `setting_key` | 設定鍵，例如 `cash_flow_opening_balance`。 |
| `setting_value` | 設定值。 |
| `notes` | 備註。 |

## Supabase Migration Model v1

The current deployed MVP still uses Google Sheets as the operational data store. Supabase is the next-system schema and must preserve source traceability during the dual-track transition.

Runtime handoff note: see `docs/handoff-status.md` for the current implementation snapshot. As of 2026-06-09, the Supabase schema and Vercel read/write foundation exist, and Google Sheet transaction data has been imported for the active household. The schema already includes future-facing tables such as `credit_card_statements`, but some user workflows that write to those tables are still pending.

Supabase v1 uses product-oriented tables instead of copying Google Sheet tab names directly:

- `budget_groups` and `budget_items` replace the flat `BudgetItems` view while keeping `legacy_code` and `legacy_name`.
- `expenses`, `payment_schedules`, and `income_schedules` preserve the current accounting model: budget usage follows consumption date, cash flow follows payment date.
- `credit_card_bill_estimates` and `credit_card_statements` support estimated-vs-actual credit card bills. Cash flow uses actual statement amount when present and estimated amount otherwise.
- `budget_mapping_drafts` keeps old-to-new budget taxonomy migration review-gated.
- `migration_runs` and `migration_issues` record import and reconciliation results before switching daily use away from Google Sheets.

All migrated tables that carry Google Sheet data should preserve source fields such as `source_system`, `source_table`, `source_row_id`, `legacy_id`, and `imported_at` where applicable.

The frontend Bill Center reads monthly credit-card totals from `credit_card_bill_estimates` and real statements from `credit_card_statements`. Cash-flow display uses the actual statement amount when available; otherwise it uses the estimate. Payment schedules remain the traceable detail source behind an estimate.

### credit_card_bill_estimates

Stores the monthly estimated credit card bill by household, card, and bill month. This table is the user-facing monthly bill estimate source for Bill Center, and is derived from `payment_schedules`.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `household_id` | Household owner for the estimate. |
| `credit_card_id` | Credit card being estimated. Must belong to the same household. |
| `bill_month` | Bill/payment month in `YYYY-MM`; must be a valid month from `01` to `12`. |
| `billing_period_start` | Estimated start date of the card billing period. |
| `billing_period_end` | Estimated end date of the card billing period. |
| `estimated_payment_date` | Estimated payment due date. |
| `estimated_bill_amount` | Estimated bill amount aggregated from payment schedules. |
| `detail_count` | Number of payment schedule details included in the estimate. |
| `source_system` | Source system for migrated or imported estimate data. |
| `source_table` | Source table or sheet name for migrated data. |
| `source_row_id` | Source row identifier for traceability. |
| `legacy_id` | Legacy identifier when available. |
| `imported_at` | Time the legacy data was imported. |
| `generated_at` | Time the estimate was generated. |

Unique key: `household_id + credit_card_id + bill_month`.

### credit_card_statements

Stores real credit card statement amounts entered or imported by the user. Cash flow uses this table before falling back to `credit_card_bill_estimates`.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `household_id` | Household owner for the statement. |
| `user_id` | User who entered or imported the statement. |
| `credit_card_id` | Credit card on the statement. Must belong to the same household. |
| `statement_month` | Statement/payment month in `YYYY-MM`; must be a valid month from `01` to `12`. |
| `payment_due_date` | Actual payment due date on the statement. |
| `actual_amount` | Actual bill amount from the statement. |
| `statement_status` | `missing`, `entered`, `reconciled`, or `ignored`. |
| `source` | Manual entry or import source label. |
| `source_system` | Source system for migrated or imported statement data. |
| `source_table` | Source table or sheet name for migrated data. |
| `source_row_id` | Source row identifier for traceability. |
| `legacy_id` | Legacy identifier when available. |
| `imported_at` | Time the legacy data was imported. |
| `notes` | Notes. |
| `created_at` | Creation time. |
| `updated_at` | Last update time. |

Unique key: `household_id + credit_card_id + statement_month`.

### cash_flow_months

Stores generated monthly cash-flow totals. Credit card payment total should use real statements when available and bill estimates otherwise.

| Field | Description |
|---|---|
| `id` | Primary key. |
| `household_id` | Household owner for the cash-flow month. |
| `cash_flow_month` | Cash-flow month in `YYYY-MM`; must be a valid month from `01` to `12`. |
| `opening_balance` | Opening balance for the month, if generated. |
| `income_total` | Total income for the month. |
| `cash_expense_total` | Total cash expenses for the month. |
| `credit_card_payment_total` | Credit card payment amount used in cash flow. |
| `net_cash_flow` | `income_total - cash_expense_total - credit_card_payment_total`. |
| `ending_balance` | Ending balance after net cash flow, if generated. |
| `source_system` | Source system for migrated or imported cash-flow data. |
| `source_table` | Source table or sheet name for migrated data. |
| `source_row_id` | Source row identifier for traceability. |
| `legacy_id` | Legacy identifier when available. |
| `imported_at` | Time the legacy data was imported. |
| `generated_at` | Time the cash-flow row was generated. |

Unique key: `household_id + cash_flow_month`.

## 發票群組消費欄位

財政部發票以 `invoice_number` 群組，但每個品項仍保留一筆 `expenses`：

| 欄位 | 說明 |
| --- | --- |
| `invoice_number` | 發票群組鍵，只使用財政部發票號碼。 |
| `source_line_key` | 明細列去重鍵；同一發票可有多個不同 key。 |
| `source_order` | `invoice_drafts` 的原始匯入順序，用於同額品項的折扣歸屬。 |
| `line_type` | `item` 為正數品項，`discount` 為負數折扣。 |
| `original_amount` | 財政部匯入的原始明細金額。 |
| `amount` | 折扣分配後計入預算的金額；折扣列為 0。 |
| `payment_parent_expense_id` | 同張發票負責付款排程的主品項；所有同發票明細指向同一筆。 |

同一發票的負數明細合計歸入原始金額最高的正數品項；同額時使用 `source_order` 最小者。付款排程只由 payment parent 依整張發票實付總額建立一次。