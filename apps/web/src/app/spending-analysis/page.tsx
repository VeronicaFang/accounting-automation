import { AppShell } from "@/components/app-shell";

import { SpendingAnalysisClient } from "./spending-analysis-client";

export default function SpendingAnalysisPage() {
  return (
    <AppShell>
      <SpendingAnalysisClient />
    </AppShell>
  );
}
