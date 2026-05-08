# Data Model

## Standard Expense Record

| Field | Description |
|---|---|
| expense_id | Unique expense identifier |
| source_type | invoice_import or manual_no_invoice |
| source_record_id | Source row or invoice reference |
| consumption_date | Actual consumption date |
| budget_month | Derived from consumption_date |
| merchant_tax_id | Seller tax ID when available |
| merchant_name | Seller or manual channel name |
| item_description | Invoice item name or manually entered purchase item |
| budget_item | Final item from the annual budget workbook |
| suggested_budget_item | Suggested item before confirmation |
| classification_status | auto_confirmed, needs_review, manually_confirmed, unable_to_classify |
| classification_basis | merchant_rule, keyword_rule, merchant_item_history, manual |
| amount | Expense amount |
| payment_tool_type | cash or credit_card |
| credit_card_name | Required when payment_tool_type is credit_card |
| is_installment | yes or no |
| installment_count | 1 for non-installment |
| expense_status | normal or cancelled |
| notes | Optional note |

## Payment Schedule

| Field | Description |
|---|---|
| payment_id | Unique payment identifier |
| expense_id | Linked expense identifier |
| payment_sequence | Installment sequence |
| payment_date | Actual or estimated payment date |
| cash_flow_month | Derived from payment_date |
| payment_amount | Payment amount for the schedule row |
| payment_tool_type | cash or credit_card |
| credit_card_name | Inherited from the expense record for credit-card payments |
| payment_status | estimated, reconciled, paid, corrected, offset |
| notes | Optional note |

## Income Schedule

| Field | Description |
|---|---|
| income_id | Unique income identifier |
| income_date | Income receipt date |
| income_month | Derived from income_date |
| income_item | Salary, year-end bonus, festival bonus, incentive bonus, or other income |
| income_amount | Estimated or actual income amount |
| income_status | estimated, received, corrected |
| source | actual_income, salary_structure, manual |
| notes | Optional note |

## Rule Tables

| Table | Purpose |
|---|---|
| credit_card_rules | Credit-card cutoff and payment date rules |
| merchant_payment_rules | Merchant payment method suggestions |
| merchant_item_rules | Merchant and item classification suggestions |
| budget_item_rules | Valid budget item list derived from the annual budget workbook |
| classification_history | Confirmed classification history for learning |
| payment_choice_history | Confirmed payment choice history for learning |

