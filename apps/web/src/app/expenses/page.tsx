import { AppShell } from "@/components/app-shell";

import { ExpensesClient } from "./expenses-client";

export default function ExpensesPage() {
  return (
    <AppShell>
      <ExpensesClient />
    </AppShell>
  );
}
