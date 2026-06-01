import { AppShell } from "@/components/app-shell";
import { CashFlowTable } from "@/components/cash-flow-table";
import { PageHeader } from "@/components/page-header";
import { getAccountingDashboardData } from "@/lib/data/accounting-dashboard";

export default async function CashFlowPage() {
  const { cashFlowMonths } = await getAccountingDashboardData();

  return (
    <AppShell>
      <PageHeader
        eyebrow="現金流"
        title="月度現金流"
        description="信用卡付款優先採用真實帳單；尚未輸入真實帳單時採用帳單預估。"
      />
      <CashFlowTable months={cashFlowMonths} />
    </AppShell>
  );
}
