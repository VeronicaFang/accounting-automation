import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TaskWorkbench } from "@/components/task-workbench";
import { reviewTasks } from "@/lib/mock-data";

export default function ReviewPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="待確認"
        title="審核中心"
        description="發票、手動匯入、預算 mapping、帳單差異都先進入這裡人工確認。"
      />
      <TaskWorkbench tasks={reviewTasks} />
    </AppShell>
  );
}
