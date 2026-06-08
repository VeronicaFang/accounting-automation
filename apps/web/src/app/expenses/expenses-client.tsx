"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { getSupabaseExpenses } from "@/lib/data/supabase-repository";
import { formatCurrency } from "@/lib/format";
import type { ExpenseRecord } from "@/lib/types";

type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

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
  const [state, setState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);

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

    getSupabaseExpenses(session.accessToken, 200)
      .then((rows) => {
        if (!isCurrent) {
          return;
        }

        setExpenses(rows);
        setState("ready");
      })
      .catch((caughtError) => {
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

  return (
    <>
      <PageHeader
        eyebrow="消費明細"
        title="已記錄消費"
        description="顯示目前登入帳號可讀取的 Supabase 消費資料，預設列出最近 200 筆。"
      />
      <div className={`data-source-pill data-source-${state}`}>{getStateText(state, expenses.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <section className="surface section-block">
        <div className="section-heading">
          <h2>消費列表</h2>
          <span>最近 200 筆</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>消費日</th>
                <th>預算月</th>
                <th>店家</th>
                <th>品項</th>
                <th>預算項目</th>
                <th>支付</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.consumptionDate}</td>
                  <td>{expense.budgetMonth}</td>
                  <td>{expense.merchantName || "未填"}</td>
                  <td>{expense.itemDescription}</td>
                  <td>{expense.budgetItemName}</td>
                  <td>{paymentLabel(expense)}</td>
                  <td className={expense.amount < 0 ? "text-good" : ""}>{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
              {state === "ready" && expenses.length === 0 ? (
                <tr>
                  <td colSpan={7}>目前沒有可顯示的消費明細。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
