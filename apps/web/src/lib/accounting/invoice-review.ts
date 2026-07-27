import { groupInvoiceLines } from "./invoice-grouping.ts";

export type InvoiceDraftPaymentToolType = "cash" | "credit_card";

export type InvoiceDraftReviewRow = {
  id: string;
  invoice_number: string | null;
  source_order: number | null;
  line_type: "item" | "discount" | null;
  source_line_key: string;
  consumption_date: string;
  merchant_tax_id: string | null;
  merchant_name: string | null;
  item_description: string;
  amount: string | number;
  suggested_payment_tool_type: InvoiceDraftPaymentToolType | null;
  suggested_credit_card_id: string | null;
  suggested_budget_item_id: string | null;
  legacy_suggested_budget_item: string | null;
  review_status: string;
  notes: string | null;
};

export type InvoiceDraftBudgetItemLookup = {
  id: string;
  name: string | null;
  legacy_id?: string | null;
  legacy_name: string | null;
};

export type InvoiceDraftCreditCardLookup = {
  id: string;
  name: string;
  legacy_id?: string | null;
};

export type InvoiceMerchantPaymentRule = {
  merchant_tax_id: string | null;
  merchant_name_contains: string | null;
  payment_tool_type: InvoiceDraftPaymentToolType;
  credit_card_id: string | null;
  default_budget_item_id: string | null;
  is_active: boolean;
};

export type InvoiceMerchantItemRule = {
  merchant_tax_id: string | null;
  merchant_name_contains: string | null;
  item_keyword_contains: string;
  budget_item_id: string;
  is_active: boolean;
};

export type InvoiceRuleLookups = {
  paymentRules?: InvoiceMerchantPaymentRule[];
  itemRules?: InvoiceMerchantItemRule[];
};

export type InvoiceDraftReviewItem = {
  id: string;
  invoiceNumber: string;
  sourceOrder: number;
  lineType: "item" | "discount";
  sourceLineKey: string;
  consumptionDate: string;
  merchantTaxId: string | null;
  merchantName: string;
  itemDescription: string;
  amount: number;
  suggestedPaymentToolType: InvoiceDraftPaymentToolType;
  suggestedCreditCardId: string;
  suggestedCreditCardName: string;
  suggestedBudgetItemId: string;
  suggestedBudgetItemName: string;
  reviewStatus: string;
  notes: string | null;
};

export type InvoiceDraftConfirmation = {
  draftId: string;
  budgetItemId: string;
  paymentToolType: InvoiceDraftPaymentToolType;
  creditCardId?: string;
  notes?: string;
  installmentCount?: number;
};

export type InvoiceDraftConfirmationInput = {
  draftId: string;
  invoiceNumber: string;
  sourceOrder: number;
  lineType: "item" | "discount";
  consumptionDate: string;
  merchantTaxId: string | null;
  merchantName: string;
  itemDescription: string;
  amount: number;
  budgetItemId: string;
  paymentToolType: InvoiceDraftPaymentToolType;
  creditCardId?: string;
  notes: string;
  sourceLineKey: string;
  installmentCount: number;
};

function valueIncludes(value: string, fragment: string | null | undefined): boolean {
  const trimmedFragment = String(fragment ?? "").trim();

  if (!trimmedFragment) {
    return false;
  }

  return value.includes(trimmedFragment);
}

function merchantRuleMatches(
  row: Pick<InvoiceDraftReviewRow, "merchant_tax_id" | "merchant_name">,
  rule: Pick<InvoiceMerchantPaymentRule, "merchant_tax_id" | "merchant_name_contains">
): boolean {
  const rowTaxId = String(row.merchant_tax_id ?? "").trim();

  if (rule.merchant_tax_id && rule.merchant_tax_id === rowTaxId) {
    return true;
  }

  return valueIncludes(String(row.merchant_name ?? ""), rule.merchant_name_contains);
}

export function findInvoiceMerchantPaymentRule(
  row: Pick<InvoiceDraftReviewRow, "merchant_tax_id" | "merchant_name">,
  rules: InvoiceMerchantPaymentRule[] = []
): InvoiceMerchantPaymentRule | undefined {
  return rules.filter((rule) => rule.is_active).find((rule) => merchantRuleMatches(row, rule));
}

export function findInvoiceMerchantItemRule(
  row: Pick<InvoiceDraftReviewRow, "merchant_tax_id" | "merchant_name" | "item_description">,
  rules: InvoiceMerchantItemRule[] = []
): InvoiceMerchantItemRule | undefined {
  return rules
    .filter((rule) => rule.is_active)
    .find((rule) => merchantRuleMatches(row, rule) && valueIncludes(row.item_description, rule.item_keyword_contains));
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(value);
}

function getBudgetItemLabel(item: InvoiceDraftBudgetItemLookup | undefined, fallback: string | null): string {
  return item?.legacy_name ?? item?.legacy_id ?? item?.name ?? fallback ?? "";
}

function getCreditCardLabel(card: InvoiceDraftCreditCardLookup | undefined): string {
  return card?.legacy_id ?? card?.name ?? "";
}

export function mapInvoiceDraftReviewItems(
  rows: InvoiceDraftReviewRow[],
  budgetItems: InvoiceDraftBudgetItemLookup[],
  creditCards: InvoiceDraftCreditCardLookup[],
  rules: InvoiceRuleLookups = {}
): InvoiceDraftReviewItem[] {
  const budgetItemById = new Map(budgetItems.map((item) => [item.id, item]));
  const creditCardById = new Map(creditCards.map((card) => [card.id, card]));

  return rows.map((row) => {
    const paymentRule = findInvoiceMerchantPaymentRule(row, rules.paymentRules);
    const itemRule = findInvoiceMerchantItemRule(row, rules.itemRules);
    const suggestedBudgetItemId =
      paymentRule?.default_budget_item_id ?? itemRule?.budget_item_id ?? row.suggested_budget_item_id ?? "";
    const suggestedPaymentToolType = paymentRule?.payment_tool_type ?? row.suggested_payment_tool_type ?? "cash";
    const suggestedCreditCardId =
      suggestedPaymentToolType === "credit_card" ? (paymentRule?.credit_card_id ?? row.suggested_credit_card_id ?? "") : "";

    return {
      id: row.id,
      invoiceNumber: row.invoice_number ?? row.source_line_key.split("|")[0] ?? "",
      sourceOrder: row.source_order ?? 1,
      lineType: row.line_type ?? (toNumber(row.amount) < 0 ? "discount" : "item"),
      sourceLineKey: row.source_line_key,
      consumptionDate: row.consumption_date,
      merchantTaxId: row.merchant_tax_id,
      merchantName: row.merchant_name ?? "",
      itemDescription: row.item_description,
      amount: toNumber(row.amount),
      suggestedPaymentToolType,
      suggestedCreditCardId,
      suggestedCreditCardName: getCreditCardLabel(creditCardById.get(suggestedCreditCardId)),
      suggestedBudgetItemId,
      suggestedBudgetItemName: getBudgetItemLabel(budgetItemById.get(suggestedBudgetItemId), row.legacy_suggested_budget_item),
      reviewStatus: row.review_status,
      notes: row.notes
    };
  });
}

export type InvoiceDraftGroup = {
  invoiceNumber: string;
  lines: InvoiceDraftReviewItem[];
  itemLines: InvoiceDraftReviewItem[];
  discountLines: InvoiceDraftReviewItem[];
  paidTotal: number;
  discountTotal: number;
  consumptionDate: string;
  merchantName: string;
};

export type InvoiceGroupConfirmationPreflight = {
  invoiceNumber: string;
  paymentToolType: InvoiceDraftPaymentToolType;
  creditCardId?: string;
  installmentCount?: number;
  lines: Array<{
    draftId: string;
    budgetItemId: string;
  }>;
};

export type InvoiceGroupConfirmationIssue = {
  invoiceNumber: string;
  consumptionDate: string;
  merchantName: string;
  draftId?: string;
  sourceOrder?: number;
  itemDescription?: string;
  reason: string;
};

export function buildInvoiceDraftGroups(drafts: InvoiceDraftReviewItem[]): InvoiceDraftGroup[] {
  return groupInvoiceLines(
    drafts.map((draft) => ({
      ...draft,
      originalAmount: draft.amount
    }))
  )
    .map((group) => ({
      invoiceNumber: group.invoiceNumber,
      lines: group.lines,
      itemLines: group.lines.filter((line) => line.lineType === "item"),
      discountLines: group.lines.filter((line) => line.lineType === "discount"),
      paidTotal: group.paidTotal,
      discountTotal: group.discountTotal,
      consumptionDate: group.lines[0]?.consumptionDate ?? "",
      merchantName: group.lines[0]?.merchantName ?? ""
    }))
    .sort((a, b) => a.consumptionDate.localeCompare(b.consumptionDate) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

export function collectInvoiceGroupConfirmationIssues(
  group: InvoiceDraftGroup,
  confirmation: InvoiceGroupConfirmationPreflight
): InvoiceGroupConfirmationIssue[] {
  const issues: InvoiceGroupConfirmationIssue[] = [];
  const baseIssue = {
    invoiceNumber: group.invoiceNumber,
    consumptionDate: group.consumptionDate,
    merchantName: group.merchantName || "未知商家"
  };

  if (confirmation.invoiceNumber !== group.invoiceNumber) {
    issues.push({ ...baseIssue, reason: "送出的發票號碼與畫面上的發票號碼不一致。" });
  }

  if (confirmation.paymentToolType === "credit_card" && !String(confirmation.creditCardId ?? "").trim()) {
    issues.push({ ...baseIssue, reason: "付款方式是信用卡，但尚未選擇信用卡。" });
  }

  if (confirmation.paymentToolType !== "cash" && confirmation.paymentToolType !== "credit_card") {
    issues.push({ ...baseIssue, reason: "付款方式不是支援的類型。" });
  }

  const installmentCount = Number(confirmation.installmentCount ?? 1);
  if (!Number.isFinite(installmentCount) || installmentCount < 1) {
    issues.push({ ...baseIssue, reason: "分期數必須大於或等於 1。" });
  }

  if (group.itemLines.length === 0) {
    issues.push({ ...baseIssue, reason: "發票沒有可入帳的正數品項。" });
  }

  const positiveTotal = group.itemLines.reduce((sum, line) => sum + line.amount, 0);
  if (positiveTotal + group.discountTotal < 0) {
    issues.push({ ...baseIssue, reason: "折扣金額超過正數品項總額，請檢查折扣與品項金額。" });
  }

  const submittedLineByDraftId = new Map(confirmation.lines.map((line) => [line.draftId, line]));
  for (const line of group.itemLines) {
    const submittedLine = submittedLineByDraftId.get(line.id);
    if (!submittedLine || !String(submittedLine.budgetItemId ?? "").trim()) {
      issues.push({
        ...baseIssue,
        draftId: line.id,
        sourceOrder: line.sourceOrder,
        itemDescription: line.itemDescription,
        reason: `品項「${line.itemDescription || line.id}」尚未選擇預算項目。`
      });
    }
  }

  return issues;
}
export function buildInvoiceDraftConfirmationInputs(
  drafts: InvoiceDraftReviewItem[],
  confirmations: InvoiceDraftConfirmation[]
): InvoiceDraftConfirmationInput[] {
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));

  return confirmations.map((confirmation) => {
    const draft = draftById.get(confirmation.draftId);

    if (!draft) {
      throw new Error(`Invoice draft not found: ${confirmation.draftId}`);
    }

    if (!confirmation.budgetItemId) {
      throw new Error(`Budget item is required for invoice draft: ${confirmation.draftId}`);
    }

    if (confirmation.paymentToolType === "credit_card" && !confirmation.creditCardId) {
      throw new Error(`Credit card is required for invoice draft: ${confirmation.draftId}`);
    }

    return {
      draftId: draft.id,
      invoiceNumber: draft.invoiceNumber,
      sourceOrder: draft.sourceOrder,
      lineType: draft.lineType,
      consumptionDate: draft.consumptionDate,
      merchantTaxId: draft.merchantTaxId,
      merchantName: draft.merchantName,
      itemDescription: draft.itemDescription,
      amount: draft.amount,
      budgetItemId: confirmation.budgetItemId,
      paymentToolType: confirmation.paymentToolType,
      creditCardId: confirmation.paymentToolType === "credit_card" ? confirmation.creditCardId : undefined,
      notes: String(confirmation.notes ?? ""),
      sourceLineKey: draft.sourceLineKey,
      installmentCount: Math.max(1, Math.trunc(Number(confirmation.installmentCount || 1)))
    };
  });
}
