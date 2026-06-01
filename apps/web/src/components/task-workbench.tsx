import { formatCurrency } from "@/lib/format";
import type { ReviewTask } from "@/lib/types";

export function TaskWorkbench({ tasks }: { tasks: ReviewTask[] }) {
  return (
    <section className="surface section-block">
      <div className="section-heading">
        <h2>待處理</h2>
        <span>{tasks.length} 件</span>
      </div>
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
    </section>
  );
}
