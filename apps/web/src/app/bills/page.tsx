import { AppShell } from "@/components/app-shell";
import { BillEstimateTable } from "@/components/bill-estimate-table";
import { DetailDrawer } from "@/components/detail-drawer";
import { PageHeader } from "@/components/page-header";
import { getAccountingDashboardData } from "@/lib/data/accounting-dashboard";

export default async function BillsPage() {
  const { billEstimates } = await getAccountingDashboardData();

  return (
    <AppShell>
      <PageHeader
        eyebrow="帳單中心"
        title="每月信用卡帳單"
        description="先看每月帳單預估；只有金額怪怪的時候才進到付款排程明細。"
      />
      <div className="grid-two">
        <BillEstimateTable bills={billEstimates} />
        <DetailDrawer title="帳單明細入口">
          <p className="muted">
            付款排程是底層資料。這個區塊未來顯示選定帳單的來源消費、分期、修正紀錄與狀態更新。
          </p>
        </DetailDrawer>
      </div>
    </AppShell>
  );
}
