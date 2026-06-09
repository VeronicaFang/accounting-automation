export type InvoiceDraftPaymentToolType = "cash" | "credit_card";

export type InvoiceDraftReviewRow = {
  id: string;
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

export type InvoiceDraftReviewItem = {
  id: string;
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
};

export type InvoiceDraftConfirmationInput = {
  draftId: string;
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
};

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
  creditCards: InvoiceDraftCreditCardLookup[]
): InvoiceDraftReviewItem[] {
  const budgetItemById = new Map(budgetItems.map((item) => [item.id, item]));
  const creditCardById = new Map(creditCards.map((card) => [card.id, card]));

  return rows.map((row) => {
    const suggestedBudgetItemId = row.suggested_budget_item_id ?? "";
    const suggestedCreditCardId = row.suggested_credit_card_id ?? "";

    return {
      id: row.id,
      sourceLineKey: row.source_line_key,
      consumptionDate: row.consumption_date,
      merchantTaxId: row.merchant_tax_id,
      merchantName: row.merchant_name ?? "",
      itemDescription: row.item_description,
      amount: toNumber(row.amount),
      suggestedPaymentToolType: row.suggested_payment_tool_type ?? "cash",
      suggestedCreditCardId,
      suggestedCreditCardName: getCreditCardLabel(creditCardById.get(suggestedCreditCardId)),
      suggestedBudgetItemId,
      suggestedBudgetItemName: getBudgetItemLabel(budgetItemById.get(suggestedBudgetItemId), row.legacy_suggested_budget_item),
      reviewStatus: row.review_status,
      notes: row.notes
    };
  });
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
      consumptionDate: draft.consumptionDate,
      merchantTaxId: draft.merchantTaxId,
      merchantName: draft.merchantName,
      itemDescription: draft.itemDescription,
      amount: draft.amount,
      budgetItemId: confirmation.budgetItemId,
      paymentToolType: confirmation.paymentToolType,
      creditCardId: confirmation.paymentToolType === "credit_card" ? confirmation.creditCardId : undefined,
      notes: String(confirmation.notes ?? ""),
      sourceLineKey: draft.sourceLineKey
    };
  });
}
