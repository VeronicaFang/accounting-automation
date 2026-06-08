import { AppShell } from "@/components/app-shell";

import { BillsClient } from "./bills-client";

export default function BillsPage() {
  return (
    <AppShell>
      <BillsClient />
    </AppShell>
  );
}
