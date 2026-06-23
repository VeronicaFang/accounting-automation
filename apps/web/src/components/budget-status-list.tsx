import Link from "next/link";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

export function BudgetStatusList({ items }: { items: BudgetStatus[] }) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>預算使用狀態</h2>
        <span>{items.length} 筆</span>
      </div>
      <div className="budget-list">
        {items.map((item) => (
          <article className={`budget-row severity-${item.severity}`} key={`${item.groupName}-${item.itemName}`}>
            <div>
              <span>{item.groupName}</span>
              <Link className="table-link" href={`/expenses?budget=${encodeURIComponent(item.itemName)}`}><strong>{item.itemName}</strong></Link>
            </div>
            <div className="budget-numbers">
              <span>{formatPercent(item.usageRatio)}</span>
              <small>剩餘 {formatCurrency(item.remainingAmount)}</small>
            </div>
          </article>
        ))}
        {items.length === 0 ? <p className="muted">目前沒有可顯示的預算項目。</p> : null}
      </div>
    </section>
  );
}
