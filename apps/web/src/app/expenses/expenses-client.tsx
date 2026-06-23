"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { getSupabaseExpenses } from "@/lib/data/supabase-repository";
import { formatCurrency } from "@/lib/format";
import type { ExpenseRecord } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

function paymentLabel(expense: ExpenseRecord): string {
  if (expense.paymentToolType === "credit_card") {
    return `信用卡 ${expense.creditCardName ?? ""}`.trim();
  }

  return "現金";
}

function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `已連線 Supabase，顯示 ${count} 筆消費明細`;
  }

  if (state === "loading") {
    return "正在讀取 Supabase";
  }

  if (state === "expired") {
    return "Session 已過期，請重新登入";
  }

  if (state === "error") {
    return "Supabase 讀取失敗";
  }

  return "請先登入 Supabase";
}

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [itemEdits, setItemEdits] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "可直接修正品項，或刪除錯誤與重複消費。" });
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);

  async function loadExpenses(accessToken: string, isCurrent = () => true) {
    const rows = await getSupabaseExpenses(accessToken, 200);

    if (!isCurrent()) {
      return;
    }

    setExpenses(rows);
    setItemEdits(Object.fromEntries(rows.map((expense) => [expense.id, expense.itemDescription])));
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

    loadExpenses(session.accessToken, () => isCurrent).catch((caughtError) => {
      if (!isCurrent) {
        return;
      }

      setExpenses([]);
      setError(caughtError instanceof Error ? caughtError.message : "Supabase 讀取失敗");
      setState("error");
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function submitExpenseAction(action: string, body: Record<string, unknown>) {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已過期，請重新登入。" });
      return null;
    }

    const response = await fetch("/api/accounting/expense-entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...body })
    });
    const result = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "消費明細更新失敗。");
    }

    await loadExpenses(session.accessToken);
    return result;
  }

  async function saveItemDescription(expense: ExpenseRecord) {
    const itemDescription = String(itemEdits[expense.id] ?? "").trim();

    if (!itemDescription) {
      setMessage({ tone: "error", text: "品項不可空白。" });
      return;
    }

    setBusyExpenseId(expense.id);
    setMessage({ tone: "muted", text: "正在更新品項..." });

    try {
      await submitExpenseAction("updateExpenseItemDescription", { expenseId: expense.id, itemDescription });
      setMessage({ tone: "success", text: "品項已更新。" });
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "品項更新失敗。" });
    } finally {
      setBusyExpenseId(null);
    }
  }

  async function deleteExpense(expense: ExpenseRecord) {
    if (!window.confirm(`刪除這筆消費？\n${expense.consumptionDate} ${expense.merchantName} ${expense.itemDescription}`)) {
      return;
    }

    setBusyExpenseId(expense.id);
    setMessage({ tone: "muted", text: "正在刪除消費並更新現金流..." });

    try {
      const result = await submitExpenseAction("deleteExpenses", { expenseIds: [expense.id] });
      setMessage({ tone: "success", text: `已刪除 ${result?.deletedExpenses ?? 0} 筆消費。` });
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "刪除消費失敗。" });
    } finally {
      setBusyExpenseId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="消費明細"
        title="已記錄消費"
        description="顯示目前登入帳號可讀取的 Supabase 消費資料，預設列出最近 200 筆。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, expenses.length)}</div>
      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <section className="surface section-block">
        <div className="section-heading">
          <h2>消費列表</h2>
          <span>最近 200 筆</span>
        </div>
        <div className="table-scroll">
          <table className="data-table expenses-table">
            <thead>
              <tr>
                <th>消費日</th>
                <th>預算月</th>
                <th>店家</th>
                <th>品項</th>
                <th>預算項目</th>
                <th>支付</th>
                <th>金額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const isBusy = busyExpenseId === expense.id;
                const itemValue = itemEdits[expense.id] ?? expense.itemDescription;
                const isChanged = itemValue.trim() !== expense.itemDescription;

                return (
                  <tr key={expense.id}>
                    <td>{expense.consumptionDate}</td>
                    <td>{expense.budgetMonth}</td>
                    <td>{expense.merchantName || "未填"}</td>
                    <td>
                      <input
                        className="expense-item-input"
                        value={itemValue}
                        onChange={(event) => setItemEdits((current) => ({ ...current, [expense.id]: event.target.value }))}
                      />
                    </td>
                    <td>{expense.budgetItemName}</td>
                    <td>{paymentLabel(expense)}</td>
                    <td className={expense.amount < 0 ? "text-good" : ""}>{formatCurrency(expense.amount)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="secondary-action" disabled={isBusy || !isChanged} onClick={() => saveItemDescription(expense)} type="button">
                          儲存
                        </button>
                        <button className="secondary-action danger-action" disabled={isBusy} onClick={() => deleteExpense(expense)} type="button">
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {state === "ready" && expenses.length === 0 ? (
                <tr>
                  <td colSpan={8}>目前沒有可顯示的消費明細。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}