# 報表與畫面文件

本文件描述目前 Web App 已呈現或資料模型已支援的報表。


## 報表與資料表對照

| 報表或畫面 | 主要資料表 |
|---|---|
| 預算總覽 | `BudgetItems`, `ExpenseRecords` |
| 單筆消費後預算提示 | `BudgetItems`, `ExpenseRecords` |
| 現金流總覽 | `IncomeSchedule`, `PaymentSchedule` |
| 每月收入預估 | `IncomeSchedule` |
| 每月帳單預估 | `PaymentSchedule`, `CreditCardRules` |
| 近期消費 | `ExpenseRecords` |
| 待確認發票清單 | `ImportedInvoiceDrafts`, `MerchantPaymentRules`, `MerchantItemRules` |
| 後續規則學習報表 | `ClassificationHistory`, `PaymentChoiceHistory` |

## Dashboard 資料來源

前端透過 `getDashboardDataJson()` 載入下列資料：

| Payload | 來源函式 | 用途 |
|---|---|---|
| `budgetSummary` | `getBudgetSummary()` | 預算使用總覽。 |
| `cashFlowOverview` | `getCashFlowOverview()` | 每月現金流。 |
| `incomeSchedule` | `getIncomeSchedule(12)` | 每月收入預估與入帳/修正。 |
| `paymentSchedule` | `getPaymentSchedule(6)` | 每月帳單預估明細與付款對帳。 |
| `monthlyCreditCardBillEstimates` | `getMonthlyCreditCardBillEstimates(6)` | 依付款月份與信用卡彙總的每月帳單預估。 |
| `upcomingCreditCardPayments` | `getUpcomingCreditCardPayments(6)` | 舊版未來信用卡付款摘要 payload，保留供相容與後續使用。 |
| `recentExpenses` | `getRecentExpenses(10)` | 近期消費。 |
| `pendingInvoiceDraftPage` | `getPendingInvoiceDraftPage(0, 50)` | 待確認發票分頁，預設 50 筆並可載入更多。 |
| `budgetItems` | `getBudgetItems()` | 預算項目下拉選單。 |
| `enums` | `ENUMS` | 前端列舉選項。 |

## 預算總覽

目的：讓使用者知道各預算項目的年度使用狀態。

欄位：

- 預算項目。
- 年度預算。
- 已使用金額。
- 剩餘金額。
- 使用狀態。

計算邏輯：

- 資料來源為 `BudgetItems` 與 `ExpenseRecords`。
- 排除 `expense_status = cancelled` 的消費。
- 使用率達 70%、90%、100% 時切換提醒狀態。
- 超支項目需最醒目。

## 單筆消費後預算提示

手動單筆消費建立成功後，系統回傳 `budget_impact`：

- 預算項目。
- 消費前剩餘。
- 消費後剩餘。
- 消費前狀態。
- 消費後狀態。

目前 UI 主要顯示消費後剩餘與狀態；後續可再強化成更完整的消費前/後比較。

## 現金流總覽

目的：讓使用者知道每月收入扣付款後的淨現金流。

欄位：

- 月份。
- 收入總額。
- 現金支出。
- 信用卡付款。
- 淨現金流。

計算邏輯：

```text
net_cash_flow = income_total - cash_expense_total - credit_card_payment_total
```

資料來源：

- 收入：`IncomeSchedule`。
- 現金支出與信用卡付款：`PaymentSchedule`。
- `payment_status = offset` 不納入付款支出。

目前不含：

- 期初現金餘額。
- 銀行帳戶餘額。
- 帳戶間轉帳。

## 每月收入預估

目的：讓使用者看到薪資與其他收入排程，並在實際入帳後修正。

資料來源：`IncomeSchedule`。

顯示欄位：

- 收入月。
- 收入日。
- 收入項目。
- 金額。
- 狀態：`estimated`、`received`、`corrected`。
- 來源。
- 備註。

操作：

- 點「入帳/修正」後可修改收入狀態、金額與備註。
- 薪資排程實際入帳時更新原本那筆，不新增第二筆，避免 Cash Flow 重複計算。

## 每月帳單預估

目的：讓使用者快速看未來 6 個月各信用卡每月預估帳單金額。

資料來源：`PaymentSchedule`。

篩選條件：

- `payment_tool_type = credit_card`。
- `payment_status` 不是 `offset`。

顯示欄位：

- 帳單月份。
- 信用卡名稱。
- 帳單區間。
- 預估付款日。
- 預估帳單金額。
- 狀態摘要。

操作：

- 預設顯示為唯讀彙總。
- 點「查看明細 / 對帳」才展開來源付款排程。
- 明細中可修改付款狀態、付款金額與備註。

## 近期消費

目的：讓使用者確認最近入帳的消費紀錄。

資料來源：`ExpenseRecords`。

規則：

- 排除 `expense_status = cancelled`。
- 依 `consumption_date` 與 `expense_id` 由新到舊排序。
- 預設顯示 10 筆。

顯示欄位：

- 消費日。
- 店家。
- 品項。
- 預算項目。
- 金額。
- 支付方式。

## 待確認發票清單

目的：集中處理發票匯入後尚未確認的明細。

資料來源：`ImportedInvoiceDrafts`。

篩選條件：

- `import_status = pending`。

顯示與操作：

- 可勾選多筆。
- 可調整預算項目、支付方式、信用卡。
- 單筆操作只保留刪除。
- 主要操作使用批次確認、批次確認並匯入規則、批次刪除。
- 預設載入 50 筆，畫面顯示「目前顯示 N / 待確認共 M 筆」。
- 可按「載入更多 50 筆」追加下一批；批次操作只處理目前已載入且勾選的項目。

## 後續報表方向

尚未完整實作但資料模型已支援或可延伸：

- 月度預算使用表：以 `BudgetItems.month_01` 到 `month_12` 對照 `ExpenseRecords`。
- 待分類/需確認清單：整合發票草稿與未來手動分類規則。
- 更完整的信用卡對帳表：依 `PaymentSchedule` 與信用卡帳單比對。
- 分期付款追蹤：剩餘期數、剩餘金額、各卡未來付款壓力。
- 收入預估與實際差異：目前可修正單筆，後續可新增差異報表。
- 現金流含期初餘額版本：加入帳戶餘額與轉帳後再計算。
