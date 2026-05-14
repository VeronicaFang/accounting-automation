# 流程文件

本文件描述現行 Web App 的主要使用流程與資料流。完整架構請見 [產品開發交接文件](product-development-guide.md)。


## 流程與資料表對照

| 流程 | 主要資料表 |
|---|---|
| 初始化 | `BudgetItems`, `CreditCardRules`, `MerchantPaymentRules`, `MerchantItemRules`, `ClassificationHistory`, `PaymentChoiceHistory`, `ImportedInvoiceDrafts`, `ExpenseRecords`, `PaymentSchedule`, `IncomeSchedule` |
| 發票匯入 | `ImportedInvoiceDrafts`, `MerchantPaymentRules`, `MerchantItemRules`, `ExpenseRecords` |
| 待確認發票確認 | `ImportedInvoiceDrafts`, `ExpenseRecords`, `PaymentSchedule`, `ClassificationHistory`, `PaymentChoiceHistory`, `MerchantPaymentRules` |
| 手動單筆消費 | `ExpenseRecords`, `PaymentSchedule`, `MerchantPaymentRules`, `BudgetItems` |
| 手動批次匯入 | `ExpenseRecords`, `PaymentSchedule`, `MerchantPaymentRules`, `BudgetItems` |
| Dashboard | `BudgetItems`, `ExpenseRecords`, `PaymentSchedule`, `IncomeSchedule`, `ImportedInvoiceDrafts` |
| 對帳與修正 | `PaymentSchedule`, `IncomeSchedule` |

## 初始化流程

1. 部署 Apps Script Web App。
2. 確認 `Config.gs` 的 `SPREADSHEET_ID` 指向正確 Google Sheet。
3. 執行 `setupDatabase()`。
4. 系統建立或補齊 10 張正式資料表。
5. 系統 seed `CreditCardRules` 與初始 `MerchantPaymentRules`。
6. 使用者在 `BudgetItems` 放入有效預算項目。
7. Web App 點擊 Refresh 後載入 dashboard。

## 發票匯入流程

1. 使用者從財政部下載 CSV，或從 Excel/CSV 複製發票明細。
2. Web App 選擇 CSV 檔或貼上來源值。
3. 前端呼叫 `importInvoiceDraftsFromText(text)`。
4. 後端解析欄位並正規化：發票號碼、消費日、店家統編、店家名稱、品項、金額。
5. 後端依規則產生建議支付方式與建議預算項目。
6. 後端建立 `source_line_key`，檢查 `ImportedInvoiceDrafts` 與 `ExpenseRecords` 是否已有重複發票明細。
7. 非重複資料寫入 `ImportedInvoiceDrafts`，狀態為 `pending`。
8. 前端 Refresh 顯示待確認發票，預設載入 50 筆並可用「載入更多」追加。

## 待確認發票處理流程

待確認清單支援三種批次操作：

- 批次確認入帳。
- 批次確認並匯入店家支付規則。
- 批次刪除。

確認入帳時：

1. 前端讀取每列目前選定的預算項目、支付方式、信用卡。
2. 呼叫 `confirmInvoiceDraftsBatch(inputs)`。
3. 每筆草稿呼叫 `confirmInvoiceDraft(input)`。
4. 建立 `ExpenseRecords`。
5. 建立 `PaymentSchedule`。
6. 更新 `ImportedInvoiceDrafts.import_status = confirmed` 並寫入 `expense_id`。
7. 寫入 `ClassificationHistory` 與 `PaymentChoiceHistory`。
8. 若選擇匯入規則，新增或更新 `MerchantPaymentRules`，並將店家名稱寫入 `merchant_display_name` 供人工辨識。

刪除時：

1. 前端呼叫 `deleteInvoiceDraftsBatch(inputs)`。
2. 後端將草稿狀態改成 `deleted`。
3. 不建立正式消費，也不建立付款排程。

## 手動單筆消費流程

1. 使用者在 Web App 輸入消費日、品項、金額、通路、預算項目、支付方式、信用卡、分期、備註。
2. 前端呼叫 `createManualExpense(input)`。
3. 後端驗證必填欄位。
4. `manual_no_invoice` 金額必須大於 0。
5. 建立 `ExpenseRecords`。
6. 依付款規則建立 `PaymentSchedule`。
7. 回傳 `budget_impact` 給前端顯示剩餘預算與狀態。
8. 若選擇寫入店家規則，更新 `MerchantPaymentRules`。

## 手動批次匯入流程

1. 使用者用 LLM 或試算表整理購物車多品項清單。
2. Web App 選擇 CSV 或貼上來源值。
3. 支援欄位：`消費日`、`購買品項`、`消費金額`、`消費通路`、`預算項目`、`支付方式`、`信用卡`、`備註`。
4. 可貼有標題列資料，也可貼無標題列資料；無標題列時依上述欄位順序解析。
5. `YYYY/MM`、`YYYY-MM`、`YYYY年MM月` 等年月格式會正規化為該月 1 日，例如 `2026/01` 會寫成 `2026-01-01`，`budget_month` 為 `2026-01`。
6. 前端呼叫 `importManualExpensesFromText(text, options)`。
7. 後端逐列解析並轉成 `createManualExpense()` input。
8. `source_type` 設為 `manual_batch_import`。
9. 金額允許 0 或負數。
10. 成功列建立 `ExpenseRecords` 與 `PaymentSchedule`，失敗列回傳錯誤摘要。

## Dashboard 載入流程

1. 前端呼叫 `getDashboardDataJson()`。
2. 後端組合：
   - `getBudgetSummary()`
   - `getCashFlowOverview()`
   - `getIncomeSchedule(12)`
   - `getPaymentSchedule(6)`
   - `getMonthlyCreditCardBillEstimates(6)`
   - `getUpcomingCreditCardPayments(6)`，保留在 payload 供相容與後續使用
   - `getRecentExpenses(10)`
   - `getPendingInvoiceDraftPage(0, 50)`
   - `getBudgetItems()`
   - `ENUMS`
3. 前端渲染預算、現金流、每月收入預估、每月帳單預估、近期消費、待確認發票、預算下拉選單。

## 對帳與修正流程

### 付款與帳單

1. 使用者先看「每月帳單預估」，資料由 `PaymentSchedule` 依付款月份與信用卡彙總。
2. 每月帳單覺得異常時，可展開明細檢查來源消費與付款排程。
3. 明細列可按「對帳/修正」，更新 `payment_amount`、`payment_status` 與 `notes`。
4. 尚未確認的付款為 `estimated`。
5. 對帳完成可改成 `reconciled`。
6. 實際付款完成可改成 `paid`。
7. 金額修正可改成 `corrected`。
8. 退款、折抵、取消付款可改成 `offset`。

### 收入

1. 薪資排程會先寫入 `IncomeSchedule`，狀態多為 `estimated`。
2. Web App 的「每月收入預估」顯示最近 12 筆收入。
3. 實際入帳後可按「入帳/修正」更新 `income_status`、`income_amount` 與 `notes`。
4. 狀態支援 `estimated`、`received`、`corrected`。

## 取消或刪除消費

- 待確認發票刪除只會把草稿改成 `deleted`。
- 正式消費目前以 `ExpenseRecords.expense_status` 表示 `normal` 或 `cancelled`。
- 預算報表排除 `cancelled` 消費。
- 現金流是否同步沖銷付款排程，後續需補 UI 與流程。
