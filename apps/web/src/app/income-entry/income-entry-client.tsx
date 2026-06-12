"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

const defaultIncome = {
  incomeDate: "",
  incomeItem: "",
  incomeAmount: "",
  incomeStatus: "received",
  source: "",
  notes: ""
};

export function IncomeEntryClient() {
  const [income, setIncome] = useState(defaultIncome);
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "填寫收入後會同步更新現金流月份。" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function saveIncome() {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已過期，請重新登入。" });
      return;
    }

    setIsSubmitting(true);
    setMessage({ tone: "muted", text: "正在寫入收入..." });

    try {
      const response = await fetch("/api/accounting/expense-entry", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "singleIncome", ...income })
      });
      const result = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "收入寫入失敗。");
      }

      setMessage({
        tone: "success",
        text: `已新增 ${result.insertedIncomes ?? 0} 筆收入，並更新 ${result.cashFlowMonth ?? ""} 現金流。`
      });
      setIncome(defaultIncome);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "收入寫入失敗。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="收入"
        title="新增收入"
        description="登錄薪資、獎金或其他收入，並同步更新現金流月份。"
      />

      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>收入資料</h2>
          <span>收入日期會決定現金流月份</span>
        </div>
        <div className="entry-form-grid">
          <label>
            收入日期
            <input
              type="date"
              value={income.incomeDate}
              onChange={(event) => setIncome({ ...income, incomeDate: event.target.value })}
            />
          </label>
          <label>
            收入項目
            <input
              placeholder="薪資 / 獎金 / 其他收入"
              value={income.incomeItem}
              onChange={(event) => setIncome({ ...income, incomeItem: event.target.value })}
            />
          </label>
          <label>
            金額
            <input
              min="0"
              step="1"
              type="number"
              value={income.incomeAmount}
              onChange={(event) => setIncome({ ...income, incomeAmount: event.target.value })}
            />
          </label>
          <label>
            狀態
            <select
              value={income.incomeStatus}
              onChange={(event) => setIncome({ ...income, incomeStatus: event.target.value })}
            >
              <option value="received">已入帳</option>
              <option value="estimated">預估</option>
              <option value="corrected">修正</option>
            </select>
          </label>
          <label>
            來源
            <input
              placeholder="公司 / 銀行 / 手動登錄"
              value={income.source}
              onChange={(event) => setIncome({ ...income, source: event.target.value })}
            />
          </label>
          <label>
            備註
            <input value={income.notes} onChange={(event) => setIncome({ ...income, notes: event.target.value })} />
          </label>
        </div>
        <button className="primary-action" disabled={isSubmitting} onClick={saveIncome} type="button">
          新增收入
        </button>
      </section>
    </>
  );
}
