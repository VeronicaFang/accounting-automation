import Link from "next/link";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

type BudgetStatusListProps = {
  items: BudgetStatus[];
  budgetEdits?: Record<string, string>;
  editingId?: string | null;
  savingId?: string | null;
  onEditStart?: (id: string) => void;
  onEditCancel?: () => void;
  onEditChange?: (id: string, value: string) => void;
  onEditSave?: (item: BudgetStatus) => void;
};

export function BudgetStatusList({
  items,
  budgetEdits = {},
  editingId = null,
  savingId = null,
  onEditStart,
  onEditCancel,
  onEditChange,
  onEditSave
}: BudgetStatusListProps) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>預算使用狀態</h2>
        <span>{items.length} 筆</span>
      </div>
      <div className="budget-list">
        {items.map((item) => {
          const isEditing = editingId === item.id;
          const isSaving = savingId === item.id;

          return (
            <article className={`budget-row severity-${item.severity}`} key={item.id}>
              <div>
                <span>{item.groupName}</span>
                <Link className="table-link" href={`/expenses?budget=${encodeURIComponent(item.itemName)}`}>
                  <strong>{item.itemName}</strong>
                </Link>
              </div>
              <div className="budget-numbers">
                {isEditing ? (
                  <div className="budget-edit-row">
                    <input
                      className="budget-amount-input"
                      type="number"
                      min="0"
                      value={budgetEdits[item.id] ?? ""}
                      onChange={(e) => onEditChange?.(item.id, e.target.value)}
                      disabled={isSaving}
                    />
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={isSaving}
                      onClick={() => onEditSave?.(item)}
                    >
                      {isSaving ? "儲存中…" : "儲存"}
                    </button>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={isSaving}
                      onClick={() => onEditCancel?.()}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <span>{formatPercent(item.usageRatio)}</span>
                    <small>
                      年度 {formatCurrency(item.annualBudget)}　剩餘 {formatCurrency(item.remainingAmount)}
                      {onEditStart ? (
                        <button
                          className="budget-edit-btn"
                          type="button"
                          title="編輯年度預算"
                          onClick={() => onEditStart(item.id)}
                        >
                          ✏️
                        </button>
                      ) : null}
                    </small>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {items.length === 0 ? <p className="muted">目前沒有可顯示的預算項目。</p> : null}
      </div>
    </section>
  );
}
