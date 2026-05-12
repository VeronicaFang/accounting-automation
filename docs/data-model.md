# 資料模型

本文件描述 Google Sheet 資料庫的 10 張正式資料表。表結構以 `src/apps-script/Config.gs` 的 `HEADERS` 為準。

## 資料庫總覽

| 表名 | 用途 |
|---|---|
| `BudgetItems` | 年度與月份預算項目，是預算分類的唯一合法來源。 |
| `ExpenseRecords` | 已確認入帳的標準化消費紀錄。 |
| `PaymentSchedule` | 每筆消費產生的付款排程，供現金流使用。 |
| `IncomeSchedule` | 收入排程或實際收入紀錄。 |
| `ImportedInvoiceDrafts` | 發票匯入後、尚未確認入帳的草稿清單。 |
| `MerchantPaymentRules` | 店家預設支付方式、信用卡與預設預算項目。 |
| `MerchantItemRules` | 店家 + 品項關鍵字對應預算項目。 |
| `ClassificationHistory` | 使用者確認過的預算分類歷史。 |
| `PaymentChoiceHistory` | 使用者確認過的支付方式歷史。 |
| `CreditCardRules` | 信用卡結帳日與付款日規則。 |

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