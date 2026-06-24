"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { TaskWorkbench } from "@/components/task-workbench";
import {
  buildInvoiceDraftGroups,
  type InvoiceDraftBudgetItemLookup,
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
type ItemEdit = { budgetItemId: string; notes: string };
type GroupEdit = {
  paymentToolType: InvoiceDraftPaymentToolType;
  creditCardId: string;
  installmentCount: number;
  showInstallment: boolean;
};
type Message = { tone: "success" | "error" | "muted"; text: string };

function getBudgetItemLabel(item: InvoiceDraftBudgetItemLookup): string {
  return item.legacy_name ?? item.legacy_id ?? item.name ?? "";
}

function getCreditCardLabel(card: InvoiceDraftCreditCardLookup): string {
  return card.legacy_id ?? card.name;
}

export function ReviewClient() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [drafts, setDrafts] = useState<InvoiceDraftReviewItem[]>([]);
  const [budgetItems, setBudgetItems] = useState<InvoiceDraftBudgetItemLookup[]>([]);
  const [creditCards, setCreditCards] = useState<InvoiceDraftCreditCardLookup[]>([]);
  const [itemEdits, setItemEdits] = useState<Record<string, ItemEdit>>({});
  const [groupEdits, setGroupEdits] = useState<Record<string, GroupEdit>>({});
  const [selectedInvoiceNumbers, setSelectedInvoiceNumbers] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "登入 Supabase 後可審核待確認發票。" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const groups = useMemo(() => buildInvoiceDraftGroups(drafts), [drafts]);

  async function loadReviewData(accessToken: string, isCurrent = () => true, updateMessage = true) {
    const [taskRows, draftRows, budgetItemRows, creditCardRows] = await Promise.all([
      getSupabaseReviewTasks(accessToken),
      getSupabaseInvoiceDrafts(accessToken, 1000),
      fetchSupabaseRows<InvoiceDraftBudgetItemLookup>("budget_items", { select: "id,name,legacy_id,legacy_name", is_active: "eq.true", order: "legacy_code.asc" }, undefined, accessToken),
      fetchSupabaseRows<InvoiceDraftCreditCardLookup>("credit_cards", { select: "id,name,legacy_id", is_active: "eq.true", order: "name.asc" }, undefined, accessToken)
    ]);
    if (!isCurrent()) return;

    const nextGroups = buildInvoiceDraftGroups(draftRows);
    setTasks(taskRows);
    setDrafts(draftRows);
    setBudgetItems(budgetItemRows);
    setCreditCards(creditCardRows);
    setItemEdits(Object.fromEntries(draftRows.filter((draft) => draft.lineType === "item").map((draft) => [draft.id, { budgetItemId: draft.suggestedBudgetItemId, notes: draft.notes ?? "" }])));
    setGroupEdits(Object.fromEntries(nextGroups.map((group) => {
      const first = group.itemLines[0];
      return [group.invoiceNumber, {
        paymentToolType: first?.suggestedPaymentToolType ?? "cash",
        creditCardId: first?.suggestedCreditCardId ?? "",
        installmentCount: 1,
        showInstallment: false
      }];
    })));
    setSelectedInvoiceNumbers(nextGroups.map((group) => group.invoiceNumber));
    if (updateMessage) setMessage({ tone: "success", text: nextGroups.length > 0 ? `已載入 ${nextGroups.length} 張待確認發票。` : "目前沒有待確認發票。" });
    setState("ready");
  }

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);
    if (!session) { setState("signed-out"); return; }
    if (!isStoredSupabaseSessionValid(window.localStorage)) { setState("expired"); return; }
    let isCurrent = true;
    setState("loading");
    setError(null);
    loadReviewData(session.accessToken, () => isCurrent).catch((caughtError) => {
      if (!isCurrent) return;
      setError(caughtError instanceof Error ? caughtError.message : "讀取待審資料失敗。");
      setMessage({ tone: "error", text: "讀取待審資料失敗。" });
      setState("error");
    });
    return () => { isCurrent = false; };
  }, []);

  const selectedGroups = groups.filter((group) => selectedInvoiceNumbers.includes(group.invoiceNumber));
  const selectedTotal = selectedGroups.reduce((total, group) => total + group.paidTotal, 0);

  function updateItemEdit(draftId: string, patch: Partial<ItemEdit>) {
    setItemEdits((current) => ({ ...current, [draftId]: { ...current[draftId], ...patch } }));
  }

  function updateGroupEdit(invoiceNumber: string, patch: Partial<GroupEdit>) {
    setGroupEdits((current) => ({ ...current, [invoiceNumber]: { ...current[invoiceNumber], ...patch } }));
  }

  function toggleGroup(invoiceNumber: string, checked: boolean) {
    setSelectedInvoiceNumbers((current) => checked ? [...new Set([...current, invoiceNumber])] : current.filter((value) => value !== invoiceNumber));
  }

  async function postAction(accessToken: string, body: Record<string, unknown>) {
    const response = await fetch("/api/accounting/expense-entry", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "發票操作失敗。");
    return result;
  }

  async function confirmSelectedGroups() {
    const session = readStoredSupabaseSession(window.localStorage);
    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) { setMessage({ tone: "error", text: "Supabase session 已失效，請重新登入。" }); return; }
    if (selectedGroups.length === 0) { setMessage({ tone: "error", text: "請先勾選要確認的發票。" }); return; }

    const payloadGroups = selectedGroups.map((group) => {
      const edit = groupEdits[group.invoiceNumber];
      return {
        invoiceNumber: group.invoiceNumber,
        paymentToolType: edit?.paymentToolType ?? "cash",
        creditCardId: edit?.paymentToolType === "credit_card" ? edit.creditCardId : undefined,
        installmentCount: edit?.installmentCount ?? 1,
        lines: group.itemLines.map((line) => ({ draftId: line.id, budgetItemId: itemEdits[line.id]?.budgetItemId ?? "", notes: itemEdits[line.id]?.notes ?? "" }))
      };
    });

    setIsSubmitting(true);
    setMessage({ tone: "muted", text: "正在依發票群組寫入正式支出..." });
    try {
      const result = await postAction(session.accessToken, { action: "confirmInvoiceGroups", groups: payloadGroups });
      setMessage({ tone: "success", text: `已確認 ${result.confirmedGroups ?? 0} 張發票，建立 ${result.insertedExpenses ?? 0} 筆明細。` });
      await loadReviewData(session.accessToken, () => true, false);
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "確認發票失敗。" });
    } finally { setIsSubmitting(false); }
  }

  async function deleteSelectedGroups() {
    const session = readStoredSupabaseSession(window.localStorage);
    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) { setMessage({ tone: "error", text: "Supabase session 已失效，請重新登入。" }); return; }
    const draftIds = selectedGroups.flatMap((group) => group.lines.map((line) => line.id));
    if (draftIds.length === 0) { setMessage({ tone: "error", text: "請先勾選要刪除的發票。" }); return; }
    setIsSubmitting(true);
    try {
      const result = await postAction(session.accessToken, { action: "deleteInvoiceDrafts", draftIds });
      setMessage({ tone: "success", text: `已刪除 ${result.deletedDrafts ?? 0} 筆待確認明細。` });
      await loadReviewData(session.accessToken, () => true, false);
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "刪除發票失敗。" });
    } finally { setIsSubmitting(false); }
  }

  return (
    <>
      <PageHeader eyebrow="Review" title="待確認項目" description="依發票號碼審核品項與折扣；每個品項可使用不同預算項目。" />
      <div className={`data-source-pill data-source-${state}`}>{state === "ready" ? "Supabase 已連線" : state === "loading" ? "正在讀取 Supabase" : state === "expired" ? "Session 已失效，請重新登入" : "請先登入 Supabase"}</div>
      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <TaskWorkbench tasks={tasks} />

      <section className="surface section-block review-section">
        <div className="section-heading"><h2>發票草稿</h2><span>已選 {selectedGroups.length} 張 / {formatCurrency(selectedTotal)}</span></div>
        {groups.length === 0 && state === "ready" ? <div className="empty-state"><strong>目前沒有待確認發票</strong><p className="muted">新的財政部發票匯入後會出現在這裡。</p></div> : (
          <>
            <div className="review-actions">
              <label><input checked={groups.length > 0 && selectedInvoiceNumbers.length === groups.length} onChange={(event) => setSelectedInvoiceNumbers(event.target.checked ? groups.map((group) => group.invoiceNumber) : [])} type="checkbox" />全選</label>
              <button className="primary-action" disabled={isSubmitting || selectedGroups.length === 0} onClick={confirmSelectedGroups} type="button">確認選取發票</button>
              <button className="secondary-action" disabled={isSubmitting || selectedGroups.length === 0} onClick={deleteSelectedGroups} type="button">刪除選取發票</button>
            </div>
            <div className="table-scroll">
              <table className="data-table review-table">
                <thead><tr><th>選取</th><th>日期 / 發票</th><th>商家</th><th>品項</th><th>金額</th><th>預算項目</th><th>付款</th><th>備註</th></tr></thead>
                <tbody>
                  {groups.map((group) => {
                    const groupEdit = groupEdits[group.invoiceNumber] ?? { paymentToolType: "cash" as const, creditCardId: "", installmentCount: 1, showInstallment: false };
                    return <Fragment key={group.invoiceNumber}>
                      <tr className="invoice-review-summary">
                        <td><input checked={selectedInvoiceNumbers.includes(group.invoiceNumber)} onChange={(event) => toggleGroup(group.invoiceNumber, event.target.checked)} type="checkbox" /></td>
                        <td><strong>{group.consumptionDate}</strong><small>{group.invoiceNumber}</small></td>
                        <td><strong>{group.merchantName || "未填商家"}</strong></td>
                        <td>{group.itemLines.length} 項{group.discountLines.length > 0 ? ` / ${group.discountLines.length} 筆折扣` : ""}</td>
                        <td className="task-amount">{formatCurrency(group.paidTotal)}</td>
                        <td><span className="muted">逐項分類</span></td>
                        <td>
                          <div className="review-payment-controls">
                            <select value={groupEdit.paymentToolType} onChange={(event) => updateGroupEdit(group.invoiceNumber, { paymentToolType: event.target.value === "credit_card" ? "credit_card" : "cash", creditCardId: event.target.value === "credit_card" ? groupEdit.creditCardId : "", installmentCount: 1, showInstallment: false })}><option value="cash">現金</option><option value="credit_card">信用卡</option></select>
                            {groupEdit.paymentToolType === "credit_card" ? <select value={groupEdit.creditCardId} onChange={(event) => updateGroupEdit(group.invoiceNumber, { creditCardId: event.target.value })}><option value="">請選擇信用卡</option>{creditCards.map((card) => <option key={card.id} value={card.id}>{getCreditCardLabel(card)}</option>)}</select> : null}
                            {groupEdit.paymentToolType === "credit_card" && !groupEdit.showInstallment ? <button className="installment-toggle-btn" type="button" onClick={() => updateGroupEdit(group.invoiceNumber, { showInstallment: true })}>分期</button> : null}
                            {groupEdit.paymentToolType === "credit_card" && groupEdit.showInstallment ? <div className="installment-inline"><select value={groupEdit.installmentCount} onChange={(event) => updateGroupEdit(group.invoiceNumber, { installmentCount: Number(event.target.value) })}>{[3, 6, 12, 18, 24, 30, 36].map((count) => <option key={count} value={count}>{count} 期</option>)}</select><button className="installment-cancel-btn" type="button" onClick={() => updateGroupEdit(group.invoiceNumber, { showInstallment: false, installmentCount: 1 })}>×</button></div> : null}
                          </div>
                        </td>
                        <td>{group.discountTotal < 0 ? <span className="invoice-discount-row">折扣 {formatCurrency(group.discountTotal)}</span> : null}</td>
                      </tr>
                      {group.lines.map((draft) => {
                        const edit = itemEdits[draft.id] ?? { budgetItemId: draft.suggestedBudgetItemId, notes: draft.notes ?? "" };
                        return <tr key={draft.id} className={draft.lineType === "discount" ? "invoice-discount-row" : "invoice-review-line"}>
                          <td />
                          <td><small>第 {draft.sourceOrder} 列</small></td>
                          <td>{draft.merchantTaxId ? <small>{draft.merchantTaxId}</small> : null}</td>
                          <td>{draft.itemDescription}</td>
                          <td className="task-amount">{formatCurrency(draft.amount)}</td>
                          <td>{draft.lineType === "item" ? <select value={edit.budgetItemId} onChange={(event) => updateItemEdit(draft.id, { budgetItemId: event.target.value })}><option value="">請選擇</option>{budgetItems.map((item) => <option key={item.id} value={item.id}>{getBudgetItemLabel(item)}</option>)}</select> : <span>折扣列</span>}</td>
                          <td><span className="muted">沿用發票付款</span></td>
                          <td>{draft.lineType === "item" ? <input value={edit.notes} onChange={(event) => updateItemEdit(draft.id, { notes: event.target.value })} /> : <span className="muted">不另計預算</span>}</td>
                        </tr>;
                      })}
                    </Fragment>;
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