"use client";

import { useEffect, useMemo, useState } from "react";

import { addMonths, monthKeyFromDateValue } from "@/lib/accounting/dashboard-filters";
import { getSupabaseExpensesByMonth } from "@/lib/data/supabase-repository";
import { formatCurrency } from "@/lib/format";
import type { ExpenseRecord } from "@/lib/types";

type Props = {
  accessToken: string | null;
};

function shortCategory(name: string): string {
  const match = name.match(/^\d+\.\s+(.+)$/);
  return match ? match[1] : name;
}

function paymentLabel(expense: ExpenseRecord): string {
  return expense.paymentToolType === "credit_card"
    ? (expense.creditCardName ?? "信用卡")
    : "現金";
}

export function RecentExpensesFeed({ accessToken }: Props) {
  const currentMonth = monthKeyFromDateValue();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeChip, setActiveChip] = useState("全部");

  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    setLoading(true);

    getSupabaseExpensesByMonth(selectedMonth, accessToken)
      .then((rows) => { if (alive) setExpenses(rows); })
      .catch(() => { if (alive) setExpenses([]); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [accessToken, selectedMonth]);

  const chips = useMemo(() => {
    const cats = [...new Set(expenses.map((e) => shortCategory(e.budgetItemName)).filter(Boolean))];
    return ["全部", ...cats.slice(0, 8)];
  }, [expenses]);

  const visible = useMemo(
    () =>
      activeChip === "全部"
        ? expenses
        : expenses.filter((e) => shortCategory(e.budgetItemName) === activeChip),
    [expenses, activeChip]
  );

  function changeMonth(delta: number) {
    setSelectedMonth((m) => addMonths(m, delta));
    setActiveChip("全部");
  }

  return (
    <section className="surface section-block recent-feed">
      <div className="recent-feed-header">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <h2>最近消費</h2>
          <span>{loading ? "…" : `${visible.length} 筆`}</span>
        </div>
        <div className="month-picker">
          <button className="month-arrow" type="button" onClick={() => changeMonth(-1)}>
            ‹
          </button>
          <span className="month-label">{selectedMonth}</span>
          <button
            className="month-arrow"
            type="button"
            onClick={() => changeMonth(1)}
            disabled={selectedMonth >= currentMonth}
          >
            ›
          </button>
        </div>
      </div>

      <div className="chip-row">
        {chips.map((chip) => (
          <button
            key={chip}
            className={`category-chip${activeChip === chip ? " chip-active" : ""}`}
            onClick={() => setActiveChip(chip)}
            type="button"
          >
            {chip}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted feed-empty">載入中...</p>
      ) : visible.length === 0 ? (
        <p className="muted feed-empty">本月沒有消費記錄。</p>
      ) : (
        <div className="expense-feed-list">
          {visible.map((expense) => (
            <div key={expense.id} className="expense-feed-row">
              <span className="feed-date">{expense.consumptionDate.slice(5)}</span>
              <div className="feed-main">
                <span className="feed-merchant">{expense.merchantName || expense.itemDescription}</span>
                {expense.merchantName ? (
                  <span className="feed-item">{expense.itemDescription}</span>
                ) : null}
              </div>
              <span className="feed-chip">{shortCategory(expense.budgetItemName)}</span>
              <span className="feed-payment">{paymentLabel(expense)}</span>
              <span className="feed-amount">{formatCurrency(expense.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
