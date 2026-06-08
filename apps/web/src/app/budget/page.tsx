import { AppShell } from "@/components/app-shell";

import { BudgetClient } from "./budget-client";

export default function BudgetPage() {
  return (
    <AppShell>
      <BudgetClient />
    </AppShell>
  );
}
