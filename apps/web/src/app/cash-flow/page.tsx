import { AppShell } from "@/components/app-shell";
import { CashFlowClient } from "./cash-flow-client";
import { getAccountingDashboardData } from "@/lib/data/accounting-dashboard";

export default async function CashFlowPage() {
  const initialData = await getAccountingDashboardData();

  return (
    <AppShell>
      <CashFlowClient initialData={initialData} />
    </AppShell>
  );
}
