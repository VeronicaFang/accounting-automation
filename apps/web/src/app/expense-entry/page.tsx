import { AppShell } from "@/components/app-shell";

import { ExpenseEntryClient } from "./expense-entry-client";

export default function ExpenseEntryPage() {
  return (
    <AppShell>
      <ExpenseEntryClient />
    </AppShell>
  );
}
