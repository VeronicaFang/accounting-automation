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
| 對帳 | `PaymentSchedule` |

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
8. 前端 Refresh 顯示待確認發票。

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
8. 若選擇匯入規則，新增或更新 `MerchantPaymentRules`。

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
4. 前端呼叫 `importManualExpensesFromText(text, options)`。
5. 後端逐列解析並轉成 `createManualExpense()` input。
6. `source_type` 設為 `manual_batch_import`。
7. 金額允許 0 或負數。
8. 成功列建立 `ExpenseRecords` 與 `PaymentSchedule`，失敗列回傳錯誤摘要。

## Dashboard 載入流程

1. 前端呼叫 `getDashboardDataJson()`。
2. 後端組合：
   - `getBudgetSummary()`
   - `getCashFlowOverview()`
   - `getUpcomingCreditCardPayments(6)`
   - `getRecentExpenses(10)`
   - `getPendingInvoiceDrafts(50)`
   - `getBudgetItems()`
   - `ENUMS`
3. 前端渲染預算、現金流、信用卡付款、近期消費、待確認發票、預算下拉選單。

## 對帳流程

對帳 UI 尚未完整實作，但資料模型已預留：

1. 使用者可比對 `PaymentSchedule` 與信用卡帳單或現金支出。
2. 尚未確認的付款為 `estimated`。
3. 對帳完成可改成 `reconciled`。
4. 實際付款完成可改成 `paid`。
5. 金額或日期修正可改成 `corrected`。
6. 退款、折抵、取消付款可改成 `offset`。

## 取消或刪除消費

- 待確認發票刪除只會把草稿改成 `deleted`。
- 正式消費目前以 `ExpenseRecords.expense_status` 表示 `normal` 或 `cancelled`。
- 預算報表排除 `cancelled` 消費。
- 現金流是否同步沖銷付款排程，後續需補 UI 與流程。