import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

export function BudgetStatusList({ items }: { items: BudgetStatus[] }) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>預算狀態</h2>
        <span>依風險排序</span>
      </div>
      <div className="budget-list">
        {items.map((item) => (
          <article className={`budget-row severity-${item.severity}`} key={`${item.groupName}-${item.itemName}`}>
            <div>
              <span>{item.groupName}</span>
              <strong>{item.itemName}</strong>
            </div>
            <div className="budget-numbers">
              <span>{formatPercent(item.usageRatio)}</span>
              <small>剩餘 {formatCurrency(item.remainingAmount)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
