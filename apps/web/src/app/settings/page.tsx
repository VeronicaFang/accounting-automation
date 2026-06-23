import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="設定"
        title="系統設定"
        description="信用卡結算規則、結帳日與繳款日設定。"
      />
      <SettingsClient />
    </AppShell>
  );
}
