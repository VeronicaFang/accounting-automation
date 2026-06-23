import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";

import { ExpensesClient } from "./expenses-client";

export default function ExpensesPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="muted">正在載入消費明細...</p>}>
        <ExpensesClient />
      </Suspense>
    </AppShell>
  );
}
