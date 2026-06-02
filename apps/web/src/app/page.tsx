import { AppShell } from "@/components/app-shell";
import { getAccountingDashboardData } from "@/lib/data/accounting-dashboard";
import { HomeDashboardClient } from "./home-dashboard-client";

export default async function HomePage() {
  const dashboardData = await getAccountingDashboardData();

  return (
    <AppShell>
      <HomeDashboardClient initialData={dashboardData} />
    </AppShell>
  );
}
