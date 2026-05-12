# 規則文件

本文件描述現行程式實作的主要商業規則。對應程式位於 `src/core/*.mjs` 與 `src/apps-script/*.gs`。


## 規則與資料表對照

| 規則 | 主要資料表 |
|---|---|
| 預算規則 | `BudgetItems`, `ExpenseRecords` |
| 現金流規則 | `IncomeSchedule`, `PaymentSchedule` |
| 信用卡付款日 | `CreditCardRules`, `PaymentSchedule` |
| 發票匯入預設 | `ImportedInvoiceDrafts`, `MerchantPaymentRules`, `MerchantItemRules` |
| 發票重複檢查 | `ImportedInvoiceDrafts`, `ExpenseRecords` |
| 規則學習 | `ClassificationHistory`, `PaymentChoiceHistory`, `MerchantPaymentRules`, `MerchantItemRules` |

## 預算規則

```text
budget_month = month(consumption_date)
budget_used = sum(ExpenseRecords.amount where expense_status != cancelled)
remaining = annual_budget - used
```

- 預算以消費日計算。
- 信用卡與分期不影響預算扣除時點。
- 預算項目必須來自 `BudgetItems`。
- `BudgetItems.is_valid_expense_item` 為 true 的項目才是有效消費分類。

## 現金流規則

```text
monthly net cash flow = monthly income_total - monthly payment_total
```

- 收入來自 `IncomeSchedule`。
- 支出來自 `PaymentSchedule`。
- `payment_status = offset` 的付款不計入現金流付款支出。
- 現金支付的付款日等於消費日。
- 信用卡支付的付款日依信用卡規則計算。

## 信用卡付款日規則

| 信用卡 | 消費日 | 付款日 |
|---|---|---|
| 玉山 | 每月 1-12 日 | 當月 23 日 |
| 玉山 | 每月 13 日後 | 次月 23 日 |
| 聯邦、國泰、富邦、中信及其他 | 每月 1-5 日 | 當月 17 日 |
| 聯邦、國泰、富邦、中信及其他 | 每月 6 日後 | 次月 17 日 |

程式需同時支援中文卡名與內部卡名，例如 `玉山` 與 `YuShan`。

## 分期規則

- `is_installment = yes` 時使用 `installment_count`。
- 非分期視為 1 期。
- 平均分期：前 N-1 期為 `floor(total / count)`。
- 最後一期吸收尾差。
- 每一期付款日從首期付款日開始，每月同日遞延。
- 對帳時可手動修改付款排程金額與狀態。

## 發票匯入預設規則

發票草稿的建議值依下列優先順序：

1. 來源資料中的手動註記。
2. `MerchantPaymentRules`。
3. `MerchantItemRules`。
4. 預設 `24. 餐費` + `cash`。

即使有命中規則，`classification_status` 仍為 `needs_review`，必須由使用者確認。

## 店家支付規則

`MerchantPaymentRules` 可用兩種方式命中店家：

- `merchant_tax_id` 等於發票或消費的店家統編。
- `merchant_name_contains` 包含於店家名稱。

命中後提供：

- `payment_tool_type`
- `credit_card_name`
- `default_budget_item`

當使用者按下「把本次紀錄匯入店家支付規則中」時，會新增或更新該店家的支付規則。

## 店家 + 品項規則

`MerchantItemRules` 同時檢查：

- 店家統編或店名包含條件。
- 品項文字包含 `item_keyword_contains`。

命中後提供 `budget_item`。

## 發票重複檢查規則

匯入發票時，系統會建立 `source_line_key`。組成包含：

- 發票號碼。
- 店家統編。
- 消費日，正規化為 `yyyy-MM-dd`。
- 品項描述。
- 金額。
- 同一批匯入中的重複序號。

重複檢查來源：

- `ImportedInvoiceDrafts.source_line_key`。
- 舊資料中沒有 `source_line_key` 時的欄位組合。
- `ExpenseRecords` 中已確認入帳的發票欄位組合。

## 金額允許規則

| source_type | 金額限制 |
|---|---|
| `manual_no_invoice` | 必須大於 0。 |
| `manual_batch_import` | 可為正數、0、負數。 |
| `finance_ministry_invoice` | 可為正數、0、負數。 |

允許 0 或負數是為了保留折扣、點數折抵與發票明細中的調整項。

## 狀態規則

### 預算狀態

| 使用率 | 狀態 |
|---:|---|
| < 70% | `normal` |
| >= 70% 且 < 90% | `reminder` |
| >= 90% 且 < 100% | `warning` |
| >= 100% | `over_budget` |

### 發票匯入狀態

| 狀態 | 說明 |
|---|---|
| `pending` | 待確認。 |
| `confirmed` | 已確認並建立正式消費。 |
| `deleted` | 使用者刪除，不入帳。 |

### 付款狀態

| 狀態 | 說明 |
|---|---|
| `estimated` | 預估付款。 |
| `reconciled` | 已對帳。 |
| `paid` | 已付款。 |
| `corrected` | 已修正。 |
| `offset` | 已沖銷或排除。 |

## 規則學習方向

目前已有：

- `ClassificationHistory`
- `PaymentChoiceHistory`
- 手動把本次紀錄寫入 `MerchantPaymentRules`

後續目標：最近 5 次中有 4 次一致時，才自動調整預設規則。