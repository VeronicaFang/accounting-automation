"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { isStoredSupabaseSessionValid, readStoredSupabaseSession } from "@/lib/auth/supabase-auth";
import { fetchSupabaseRows } from "@/lib/data/supabase-rest";
import { formatCurrency } from "@/lib/format";

type IncomeStatus = "estimated" | "received" | "corrected";
type LoadState = "signed-out" | "expired" | "loading" | "ready" | "error";

type IncomeRow = {
  id: string;
  income_date: string;
  income_month: string;
  income_item: string;
  income_amount: string | number;
  income_status: IncomeStatus;
  source: string | null;
  notes: string | null;
};

type IncomeForm = {
  incomeDate: string;
  incomeItem: string;
  incomeAmount: string;
  incomeStatus: IncomeStatus;
  source: string;
  notes: string;
};

type Message = {
  tone: "success" | "error" | "muted";
  text: string;
};

const statusLabels: Record<IncomeStatus, string> = {
  received: "已入帳",
  estimated: "預估",
  corrected: "修正"
};

const defaultIncome: IncomeForm = {
  incomeDate: "",
  incomeItem: "",
  incomeAmount: "",
  incomeStatus: "received",
  source: "",
  notes: ""
};

function rowToForm(row: IncomeRow): IncomeForm {
  return {
    incomeDate: row.income_date,
    incomeItem: row.income_item ?? "",
    incomeAmount: String(row.income_amount ?? ""),
    incomeStatus: row.income_status ?? "received",
    source: row.source ?? "",
    notes: row.notes ?? ""
  };
}

function getIncomeYear(row: IncomeRow): string {
  return (row.income_month || row.income_date || "").slice(0, 4);
}

function getStateText(state: LoadState, count: number): string {
  if (state === "ready") {
    return `已載入 ${count} 筆收入明細。`;
  }

  if (state === "loading") {
    return "正在讀取 Supabase 收入資料...";
  }

  if (state === "expired") {
    return "Session 已過期，請重新登入 Supabase。";
  }

  if (state === "error") {
    return "收入資料讀取失敗。";
  }

  return "請先登入 Supabase。";
}

export function IncomeEntryClient() {
  const [income, setIncome] = useState<IncomeForm>(defaultIncome);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [rowEdits, setRowEdits] = useState<Record<string, IncomeForm>>({});
  const [message, setMessage] = useState<Message>({ tone: "muted", text: "填寫收入後會同步更新現金流月份。" });
  const [loadState, setLoadState] = useState<LoadState>("signed-out");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyIncomeId, setBusyIncomeId] = useState<string | null>(null);
  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const yearlyTotals = useMemo(() => {
    const totals = new Map<string, { year: string; amount: number; count: number }>();

    incomeRows.forEach((row) => {
      const year = getIncomeYear(row);

      if (!year) {
        return;
      }

      const current = totals.get(year) ?? { year, amount: 0, count: 0 };
      current.amount += Number(row.income_amount || 0);
      current.count += 1;
      totals.set(year, current);
    });

    return Array.from(totals.values()).sort((a, b) => b.year.localeCompare(a.year));
  }, [incomeRows]);

  const filteredRows = useMemo(() => {
    return incomeRows.filter((row) => getIncomeYear(row) === selectedYear);
  }, [incomeRows, selectedYear]);

  async function loadIncomes(accessToken: string, isCurrent = () => true) {
    const rows = await fetchSupabaseRows<IncomeRow>(
      "income_schedules",
      {
        select: "id,income_date,income_month,income_item,income_amount,income_status,source,notes",
        order: "income_date.desc,id.desc",
        limit: "1000"
      },
      undefined,
      accessToken
    );

    if (!isCurrent()) {
      return;
    }

    setIncomeRows(rows);
    setRowEdits(Object.fromEntries(rows.map((row) => [row.id, rowToForm(row)])));
    setLoadState("ready");
  }

  function getSessionAccessToken(): string | null {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session || !isStoredSupabaseSessionValid(window.localStorage)) {
      setMessage({ tone: "error", text: "Supabase session 已過期，請重新登入。" });
      setLoadState(session ? "expired" : "signed-out");
      return null;
    }

    return session.accessToken;
  }

  async function postIncomeAction(action: string, body: Record<string, unknown>, accessToken: string) {
    const response = await fetch("/api/accounting/expense-entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...body })
    });
    const result = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "收入資料儲存失敗。");
    }

    return result;
  }

  async function refreshIncomes(accessToken: string) {
    setLoadState("loading");
    await loadIncomes(accessToken);
  }

  useEffect(() => {
    const session = readStoredSupabaseSession(window.localStorage);

    if (!session) {
      setLoadState("signed-out");
      return;
    }

    if (!isStoredSupabaseSessionValid(window.localStorage)) {
      setLoadState("expired");
      return;
    }

    let isCurrent = true;
    setLoadState("loading");
    setError(null);

    loadIncomes(session.accessToken, () => isCurrent).catch((caughtError) => {
      if (!isCurrent) {
        return;
      }

      setIncomeRows([]);
      setRowEdits({});
      setLoadState("error");
      setError(caughtError instanceof Error ? caughtError.message : "收入資料讀取失敗。");
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (yearlyTotals.length > 0 && !yearlyTotals.some((item) => item.year === selectedYear)) {
      setSelectedYear(yearlyTotals[0].year);
    }
  }, [selectedYear, yearlyTotals]);

  async function saveIncome() {
    const accessToken = getSessionAccessToken();

    if (!accessToken) {
      return;
    }

    setIsSubmitting(true);
    setMessage({ tone: "muted", text: "正在新增收入..." });

    try {
      const result = await postIncomeAction("singleIncome", income, accessToken);
      await refreshIncomes(accessToken);
      setSelectedYear(String(income.incomeDate || result.cashFlowMonth || currentYear).slice(0, 4));
      setMessage({ tone: "success", text: `已新增收入，並更新 ${result.cashFlowMonth ?? "對應月份"} 現金流。` });
      setIncome(defaultIncome);
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "收入資料儲存失敗。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateIncome(row: IncomeRow) {
    const accessToken = getSessionAccessToken();

    if (!accessToken) {
      return;
    }

    const edit = rowEdits[row.id];

    if (!edit) {
      setMessage({ tone: "error", text: "找不到這筆收入的編輯內容。" });
      return;
    }

    setBusyIncomeId(row.id);
    setMessage({ tone: "muted", text: "正在更新收入..." });

    try {
      const result = await postIncomeAction("updateIncome", { incomeId: row.id, ...edit }, accessToken);
      await refreshIncomes(accessToken);
      setSelectedYear(String(edit.incomeDate || result.cashFlowMonth || selectedYear).slice(0, 4));
      setMessage({ tone: "success", text: `已更新收入，並同步 ${result.cashFlowMonth ?? "對應月份"} 現金流。` });
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "收入資料更新失敗。" });
    } finally {
      setBusyIncomeId(null);
    }
  }

  async function deleteIncome(row: IncomeRow) {
    const accessToken = getSessionAccessToken();

    if (!accessToken) {
      return;
    }

    if (!window.confirm(`確定要刪除「${row.income_item}」這筆收入？`)) {
      return;
    }

    setBusyIncomeId(row.id);
    setMessage({ tone: "muted", text: "正在刪除收入..." });

    try {
      const result = await postIncomeAction("deleteIncome", { incomeId: row.id }, accessToken);
      await refreshIncomes(accessToken);
      setMessage({ tone: "success", text: `已刪除收入，並同步 ${result.cashFlowMonth ?? "對應月份"} 現金流。` });
    } catch (caughtError) {
      setMessage({ tone: "error", text: caughtError instanceof Error ? caughtError.message : "收入資料刪除失敗。" });
    } finally {
      setBusyIncomeId(null);
    }
  }

  function updateRowEdit(id: string, patch: Partial<IncomeForm>) {
    setRowEdits((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? defaultIncome),
        ...patch
      }
    }));
  }

  return (
    <>
      <PageHeader
        eyebrow="收入"
        title="收入管理"
        description="登錄薪資、獎金或其他收入，並同步更新現金流月份。"
      />

      <div className={`entry-message entry-message-${message.tone}`}>{message.text}</div>
      <div className={`data-source-pill data-source-${loadState}`}>{getStateText(loadState, incomeRows.length)}</div>
      {error ? <p className="error-text">{error}</p> : null}

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>新增收入</h2>
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
              onChange={(event) => setIncome({ ...income, incomeStatus: event.target.value as IncomeStatus })}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
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

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>年度總收入</h2>
          <span>{yearlyTotals.length} 個年度</span>
        </div>
        {yearlyTotals.length === 0 ? (
          <p className="muted">目前沒有收入資料。</p>
        ) : (
          <div className="income-summary-grid">
            {yearlyTotals.map((item) => (
              <button
                aria-pressed={selectedYear === item.year}
                className={`income-year-card ${selectedYear === item.year ? "income-year-card-active" : ""}`}
                key={item.year}
                onClick={() => setSelectedYear(item.year)}
                type="button"
              >
                <span>{item.year}</span>
                <strong>{formatCurrency(item.amount)}</strong>
                <small>{item.count} 筆收入</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="surface section-block entry-section">
        <div className="section-heading">
          <h2>{selectedYear} 收入明細</h2>
          <span>{filteredRows.length} 筆</span>
        </div>
        <div className="table-scroll">
          <table className="data-table income-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>收入項目</th>
                <th>金額</th>
                <th>狀態</th>
                <th>來源</th>
                <th>備註</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>這個年度目前沒有收入明細。</td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const edit = rowEdits[row.id] ?? rowToForm(row);
                  const isBusy = busyIncomeId === row.id;

                  return (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="date"
                          value={edit.incomeDate}
                          onChange={(event) => updateRowEdit(row.id, { incomeDate: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={edit.incomeItem}
                          onChange={(event) => updateRowEdit(row.id, { incomeItem: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          min="0"
                          step="1"
                          type="number"
                          value={edit.incomeAmount}
                          onChange={(event) => updateRowEdit(row.id, { incomeAmount: event.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={edit.incomeStatus}
                          onChange={(event) => updateRowEdit(row.id, { incomeStatus: event.target.value as IncomeStatus })}
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={edit.source}
                          onChange={(event) => updateRowEdit(row.id, { source: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={edit.notes}
                          onChange={(event) => updateRowEdit(row.id, { notes: event.target.value })}
                        />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="secondary-action" disabled={isBusy} onClick={() => updateIncome(row)} type="button">
                            儲存
                          </button>
                          <button
                            className="secondary-action danger-action"
                            disabled={isBusy}
                            onClick={() => deleteIncome(row)}
                            type="button"
                          >
                            刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
