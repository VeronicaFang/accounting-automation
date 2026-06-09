"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { TaskWorkbench } from "@/components/task-workbench";
import {
  type InvoiceDraftBudgetItemLookup,
  type InvoiceDraftConfirmation,
  type InvoiceDraftCreditCardLookup,
  type InvoiceDraftPaymentToolType,
  type InvoiceDraftReviewItem
} from "@/lib/accounting/invoice-review";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { fetchSupabaseRows } from "@/lib/data/supabase-rest";
import { getSupabaseInvoiceDrafts, getSupabaseReviewTasks } from "@/lib/data/supabase-repository";
import { formatCurrency } from "@/lib/format";
import type { ReviewTask } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

type DraftEdit = {
  budgetItemId: string;
  paymentToolType: InvoiceDraftPaymentToolType;
  creditCardId: string;
  notes: string;
};

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

function getBudgetItemLabel(item: InvoiceDraftBudgetItemLookup): string {
  return item.legacy_name ?? item.legacy_id ?? item.name ?? "";
}

function getCreditCardLabel(card: InvoiceDraftCreditCardLookup): string {
  return card.legacy_id ?? card.name;
}

function buildDefaultDraftEdit(draft: InvoiceDraftReviewItem): DraftEdit {
  return {
    budgetItemId: draft.suggestedBudgetItemId,
    paymentToolType: draft.suggestedPaymentToolType,
    creditCardId: draft.suggestedCreditCardId,
    notes: draft.notes ?? ""
  };
}

export function ReviewClient() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [drafts, setDrafts] = useState<InvoiceDraftReviewItem[]>([]);
  const [budgetItems, setBudgetItems] = useState<InvoiceDraftBudgetItemLookup[]>([]);
  const [creditCards, setCreditCards] = useState<InvoiceDraftCreditCardLookup[]>([]);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdit>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "登入 Supabase 後可審核待確認發票。" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadReviewData(accessToken: string, isCurrent = () => true, updateMessage = true) {
    const [taskRows, draftRows, budgetItemRows, creditCardRows] = await Promise.all([
      getSupabaseReviewTasks(accessToken),
      getSupabaseInvoiceDrafts(accessToken),
      fetchSupabaseRows<InvoiceDraftBudgetItemLookup>(
        "budget_items",
        {
          select: "id,name,legacy_id,legacy_name",
          is_active: "eq.true",
          order: "legacy_code.asc"
        },
        undefined,
        accessToken
      ),
      fetchSupabaseRows<InvoiceDraftCreditCardLookup>(
        "credit_cards",
        {
          select: "id,name,legacy_id",
          is_active: "eq.true",
          order: "name.asc"
        },
        undefined,
        accessToken
      )
    ]);

    if (!isCurrent()) {
      return;
    }

    setTasks(taskRows);
    setDrafts(draftRows);
    setBudgetItems(budgetItemRows);
    setCreditCards(creditCardRows);
    setDraftEdits(Object.fromEntries(draftRows.map((draft) => [draft.id, buildDefaultDraftEdit(draft)])));
    setSelectedIds(draftRows.map((draft) => draft.id));
    if (updateMessage) {
      setMessage({
        tone: "success",
        text: draftRows.length > 0 ? `已載入 ${draftRows.length} 筆待確認發票。` : "目前沒有待確認發票。"
      });
    }
    setState("ready");
  }

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session) {
      setState("signed-out");
      return;
    }

    if (!isStoredSupabaseSessionValid(window.localStorage)) {
      setState("expired");
      return;
    }

    let isCurrent = true;
    setState("loading");
    setError(null);

    loadReviewData(session.accessToken, () => isCurrent).catch((caughtError) => {
      if (!isCurrent) {
        return;
      }

      setError(caughtError instanceof Error ? caughtError.message : "讀取待審資料失敗。");
      setMessage({ tone: "error", text: "讀取待審資料失敗。" });
      setState("error");
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedCount = selectedIds.length;
  const selectedTotal = useMemo(
    () => drafts.filter((draft) => selectedIds.includes(draft.id)).reduce((total, draft) => total + draft.amount, 0),
    [drafts, selectedIds]
  );

  function updateDraftEdit(draftId: string, patch: Partial<DraftEdit>) {
    setDraftEdits((current) => ({
      ...current,
      [draftId]: {
        ...current[draftId],
        ...patch
      }
    }));
  }

  function toggleDraft(draftId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...new Set([...current, draftId])] : current.filter((id) => id !== draftId)));
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? drafts.map((draft) => draft.id) : []);
  }

  async function confirmSelectedDrafts() {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已失效，請重新登入。" });
      return;
    }

    const confirmations: InvoiceDraftConfirmation[] = selectedIds.map((draftId) => {
      const edit = draftEdits[draftId];

      return {
        draftId,
        budgetItemId: edit?.budgetItemId ?? "",
        paymentToolType: edit?.paymentToolType ?? "cash",
        creditCardId: edit?.paymentToolType === "credit_card" ? edit.creditCardId : undefined,
        notes: edit?.notes ?? ""
      };
    });

    if (confirmations.length === 0) {
      setMessage({ tone: "error", text: "請先勾選要確認的發票。" });
      return;
    }

    setIsSubmitting(true);
    setMessage({ tone: "muted", text: "正在確認發票並寫入正式支出..." });

    try {
      const response = await fetch("/api/accounting/expense-entry", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "confirmInvoiceDrafts", confirmations })
      });
      const result = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "確認發票失敗。");
      }

      setMessage({
        tone: "success",
        text: `已確認 ${result.confirmedDrafts ?? 0} 筆發票，建立 ${result.insertedExpenses ?? 0} 筆正式支出。`
      });
      await loadReviewData(session.accessToken, () => true, false);
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "確認發票失敗。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="待確認項目"
        description="審核 Supabase 中的財政部發票草稿，確認後寫入正式支出與付款排程。"
      />
      <div className={`data-source-pill data-source-${state}`}>
        {state === "ready"
          ? "Supabase 已連線"
          : state === "loading"
            ? "正在讀取 Supabase"
            : state === "expired"
              ? "Session 已失效，請重新登入"
              : "請先登入 Supabase"}
      </div>
      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>
      {error ? <p className="error-text">{error}</p> : null}

      <TaskWorkbench tasks={tasks} />

      <section className="surface section-block review-section">
        <div className="section-heading">
          <h2>發票草稿</h2>
          <span>
            已選 {selectedCount} 筆 / {formatCurrency(selectedTotal)}
          </span>
        </div>
        {drafts.length === 0 && state === "ready" ? (
          <div className="empty-state">
            <strong>目前沒有待確認發票</strong>
            <p className="muted">新的財政部發票匯入後會出現在這裡。</p>
          </div>
        ) : (
          <>
            <div className="review-actions">
              <label>
                <input
                  checked={drafts.length > 0 && selectedIds.length === drafts.length}
                  onChange={(event) => toggleAll(event.target.checked)}
                  type="checkbox"
                />
                全選
              </label>
              <button className="primary-action" disabled={isSubmitting || selectedIds.length === 0} onClick={confirmSelectedDrafts} type="button">
                確認選取發票
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table review-table">
                <thead>
                  <tr>
                    <th>選取</th>
                    <th>日期</th>
                    <th>商家</th>
                    <th>品項</th>
                    <th>金額</th>
                    <th>預算項目</th>
                    <th>付款</th>
                    <th>備註</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => {
                    const edit = draftEdits[draft.id] ?? buildDefaultDraftEdit(draft);

                    return (
                      <tr key={draft.id}>
                        <td>
                          <input
                            checked={selectedIds.includes(draft.id)}
                            onChange={(event) => toggleDraft(draft.id, event.target.checked)}
                            type="checkbox"
                          />
                        </td>
                        <td>{draft.consumptionDate}</td>
                        <td>
                          <strong>{draft.merchantName || "未填商家"}</strong>
                          {draft.merchantTaxId ? <small>{draft.merchantTaxId}</small> : null}
                        </td>
                        <td>{draft.itemDescription}</td>
                        <td className="task-amount">{formatCurrency(draft.amount)}</td>
                        <td>
                          <select
                            value={edit.budgetItemId}
                            onChange={(event) => updateDraftEdit(draft.id, { budgetItemId: event.target.value })}
                          >
                            <option value="">請選擇</option>
                            {budgetItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {getBudgetItemLabel(item)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="review-payment-controls">
                            <select
                              value={edit.paymentToolType}
                              onChange={(event) =>
                                updateDraftEdit(draft.id, {
                                  paymentToolType: event.target.value === "credit_card" ? "credit_card" : "cash",
                                  creditCardId: event.target.value === "credit_card" ? edit.creditCardId : ""
                                })
                              }
                            >
                              <option value="cash">現金</option>
                              <option value="credit_card">信用卡</option>
                            </select>
                            {edit.paymentToolType === "credit_card" ? (
                              <select
                                value={edit.creditCardId}
                                onChange={(event) => updateDraftEdit(draft.id, { creditCardId: event.target.value })}
                              >
                                <option value="">請選擇信用卡</option>
                                {creditCards.map((card) => (
                                  <option key={card.id} value={card.id}>
                                    {getCreditCardLabel(card)}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <input
                            value={edit.notes}
                            onChange={(event) => updateDraftEdit(draft.id, { notes: event.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
