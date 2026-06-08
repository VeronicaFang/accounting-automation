import { formatCurrency } from "@/lib/format";
import type { ReviewTask } from "@/lib/types";

export function TaskWorkbench({ tasks }: { tasks: ReviewTask[] }) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>待處理</h2>
        <span>{tasks.length} 筆</span>
      </div>
      {tasks.length === 0 ? (
        <div className="empty-state">
          <strong>目前沒有待處理項目</strong>
          <p className="muted">沒有待確認發票、預算 mapping 或帳單差異。</p>
        </div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <article className="task-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
              </div>
              {task.amount ? <span className="task-amount">{formatCurrency(task.amount)}</span> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
