import { AppShell } from "@/components/app-shell";
import { BudgetStatusList } from "@/components/budget-status-list";
import { PageHeader } from "@/components/page-header";
import { budgetStatuses, currentMonth } from "@/lib/mock-data";

export default function BudgetPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="預算"
        title="預算查詢總覽"
        description={`預設查 ${currentMonth}，排序依超支、警示、提醒、正常，再依使用比例。`}
      />
      <BudgetStatusList items={budgetStatuses} />
    </AppShell>
  );
}
